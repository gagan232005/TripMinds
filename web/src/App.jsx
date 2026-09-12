import { useCallback, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Chat from './components/Chat.jsx';
import Planning from './components/Planning.jsx';
import Itinerary from './components/Itinerary.jsx';
import { planApi } from './lib/api.js';
import { getTrips, saveTrip, getPlan } from './lib/store.js';

export default function App() {
  const [view, setView] = useState('dashboard'); // dashboard | chat | planning | itinerary
  const [trips, setTrips] = useState(() => getTrips());
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [planning, setPlanning] = useState(false);

  const goDashboard = useCallback(() => setView('dashboard'), []);

  const openTrip = useCallback((id) => {
    const p = getPlan(id);
    if (p) {
      setPlan(p);
      setView('itinerary');
      window.scrollTo({ top: 0 });
    }
  }, []);

  const handlePlan = useCallback(async (brief) => {
    setError(null);
    setPlanning(true);
    setView('planning');
    const t0 = Date.now();
    try {
      const p = await planApi(brief);
      const wait = Math.max(0, 4200 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      setPlan(p);
      saveTrip(p);
      setTrips(getTrips());
      setView('itinerary');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e.message || 'Planning failed. Please try again.');
      setView('chat');
    } finally {
      setPlanning(false);
    }
  }, []);

  return (
    <div className="tm-shell">
      <header className="tm-header">
        <div className="tm-header-inner">
          <button className="tm-brand" onClick={goDashboard} aria-label="TripMinds home">
            <span className="tm-logo">✈</span>
            <b>TripMinds <span>planner</span></b>
          </button>
          <nav className="tm-nav">
            <button className={`tm-link${view === 'dashboard' ? ' active' : ''}`} onClick={goDashboard}>Trips</button>
            <button className="tm-cta" onClick={() => setView('chat')}>◉ &nbsp;NEW TRIP</button>
          </nav>
        </div>
      </header>

      <main className="tm-main">
        {error && (view === 'chat') && <div className="tm-error">{error}</div>}
        {view === 'dashboard' && (
          <Dashboard trips={trips} onNew={() => setView('chat')} onOpen={openTrip} />
        )}
        {view === 'chat' && <Chat onPlan={handlePlan} thinking={planning} />}
        {view === 'planning' && <Planning done={false} />}
        {view === 'itinerary' && plan && (
          <Itinerary
            plan={plan}
            busy={false}
            onChange={(p) => {
              setPlan(p);
              saveTrip(p);
              setTrips(getTrips());
            }}
            onNew={() => setView('chat')}
            onHome={goDashboard}
          />
        )}
      </main>

      <footer className="tm-footer">
        <div className="tm-footer-inner">
          <span><b>TripMinds</b> · Travel smarter. Spend better.</span>
          <span>Orchestrator + transport, stay, activity & budget agents · Estimated demo data</span>
        </div>
      </footer>
    </div>
  );
}
