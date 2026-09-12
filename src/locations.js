'use strict';

/**
 * Location database + trip-type classification + autocomplete.
 *
 * V1 keeps a curated list of common Indian + international cities (with
 * state/country + approx coordinates for distance estimates) but accepts
 * ARBITRARY input: unknown places still work via sensible fallbacks.
 */

const PLACES = [
  // Karnataka + neighbours (local / within-state)
  { name: 'Tumakuru', state: 'Karnataka', country: 'India', lat: 13.34, lon: 77.10 },
  { name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.97, lon: 77.59 },
  { name: 'Mysuru', state: 'Karnataka', country: 'India', lat: 12.29, lon: 76.65 },
  { name: 'Belagavi', state: 'Karnataka', country: 'India', lat: 15.85, lon: 74.50 },
  { name: 'Mangaluru', state: 'Karnataka', country: 'India', lat: 12.91, lon: 74.85 },
  { name: 'Hubballi', state: 'Karnataka', country: 'India', lat: 15.36, lon: 75.12 },
  { name: 'Hampi', state: 'Karnataka', country: 'India', lat: 15.33, lon: 76.46 },
  { name: 'Coorg', state: 'Karnataka', country: 'India', lat: 12.42, lon: 75.73 },
  // Domestic India
  { name: 'Goa', state: 'Goa', country: 'India', lat: 15.30, lon: 74.12 },
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.07, lon: 72.87 },
  { name: 'Delhi', state: 'Delhi', country: 'India', lat: 28.61, lon: 77.20 },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.91, lon: 75.79 },
  { name: 'Udaipur', state: 'Rajasthan', country: 'India', lat: 24.58, lon: 73.68 },
  { name: 'Kerala', state: 'Kerala', country: 'India', lat: 9.93, lon: 76.27 },
  { name: 'Kochi', state: 'Kerala', country: 'India', lat: 9.93, lon: 76.27 },
  { name: 'Munnar', state: 'Kerala', country: 'India', lat: 10.08, lon: 77.06 },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.08, lon: 80.27 },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.38, lon: 78.48 },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.57, lon: 88.36 },
  { name: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.31, lon: 82.98 },
  { name: 'Agra', state: 'Uttar Pradesh', country: 'India', lat: 27.17, lon: 78.00 },
  { name: 'Amritsar', state: 'Punjab', country: 'India', lat: 31.63, lon: 74.87 },
  { name: 'Shimla', state: 'Himachal Pradesh', country: 'India', lat: 31.10, lon: 77.17 },
  { name: 'Manali', state: 'Himachal Pradesh', country: 'India', lat: 32.24, lon: 77.19 },
  { name: 'Darjeeling', state: 'West Bengal', country: 'India', lat: 27.04, lon: 88.26 },
  { name: 'Pondicherry', state: 'Puducherry', country: 'India', lat: 11.94, lon: 79.80 },
  { name: 'Ooty', state: 'Tamil Nadu', country: 'India', lat: 11.41, lon: 76.69 },
  // International
  { name: 'Dubai', state: 'Dubai', country: 'UAE', lat: 25.20, lon: 55.27 },
  { name: 'Singapore', state: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Bangkok', state: 'Bangkok', country: 'Thailand', lat: 13.75, lon: 100.50 },
  { name: 'Bali', state: 'Bali', country: 'Indonesia', lat: -8.65, lon: 115.22 },
  { name: 'Paris', state: 'Île-de-France', country: 'France', lat: 48.85, lon: 2.35 },
  { name: 'London', state: 'England', country: 'UK', lat: 51.50, lon: -0.12 },
  { name: 'New York', state: 'New York', country: 'USA', lat: 40.71, lon: -74.00 },
  { name: 'Tokyo', state: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69 },
  { name: 'Maldives', state: 'Malé', country: 'Maldives', lat: 3.20, lon: 73.22 },
];

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function findPlace(name) {
  const n = norm(name);
  if (!n) return null;
  return PLACES.find((p) => norm(p.name) === n) || null;
}

function guessPlace(name) {
  const known = findPlace(name);
  if (known) return known;
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  // Unknown place: assume India (domestic story) so any city works.
  return { name: cap(trimmed), state: null, country: 'India', lat: null, lon: null, guessed: true };
}

function cap(s) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/** Fuzzy autocomplete over the curated list; always echoes raw input as last option. */
function searchPlaces(q, limit = 8) {
  const n = norm(q);
  if (!n) return PLACES.slice(0, limit);
  const starts = [];
  const contains = [];
  for (const p of PLACES) {
    const pn = norm(p.name);
    if (pn.startsWith(n)) starts.push(p);
    else if (pn.includes(n)) contains.push(p);
  }
  const out = [...starts, ...contains].slice(0, limit);
  return out;
}

function haversineKm(a, b) {
  if (a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Trip-type classification (automatic, never user-selected):
 * same city (or a nearby in-state hop, e.g. Tumakuru → Bengaluru) -> Local ·
 * same Indian state -> Within State · same country -> Domestic ·
 * different countries -> International.
 */
function classifyTrip(originName, destName) {
  const o = guessPlace(originName);
  const d = guessPlace(destName);
  if (!o || !d) return 'Domestic';
  if (norm(o.name) === norm(d.name)) return 'Local';
  if (o.country && d.country && o.country !== d.country) return 'International';
  if (o.country === 'India' && d.country === 'India') {
    if (o.state && d.state && o.state === d.state) {
      const km = haversineKm(o, d);
      if (km != null && km < 120) return 'Local';
      return 'Within State';
    }
    return 'Domestic';
  }
  return 'Domestic';
}

function estimateDistanceKm(originName, destName, tripType) {
  const o = guessPlace(originName);
  const d = guessPlace(destName);
  const real = o && d ? haversineKm(o, d) : null;
  if (real != null && real > 0) return real;
  // Fallbacks per scope so unknown cities still plan sensibly.
  if (tripType === 'Local') return 25;
  if (tripType === 'Within State') return 150;
  if (tripType === 'International') return 3200;
  return 600;
}

module.exports = { PLACES, findPlace, guessPlace, searchPlaces, classifyTrip, estimateDistanceKm };
