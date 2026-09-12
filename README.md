## TripMinds

A multi-agent AI travel planner that turns natural-language trip requests into budget-validated, day-by-day itineraries, using parallel specialist agents and a deterministic cost-optimization engine.
## 🛠️ Technology

![Node.js](https://img.shields.io/badge/Node.js-Runtime-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![OpenAI](https://img.shields.io/badge/OpenAI--Compatible-Optional_LLM-412991?style=for-the-badge&logo=openai&logoColor=white)

## 📸 Screenshots

### 🏠 Landing Page

![Screenshot 2026-09-12 195916.png](../../../Pictures/Screenshots/Screenshot%202026-09-12%20195916.png)
*Chat-first planning with live multi-agent orchestration trace — transport, stay, activity, and budget agents shown resolving in real time.*
## Features

- 🤖 **Multi-agent orchestration** — transport, stay, activity, and budget agents run in parallel via `Promise.all`, each returning structured JSON candidates
- 💬 **Conversational trip design** — free-text chat is parsed into a live Trip Brief (origin, budget, travelers, style, interests) with single-question follow-ups for whatever's missing
- 🗺️ **Automatic trip classification** — Local / Within-State / Domestic / International, based on origin-destination distance and country
- 💰 **Deterministic budget engine** — transport + stay + activities + food + local transport + a 6% contingency buffer, computed with real arithmetic, never LLM guesswork
- ⚖️ **Budget optimization with concrete swaps** — cheaper transport → cheaper stay → free-activity substitution → budget-tier food/local transport, applied in order until the plan fits
- 🚫 **Honest infeasibility detection** — flags trips that can't realistically fit the stated budget and suggests concrete alternatives instead of silently under-reporting cost
- 🔁 **Conversational refinement loop** — natural follow-up instructions ("no bus," "make it cheaper," "add comfort") re-optimize the existing plan without a full replan
- 🧠 **LLM-ready architecture with heuristic fallback** — runs fully offline on scoring-based heuristics with zero API dependencies; an OpenAI-compatible integration point lets a real LLM take over option selection, day theming, and personalization when a key is configured
- 🌍 **International trip notes** — currency, visa, and transport guidance surfaced automatically for cross-border trips
- ⚡ Lightweight Node.js/Express API backing a React + Vite single-page frontend

## How It Works

TripMinds combines **conversational intake** with **deterministic, budget-aware planning**.

### 💬 1. Chat
Describe your trip in plain language. A pattern-based extraction layer pulls out origin, destination, budget, days, travelers, style, and interests.

⬇️

### 📋 2. Build the Brief
Missing details are collected one question at a time, and the trip is auto-classified as Local, Within-State, Domestic, or International.

⬇️

### 🤖 3. Fan Out to Agents
The orchestrator dispatches the brief to transport, stay, and activity agents **in parallel**, each returning cost-estimated, structured candidates.

⬇️

### 💰 4. Validate the Budget
A deterministic budget agent totals transport, stay, activities, food, local transport, and a contingency buffer against the stated budget.

⬇️

### ⚖️ 5. Optimize if Needed
If the plan is over budget, ranked swaps are applied automatically — cheaper transport, cheaper stay, free activities, budget-tier food — until it fits, or the trip is flagged as genuinely infeasible with alternatives.

⬇️

### 🗓️ 6. Deliver the Itinerary
A day-by-day plan is assembled from the chosen options, ready to refine further with plain instructions like "no bus" or "make it cheaper."

### 🚀 Workflow

**💬 Chat → 📋 Build Brief → 🤖 Fan Out to Agents → 💰 Validate Budget → ⚖️ Optimize → 🗓️ Deliver Itinerary**

---

## 🚀 Run Locally

## 🧰 Prerequisites

- 🟢 **Node.js 18+**
- 📦 **npm**

## 1️⃣ 📥 Clone the Repository

```bash
git clone https://github.com/gagan232005/TripMinds.git
cd TripMinds
```

## 2️⃣ ⚙️ Backend Setup

Copy the example environment file:

```bash
cp .env.example .env
```

```env
PORT=5101

# Optional — without a key, TripMinds runs fully on its deterministic
# local pipeline (regex extraction + heuristic agent scoring).
# With a key, an LLM reads chat messages, selects among shortlisted
# agent options, and personalizes the itinerary. Budget math always
# stays deterministic — never LLM arithmetic.
# LLM_API_KEY=sk-your-key-here
# LLM_MODEL=gpt-4o-mini
# LLM_BASE_URL=https://api.openai.com/v1
```

Install dependencies and run:

```bash
npm install
npm run dev
```

The backend will be available at:

- 🌐 **API:** http://localhost:5101

## 3️⃣ 🎨 Frontend Setup

```bash
cd web
npm install
npm run dev
```

The frontend will be available at:

- 💻 **Application:** http://localhost:5175

> 💡 To serve the frontend from the same Express server, build it first with `npm run build:web` from the project root, then just run the backend — it will serve the compiled `web/dist` automatically.

## 🔒 Environment Variables

For security, never commit `.env` files or expose sensitive credentials in source code.

- 🔌 **PORT** – Port the Express server listens on
- 🔑 **LLM_API_KEY** – Optional OpenAI-compatible API key for AI-driven option selection and personalization
- 🧠 **LLM_MODEL** – Optional model name (defaults work with any OpenAI-compatible endpoint)
- 🌐 **LLM_BASE_URL** – Optional base URL, so OpenRouter, Together, local Ollama, etc. also work

---

> 💡 **Note:** Run the backend and frontend in separate terminals during development. The backend must be running for the frontend to reach the API.

## 🗺️ Roadmap

- 🧠 **Deeper LLM Integration** — Expand the LLM seam beyond option selection into richer, fully personalized narrative itineraries.
- 🌍 **Live Pricing** — Replace estimated demo pricing with real-time transport and stay fares.
- 🏨 **More Agent Categories** — Add dedicated agents for dining and local experiences.
- 📱 **Mobile-Optimized UI** — Refine the React frontend for smaller screens.
- 🧪 **Automated Tests** — Coverage for NLP extraction, budget optimization, and agent orchestration logic.
- ☁️ **Production Deployment** — Deploy the backend and frontend once ready.

> 🚀 **TripMinds is an evolving exploration of multi-agent orchestration and budget-aware planning — built to plan real trips with honest, transparent numbers.**

## 👨‍💻 Author

Built and maintained with ❤️ by **Gagan V**

🎓 Computer Science Engineering Student

🔗 **LinkedIn:** [Gagan V](https://www.linkedin.com/in/gagan232005/)

🔗 **GitHub:** [Gagan](https://github.com/gagan232005/)

> 🚀 **TripMinds is an independent project built to explore multi-agent system design, deterministic budget logic, and conversational UX for real-world trip planning.**