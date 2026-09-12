import { inr } from '../lib/api.js';

const ROWS = [
  { key: 'route', icon: '📍', label: (b) => (b.origin && b.destination ? `${b.origin} → ${b.destination}` : null) },
  { key: 'tripType', icon: '🗺️', label: (b) => b.tripType || null },
  { key: 'days', icon: '📅', label: (b) => (b.days ? `${b.days} Day${b.days > 1 ? 's' : ''}` : null) },
  { key: 'travelers', icon: '👥', label: (b) => (b.travelers ? `${b.travelers} Traveler${b.travelers > 1 ? 's' : ''}` : null) },
  { key: 'budget', icon: '💰', label: (b) => (b.budget ? inr(b.budget) : null) },
  { key: 'travelStyle', icon: '🪙', label: (b) => b.travelStyle || null },
  { key: 'interests', icon: '🏖️', label: (b) => (b.interests && b.interests.length ? b.interests.slice(0, 3).join(' · ') : null) },
  { key: 'transportPreference', icon: '🚆', label: (b) => b.transportPreference || null },
];

export default function TripBrief({ brief, collapsed, onToggle }) {
  return (
    <div>
      <button className="tm-brief-toggle" onClick={onToggle}>
        {collapsed ? '▸ Show Trip Brief' : '▾ Hide Trip Brief'}
      </button>
      <aside className={`tm-brief${collapsed ? ' collapsed' : ''}`}>
        <h2>TRIP BRIEF</h2>
        <div className="tm-brief-body">
          {ROWS.map((r) => {
            const v = r.label(brief);
            return (
              <div key={r.key} className="tm-brief-row">
                <span className="e">{r.icon}</span>
                {v ? <span>{v}</span> : <span className="empty">—</span>}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
