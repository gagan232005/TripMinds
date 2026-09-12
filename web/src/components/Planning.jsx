import { useEffect, useState } from 'react';

const STAGES = [
  'Understanding your trip',
  'Comparing transportation',
  'Finding accommodation',
  'Discovering activities',
  'Checking your budget',
  'Optimizing your plan',
  'Building your itinerary',
];

export default function Planning({ done }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) {
      setStep(STAGES.length);
      return;
    }
    setStep(0);
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStep(i + 1), 650 * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [done]);

  return (
    <div className="tm-plan-screen">
      <h1>TripMinds is planning your trip…</h1>
      <p>Your AI travel team is working together.</p>
      <div className="tm-steps">
        {STAGES.map((s, i) => (
          <div key={s} className={`tm-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
            <span className="tm-dot">{i < step ? '✓' : ''}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
