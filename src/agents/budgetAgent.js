'use strict';

/**
 * BUDGET AGENT — the key differentiator.
 * Deterministic arithmetic only (never LLM math):
 * transport + stay + activities + food + local transport + emergency buffer.
 */

const FOOD_PER_DAY = { Budget: 180, Comfort: 550, Luxury: 1200 };
const LOCAL_PER_DAY = { Budget: 100, Comfort: 400, Luxury: 800 };

function foodEstimate({ days, travelers, travelStyle, tripType }) {
  const base = FOOD_PER_DAY[travelStyle] || FOOD_PER_DAY.Comfort;
  const mult = tripType === 'International' ? 2.2 : 1;
  return Math.round(base * mult * days * travelers / 10) * 10;
}

function localEstimate({ days, travelers, travelStyle }) {
  const base = LOCAL_PER_DAY[travelStyle] || LOCAL_PER_DAY.Comfort;
  const groupFactor = travelers <= 2 ? 1 : travelers <= 4 ? 1.6 : 2.2;
  return Math.round(base * days * groupFactor / 10) * 10;
}

/** Full deterministic breakdown for a candidate plan. */
function calculate({ transport, stay, activities, days, travelers, travelStyle, tripType }) {
  const transportation = transport ? transport.cost : 0;
  const accommodation = stay ? stay.cost : 0;
  const activityList = activities || [];
  const activitiesTotal = activityList.reduce((s, a) => s + (a.cost || 0), 0);
  const food = foodEstimate({ days, travelers, travelStyle, tripType });
  const localTransport = localEstimate({ days, travelers, travelStyle });
  const subtotal = transportation + accommodation + activitiesTotal + food + localTransport;
  const emergencyBuffer = Math.round(subtotal * 0.06 / 10) * 10;
  const total = subtotal + emergencyBuffer;
  return {
    transportation, accommodation, activities: activitiesTotal, food,
    localTransport, emergencyBuffer, total,
  };
}

/**
 * Optimize an over-budget plan with concrete swaps.
 * Returns { breakdown, steps: [{title, detail, save}], optimized, impossible }.
 */
function optimize({ transport, stay, activities, transportOptions, stayOptions, days, travelers, travelStyle, tripType, budget }) {
  const steps = [];
  let t = transport;
  let s = stay;
  let acts = [...activities];
  let style = travelStyle;

  const totalOf = () => calculate({ transport: t, stay: s, activities: acts, days, travelers, travelStyle: style, tripType }).total;

  // 1. Cheaper transport (cheapest option that isn't the pick)
  if (t && transportOptions) {
    const cheaper = transportOptions.filter((o) => o.cost < t.cost).sort((a, b) => a.cost - b.cost)[0];
    if (cheaper && totalOf() > budget) {
      steps.push({ title: 'Cheaper transport', detail: `Switch ${t.name} → ${cheaper.name}`, save: t.cost - cheaper.cost });
      t = cheaper;
    }
  }
  // 2. Cheaper stay
  if (s && stayOptions) {
    const cheaper = stayOptions.filter((o) => o.cost < s.cost).sort((a, b) => a.cost - b.cost)[0];
    if (cheaper && totalOf() > budget) {
      steps.push({ title: 'Cheaper stay', detail: `Switch ${s.kind} → ${cheaper.kind}`, save: s.cost - cheaper.cost });
      s = cheaper;
    }
  }
  // 3. Drop most expensive paid activity for a free one
  if (totalOf() > budget) {
    const paid = [...acts].sort((a, b) => b.cost - a.cost).find((a) => a.cost > 300);
    if (paid) {
      steps.push({ title: 'Free activity swap', detail: `Replace “${paid.name}” with a free experience (sunset point / heritage walk)`, save: paid.cost });
      acts = acts.map((a) => (a === paid ? { ...a, name: 'Sunset point + old-town walk', cost: 0, kind: 'Free' } : a));
    }
  }
  // 4. Food tier optimization (comfort → budget-style eating)
  if (totalOf() > budget && style !== 'Budget') {
    const before = calculate({ transport: t, stay: s, activities: acts, days, travelers, travelStyle: style, tripType });
    const after = calculate({ transport: t, stay: s, activities: acts, days, travelers, travelStyle: 'Budget', tripType });
    const save = before.food + before.localTransport - (after.food + after.localTransport);
    if (save > 0) {
      steps.push({ title: 'Food + local transport optimization', detail: 'More street food & markets, shared cabs / public transport', save });
      style = 'Budget';
    }
  }

  const breakdown = calculate({ transport: t, stay: s, activities: acts, days, travelers, travelStyle: style, tripType });
  const optimized = breakdown.total <= budget && steps.length > 0;

  // Impossible check: even the rock-bottom plan can't fit.
  let impossible = null;
  if (breakdown.total > budget) {
    const minFood = foodEstimate({ days, travelers, travelStyle: 'Budget', tripType });
    const rockBottom = (t ? Math.min(t.cost, ...(transportOptions || []).map((o) => o.cost)) : 0) + minFood;
    if (budget < rockBottom * 0.9) {
      impossible = {
        headline: `This trip can't realistically fit ₹${budget.toLocaleString('en-IN')}. Transport + food alone would be ≈₹${rockBottom.toLocaleString('en-IN')}.`,
        alternatives: [
          `Raise the budget to ≈₹${(Math.round(breakdown.total / 500) * 500).toLocaleString('en-IN')}`,
          'Pick a closer destination (e.g. Mysuru instead of Goa)',
          'Travel with fewer people or fewer days',
        ],
      };
    }
  }

  return { transport: t, stay: s, activities: acts, style, breakdown, steps, optimized, impossible };
}

module.exports = { calculate, optimize, foodEstimate, localEstimate };
