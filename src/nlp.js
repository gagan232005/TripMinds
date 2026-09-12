'use strict';

/**
 * Deterministic requirement extraction for the conversational planner.
 *
 * Parses free text into a partial Trip Brief:
 * { origin, destination, days, travelers, budget, travelStyle, interests[], transportPreference }
 * Never asks for anything the user already provided.
 */

const { searchPlaces } = require('./locations');

const INTEREST_KEYWORDS = [
  ['beach', 'Beaches'], ['sea', 'Beaches'], ['island', 'Beaches'],
  ['food', 'Food'], ['cuisine', 'Food'], ['street food', 'Food'],
  ['adventure', 'Adventure'], ['trek', 'Adventure'], ['hiking', 'Adventure'], ['water sports', 'Adventure'],
  ['culture', 'Culture'], ['temple', 'Culture'], ['history', 'Culture'], ['museum', 'Culture'], ['heritage', 'Culture'],
  ['nature', 'Nature'], ['hills', 'Nature'], ['wildlife', 'Nature'], ['waterfall', 'Nature'],
  ['nightlife', 'Nightlife'], ['party', 'Nightlife'], ['pub', 'Nightlife'],
  ['shopping', 'Shopping'], ['market', 'Shopping'],
  ['spiritual', 'Spiritual'], ['yoga', 'Spiritual'], ['meditation', 'Spiritual'],
  ['romantic', 'Romantic'], ['honeymoon', 'Romantic'],
  ['family', 'Family'], ['kids', 'Family'],
  ['photography', 'Photography'], ['sunset', 'Sunsets'],
];

const STYLE_WORDS = [
  [/luxur/i, 'Luxury'], [/premium/i, 'Luxury'], [/5 star/i, 'Luxury'], [/5-star/i, 'Luxury'],
  [/comfort/i, 'Comfort'], [/comfortable/i, 'Comfort'], [/mid-range/i, 'Comfort'], [/mid range/i, 'Comfort'],
  [/budget/i, 'Budget'], [/cheap/i, 'Budget'], [/economical/i, 'Budget'], [/backpack/i, 'Budget'],
];

const TRANSPORT_WORDS = [
  [/flight|fly|plane|airport/i, 'flight'],
  [/train|rail/i, 'train'],
  [/\bbus\b|volvo|sleeper/i, 'bus'],
  [/\bcar\b|drive|road trip|self-drive/i, 'car'],
  [/\bcab\b|taxi/i, 'cab'],
  [/\bbike\b|motorbike|bullet/i, 'bike'],
];

function parseBudget(text) {
  const t = String(text);
  // ₹8,000 · Rs. 8000 · INR 8000 · 8k · 10K · $500
  let m = t.match(/₹\s?([\d,]+(?:\.\d+)?)/);
  if (m) return Math.round(Number(m[1].replace(/,/g, '')));
  m = t.match(/(?:rs\.?|inr|rupees?)\s?([\d,]+(?:\.\d+)?)/i);
  if (m) return Math.round(Number(m[1].replace(/,/g, '')));
  m = t.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  if (m) return Math.round(Number(m[1].replace(/,/g, '')) * 83); // ~INR for V1 demo
  m = t.match(/(\d+(?:\.\d+)?)\s?k\b/i);
  if (m) return Math.round(Number(m[1]) * 1000);
  m = t.match(/under\s?([\d,]+)/i);
  if (m) return Math.round(Number(m[1].replace(/,/g, '')));
  m = t.match(/budget(?: of| is)?\s?([\d,]+)/i);
  if (m) return Math.round(Number(m[1].replace(/,/g, '')));
  // Bare large number ("I have 7000") — treated as total budget
  m = t.match(/\b(\d{4,6})\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1000 && n <= 500000) return n;
  }
  return null;
}

function parseTravelers(text) {
  const t = String(text).toLowerCase();
  if (/\bsolo\b|just me|alone|myself/.test(t)) return 1;
  let m = t.match(/(\d+)\s?(?:people|persons|travellers|travelers|members|friends|adults)/);
  if (m) return Math.max(1, Math.min(20, Number(m[1])));
  m = t.match(/for\s(\d+)\b(?!\s?days?)/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 20) return Number(m[1]);
  m = t.match(/(\d+)\s?of us/);
  if (m) return Math.max(1, Math.min(20, Number(m[1])));
  return null;
}

function parseDays(text) {
  const t = String(text).toLowerCase();
  let m = t.match(/(\d+)\s?[- ]day/);
  if (m) return Math.max(1, Math.min(30, Number(m[1])));
  m = t.match(/(\d+)\s?days?/);
  if (m) return Math.max(1, Math.min(30, Number(m[1])));
  if (/\bweekend\b/.test(t)) return 2;
  if (/\bweek\b/.test(t)) return 7;
  return null;
}

function parseStyle(text) {
  for (const [re, style] of STYLE_WORDS) {
    if (re.test(String(text))) return style;
  }
  return null;
}

function parseTransport(text) {
  for (const [re, mode] of TRANSPORT_WORDS) {
    if (re.test(String(text))) return mode;
  }
  return null;
}

function parseInterests(text) {
  const t = String(text).toLowerCase();
  const out = [];
  for (const [kw, label] of INTEREST_KEYWORDS) {
    if (t.includes(kw) && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Extract origin/destination using "from X to Y" style patterns. */
function parseRoute(text) {
  const t = String(text);
  let origin = null;
  let destination = null;

  // "from A to B" / "from A for B" / "A to B"
  let   m = t.match(/from\s+([A-Za-z][A-Za-z .()-]{1,30}?)\s+to\s+([A-Za-z][A-Za-z .()-]{1,30}?)(?=[,.\s]*(?:for|under|with|in|on|\d|₹|rs|\$|$))/i);
  if (m) {
    origin = cleanPlace(m[1]);
    destination = cleanPlace(m[2]);
    return { origin, destination };
  }
  // Destination-first: "Goa trip from Tumakuru" / "Goa from Tumakuru"
  // (no early return — a partial origin hit must not block destination fallbacks)
  m = t.match(/([A-Za-z][A-Za-z .()-]{1,28}?)\s+trip\s+from\s+([A-Za-z][A-Za-z .()-]{1,28}?)(?=[,.\s]*(?:for|under|with|for|\d|₹|rs|\$|$))/i);
  if (m) {
    const d = cleanPlace(m[1]);
    const o = cleanPlace(m[2]);
    if (!destination && isPlaceLike(d)) destination = d;
    if (!origin && isPlaceLike(o)) origin = o;
  }
  m = t.match(/([A-Za-z][A-Za-z .()-]{1,30}?)\s+to\s+([A-Za-z][A-Za-z .()-]{1,30}?)(?=[,.\s]*(?:for|under|with|trip|for|in|\d|₹|rs|\$|$))/i);
  if (m) {
    const a = cleanPlace(m[1]);
    const b = cleanPlace(m[2]);
    // Accept A→B when both look like places (trigger words NOT required);
    // otherwise keep a lone place-like B as the destination.
    if (isPlaceLike(a) && isPlaceLike(b)) return { origin: a, destination: b };
    if (isPlaceLike(b)) return { origin: null, destination: b };
  }
  // Standalone "to X" (first place-like match wins, avoids "want to go")
  if (!destination) {
    const re = /\bto\s+([A-Za-z][A-Za-z .()-]{1,28}?)(?=[,.\s]*(?:for|under|with|from|for|in|on|\d|₹|rs|\$|$))/gi;
    let tm;
    while ((tm = re.exec(t)) !== null) {
      const cand = cleanPlace(tm[1]);
      if (isPlaceLike(cand)) {
        destination = cand;
        break;
      }
    }
  }
  // "X trip ..." — single word right before "trip" ("3-day Goa trip" → Goa)
  if (!destination) {
    const mt = t.match(/(\b[A-Za-z][A-Za-z.()-]*)\s+trip/i);
    if (mt) {
      const d = cleanPlace(mt[1]);
      if (isPlaceLike(d)) destination = d;
    }
  }
  // "go to X" / "visit X" / "explore X" (word-boundaried; validated)
  if (!destination) {
    m = t.match(/(?:\bgo to|\bgoto|\bvisiting|\bvisit|\bexplore|\btrip to|\btravel to)\s+([A-Za-z][A-Za-z .()-]{1,28}?)(?=[,.\s]*(?:for|under|with|from|for|in|on|\d|₹|rs|\$|$))/i);
    if (m) {
      const cand = cleanPlace(m[1]);
      if (isPlaceLike(cand)) destination = cand;
    }
  }
  m = t.match(/\bfrom\s+([A-Za-z][A-Za-z .()-]{1,28}?)(?=[,.\s]*(?:for|under|with|to|for|\d|₹|rs|\$|$))/i);
  if (m) {
    const cand = cleanPlace(m[1]);
    if (isPlaceLike(cand)) origin = cand;
  }

  // "Suggest somewhere" / "anywhere" -> no destination yet
  if (/suggest|anywhere|somewhere|surprise/i.test(t)) destination = null;

  return { origin, destination };
}

const STOP = new Set(['the', 'a', 'an', 'my', 'our', 'trip', 'travel', 'travelling', 'traveling', 'plan', 'planning', 'please', 'want', 'wants', 'need', 'needs', 'go', 'goes', 'going', 'went', 'to', 'from', 'days', 'day', 'people', 'persons', 'person', 'under', 'around', 'about', 'with', 'comfortable', 'comfort', 'budget', 'luxury', 'internationally', 'international', 'somewhere', 'anywhere', 'weekend', 'week', 'i', 'we', 'you', 'me', 'us', 'for', 'in', 'on', 'at', 'of', 'and', 'have', 'has', 'had', 'is', 'are', 'it', 'this', 'that']);
function isPlaceLike(s) {
  if (!s) return false;
  const w = s.trim().toLowerCase();
  if (!w || w.length < 2 || w.length > 30) return false;
  if (STOP.has(w)) return false;
  if (/\d|₹|\$/.test(w)) return false;
  // Reject phrases containing verbs/articles ("I want", "go to Goa", "a comfortable trip")
  const tokens = w.split(/[\s.()-]+/).filter(Boolean);
  if (tokens.some((tok) => STOP.has(tok))) return false;
  return true;
}

function cleanPlace(s) {
  let c = String(s || '').trim().replace(/[,.\s]+$/, '').trim();
  // Drop trailing qualifiers ("Goa trip" -> "Goa")
  c = c.replace(/\s+(trip|travel|tour|visit|plan)$/i, '').trim();
  // Title-case
  c = c.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  // Snap to curated list when close (handles "tumkur" etc.)
  if (c) {
    const hits = searchPlaces(c, 3);
    if (hits.length) {
      const hn = hits[0].name.toLowerCase();
      const cn = c.toLowerCase();
      if (hn === cn || hn.startsWith(cn) || cn.startsWith(hn)) return hits[0].name;
    }
  }
  return c || null;
}

/** Merge a user message into the brief; returns { patch, matched } . */
function extractPatch(text) {
  const route = parseRoute(text);
  const budget = parseBudget(text);
  const travelers = parseTravelers(text);
  const days = parseDays(text);
  const travelStyle = parseStyle(text);
  const transportPreference = parseTransport(text);
  const interests = parseInterests(text);
  const patch = {};
  if (route.origin) patch.origin = route.origin;
  if (route.destination) patch.destination = route.destination;
  if (budget) patch.budget = budget;
  if (travelers) patch.travelers = travelers;
  if (days) patch.days = days;
  if (travelStyle) patch.travelStyle = travelStyle;
  if (transportPreference) patch.transportPreference = transportPreference;
  if (interests.length) patch.interests = interests;
  return patch;
}

function mergeBrief(prev, patch) {
  const next = { ...(prev || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === 'interests') {
      next.interests = [...new Set([...(next.interests || []), ...v])].slice(0, 8);
    } else if (v !== null && v !== undefined && v !== '') {
      next[k] = v;
    }
  }
  return next;
}

function missingField(brief) {
  if (!brief.destination) return 'destination';
  if (!brief.origin) return 'origin';
  if (!brief.budget) return 'budget';
  if (!brief.days) return 'days';
  if (!brief.travelers) return 'travelers';
  if (!brief.travelStyle) return 'travelStyle';
  return null;
}

function followUpQuestion(field, brief) {
  const dest = brief.destination ? ` in ${brief.destination}` : '';
  switch (field) {
    case 'destination':
      return { text: 'Where would you like to go? You can name any city or country — e.g. Goa, Mysuru, Singapore.', quickReplies: ['Goa', 'Mysuru', 'Kerala', 'Singapore'] };
    case 'origin':
      return { text: `Where will you start from${dest ? ` for your ${brief.destination} trip` : ''}?`, quickReplies: ['Tumakuru', 'Bengaluru', 'Mysuru', 'Mumbai'] };
    case 'budget':
      return { text: `What's your maximum total budget${brief.travelers ? ` for ${brief.travelers} ${brief.travelers === 1 ? 'person' : 'people'}` : ''}? (e.g. ₹8,000)`, quickReplies: ['₹5,000', '₹8,000', '₹15,000', '₹50,000'] };
    case 'days':
      return { text: 'How many days will the trip be?', quickReplies: ['2 Days', '3 Days', '5 Days', '7 Days'] };
    case 'travelers':
      return { text: 'How many people are travelling?', quickReplies: ['1', '2', '4', '6'] };
    case 'travelStyle':
      return {
        text: 'Would you prefer Budget, Comfort or Luxury?',
        quickReplies: ['🪙 Budget', '⚖️ Comfort', '✨ Luxury', '🤖 Let TripMinds Decide'],
      };
    default:
      return null;
  }
}

function briefComplete(brief) {
  return Boolean(brief.origin && brief.destination && brief.budget && brief.days && brief.travelers && brief.travelStyle);
}

function applyQuickReply(brief, label) {
  const t = String(label);
  if (/let tripminds decide/i.test(t)) return { travelStyle: 'Comfort' };
  if (/budget/i.test(t) && /🪙|budget/i.test(t)) return { travelStyle: 'Budget' };
  if (/comfort/i.test(t)) return { travelStyle: 'Comfort' };
  if (/luxury/i.test(t)) return { travelStyle: 'Luxury' };
  let m = t.match(/₹\s?([\d,]+)/);
  if (m) return { budget: Number(m[1].replace(/,/g, '')) };
  m = t.match(/(\d+)\s?days?/i);
  if (m) return { days: Number(m[1]) };
  if (/^\d{1,2}$/.test(t.trim())) return { travelers: Number(t.trim()) };
  // Otherwise treat as a place name for whichever is missing
  if (!brief.destination) return { destination: cleanPlace(t) };
  if (!brief.origin) return { origin: cleanPlace(t) };
  return extractPatch(t);
}

/**
 * LLM-powered requirement extraction — the model genuinely reads the message
 * and returns a structured patch. Sanitized before use; null when the LLM is
 * disabled or fails (caller falls back to extractPatch).
 */
async function extractPatchLLM(text, brief) {
  let llm;
  try {
    llm = require('./llm');
  } catch {
    return null;
  }
  if (!llm.isEnabled()) return null;
  const out = await llm.completeJSON({
    system: [
      'You are TripMinds\' requirement extractor. Read the user message and the',
      'current trip brief, and return ONLY new/changed fields as a JSON object.',
      'Allowed keys: origin, destination (city/country strings), days (1-30 integer),',
      'travelers (1-20 integer), budget (total trip budget as a plain number in INR;',
      '"8k", "10K", "₹8,000" all mean 8000; "$500" ≈ 41500),',
      'travelStyle (exactly one of: Budget, Comfort, Luxury),',
      'interests (array of short labels like Beaches, Food, Adventure),',
      'transportPreference (one of: train, bus, flight, car, cab, bike).',
      'Omit keys you cannot determine. Never invent destinations, budgets or dates.',
      'If the user asks for suggestions without naming a place, omit destination.',
      'Example: {"destination": "Goa", "days": 3, "budget": 8000}',
    ].join(' '),
    user: `Current brief: ${JSON.stringify(brief || {})}\nUser message: ${String(text)}`,
  });
  if (!out || typeof out !== 'object' || Array.isArray(out)) return null;
  const patch = {};
  if (typeof out.origin === 'string' && isPlaceLike(cleanPlace(out.origin))) patch.origin = cleanPlace(out.origin);
  if (typeof out.destination === 'string' && isPlaceLike(cleanPlace(out.destination))) patch.destination = cleanPlace(out.destination);
  const days = Number(out.days);
  if (Number.isFinite(days)) patch.days = Math.max(1, Math.min(30, Math.round(days)));
  const travelers = Number(out.travelers);
  if (Number.isFinite(travelers)) patch.travelers = Math.max(1, Math.min(20, Math.round(travelers)));
  const budget = Number(out.budget);
  if (Number.isFinite(budget) && budget >= 500 && budget <= 10000000) patch.budget = Math.round(budget);
  if (['Budget', 'Comfort', 'Luxury'].includes(out.travelStyle)) patch.travelStyle = out.travelStyle;
  if (Array.isArray(out.interests)) {
    const interests = out.interests.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 24)).slice(0, 8);
    if (interests.length) patch.interests = interests;
  }
  if (['train', 'bus', 'flight', 'car', 'cab', 'bike'].includes(out.transportPreference)) {
    patch.transportPreference = out.transportPreference;
  }
  return Object.keys(patch).length ? patch : null;
}

module.exports = {
  extractPatch, mergeBrief, missingField, followUpQuestion, briefComplete,
  applyQuickReply, parseBudget, parseDays, parseTravelers, cleanPlace,
  extractPatchLLM,
};
