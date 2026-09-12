'use strict';

/**
 * TRANSPORT AGENT — structured JSON only.
 * Compares train / bus / flight / car / cab / bike where realistic,
 * never defaults to flights. Returns { type, pick, options[] }.
 */

function fmtDur(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function estimateModes(distanceKm, tripType) {
  const modes = [];
  if (distanceKm <= 40) {
    modes.push('bike', 'cab', 'bus', 'car');
  } else if (distanceKm <= 200) {
    modes.push('bus', 'train', 'cab', 'car');
  } else if (distanceKm <= 600) {
    modes.push('train', 'bus', 'car', 'cab', 'flight');
  } else if (distanceKm <= 1600) {
    modes.push('train', 'bus', 'flight', 'car');
  } else {
    modes.push('flight', 'train', 'bus');
  }
  if (tripType === 'International') return ['flight-intl', 'flight'];
  return modes;
}

// Per-person one-way realistic Indian demo fares (Estimated).
// Calibrated so a 4-person, 3-day ~380 km budget trip (train) lands ≈ ₹1,800.
const FARE = {
  bike: { base: 40, perKm: 2.5, speed: 35 },
  cab: { base: 250, perKm: 11, speed: 45 },
  car: { base: 400, perKm: 6.5, speed: 50 },
  bus: { base: 100, perKm: 1.0, speed: 42 },
  train: { base: 50, perKm: 0.45, speed: 55 },
  flight: { base: 1500, perKm: 3.8, speed: 550 },
  'flight-intl': { base: 6000, perKm: 2.2, speed: 800 },
};

const LABEL = {
  bike: { icon: '🏍️', name: 'Bike' },
  cab: { icon: '🚕', name: 'Cab' },
  car: { icon: '🚗', name: 'Car (self-drive)' },
  bus: { icon: '🚌', name: 'Bus' },
  train: { icon: '🚆', name: 'Train' },
  flight: { icon: '✈️', name: 'Flight' },
  'flight-intl': { icon: '✈️', name: 'International Flight' },
};

function run({ origin, destination, distanceKm, tripType, travelers, budget, travelStyle, transportPreference }) {
  const t0 = Date.now();
  const modes = estimateModes(distanceKm, tripType);
  const style = travelStyle || 'Comfort';

  const options = modes.map((mode) => {
    const f = FARE[mode];
    // Round trip, all travelers. Cars/cabs split across vehicle; keep simple per-group pricing.
    const shared = mode === 'car' || mode === 'cab';
    const oneWay = f.base + f.perKm * distanceKm;
    const cost = shared
      ? Math.round((oneWay * 2) / 10) * 10
      : Math.round((oneWay * 2 * travelers) / 10) * 10;
    const hours = Math.max(0.5, distanceKm / f.speed + (mode.startsWith('flight') ? 2.5 : mode === 'train' ? 0.8 : 0.4));
    return {
      mode,
      icon: LABEL[mode].icon,
      name: LABEL[mode].name,
      cost,
      duration: fmtDur(hours),
      hours: Math.round(hours * 10) / 10,
      stops: mode === 'train' && distanceKm > 500 ? 3 : mode === 'bus' && distanceKm > 400 ? 2 : mode.startsWith('flight') && distanceKm > 1500 ? 1 : 0,
      convenience: mode.startsWith('flight') ? 8 : mode === 'train' ? 8 : mode === 'bus' ? 6 : 7,
      comfort: mode.startsWith('flight') ? 8 : mode === 'cab' || mode === 'car' ? 8 : mode === 'train' ? 7 : mode === 'bus' ? 5 : 4,
      recommendation: '',
      estimated: true,
    };
  });

  // Rank: score = value for (budget, style, travelers, preference).
  const scored = options.map((o) => {
    let s = 50;
    s -= o.cost / Math.max(1000, budget) * 40; // cheaper is better, budget-relative
    if (style === 'Budget') s += (o.mode === 'train' || o.mode === 'bus' ? 18 : o.mode.startsWith('flight') ? -14 : 4);
    if (style === 'Luxury') s += (o.mode.startsWith('flight') || o.mode === 'cab' || o.mode === 'car' ? 14 : -4);
    if (style === 'Comfort') s += (o.mode === 'train' || o.mode.startsWith('flight') ? 8 : 0);
    if (travelers >= 4 && (o.mode === 'car' || o.mode === 'cab')) s += 6; // group splits cost
    if (transportPreference && o.mode === transportPreference) s += 25;
    if (transportPreference === 'flight' && o.mode === 'flight-intl') s += 25;
    s += o.comfort * 0.8 - o.hours * 0.5;
    return { o, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const pick = scored[0].o;
  pick.recommendation = bestReason(pick, style, budget);

  const sorted = scored.map((x) => x.o);
  return {
    type: 'transportation',
    pick,
    options: sorted,
    latencyMs: Date.now() - t0,
    notes: `Compared ${sorted.length} modes for ~${distanceKm} km (${tripType}).`,
  };
}

function bestReason(pick, style, budget) {
  if (pick.mode === 'train') return style === 'Budget' ? 'Best for your budget — low fare, comfortable for groups' : 'Best balance of cost, comfort and convenience';
  if (pick.mode === 'bus') return 'Lowest practical fare on this route';
  if (pick.mode.startsWith('flight')) return 'Fastest option — worth it for this distance';
  if (pick.mode === 'car') return 'Flexible for a group — split fuel, stop anywhere';
  if (pick.mode === 'cab') return 'Door-to-door comfort for a short hop';
  return 'Most practical for a short local hop';
}

module.exports = { run };
