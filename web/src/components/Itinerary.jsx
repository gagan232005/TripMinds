import { useState } from 'react';
import { inr, refineApi, optimizeApi } from '../lib/api.js';

function pct(plan) {
  if (!plan.budget?.limit) return 0;
  return Math.min(100, Math.round((plan.budget.total / plan.budget.limit) * 100));
}

export default function Itinerary({ plan, onChange, busy, onNew, onHome }) {
  const [instruction, setInstruction] = useState('');
  const [localBusy, setLocalBusy] = useState(null);
  const [error, setError] = useState(null);
  const b = plan.brief || {};
  const over = plan.budget.status === 'over-budget';

  async function act(kind, payload) {
    setError(null);
    setLocalBusy(kind);
    try {
      let out;
      if (kind === 'refine') out = await refineApi(plan, payload);
      else if (kind === 'cheaper') out = await optimizeApi(plan, 'cheaper');
      else if (kind === 'comfort') out = await optimizeApi(plan, 'comfort');
      else if (kind === 'regen') out = await refineApi(plan, 'regenerate with fresh variety');
      onChange(out);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLocalBusy(null);
    }
  }

  const t = plan.transport?.pick;
  const stay = plan.stay?.pick;

  return (
    <div>
      <div className="tm-it-head">
        <h1>Your TripMinds Plan</h1>
        <p>
          {b.origin} → {b.destination} · {b.days} Day{b.days > 1 ? 's' : ''} · {b.travelers} Traveler{b.travelers > 1 ? 's' : ''} · {plan.tripType} Trip
        </p>
        <span className="tm-demo">Estimated / Demo Data — illustrative prices, not live fares</span>
        {plan.aiReasoning && <span className="tm-demo" style={{ marginLeft: 8, background: '#f0fdfa', color: '#0b3b38' }}>✨ AI-personalized</span>}
      </div>

      {plan.personalizationNotes?.length > 0 && (
        <div className="tm-success">
          {plan.personalizationNotes.map((n, i) => <div key={i}>{i === 0 ? <b>{n}</b> : n}</div>)}
        </div>
      )}

      {error && <div className="tm-error">{error}</div>}

      {plan.optimized && (
        <div className="tm-success">
          <b>TripMinds optimized your trip to fit your budget.</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {plan.optimizationSteps.map((s, i) => (
              <li key={i}>{s.title}: {s.detail} — saved {inr(s.save)}</li>
            ))}
          </ul>
        </div>
      )}

      {!plan.optimized && plan.optimizationSteps?.length > 0 && (
        <div className="tm-success">
          <b>TripMinds applied {plan.optimizationSteps.length} saving{plan.optimizationSteps.length > 1 ? 's' : ''} — still {inr(-plan.budget.remaining)} over your budget.</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {plan.optimizationSteps.map((s, i) => (
              <li key={i}>{s.title}: {s.detail} — saved {inr(s.save)}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.impossible && (
        <div className="tm-alert">
          <b>{plan.impossible.headline}</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {plan.impossible.alternatives.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <div className="tm-cols">
        <section className="tm-panel">
          <h2>Budget</h2>
          <p className="sub">{inr(plan.budget.total)} / {inr(plan.budget.limit)} · {over ? `${inr(-plan.budget.remaining)} over` : `${inr(plan.budget.remaining)} remaining`}</p>
          <div className={`tm-budget-bar${over ? ' over' : ''}`}><i style={{ width: `${pct(plan)}%` }} /></div>
          <div className="tm-kv"><span>🚆 Transportation</span><b>{inr(plan.costs.transportation)}</b></div>
          <div className="tm-kv"><span>🏨 Accommodation</span><b>{inr(plan.costs.accommodation)}</b></div>
          <div className="tm-kv"><span>🎯 Activities</span><b>{inr(plan.costs.activities)}</b></div>
          <div className="tm-kv"><span>🍛 Food (est.)</span><b>{inr(plan.costs.food)}</b></div>
          <div className="tm-kv"><span>🚕 Local transport (est.)</span><b>{inr(plan.costs.localTransport)}</b></div>
          <div className="tm-kv"><span>🛟 Buffer</span><b>{inr(plan.costs.emergencyBuffer)}</b></div>
        </section>

        <section className="tm-panel">
          <h2>Transportation</h2>
          <p className="sub">TripMinds Pick {t?.estimated ? '· Estimated' : ''}</p>
          {t ? (
            <div className="tm-opt">
              <b>{t.icon} {t.name} — {inr(t.cost)}</b>
              <small>{t.duration} · {t.recommendation}</small>
            </div>
          ) : <p className="sub">No transport needed.</p>}
          {plan.transport?.options?.filter((o) => o.mode !== t?.mode).slice(0, 3).map((o) => (
            <div key={o.mode} className="tm-opt">
              {o.icon} {o.name} — {inr(o.cost)} <small>{o.duration} · Estimated</small>
            </div>
          ))}
        </section>

        <section className="tm-panel">
          <h2>Accommodation</h2>
          {stay ? (
            <>
              <p className="sub">{stay.kind} · Estimated</p>
              <div className="tm-opt"><b>{stay.name} — {inr(stay.cost)}</b>
                <small>{stay.nights} night{stay.nights > 1 ? 's' : ''} · {stay.rooms} room{stay.rooms > 1 ? 's' : ''} · ★ {stay.rating} · {stay.note}</small>
              </div>
              {plan.stay?.options?.filter((o) => o.kind !== stay.kind).map((o) => (
                <div key={o.kind} className="tm-opt">{o.kind} — {inr(o.cost)}<small>★ {o.rating} · {o.note}</small></div>
              ))}
            </>
          ) : <p className="sub">Local trip — no overnight stay needed.</p>}
        </section>

        <section className="tm-panel">
          <h2>Activities</h2>
          <p className="sub">Mixed free, low-cost & paid picks</p>
          {plan.chosenActivities.map((a, i) => (
            <div key={i} className="tm-opt">
              {a.name} — {a.cost === 0 ? 'Free' : inr(a.cost)}
              <small>{a.kind}{a.tags?.length ? ` · ${a.tags.join(', ')}` : ''}</small>
            </div>
          ))}
        </section>

        {plan.international && (
          <section className="tm-panel">
            <h2>International notes<span className="tm-tag">INFO</span></h2>
            <div className="tm-kv"><span>💱 Currency</span></div>
            <p className="sub">{plan.international.currency}</p>
            <div className="tm-kv"><span>🛂 Visa / entry</span></div>
            <p className="sub">{plan.international.visa}</p>
            <div className="tm-kv"><span>✈️ Getting there</span></div>
            <p className="sub">{plan.international.transport}</p>
          </section>
        )}

        <section className="tm-panel">
          <h2>Day-by-day itinerary</h2>
          <p className="sub">Realistic pacing — travel, rest and evenings included.</p>
          {plan.dailyPlan.map((d) => (
            <div key={d.day} className="tm-day">
              <h3>DAY {d.day} — {d.title}</h3>
              {d.slots.map((s, i) => (
                <div key={i} className="tm-slot"><time>{s.time}</time><span>{s.title}</span></div>
              ))}
            </div>
          ))}
        </section>

        <section className="tm-panel">
          <h2>Smart actions</h2>
          <p className="sub">One tap, or describe any change in your own words.</p>
          <div className="tm-actions">
            <button disabled={busy || localBusy} onClick={() => act('cheaper')}>{localBusy === 'cheaper' ? 'Working…' : 'Make It Cheaper'}</button>
            <button disabled={busy || localBusy} onClick={() => act('comfort')}>{localBusy === 'comfort' ? 'Working…' : 'Make It More Comfortable'}</button>
            <button disabled={busy || localBusy} onClick={() => act('refine', 'change transportation to the next best option')}>Change Transportation</button>
            <button disabled={busy || localBusy} onClick={() => act('refine', 'upgrade accommodation comfort')}>Change Accommodation</button>
            <button disabled={busy || localBusy} onClick={() => act('regen')}>{localBusy === 'regen' ? 'Working…' : 'Regenerate Trip'}</button>
          </div>
          <form
            className="tm-input-row"
            style={{ padding: '14px 0 0', border: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim()) {
                act('refine', instruction.trim());
                setInstruction('');
              }
            }}
          >
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Tell TripMinds what you'd like to change..."
              aria-label="Tell TripMinds what you'd like to change"
            />
            <button className="tm-send" type="submit" disabled={busy || localBusy || !instruction.trim()}>Update</button>
          </form>
          <div className="tm-actions" style={{ marginTop: 16 }}>
            <button className="tm-btn-ghost tm-btn" style={{ textDecoration: 'none' }} onClick={onHome}>← Trips</button>
            <button className="tm-btn" onClick={onNew}>+ New Trip</button>
          </div>
          <div className="tm-trace">
            Agents: {plan.trace.map((tr) => `${tr.agent} (${tr.candidates} options, ${tr.latencyMs}ms)`).join(' · ')}
          </div>
        </section>
      </div>
    </div>
  );
}
