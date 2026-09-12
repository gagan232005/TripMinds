'use strict';

/**
 * LLM client — TripMinds' real-AI layer (OpenAI-compatible API).
 *
 * - Without LLM_API_KEY: every caller falls back to the deterministic local
 *   pipeline (regex NLP, heuristic agent scoring). The app fully works.
 * - With a key: the model genuinely reasons — extracting trip requirements
 *   from free text and choosing among shortlisted agent options.
 * - Budget arithmetic NEVER goes through the model (see budgetAgent.js).
 */

function isEnabled() {
  return Boolean(process.env.LLM_API_KEY);
}

function parseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch { /* try brace-matching below */ }
  const start = raw.search(/[{[]/);
  if (start >= 0) {
    for (let end = raw.length; end > start; end--) {
      try {
        return JSON.parse(raw.slice(start, end));
      } catch { /* shrink and retry */ }
    }
  }
  return null;
}

async function completeJSON({ system, user, maxTokens = 500, temperature = 0.2, timeoutMs = 20000 }) {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return parseJSON(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Light friendly rewording of an already-computed reply (cosmetic only). */
async function reword(text) {
  if (!isEnabled()) return text;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 120,
        messages: [
          { role: 'system', content: 'You are TripMinds, a concise friendly travel planner. Keep the meaning, stay under 60 words.' },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isEnabled, completeJSON, reword };
