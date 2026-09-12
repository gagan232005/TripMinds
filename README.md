# TripMinds — Travel smarter. Spend better.

Budget-first multi-agent AI travel planner (V1).

> "TripMinds uses a lightweight Node.js/Express backend. The user interacts with a
> conversational interface, and the system extracts structured travel requirements.
> An orchestrator delegates the request to specialized transportation, accommodation
> and activity agents. Their results are passed to a budget agent, which validates
> the total cost and triggers optimization when necessary. The orchestrator then
> produces a personalized day-by-day itinerary."

## Architecture

```
            Chat (NLP extraction → Trip Brief)
                        │
                   ORCHESTRATOR (src/orchestrator.js)
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
   TRANSPORT          STAY          ACTIVITY
     AGENT           AGENT            AGENT
   (multi-modal:    (hotel/         (free/low/paid
    train/bus/       hostel/         mix by interests)
    flight/car/      homestay/
    cab/bike)        guesthouse)
        └───────────────┼───────────────┘
                        ↓
                   BUDGET AGENT (deterministic math)
                   validate → optimize if over
                        ↓
                  FINAL ITINERARY
```

- Every agent returns structured JSON (`{ type, options/pick, ... }`).
- Budget math is deterministic (`src/agents/budgetAgent.js`) — never LLM arithmetic.
- Without `LLM_API_KEY`, chat runs on the local NLP extractor (`src/nlp.js`);
  with a key, replies are lightly reworded only. All prices are **Estimated / Demo Data**.

## Run

```bash
cd tripminds
npm install
npm run build:web   # builds the React UI (needs npm install in web/ first)
npm run dev         # API + UI on http://localhost:5101
```

Frontend dev (optional):

```bash
cd tripminds/web
npm install
npm run dev         # UI on http://localhost:5175 (proxies /api → :5101)
```

## API

- `GET /api/health`
- `GET /api/locations?q=go`
- `POST /api/chat` — `{ brief, message }` → `{ brief, reply, quickReplies, ready }`
- `POST /api/plan` — `{ brief }` → FinalItinerary
- `POST /api/refine` — `{ plan, instruction }` → updated itinerary
- `POST /api/optimize` — `{ plan, mode: cheaper|comfort }`

Recent trips are stored in `localStorage` (no auth / DB in V1).
