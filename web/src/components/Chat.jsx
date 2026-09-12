import { useEffect, useRef, useState } from 'react';
import { chatApi, locationsApi } from '../lib/api.js';
import TripBrief from './TripBrief.jsx';

const STARTER =
  "Hi! 👋 Tell me about the trip you're planning.\n\nYou can say something like:\n“Plan a 3-day Goa trip from Tumakuru for 4 people under ₹8,000.”";

export default function Chat({ onPlan, thinking }) {
  const [brief, setBrief] = useState({});
  const [msgs, setMsgs] = useState([{ role: 'ai', text: STARTER }]);
  const [input, setInput] = useState('');
  const [quick, setQuick] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = useState(true);
  const [suggest, setSuggest] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, busy]);

  useEffect(() => {
    let alive = true;
    const q = input.trim();
    if (q.length < 2) {
      setSuggest([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const hits = await locationsApi(q.split(/\s+/).pop());
        if (alive) setSuggest(hits.slice(0, 5));
      } catch {
        /* offline — ignore */
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [input]);

  async function send(text, quickReply = null) {
    const content = (text || '').trim();
    if (!content && !quickReply) return;
    setMsgs((m) => [...m, { role: 'user', text: quickReply || content }]);
    setInput('');
    setSuggest([]);
    setQuick([]);
    setBusy(true);
    try {
      const out = await chatApi(brief, content, quickReply);
      setBrief(out.brief || {});
      if (out.ai) setAiOn(true);
      setMsgs((m) => [...m, { role: 'ai', text: out.reply }]);
      setQuick(out.quickReplies || []);
      setReady(Boolean(out.ready));
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e.message || 'Something went wrong. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  const summary = [brief.origin && brief.destination ? `${brief.origin} → ${brief.destination}` : null,
    brief.days ? `${brief.days} days` : null,
    brief.travelers ? `${brief.travelers} travelers` : null,
    brief.budget ? `₹${brief.budget.toLocaleString('en-IN')}` : null,
    brief.travelStyle || null].filter(Boolean);

  return (
    <div className="tm-chat-wrap">
      <div className="tm-chat">
        <div className="tm-chat-head">
          <b>TripMinds AI</b>
          <span>{aiOn ? '✨ AI reasoning on · Your personal travel planner' : 'Your personal travel planner'}</span>
        </div>
        <div className="tm-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`tm-msg ${m.role}`}>{m.text}</div>
          ))}
          {busy && <div className="tm-msg ai typing">TripMinds is thinking…</div>}
          <div ref={bottomRef} />
        </div>

        {suggest.length > 0 && (
          <div className="tm-suggest">
            {suggest.map((s) => (
              <button key={s.name} onClick={() => send(`${input.replace(/\S+\s*$/, '')}${s.name} `.trim())}>
                📍 {s.name}
              </button>
            ))}
          </div>
        )}

        {quick.length > 0 && !busy && (
          <div className="tm-quick">
            {quick.map((q) => (
              <button key={q} onClick={() => send('', q)}>{q}</button>
            ))}
          </div>
        )}

        {ready && (
          <div className="tm-confirm">
            <b>Here's what I have.</b>
            <ul>
              <li>Origin: {brief.origin}</li>
              <li>Destination: {brief.destination}</li>
              <li>Duration: {brief.days} day{brief.days > 1 ? 's' : ''}</li>
              <li>Travelers: {brief.travelers}</li>
              <li>Budget: ₹{brief.budget.toLocaleString('en-IN')}</li>
              <li>Style: {brief.travelStyle}</li>
              {brief.interests?.length > 0 && <li>Interests: {brief.interests.join(', ')}</li>}
            </ul>
            <button className="tm-btn" disabled={thinking} onClick={() => onPlan(brief)}>
              {thinking ? 'Planning…' : 'Plan My Trip'}
            </button>
          </div>
        )}

        <form
          className="tm-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell TripMinds about your trip..."
            aria-label="Tell TripMinds about your trip"
          />
          <button className="tm-send" type="submit" disabled={busy}>Send</button>
        </form>
        {summary.length > 0 && <div style={{ display: 'none' }}>{summary.join(' ')}</div>}
      </div>

      <TripBrief brief={brief} collapsed={briefCollapsed} onToggle={() => setBriefCollapsed((c) => !c)} />
    </div>
  );
}
