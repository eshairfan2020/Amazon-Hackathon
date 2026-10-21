# Architecture (Phase 1)

    Next.js (JS, Tailwind)  ->  Fastify REST API  ->  services  ->  repository (memory now, Postgres next)
      Supabase Auth (JWT) ------> verified server-side on every request; role comes from the server, never the client

Layers (backend/src): routes (validate + authorize) -> services (business rules) -> repositories (storage) -> domain (pure risk engine).
AI provider is a stub (`services/ai`); Bedrock plugs in for forecasting (Phase 3) and the copilot (Phase 5).

## Risk engine (domain/inventory.js)
- Velocity = 0.6 x 30-day avg + 0.4 x 90-day avg (units/day). Days of cover = sellable stock / velocity.
- Reorder point = velocity x lead time + safety stock. Recommended order = velocity x (lead + 45 days) + safety - (stock + inbound).
- Classes (first match wins): Stranded (status stranded, or inactive with stock) > Critical (<=7 days cover and inbound will not arrive within lead time, or out of stock with demand) > Low Stock (position <= reorder point) > Slow Moving (<0.3 units/day, >=90 days cover) > Overstock (>120 days cover) > Healthy.
- Health score 0-100: class base (Healthy 100, Low 62, Overstock 58, Slow 45, Stranded 35, Critical 20) minus unfulfillable and overstock penalties. Dashboard score = average.
- Every result carries a plain-language explanation and is labelled an estimate. Thresholds: RISK_CONFIG_JSON env override.

## API (all under /api/v1, JSON `{data, meta}` or `{error}`; Bearer token required unless AUTH_MODE=demo)
| Method | Path | Role |
|---|---|---|
| GET | /me | any |
| GET | /dashboard?q&category&supplier&warehouse&marketplace&risk | any |
| GET | /skus?...filters&sort&dir&limit&cursor | any |
| GET | /skus/export (CSV, same filters) | any |
| POST | /skus | admin, manager |
| GET | /skus/:skuId | any |
| PATCH | /skus/:skuId | admin, manager |
| DELETE | /skus/:skuId | admin |
| POST | /skus/import `{rows:[...]}` (max 500, partial success) | admin, manager |
| POST | /demo/load (empty catalog only) | admin, manager |
| GET | /audit-logs | admin |
Security: zod validation on every input, rate limiting, CORS allow-list, 64 KB body limit (1 MB on import), per-user data scoping, CSV formula-injection neutralised on export, no string-built queries (no SQL layer yet; the Postgres repository must use parameterized queries).

## Schema
`backend/db/schema.sql`: teams, users, warehouses, suppliers, products, inventory (FBA buckets: fulfillable, inbound, reserved, unfulfillable, researching), sales_history, forecasts, purchase_orders(+lines), tasks, notifications, audit_logs, with RLS example.

## Roadmap
2: Postgres repository + suppliers/POs + SP-API adapter interface. 3: forecasting (7/30/60d, seasonality, manual adjust). 4: smart tasks. 5: copilot with tool-created tasks. 6: polish + deploy.
