import { inr } from '../lib/api.js';

const AGENTS = [
  { icon: '🚆', name: 'Transport Agent', body: 'Compares train, bus, flight, car, cab and bike for your distance, group and budget.' },
  { icon: '🏨', name: 'Stay Agent', body: 'Shortlists hostels, homestays and hotels by nightly budget, location and style.' },
  { icon: '✨', name: 'Activity Agent', body: 'Matches free, low-cost and paid experiences to your interests and days.' },
  { icon: '💰', name: 'Budget Agent', body: 'Reconciles every rupee with deterministic math and optimizes when over budget.' },
];

export default function Dashboard({ trips, onNew, onOpen }) {
  const scrollHow = () => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div>
      {/* Hero */}
      <section className="tm-hero-grid">
        <div className="rise">
          <p className="tm-badge">
            <i />
            Multi-agent itinerary engine · demo data, never fake live prices
          </p>
          <h1 className="font-display">Travel smarter. Spend&nbsp;better.</h1>
          <p className="tm-sub">
            Tell TripMinds where you want to go, what you want to spend, and what kind
            of experience you want — specialized transport, stay, activity and budget
            agents plan it together, then an orchestrator fuses everything into one
            personalized itinerary.
          </p>
          <div className="tm-hero-cta">
            <button className="tm-btn" onClick={onNew}>
              Start Planning <span aria-hidden="true">→</span>
            </button>
            <button className="tm-btn tm-btn-ghost" onClick={scrollHow}>
              <span aria-hidden="true">◉</span> See how it works
            </button>
          </div>
          <div className="tm-stats">
            {[
              ['4', 'Specialist agents'],
              ['Chat-first', 'Guided planner'],
              ['₹-aware', 'Budget-first plans'],
            ].map(([k, v]) => (
              <div key={v}>
                <b className="font-display">{k}</b>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tm-hero-visual rise" style={{ animationDelay: '120ms' }}>
          <div className="tm-hero-img">
            <img
              src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80"
              alt="Tropical beach at golden hour"
              loading="eager"
            />
          </div>
          <div className="tm-trace-card">
            <div className="tm-trace-top">
              <span className="tm-trace-icon">🤖</span>
              <div>
                <b>Orchestrator · live trace</b>
                <span>Transport ✓ · Stay ✓ · Activities ✓ · Budget ✓</span>
              </div>
            </div>
            <div className="tm-trace-bar"><i /></div>
          </div>
        </div>
      </section>

      {/* Agent strip */}
      <section id="how" style={{ scrollMarginTop: 96 }}>
        <div className="tm-agent-grid">
          {AGENTS.map((a) => (
            <div key={a.name} className="tm-agent-card">
              <span className="tm-agent-ico">{a.icon}</span>
              <b>{a.name}</b>
              <p>{a.body}</p>
            </div>
          ))}
        </div>
        <div className="tm-note">
          <span aria-hidden="true">🛡️</span>
          <span>
            Transparent by design: estimates are labelled as demo data. TripMinds never
            claims real-time availability unless a live provider is connected.
          </span>
        </div>
      </section>

      {/* Recent trips */}
      <section style={{ padding: '48px 0 8px' }}>
        <p className="tm-kicker">Your trips</p>
        <h2 className="tm-section-title font-display">Recent Trips</h2>
        <p className="tm-section-sub">Saved on this device — no sign-in needed for V1.</p>
        {trips.length === 0 ? (
          <div className="tm-empty">
            No trips yet. Create your first trip — try “Plan a 3-day Goa trip from Tumakuru for 4 people under ₹8,000”.
          </div>
        ) : (
          <div className="tm-grid">
            {trips.map((t) => (
              <button key={t.id} className="tm-card" onClick={() => onOpen(t.id)}>
                <h3 className="font-display">{t.destination}</h3>
                <div className="route">{t.origin} → {t.destination}</div>
                <div className="meta">
                  <span className="tm-pill accent">{inr(t.total ?? t.budget)}</span>
                  <span className="tm-pill">{t.days} Day{t.days > 1 ? 's' : ''}</span>
                  <span className="tm-pill">{t.travelers} traveler{t.travelers > 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
