const TRIPS_KEY = 'tripminds.trips.v1';
const PLANS_KEY = 'tripminds.plans.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — non-fatal */
  }
}

export function getTrips() {
  return read(TRIPS_KEY, []);
}

export function saveTrip(plan) {
  const trips = getTrips();
  const b = plan.brief || {};
  const entry = {
    id: `${Date.now()}`,
    origin: b.origin,
    destination: b.destination,
    days: b.days,
    travelers: b.travelers,
    budget: plan.budget?.limit,
    total: plan.budget?.total,
    tripType: plan.tripType,
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...trips.filter((t) => !(t.origin === entry.origin && t.destination === entry.destination && t.days === entry.days))].slice(0, 12);
  write(TRIPS_KEY, next);
  const plans = read(PLANS_KEY, {});
  plans[entry.id] = plan;
  write(PLANS_KEY, plans);
  return entry;
}

export function getPlan(id) {
  return read(PLANS_KEY, {})[id] || null;
}
