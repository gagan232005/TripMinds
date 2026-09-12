'use strict';

/**
 * TripMinds API — lightweight Node.js + Express (JavaScript).
 * Serves the React build (web/dist) and exposes:
 *   GET  /api/health
 *   GET  /api/locations?q=
 *   POST /api/chat      { brief, message } -> { brief, reply, quickReplies, ready }
 *   POST /api/plan      { brief }          -> FinalItinerary (orchestrator)
 *   POST /api/refine    { plan, instruction }
 *   POST /api/optimize  { plan, mode }      (mode: cheaper | comfort)
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { searchPlaces, classifyTrip } = require('./src/locations');
const nlp = require('./src/nlp');
const { planTrip, refine } = require('./src/orchestrator');
const { reword } = require('./src/llm');

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function briefWithType(brief) {
  if (brief.origin && brief.destination) {
    return { ...brief, tripType: classifyTrip(brief.origin, brief.destination) };
  }
  return brief;
}

function briefSummaryLines(b) {
  const lines = [];
  if (b.origin && b.destination) lines.push(`${b.origin} → ${b.destination}`);
  if (b.days) lines.push(`${b.days} Day${b.days > 1 ? 's' : ''}`);
  if (b.travelers) lines.push(`${b.travelers} Traveler${b.travelers > 1 ? 's' : ''}`);
  if (b.budget) lines.push(inr(b.budget));
  if (b.travelStyle) lines.push(b.travelStyle);
  return lines;
}

async function chatReply(brief, patch, userText) {
  const next = briefWithType(nlp.mergeBrief(brief, patch));
  const field = nlp.missingField(next);

  // Special-case: "I have 10k, suggest somewhere" (budget but no destination)
  if (!next.destination && next.budget && /suggest|anywhere|somewhere|idea|recommend/i.test(userText || '')) {
    const suggestion = next.budget <= 6000 ? 'Mysuru' : next.budget <= 12000 ? 'Goa' : next.budget <= 30000 ? 'Kerala' : 'Singapore';
    const text = `With ${inr(next.budget)}, a great fit is ${suggestion}. Want me to plan it? Tell me your starting city and days.`;
    return { brief: next, reply: await reword(text), quickReplies: ['Tumakuru', 'Bengaluru', '3 Days', '4'], ready: false };
  }

  if (!field) {
    const lines = briefSummaryLines(next).join(' · ');
    const text = `Here's what I have: ${lines}. Does that look right? Hit “Plan My Trip” when you're ready.`;
    return { brief: next, reply: await reword(text), quickReplies: [], ready: true };
  }

  const q = nlp.followUpQuestion(field, next);
  let ack = '';
  if (patch.destination) ack = `Got it — ${patch.destination}. `;
  else if (patch.origin) ack = `Starting from ${patch.origin} — noted. `;
  else if (patch.budget) ack = `${inr(patch.budget)} — noted. `;
  else if (patch.days) ack = `${patch.days} days — perfect. `;
  else if (patch.travelers) ack = `${patch.travelers} traveler${patch.travelers > 1 ? 's' : ''} — noted. `;
  else if (patch.travelStyle) ack = `${patch.travelStyle} it is. `;
  else if (patch.interests) ack = `Love it — ${patch.interests.join(', ')}. `;

  const text = `${ack}${q.text}`;
  return { brief: next, reply: await reword(text), quickReplies: q.quickReplies || [], ready: false };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'tripminds', agents: ['orchestrator', 'transport', 'stay', 'activity', 'budget'], llm: process.env.LLM_API_KEY ? 'configured' : 'deterministic-demo' });
});

app.get('/api/locations', (req, res) => {
  const q = String(req.query.q || '');
  res.json(searchPlaces(q).map((p) => ({ name: p.name, state: p.state, country: p.country })));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { brief = {}, message = '', quickReply = null } = req.body || {};
    if (!message && !quickReply) return res.status(400).json({ error: 'Tell TripMinds about your trip to continue.' });
    let patch;
    let ai = false;
    if (quickReply) {
      patch = nlp.applyQuickReply(brief, String(quickReply));
    } else {
      // Real AI first: the LLM reads the message; deterministic regex fills gaps.
      const base = nlp.extractPatch(String(message));
      let llmPatch = null;
      try {
        llmPatch = await nlp.extractPatchLLM(String(message), brief);
      } catch {
        llmPatch = null;
      }
      if (llmPatch) {
        ai = true;
        patch = { ...base, ...llmPatch };
        if (base.interests && llmPatch.interests) {
          patch.interests = [...new Set([...llmPatch.interests, ...base.interests])].slice(0, 8);
        }
      } else {
        patch = base;
      }
      if (Object.keys(patch).length === 0) {
        const next = briefWithType({ ...brief });
        const field = nlp.missingField(next);
        if (field) {
          const q = nlp.followUpQuestion(field, next);
          return res.json({ brief: next, reply: `I didn't quite catch that — ${q.text.charAt(0).toLowerCase() + q.text.slice(1)}`, quickReplies: q.quickReplies, ready: false, ai });
        }
        return res.json({ brief: next, reply: 'Thanks! Hit “Plan My Trip” when you are ready.', quickReplies: [], ready: true, ai });
      }
    }
    const out = await chatReply(brief, patch, String(message || quickReply));
    res.json({ ...out, ai });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong chatting. Please try again.' });
  }
});

app.post('/api/plan', async (req, res) => {
  try {
    const plan = await planTrip(req.body?.brief || req.body || {});
    res.json(plan);
  } catch (err) {
    if (err.code === 'MISSING_BRIEF') {
      return res.status(400).json({ error: `I still need: ${err.missing.join(', ')}.`, missing: err.missing });
    }
    res.status(500).json({ error: 'Planning failed. Please try again.' });
  }
});

app.post('/api/refine', async (req, res) => {
  try {
    const { plan, instruction = '', brief = null } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'A generated trip is required to refine.' });
    const out = await refine(plan, instruction, brief);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Could not update your trip. Please try again.' });
  }
});

app.post('/api/optimize', async (req, res) => {
  try {
    const { plan, mode = 'cheaper' } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'A generated trip is required to optimize.' });
    const brief = { ...(plan.brief || {}) };
    if (mode === 'cheaper') brief.travelStyle = 'Budget';
    if (mode === 'comfort') brief.travelStyle = brief.travelStyle === 'Luxury' ? 'Luxury' : 'Comfort';
    const out = await refine(plan, mode === 'cheaper' ? 'make it cheaper' : 'make it more comfortable', brief);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Optimization failed. Please try again.' });
  }
});

// Serve React build when present
const distDir = path.join(__dirname, 'web', 'dist');
if (fs.existsSync(distDir)) app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  return res.status(404).json({ error: 'TripMinds web build not found. Run `npm run build:web` in tripminds/web.' });
});

// Friendly JSON errors only — never leak stack traces.
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'That request was not valid JSON. Please try again.' });
  }
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = Number(process.env.PORT || 5101);
if (require.main === module) {
  app.listen(PORT, () => console.log(`TripMinds live on http://localhost:${PORT}`));
}

module.exports = app;
