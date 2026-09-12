export async function chatApi(brief, message, quickReply = null) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, message, quickReply }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Chat failed. Please try again.');
  return data;
}

export async function planApi(brief) {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Planning failed. Please try again.');
  return data;
}

export async function refineApi(plan, instruction) {
  const res = await fetch('/api/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, instruction }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not update your trip.');
  return data;
}

export async function optimizeApi(plan, mode) {
  const res = await fetch('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, mode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Optimization failed.');
  return data;
}

export async function locationsApi(q) {
  const res = await fetch(`/api/locations?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export const inr = (n) =>
  `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
