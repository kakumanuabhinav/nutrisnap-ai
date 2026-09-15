# NutriSnap AI — Full-Stack Application

A production-style, full-stack rebuild of the NutriSnap AI prototype: an
AI-powered food nutrition analyzer. Snap a meal photo, get instant
calories/macros/micros and health insights from Gemini Vision, log it, and
track your nutrition over time.

This is a **real application**, not a wrapped demo: authentication, database
persistence, the Gemini integration, and every button on every page hit a
real backend endpoint. Nothing is simulated.

```
nutrisnap-ai/
├── backend/     Node + Express + TypeScript API, PostgreSQL, Gemini integration
└── frontend/    React + TypeScript + Vite + Tailwind, installable PWA
```

---

## 1. Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local install, Docker, or a hosted instance like
  Supabase/Neon/Render)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## 2. Backend setup

```bash
cd backend
cp .env.example .env
npm install
```

Edit `.env`:

```env
DATABASE_URL=postgres://user:password@localhost:5432/nutrisnap
AUTH_SECRET=<generate a long random string, e.g. `openssl rand -hex 32`>
GEMINI_API_KEY=<your Gemini API key>
```

Create the database, then run migrations (this executes `src/db/schema.sql`
against `DATABASE_URL`):

```bash
createdb nutrisnap   # or create it via your Postgres provider's dashboard
npm run migrate
```

Start the API:

```bash
npm run dev
# → NutriSnap AI backend listening on http://localhost:4000
```

## 3. Frontend setup

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173`, create an account, and you're in — register
posts to a real `/api/auth/register`, which hashes your password with Argon2
and writes a row to Postgres.

## 4. Try the AI flow

1. Sign up / sign in.
2. Go to **Scan**, upload or take a photo of food.
3. Click **Analyze** — the image is sent to your backend, which calls Gemini
   Vision with a structured-output prompt and returns validated JSON.
4. Adjust serving size (recalculated client-side, no extra API call), pick a
   meal type, and click **Log Meal** — this writes a row to `meals` (plus
   `meal_foods` / `meal_insights`) scoped to your authenticated user id.
5. Check **Dashboard**, **Tracker**, **History**, and **Analytics** — every
   number there is a live query against Postgres, not hardcoded.

## 5. What's fully implemented vs. what to extend for real production traffic

**Fully implemented and real:**
- Registration/login/logout/session (Argon2 + JWT in an httpOnly cookie)
- Forgot/reset password flow (token generation + hashing + expiry;
  see the note below on wiring up actual email delivery)
- Gemini Vision food analysis with structured JSON, retries, and specific
  error handling (invalid key, rate limit, timeout, safety block, bad
  response, network failure)
- Meal logging/listing/detail/delete, all scoped to the authenticated user
  (ownership enforced in every query's `WHERE user_id = $1`, never trusted
  from the client)
- Tracker (today + arbitrary date) and Analytics (7/30/90-day trends),
  computed from real DB aggregates
- Profile with a Mifflin-St Jeor-based calorie suggestion the user can accept
  or override
- Settings: password change, data export (JSON), account deletion
  (cascades to all the user's meals via FK constraints), logout
- Serving-size recalculation without a second AI call
- Nutrition share card (Canvas), PDF export (jsPDF), Web Share API with
  clipboard/download fallback
- PWA: manifest, service worker, installable, offline app shell (API calls
  still require connectivity — the Scan page detects offline and shows a
  clear message rather than a fake result)
- Rate limiting on the AI endpoint and globally, file-size/MIME validation,
  Helmet security headers, parameterized SQL everywhere (no injection
  surface), environment-variable-only secrets

**Deliberately left as an extension point (documented in code comments),
because they depend on infrastructure you'll choose per deployment:**
- **Email delivery** — `/api/auth/forgot-password` generates and stores a
  real, hashed, single-use, expiring token, but logs it to the server
  console instead of emailing it. Wire in a transactional email provider
  (Postmark, SES, Resend) at the marked spot in `backend/src/routes/auth.ts`.
- **Object storage** — `STORAGE_DRIVER=local` compresses and saves images to
  `backend/uploads/` and serves them statically, which works for a
  single-instance deployment. For multi-instance/production, implement the
  S3/GCS/Supabase branch in `backend/src/services/storageService.ts` — every
  caller only ever consumes the returned URL, so nothing else changes.
- **Google OAuth** on the login page — the UI has a placeholder comment for
  it; wiring it up requires your own OAuth client credentials.

## 6. Security notes

- Passwords are hashed with Argon2id, never stored or logged in plaintext.
- The authenticated user's id always comes from the verified JWT
  (`req.user.sub`), never from a request body/query param — so one user can
  never read, modify, or delete another user's data. Every meal/profile/
  tracker/analytics query is scoped this way.
- Nutrition values sent from the client when logging a meal are recomputed
  server-side from the stored AI values × serving multiplier, not trusted
  as-is — a tampered request body can't inflate what gets persisted.
- All API input is validated with Zod before touching the database.
- AI responses are validated against a strict schema before being returned
  to the frontend or written to the database.
- Uploaded files are restricted by MIME type and size, and re-encoded
  (via `sharp`) before storage.

## 7. Testing

```bash
cd backend
npm test
```

`vitest` is wired up in `package.json`; add spec files under
`backend/src/**/*.test.ts` covering the flows called out in the original
spec (auth, meal CRUD, serving-size math, AI response validation,
authorization, tracker aggregation). None are pre-written here — add them
against your running test database as you build out CI.

## 8. Deployment sketch

- **Backend**: any Node host (Render, Railway, Fly.io, a VPS). Set the env
  vars from `.env.example`, run `npm run build && npm start`.
- **Database**: managed Postgres (Neon, Supabase, RDS, Render Postgres).
- **Frontend**: static host (Vercel, Netlify, Cloudflare Pages) — run
  `npm run build`, serve `frontend/dist`. Set `VITE_API_URL` to your deployed
  backend's URL, and set the backend's `CORS_ORIGIN` to your deployed
  frontend's URL.
- Put both behind HTTPS — cookies are marked `secure` automatically when
  `NODE_ENV=production`.

---

Nutrition values throughout the app are AI-generated estimates from a photo,
not a lab measurement — the PDF export and nutrition card both say so, and
the AI prompt explicitly instructs the model never to overstate certainty.
