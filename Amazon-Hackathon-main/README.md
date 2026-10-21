# Anchor AI: Amazon Inventory Intelligence (Phase 1)

AI-powered inventory command center for Amazon sellers: stock health, stockout/overstock risk, reorder recommendations.
Phase 1 = SKU management + inventory model + risk engine + dashboard + auth + RBAC + demo data.

## Run locally (2 terminals)
Backend (Node 20+):
    cd backend && cp .env.example .env && npm install && npm run dev      # http://127.0.0.1:3001
Frontend:
    cd frontend && cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
    npm install && npm run dev                  # http://localhost:3000

`AUTH_MODE=demo` (default in .env.example) needs no login on the backend and seeds 30 synthetic SKUs + 90 days of sales.
For real sign-in set `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `ADMIN_EMAILS`. Then open the app, sign in, and use
Settings > Load demo data (empty catalogs only).

Tests: `cd backend && npm test` (19 tests: risk engine, SKU service, CSV, RBAC, SQL-injection-looking input).

## What is real vs demo
- Real: REST API, validation, auth verification (Supabase), roles, risk engine, CSV import/export, audit trail.
- Demo/synthetic: all inventory and sales data (labelled). No Amazon credentials are used or required.
- Storage is IN-MEMORY: data resets when the backend restarts. `backend/db/schema.sql` is the target Postgres/Supabase schema; it is not wired yet.
- Not in Phase 1: forecasting, copilot chat, tasks, suppliers/POs, Selling Partner API sync (see docs/ARCHITECTURE.md).
