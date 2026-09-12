'use strict';

/**
 * ORCHESTRATOR — validates the Trip Brief, fans out to the 3 specialist
 * agents in parallel, validates with the Budget Agent (deterministic),
 * optimizes if over budget, then builds the day-by-day itinerary.
 *
 * Interview story: "user chat → structured brief → orchestrator delegates to
 * transport/stay/activity agents → budget agent validates + optimizes →
 * orchestrator produces the personalized itinerary."
 */

const { classifyTrip, estimateDistanceKm } = require('./locations');
const transportAgent = require('./agents/transportAgent');
const stayAgent = require('./agents/stayAgent');
const activityAgent = require('./agents/activityAgent');
const budgetAgent = require('./agents/budgetAgent');

function validateBrief(b) {
  const missing = [];
  if (!b.origin) missing.push('origin');
  if (!b.destination) missing.push('destination');
  if (!b.budget || !(b.budget > 0)) missing.push('budget');
  if (!b.days || !(b.days >= 1 && b.days <= 30)) missing.push('days');
  if (!b.travelers || !(b.travelers >= 1 && b.travelers <= 20)) missing.push('travelers');
  if (!b.travelStyle) missing.push('travelStyle');
  if (missing.length) {
    const err = new Error(`Missing: ${missing.join(', ')}`);
    err.code = 'MISSING_BRIEF';
    err.missing = missing;
    throw err;
  }
}

function buildDays({ days, origin, destination, transport, activities, tripType, dayThemes }) {
  const acts = [...activities];
  const take = () => acts.shift();
  const plan = [];
  const themeFor = (d, fallback) => (dayThemes && dayThemes[d - 1]) || fallback;
  for (let d = 1; d <= days; d++) {
    const slots = [];
    if (d === 1) {
      slots.push({ time: '06:00', title: `Depart from ${origin}`, tag: transport ? transport.name : 'Travel' });
      slots.push({ time: '14:00', title: `Arrive in ${destination}`, tag: 'Arrival' });
      if (tripType !== 'Local') slots.push({ time: '15:00', title: 'Check in & rest', tag: 'Stay' });
      const a = take();
      if (a) slots.push({ time: '17:00', title: a.name, tag: a.kind });
      slots.push({ time: '19:00', title: 'Sunset + local dinner', tag: 'Food' });
    } else if (d === days) {
      slots.push({ time: '08:00', title: 'Breakfast & check out', tag: 'Food' });
      const a = take();
      if (a) slots.push({ time: '10:00', title: a.name, tag: a.kind });
      else slots.push({ time: '10:00', title: 'Local exploration & souvenirs', tag: 'Leisure' });
      slots.push({ time: '13:00', title: 'Lunch', tag: 'Food' });
      slots.push({ time: '15:00', title: `Depart for ${origin}`, tag: 'Return' });
    } else {
      slots.push({ time: '08:00', title: 'Breakfast', tag: 'Food' });
      const a1 = take();
      if (a1) slots.push({ time: '10:00', title: a1.name, tag: a1.kind });
      slots.push({ time: '13:00', title: 'Lunch', tag: 'Food' });
      const a2 = take();
      if (a2) slots.push({ time: '15:00', title: a2.name, tag: a2.kind });
      else slots.push({ time: '15:00', title: 'Explore at leisure', tag: 'Leisure' });
      slots.push({ time: '19:00', title: 'Sunset + dinner', tag: 'Food' });
    }
    plan.push({
      day: d,
      title: themeFor(d, d === 1 ? (days === 1 ? 'Explore + Return' : 'Travel + First evening') : d === days ? 'Food + Return' : 'Explore + Experiences'),
      slots,
    });
  }
  return plan;
}

async function planTrip(brief) {
  validateBrief(brief);
  const tripType = classifyTrip(brief.origin, brief.destination);
  const distanceKm = estimateDistanceKm(brief.origin, brief.destination, tripType);
  const nights = tripType === 'Local' || brief.days <= 1 ? 0 : brief.days - 1;

  const input = {
    origin: brief.origin,
    destination: brief.destination,
    distanceKm,
    tripType,
    travelers: brief.travelers,
    budget: brief.budget,
    travelStyle: brief.travelStyle,
    interests: brief.interests || [],
    transportPreference: brief.transportPreference || null,
    nights,
    days: brief.days,
  };

  // Fan-out to specialists in parallel (the multi-agent core).
  const [transportRes, stayRes, activityRes] = await Promise.all([
    Promise.resolve(transportAgent.run(input)),
    Promise.resolve(stayAgent.run(input)),
    Promise.resolve(activityAgent.run(input)),
  ]);

  let transport = transportRes.pick;
  let stay = stayRes.pick;
  let activities = activityRes.options;

  // Real-AI reasoning: when an LLM key is configured, the model chooses among
  // the shortlisted candidates and writes personalization. Prices/durations
  // always stay with the deterministic estimates; the model only selects and
  // narrates. Falls back silently to heuristic picks.
  let aiReasoning = false;
  let aiNotes = [];
  let dayThemes = null;
  try {
    const decision = await reasonWithLLM(input, transportRes, stayRes, activityRes);
    if (decision) {
      aiReasoning = true;
      transport = decision.transport;
      stay = decision.stay;
      activities = decision.activities;
      aiNotes = decision.notes;
      dayThemes = decision.dayThemes;
    }
  } catch {
    /* deterministic picks stand */
  }

  const first = budgetAgent.calculate({
    transport, stay, activities,
    days: brief.days, travelers: brief.travelers,
    travelStyle: brief.travelStyle, tripType,
  });

  let steps = [];
  let optimized = false;
  let impossible = null;
  let finalStyle = brief.travelStyle;
  let breakdown = first;

  if (first.total > brief.budget) {
    const res = budgetAgent.optimize({
      transport, stay, activities,
      transportOptions: transportRes.options,
      stayOptions: stayRes.options,
      days: brief.days, travelers: brief.travelers,
      travelStyle: brief.travelStyle, tripType, budget: brief.budget,
    });
    transport = res.transport;
    stay = res.stay;
    activities = res.activities;
    finalStyle = res.style;
    breakdown = res.breakdown;
    steps = res.steps;
    optimized = res.optimized;
    impossible = res.impossible;
  }

  const remaining = brief.budget - breakdown.total;
  const status = breakdown.total <= brief.budget ? 'within-budget' : 'over-budget';
  const dailyPlan = buildDays({ days: brief.days, origin: brief.origin, destination: brief.destination, transport, activities, tripType, dayThemes });

  const trace = [
    { agent: 'transportation', candidates: transportRes.options.length, latencyMs: transportRes.latencyMs, notes: transportRes.notes + (aiReasoning ? ' (AI-selected)' : '') },
    { agent: 'accommodation', candidates: stayRes.options.length, latencyMs: stayRes.latencyMs, notes: stayRes.notes + (aiReasoning ? ' (AI-selected)' : '') },
    { agent: 'activity', candidates: activityRes.options.length, latencyMs: activityRes.latencyMs, notes: activityRes.notes + (aiReasoning ? ' (AI-selected)' : '') },
    { agent: 'budget', candidates: 1, latencyMs: 0, notes: optimized ? `Optimized with ${steps.length} swap(s).` : status === 'within-budget' ? 'Within budget — no optimization needed.' : 'Over budget — see alternatives.' },
  ];

  const personalizationNotes = aiNotes.length ? aiNotes : [
    `${brief.travelStyle} pace for ${brief.travelers} traveler${brief.travelers > 1 ? 's' : ''} · interests: ${(brief.interests || []).join(', ') || 'general sightseeing'}`,
    `${transport.name}: ${transport.recommendation}.`,
    stay ? `${stay.kind}: ${stay.note}.` : 'No overnight stay needed.',
  ];

  return {
    type: 'itinerary',
    brief: { ...brief, tripType, distanceKm, nights },
    tripType,
    distanceKm,
    aiReasoning,
    transport: { ...transportRes, pick: transport },
    stay: { ...stayRes, pick: stay },
    activities: activityRes.options.map((a) => ({ ...a, chosen: activities.includes(a) || activities.some((x) => x.name === a.name) })),
    chosenActivities: activities,
    costs: breakdown,
    budget: { limit: brief.budget, total: breakdown.total, remaining, status },
    optimized,
    optimizationSteps: steps,
    impossible,
    dailyPlan,
    trace,
    personalizationNotes,
    international: tripType === 'International' ? internationalNotes(brief.destination) : null,
    demoNote: 'Estimated / Demo Data — illustrative prices, not live fares.',
  };
}

/**
 * LLM agent reasoning. The model sees the real shortlisted candidates and
 * picks winners + writes personalization. Every choice is validated against
 * the deterministic options — unknown modes/kinds/names are discarded, and
 * prices/durations always come from the estimates, never the model.
 */
async function reasonWithLLM(input, transportRes, stayRes, activityRes) {
  const llm = require('./llm');
  if (!llm.isEnabled()) return null;

  const slim = {
    brief: {
      origin: input.origin, destination: input.destination, days: input.days,
      travelers: input.travelers, budget: input.budget, travelStyle: input.travelStyle,
      interests: input.interests, transportPreference: input.transportPreference,
      tripType: input.tripType, distanceKm: input.distanceKm,
    },
    transportOptions: transportRes.options.map((o) => ({ mode: o.mode, name: o.name, cost: o.cost, duration: o.duration })),
    stayOptions: (stayRes.options || []).map((o) => ({ kind: o.kind, cost: o.cost, nights: o.nights, rating: o.rating })),
    activityOptions: activityRes.options.map((o) => ({ name: o.name, cost: o.cost, kind: o.kind })),
  };

  const out = await llm.completeJSON({
    system: [
      'You are TripMinds\' expert travel team. Given a trip brief and SHORTLISTED',
      'options with estimated costs, pick the best combination and personalize it.',
      'Rules: transportMode must be exactly one of the listed modes; stayKind must',
      'be exactly one of the listed kinds (or null when stayOptions is empty);',
      'activityNames must be a subset of the listed names, max 2 per day, and must',
      'include at least 2 Free/zero-cost experiences for budget realism.',
      'dayThemes must be exactly <days> short day titles. Reasons max 20 words each.',
      'Never invent options, prices or durations — only choose and narrate.',
      'Return JSON only: {"transportMode","stayKind","activityNames":[],"reasons":',
      '{"transport":"","stay":""},"dayThemes":[],"notes":[]}.',
    ].join(' '),
    user: JSON.stringify(slim),
    maxTokens: 700,
  });
  if (!out || typeof out !== 'object') return null;

  const transport = transportRes.options.find((o) => o.mode === out.transportMode) || transportRes.pick;
  if (typeof out.reasons?.transport === 'string' && out.reasons.transport.trim()) {
    transport.recommendation = out.reasons.transport.trim().slice(0, 140);
  }
  let stay = stayRes.pick;
  if (!stayRes.options.length || out.stayKind == null) {
    stay = null;
  } else {
    stay = stayRes.options.find((o) => o.kind === out.stayKind) || stayRes.pick;
    if (typeof out.reasons?.stay === 'string' && out.reasons.stay.trim()) {
      stay.note = out.reasons.stay.trim().slice(0, 140);
    }
  }
  let activities = activityRes.options;
  if (Array.isArray(out.activityNames) && out.activityNames.length >= 2) {
    const known = out.activityNames.filter((n) => activityRes.options.some((a) => a.name === n));
    const capped = known.slice(0, Math.max(2, Math.min(9, input.days * 2)));
    if (capped.length >= 2) {
      activities = capped.map((n) => activityRes.options.find((a) => a.name === n));
      if (!activities.some((a) => a.cost === 0)) {
        const free = activityRes.options.find((a) => a.cost === 0 && !activities.includes(a));
        if (free) activities[activities.length - 1] = free;
      }
    }
  }
  let dayThemes = null;
  if (Array.isArray(out.dayThemes) && out.dayThemes.length === input.days && out.dayThemes.every((s) => typeof s === 'string' && s.trim())) {
    dayThemes = out.dayThemes.map((s) => s.trim().slice(0, 60));
  }
  const notes = Array.isArray(out.notes)
    ? out.notes.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 200)).slice(0, 4)
    : [];
  return { transport, stay, activities, dayThemes, notes };
}

function internationalNotes(destination) {
  return {
    currency: `Prices shown in INR for planning. Pay in local currency in ${destination} — check your bank's FX rate before you go (indicative only, not a live rate).`,
    visa: `Visa/entry rules change often and depend on your passport. Check the official embassy/consulate site for ${destination} before booking — TripMinds V1 does not provide visa advice.`,
    transport: 'International legs are flight-first; local trains/buses are estimated after arrival.',
  };
}

/** Apply a targeted change ("no bus", cheaper, comfort...) and re-budget. */
async function refine(plan, instruction, briefOverride) {
  const brief = { ...(plan.brief || {}), ...(briefOverride || {}) };
  const t = String(instruction || '').toLowerCase();
  if (/no bus|avoid bus|not.*bus/.test(t)) {
    brief.transportPreference = 'train';
  } else if (/no flight|avoid flight|no fly/.test(t)) {
    brief.transportPreference = 'train';
  } else if (/flight|fly/.test(t) && /want|prefer|only/.test(t)) {
    brief.transportPreference = 'flight';
  } else if (/cheaper|budget|save/.test(t)) {
    brief.travelStyle = 'Budget';
  } else if (/comfort|luxury|upgrade/.test(t)) {
    brief.travelStyle = /luxury/.test(t) ? 'Luxury' : 'Comfort';
  }
  // Transport-only swap fast path: keep stay/activities, re-pick transport, re-budget.
  if (brief.transportPreference && brief.transportPreference !== (plan.brief || {}).transportPreference) {
    const tripType = plan.tripType;
    const res = transportAgent.run({
      origin: brief.origin, destination: brief.destination,
      distanceKm: plan.distanceKm, tripType, travelers: brief.travelers,
      budget: brief.budget, travelStyle: brief.travelStyle,
      interests: brief.interests || [], transportPreference: brief.transportPreference, nights: brief.nights, days: brief.days,
    });
    const banned = /bus/.test(t) && /no|avoid|not/.test(t) ? 'bus' : /flight/.test(t) && /no|avoid|not/.test(t) ? 'flight' : null;
    const pick = res.options.find((o) => o.mode !== banned && (brief.transportPreference === 'flight' ? o.mode.startsWith('flight') : o.mode === brief.transportPreference)) || res.options.find((o) => o.mode !== banned) || res.pick;
    const breakdown = budgetAgent.calculate({
      transport: pick, stay: plan.stay.pick, activities: plan.chosenActivities,
      days: brief.days, travelers: brief.travelers, travelStyle: brief.travelStyle, tripType,
    });
    const remaining = brief.budget - breakdown.total;
    return {
      ...plan,
      brief,
      transport: { ...res, pick },
      costs: breakdown,
      budget: { limit: brief.budget, total: breakdown.total, remaining, status: breakdown.total <= brief.budget ? 'within-budget' : 'over-budget' },
      dailyPlan: buildDays({ days: brief.days, origin: brief.origin, destination: brief.destination, transport: pick, activities: plan.chosenActivities, tripType }),
    };
  }
  return planTrip(brief);
}

module.exports = { planTrip, refine, validateBrief };
