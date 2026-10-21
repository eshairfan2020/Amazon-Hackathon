# Anchor AI frontend (Next.js, JavaScript, Tailwind)
Pages: /login, /overview (Inventory Dashboard), /skus (catalog: search, filter, sort, add/edit/delete, CSV import/export), /settings.
All API calls go through `lib/api.js` (adds the Supabase access token). Styling: Tailwind only; tokens in `tailwind.config.js`, shared classes in `app/globals.css`.
Env: see `.env.example`. Run: `npm install && npm run dev`. Check: `npm run build && npm run lint`.
