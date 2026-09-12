'use strict';

/**
 * STAY AGENT — hotels / hostels / homestays / guesthouses.
 * Picks tier by travel style, sizes rooms for the group. Structured JSON only.
 */

const TIERS = {
  Budget: [
    { type: 'Budget Hostel', perNight: 700, rating: 4.1, note: 'Good location · Budget-friendly' },
    { type: 'Homestay', perNight: 900, rating: 4.3, note: 'Local feel · Great value' },
    { type: 'Guesthouse', perNight: 1100, rating: 4.0, note: 'Simple, clean rooms' },
  ],
  Comfort: [
    { type: 'Comfort Hotel', perNight: 1800, rating: 4.4, note: 'Good location · Family friendly' },
    { type: 'Boutique Homestay', perNight: 2100, rating: 4.6, note: 'Highly rated stay' },
    { type: 'Budget Hostel', perNight: 750, rating: 4.1, note: 'Cheaper alternative' },
  ],
  Luxury: [
    { type: 'Premium Resort', perNight: 5200, rating: 4.8, note: 'Top rated · Central' },
    { type: 'Luxury Hotel', perNight: 4200, rating: 4.7, note: 'Spa + pool' },
    { type: 'Comfort Hotel', perNight: 1900, rating: 4.4, note: 'Cheaper alternative' },
  ],
};

function run({ destination, tripType, nights, travelers, travelStyle, budget }) {
  const t0 = Date.now();
  const style = travelStyle === 'Luxury' ? 'Luxury' : travelStyle === 'Budget' ? 'Budget' : 'Comfort';

  if (tripType === 'Local' || nights <= 0) {
    return {
      type: 'accommodation',
      pick: null,
      options: [],
      nights: 0,
      rooms: 0,
      latencyMs: Date.now() - t0,
      notes: 'Local trip — no overnight stay needed.',
    };
  }

  // 2 travelers per room for Comfort/Luxury; hostel dorms sleep ~4 for Budget.
  const perRoom = style === 'Budget' ? 4 : 2;
  const rooms = Math.max(1, Math.ceil(travelers / perRoom));
  const intlMult = tripType === 'International' ? 1.8 : 1;

  const tiers = TIERS[style];
  const options = tiers.map((t, i) => {
    const perNight = Math.round((t.perNight * intlMult) / 10) * 10;
    const cost = perNight * nights * rooms;
    return {
      name: `${t.type} — ${destination}`,
      kind: t.type,
      cost,
      perNight: perNight * rooms,
      nights,
      rooms,
      rating: t.rating,
      note: t.note,
      recommendation: i === 0 ? `Best for ${style.toLowerCase()} — fits ${travelers} in ${rooms} room${rooms > 1 ? 's' : ''}` : 'Alternative option',
      estimated: true,
    };
  });

  // If budget is tight, surface the cheapest tier as pick regardless of style? No —
  // keep style-faithful pick; the BUDGET agent will downgrade during optimization.
  return {
    type: 'accommodation',
    pick: options[0],
    options,
    nights,
    rooms,
    latencyMs: Date.now() - t0,
    notes: `${options.length} stay tiers × ${nights} night(s) × ${rooms} room(s).`,
  };
}

module.exports = { run };
