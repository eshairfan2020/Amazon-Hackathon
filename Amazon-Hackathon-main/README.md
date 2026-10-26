# ⚓ Anchor AI: Inventory Intelligence for Amazon Sellers

> An inventory command center that spots stockouts and overstock early, explains *why* in plain words, recommends what to reorder and how to price, and lets you update stock by scanning a barcode or just talking to it.

**Amazon Developer Hackathon 2026 · Alexa track**

| | |
|---|---|
| Live demo | `[https://inventorymanagmentsystem-v1.vercel.app]` |
| Demo video (under 3 min) | `[https://youtu.be/PZf8Wh_z8HM?feature=shared]` |
| Team | `[Esha Irfan and Gul-e-Rehmat]` |

> **Independent project.** Anchor AI is not affiliated with or endorsed by Amazon. All inventory, order and customer data in the demo is **synthetic**. No Amazon credentials are used or required.

---

## Contents
1. [The problem](#the-problem)
2. [What it does](#what-it-does)
3. [Honest status](#honest-status)
4. [Try it in 3 minutes (for judges)](#try-it-in-3-minutes-for-judges)
5. [Architecture](#architecture)
6. [How the risk engine works](#how-the-risk-engine-works)
7. [The AI Business Partner](#the-ai-business-partner)
8. [Voice and Alexa](#voice-and-alexa)
9. [Run it locally](#run-it-locally)
10. [Environment variables](#environment-variables)
11. [Tests](#tests)
12. [Deploy to Vercel](#deploy-to-vercel)
13. [API reference](#api-reference)
14. [Security and privacy](#security-and-privacy)
15. [Known limitations](#known-limitations)
16. [Roadmap](#roadmap)
17. [AI tools used](#ai-tools-used)
18. [License](#license)

---

## The problem
Amazon sellers lose money in two opposite ways:

- **Stockouts:** lost sales, lower ranking, unhappy customers.
- **Overstock:** cash frozen in inventory and storage fees.

Most tools show a spreadsheet of numbers but never say what is wrong, why it matters, or what to do next. Anchor AI acts like a calm business partner: it tells you what needs attention first, explains the reason, and helps you act.

## What it does

| Module | What you get |
|---|---|
| **Inventory dashboard** | Total SKUs, inventory value, low-stock and overstock counts, inbound units and a health score, with filters (SKU, category, warehouse, supplier, marketplace, risk) and charts for stock by category, days of cover, sales velocity, 30-day sales and forecasted stockout dates. |
| **SKU management** | Create, edit, delete, search, filter, sort, paginate, **CSV import and export** (formula-injection safe). Every SKU carries ASIN, barcode, supplier, cost, price, stock buckets (fulfillable, inbound, reserved, unfulfillable), lead time, safety stock and reorder point. |
| **Risk engine** | Per SKU: sales velocity, days of cover, reorder point, recommended reorder quantity and date, stockout and overstock risk, health score, and a plain-language explanation. Classes: *Healthy, Low Stock, Critical Stockout Risk, Overstock, Slow Moving, Stranded Inventory*. |
| **Scan & Count** | Scan a product barcode (phone camera, or a USB/Bluetooth scanner), then **receive a shipment, do a cycle count or mark damaged units**. Discrepancies are flagged with their dollar value, every change is audited, and the risk badge updates immediately. SKU pages show a scannable EAN-13 label for demos. |
| **AI Business Partner** | Chat about stock levels, reorders, overstock, margins, pricing strategy and orders. Every number comes from your own data (see below). |
| **Orders & Deliveries** | Orders received, parcels delivered, in transit, returned, cancelled, net revenue, repeat-customer rate, per-product order history and **anonymous** customer purchase history. CSV import for real data. |
| **Anchor Bot + voice** | A floating bot on the dashboard. Click it to chat, or say **"Hi Alexa" / "Hi Anchor"** for hands-free commands such as *"add 20 body lotions"* (always confirmed with a yes/no first). A matching **Alexa custom skill** backend is included. |
| **Accounts and roles** | Email and Google sign-in (Supabase). Roles: **admin, manager, viewer**, enforced on the server. |

## Honest status

| Area | Status |
|---|---|
| REST API, validation, roles, risk engine, pricing maths, CSV import/export, orders analytics, audit log | ✅ Built and covered by automated tests |
| Frontend (dashboard, SKUs, orders, scan, AI partner, settings, bot) | ✅ Builds and lints cleanly; checked in a headless browser |
| Alexa skill backend (signature verification, intents, confirm flow) | ✅ Built and unit-tested · ⚠️ **not yet run on a physical Echo or the live Alexa Developer Console** |
| Browser voice ("Hi Alexa" wake word, Anchor Bot) | ✅ Tested with a simulated microphone · ⚠️ real-microphone and audible-speech behaviour not tested |
| Amazon Bedrock rewrite of AI replies | ⚠️ Code written and tested with stubs · **not tried against the real service**; off by default |
| Persistent database | ❌ Not yet. Data is **in memory** (resets on restart). The Postgres schema is designed in [`backend/db/schema.sql`](backend/db/schema.sql) |
| Amazon Selling Partner API sync | ❌ Not built. Demo data only |

## Try it in 3 minutes (for judges)
1. Open the live demo and sign up (email or Google). The synthetic demo catalog (30 SKUs, 90 days of sales, ~5,000 orders) loads automatically.
2. **Dashboard:** Anchor Bot (bottom-right) greets you based on your numbers. Look at the health score and the forecasted stockout dates.
3. **SKUs → Why?** on a *Critical* product: read the plain-language explanation and the recommended reorder quantity. The barcode label is shown there.
4. **Scan & Count:** type (or scan) that barcode, choose *Receive shipment*, enter a big quantity, and watch the badge change from Critical to Healthy.
5. **AI Partner:** ask *"What should I reorder today?"*, *"How should I price the memory foam pillow?"* and *"How many orders were delivered this week?"*.
6. **Voice:** click the bot, or enable hands-free and say *"Hi Alexa, add 20 body lotions to my inventory"*, then *"yes"*. It creates a **draft** item marked "Needs details".

## Architecture

```
Browser (Next.js 14, React, Tailwind)  ──►  Fastify REST API  ──►  services  ──►  repository (in-memory)
   Supabase Auth (email / Google)             validation (Zod)       business       domain: risk engine, pricing,
   Web Speech API (voice, wake word)          roles, rate limits     rules          orders analytics, voice language
                                              Alexa endpoint (signature-verified)
```

```
.
├── backend/                 Fastify REST API (Node.js ES modules, plain JavaScript)
│   ├── src/domain/          Pure logic: risk engine, pricing, orders, voice language, Zod schemas
│   ├── src/services/        Business rules: SKUs, orders, scan, assistant, voice, demo, audit
│   ├── src/repositories/    In-memory repository (Postgres design in db/schema.sql)
│   ├── src/routes/          REST routes: input validation + role checks
│   ├── src/alexa/           Alexa skill handler + Amazon request-signature verification
│   ├── alexa/               Alexa interaction model (JSON)
│   ├── db/schema.sql        Target relational schema (PostgreSQL / Supabase)
│   └── tests/               Vitest suite
├── frontend/                Next.js (App Router) + Tailwind CSS
│   ├── app/                 Pages: login, overview, skus, orders, scan, assistant, settings
│   ├── components/          UI components, charts (SVG), Anchor Bot
│   └── lib/                 API client, CSV, wake-word, formatting
└── docs/                    DEPLOYMENT_VERCEL.md, ALEXA_SETUP.md
```

**Tech stack:** Next.js 14 · React · Tailwind CSS · Fastify · Zod · Supabase Auth · Vitest · Vercel · browser BarcodeDetector and Web Speech APIs · Alexa Skills Kit (custom skill) · optional Amazon Bedrock.

## How the risk engine works
Transparent formulas, not a black box. Every result is labelled an **estimate**.

- **Velocity** = 60% of the 30-day average + 40% of the 90-day average (units/day).
- **Days of cover** = sellable stock ÷ velocity.
- **Reorder point** = velocity × lead time + safety stock.
- **Recommended order** = velocity × (lead time + 45 days) + safety stock − (stock + inbound).
- **Class** (first match wins): *Stranded* → *Critical* (≤ 7 days of cover and inbound won't arrive within the lead time, or out of stock with demand) → *Low Stock* (position ≤ reorder point) → *Slow Moving* (< 0.3 units/day, ≥ 90 days of cover) → *Overstock* (> 120 days of cover) → *Healthy*.
- **Health score** (0 to 100): class base minus penalties for unfulfillable and excess stock. The dashboard score is the average.

Thresholds can be overridden with `RISK_CONFIG_JSON`. See `backend/src/domain/inventory.js`.

## The AI Business Partner
Designed so it **cannot invent numbers**:

1. A calculation layer builds the answer from the user's own computed data (stock, margins, orders).
2. By default that answer is returned directly, labelled "built-in analyst". **No AI keys are needed.**
3. Optionally (`AI_PROVIDER=bedrock`), an Amazon Bedrock model only *rephrases* the grounded answer in a friendlier voice. It is told to keep every number unchanged and to treat product text as untrusted. If it fails, the built-in answer is returned.
4. It is **read-only**: no tools, no write access. Each user only sees their own data. Chat is limited to 20 questions per minute per client.

Pricing replies state their assumptions (default 15% Amazon fee, no fulfilment fee, adjustable by saying e.g. "fees are 20%") and say plainly that no competitor or demand data is used.

## Voice and Alexa
Three layers share one command engine (`backend/src/services/voice.js`):

| Layer | What it is |
|---|---|
| **Alexa custom skill** (`POST /api/v1/alexa`) | Handles *add / how many / what's low / what to reorder* with spoken **confirmation before any change**. Verifies Amazon's certificate chain, signature, timestamp (150 s) and skill ID. Pending confirmations travel in Alexa session attributes. |
| **Anchor Bot** (dashboard) | Floating bot. Click to chat, or use hands-free **"Hi Alexa" / "Hi Anchor"** (browser speech recognition; opt-in; nothing is sent to our server unless the wake phrase is heard). |
| **Voice panel** (AI Partner page) | A typed/spoken simulator of the same commands, usable without an Echo. |

Voice-created products are **drafts** (name and quantity only), flagged "Needs details" until price, supplier and ASIN are completed in the app. Setup guide: [`docs/ALEXA_SETUP.md`](docs/ALEXA_SETUP.md).

## Run it locally
Requirements: **Node.js 20+**, a Supabase project (for sign-in; Google provider optional).

```bash
# 1. Backend  (http://127.0.0.1:3001)
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run dev

# 2. Frontend  (http://localhost:3000)
cd ../frontend
cp .env.example .env.local    # then fill in the 3 values below
npm install
npm run dev
```

`AUTH_MODE=demo` (the default in `backend/.env.example`) needs no backend login and seeds the demo catalog on start. The frontend still signs in through Supabase. To make the backend verify real Supabase tokens, use the settings in the next section.

## Environment variables

**Backend** (`backend/.env`; see `.env.example`):

| Variable | Purpose |
|---|---|
| `AUTH_MODE` | `demo` (local only) · `supabase` (verify Supabase tokens) · `bearer` (static tokens). **Defaults to `bearer` in production**, so set `supabase` when deploying. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Public project URL and anon key (never the service-role key). |
| `ADMIN_EMAILS` | Comma-separated emails that get the admin role (others start as manager). |
| `CORS_ORIGINS` | Exact frontend origins, e.g. `https://inventorymanagmentsystem-v1.vercel.app`. |
| `AUTO_DEMO_DATA` | `true` gives each signed-in user the synthetic catalog on first request (demo hosting). |
| `TRUST_PROXY` | `true` behind Vercel so rate limits use real client IPs. |
| `RATE_LIMIT_MAX` | Requests per minute per client. |
| `AI_PROVIDER`, `BEDROCK_MODEL_ID`, `AWS_REGION` | `fallback` (default) or `bedrock` (needs AWS credentials and `npm i @aws-sdk/client-bedrock-runtime`). |
| `ALEXA_SKILL_ID`, `ALEXA_LINKS`, `ALEXA_VERIFY` | Alexa skill id, `<alexa user id>:<anchor user id>` links, and signature checks (must stay `true` in production). |
| `RISK_CONFIG_JSON` | Optional risk-engine threshold overrides. |

**Frontend** (`frontend/.env.local`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL, no trailing slash. Baked in at build time: redeploy after changing. |
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase URL as the backend. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same anon key as the backend. |

> Never commit `.env` files. Only the public Supabase anon key is used.

## Tests
```bash
cd backend && npm test          # Vitest: 68 tests
cd frontend && npm run build && npm run lint
```
The backend suite covers the risk rules, SKU service, CSV import/export, role enforcement, injection-style input, orders analytics, barcode lookup and stock adjustments, pricing maths, assistant answers, voice commands, and Alexa request verification (using test certificates). The frontend has build and lint checks only (no unit tests yet).

## Deploy to Vercel
Two Vercel projects from one repo: **backend** (Root Directory `backend`) and **frontend** (Root Directory `frontend`). Full step-by-step guide with environment variables, a release checklist and troubleshooting: [`docs/DEPLOYMENT_VERCEL.md`](docs/DEPLOYMENT_VERCEL.md). The frontend's **Settings → Connection check** shows exactly where a misconfigured deployment is failing.

## API reference
All routes are under `/api/v1` and return `{ data, meta }` or `{ error: { code, message, requestId } }`. A Bearer token is required except `/health` and `/alexa` (which is verified by Amazon's signature).

| Method | Path | Role |
|---|---|---|
| GET | `/health` (no prefix) | public |
| GET | `/me` | any |
| GET | `/dashboard` | any |
| GET · POST | `/skus` | any · admin, manager |
| GET · PATCH · DELETE | `/skus/:skuId` | any · admin, manager · admin |
| GET | `/skus/export` (CSV) | any |
| POST | `/skus/import` | admin, manager |
| GET | `/scan/lookup?code=` | any |
| POST | `/skus/:skuId/adjust` | admin, manager |
| GET | `/adjustments` | any |
| GET | `/orders`, `/orders/summary`, `/orders/:orderId` | any |
| POST | `/orders/import` | admin, manager |
| GET | `/customers`, `/customers/:customerRef` | any |
| POST | `/assistant/chat` | any (read-only) |
| POST | `/voice/command` | any (changes need admin or manager and confirmation) |
| POST | `/alexa` | Alexa (signature-verified) |
| POST | `/demo/load` | admin, manager |
| GET | `/audit-logs` | admin |

## Security and privacy
- **Server-side auth and roles** on every request; user data is scoped per user.
- **Input validation** with Zod on JSON, query strings and CSV rows; unknown fields are rejected; request bodies are size-limited.
- **No SQL layer yet**, so no string-built queries. The future Postgres repository must use parameterized queries.
- **Rate limiting**, a strict CORS allow-list, and `no-store` caching on API responses.
- **CSV export** neutralises spreadsheet formula injection.
- **Audit trail** records field names and ids only, never secrets or raw message text.
- **Alexa requests** are verified (certificate chain, signature, timestamp, skill id); verification cannot be disabled in production.
- **Changes by voice always need confirmation.** The AI partner is read-only.
- **Customers are anonymous IDs.** The order importer rejects names and emails. Amazon restricts buyer personal data for sellers, so this project does not collect it.
- **Hands-free listening is opt-in and visible.** In Chrome, speech recognition is processed by the browser's cloud speech service while listening is on.

## Known limitations
- **Data is in memory.** On serverless hosting (Vercel) it can reset when an instance is recycled, so user edits are not durable. `AUTO_DEMO_DATA` keeps the demo screens consistent. A persistent Postgres store is the next step.
- **Demo data only.** No live Amazon integration yet.
- **Alexa linking is configuration-based** (`ALEXA_LINKS`), not OAuth Account Linking, so it is not ready for skill certification.
- **Camera barcode scanning** uses the browser BarcodeDetector API (Chrome/Edge over HTTPS or localhost; not iOS Safari). Typed entry and USB scanners work everywhere.
- **Hands-free "Hi Alexa"** works best in desktop Chrome or Edge. Saying "Alexa" can also wake a real Echo in the same room: use "Hi Anchor" for demos.
- **Forecasts are simple estimates** (current stock ÷ recent velocity). Seasonality and trend forecasting is planned.

## Roadmap
- Persistent storage (Supabase Postgres; schema already designed)
- Amazon Selling Partner API sync for FBA inventory
- 7/30/60-day demand forecasting with seasonality and manual adjustments
- Auto-generated tasks, supplier and purchase-order tracking
- Chat that can propose stock changes (with confirmation)
- Alexa OAuth Account Linking and skill certification
- Wider barcode support on iPhone and push notifications

## AI tools used
- **Claude (Anthropic)** as a coding and architecture assistant: system design, code and test generation, review, and documentation. Our team defined the requirements, integrated, tested and deployed the result.
- In the product, the AI Business Partner uses a built-in rule-based analyst by default. An optional Amazon Bedrock model can rephrase answers when configured.

## License
MIT License

Copyright (c) 2026 [ Debug Dynasty]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
