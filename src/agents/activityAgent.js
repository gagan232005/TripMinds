'use strict';

/**
 * ACTIVITY AGENT — recommends a realistic mix of free / low-cost / paid
 * experiences based on destination + interests + days. Structured JSON only.
 */

const DEST_VIBES = {
  goa: ['Beaches', 'Nightlife', 'Food', 'Adventure'],
  mysuru: ['Culture', 'Food', 'Heritage'],
  kerala: ['Nature', 'Food', 'Culture'],
  kochi: ['Culture', 'Food', 'Heritage'],
  singapore: ['Culture', 'Food', 'Shopping'],
  dubai: ['Shopping', 'Adventure', 'Culture'],
  bangkok: ['Food', 'Culture', 'Shopping'],
  bali: ['Beaches', 'Nature', 'Adventure'],
  paris: ['Culture', 'Food', 'Shopping'],
  manali: ['Adventure', 'Nature'],
  jaipur: ['Culture', 'Heritage', 'Shopping'],
};

const POOL = [
  { name: 'Beach morning + swim', tags: ['Beaches'], cost: 0, kind: 'Free' },
  { name: 'Sunset point', tags: ['Sunsets', 'Nature'], cost: 0, kind: 'Free' },
  { name: 'Old town heritage walk', tags: ['Culture', 'Heritage'], cost: 0, kind: 'Free' },
  { name: 'Local market stroll', tags: ['Shopping', 'Food'], cost: 200, kind: 'Low-cost' },
  { name: 'Street-food crawl', tags: ['Food'], cost: 500, kind: 'Low-cost' },
  { name: 'Temple / cultural site visit', tags: ['Culture', 'Spiritual'], cost: 150, kind: 'Low-cost' },
  { name: 'Museum + gallery', tags: ['Culture'], cost: 400, kind: 'Low-cost' },
  { name: 'Lake / viewpoint picnic', tags: ['Nature'], cost: 100, kind: 'Free' },
  { name: 'Adventure activity (water sports / trek)', tags: ['Adventure'], cost: 900, kind: 'Paid' },
  { name: 'Guided day excursion', tags: ['Adventure', 'Nature'], cost: 1200, kind: 'Paid' },
  { name: 'Sunset cruise / show', tags: ['Sunsets', 'Nightlife'], cost: 800, kind: 'Paid' },
  { name: 'Local cooking class', tags: ['Food', 'Culture'], cost: 700, kind: 'Paid' },
];

function run({ destination, interests, days, travelers, travelStyle, tripType }) {
  const t0 = Date.now();
  const vibes = DEST_VIBES[String(destination || '').toLowerCase()] || ['Culture', 'Food', 'Nature'];
  const want = [...(interests || []), ...vibes];
  const count = Math.max(2, Math.min(9, days * 2));

  const scored = POOL.map((a) => {
    let s = 10 - a.cost / 400;
    for (const w of want) {
      if (a.tags.includes(w)) s += 6;
    }
    if (travelStyle === 'Budget' && a.cost === 0) s += 6;
    if (travelStyle === 'Luxury' && a.kind === 'Paid') s += 4;
    s += Math.random() * 0.01;
    return { a, s };
  });
  scored.sort((x, y) => y.s - x.s);

  // Ensure at least 2 free/low-cost experiences for budget realism.
  const picked = [];
  for (const s of scored) {
    if (picked.length >= count) break;
    picked.push(s.a);
  }
  const hasCheap = picked.filter((a) => a.cost <= 200).length;
  if (hasCheap < 2) {
    const cheap = POOL.filter((a) => a.cost <= 200 && !picked.includes(a)).slice(0, 2 - hasCheap);
    picked.push(...cheap);
  }

  const options = picked.slice(0, count + 1).map((a) => ({
    name: a.name,
    // Group total (demo estimate): small scaling for larger parties.
    cost: a.cost <= 0 ? 0 : Math.round(a.cost * (travelers <= 2 ? 1 : travelers <= 4 ? 1.5 : 2) / 10) * 10,
    kind: a.kind,
    tags: a.tags,
    estimated: true,
  }));

  return {
    type: 'activity',
    options,
    latencyMs: Date.now() - t0,
    notes: `${options.length} experiences for ${days} day(s), matched to ${(interests || []).join(', ') || 'general sightseeing'}.`,
  };
}

module.exports = { run };
