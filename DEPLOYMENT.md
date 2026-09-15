# NutriSnap AI — Production Deployment Guide

This guide provides step-by-step instructions for deploying the **NutriSnap AI** full-stack application (Express REST API + React Vite SPA + PostgreSQL + Google Gemini Vision AI) to production.

---

## Architecture Overview

```text
               User / Browser
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
Production Frontend     Production Backend API
(Vercel / Netlify /     (Render / Railway / Docker)
Cloudflare Pages / S3)   http://api.yourdomain.com
         │                       │
         └───────────┬───────────┘
                     │  (Calls /api/* with Credentials)
                     ▼
             PostgreSQL Database
          (Supabase / Neon / RDS)
                     ▲
                     │ (Server-to-Server)
                     ▼
           Google Gemini Vision AI
```

* **Frontend**: Pure client-side React SPA built with Vite. Can be hosted anywhere static files are served (Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront).
* **Backend**: Node.js Express service serving REST endpoints under `/api` and meal photos under `/uploads`.
* **Database**: PostgreSQL 14+ with SSL support. (If no PostgreSQL instance is configured, the backend automatically falls back to an embedded local PGlite database).
* **AI Provider**: Google Gemini Vision API (`gemini-2.5-flash`), accessed strictly server-side through `GEMINI_API_KEY`.

---

## 1. Prerequisites

Before deploying to production, ensure you have:

1. **Node.js**: Version 20.x or 22.x LTS.
2. **PostgreSQL**: A managed PostgreSQL database (Neon, Supabase, Render PostgreSQL, or AWS RDS).
3. **Google Gemini API Key**: An active API key from [Google AI Studio](https://aistudio.google.com/).
4. **Domain Names**:
   - Frontend: `https://nutrisnap.yourdomain.com` (or root domain)
   - Backend: `https://api.nutrisnap.yourdomain.com`

---

## 2. Production Environment Variables

### Backend Environment Variables (`nutrisnap-ai/backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `4000` | Port the backend server binds to. Automatically injected by PaaS providers. |
| `NODE_ENV` | **Yes** | `production` | Enables production optimizations, secure cookies, and strict error masking. |
| `CORS_ORIGIN` | **Yes** | — | Allowed frontend origin URL(s) for CORS. Can be comma-separated (e.g. `https://nutrisnap.com,https://app.nutrisnap.com`). |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string: `postgres://user:pass@host:5432/dbname`. |
| `DATABASE_SSL` | Optional | `true` | Set to `true` for hosted databases that enforce TLS/SSL (Neon, Supabase, Render). |
| `DB_POOL_MAX` | Optional | `10` | Maximum connections in the PostgreSQL client pool. |
| `AUTH_SECRET` | **Yes** | — | Long cryptographically random string (min 32 chars) for signing JWTs. |
| `AUTH_TOKEN_TTL`| Optional | `7d` | Lifetime of authentication sessions. |
| `GEMINI_API_KEY`| **Yes** | — | Google AI Studio API key (starts with `AIzaSy...`). |
| `GEMINI_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name for vision estimation. |
| `STORAGE_DRIVER`| Optional | `local` | Storage driver (`local` saves to disk under `uploads/`). |
| `MAX_UPLOAD_MB` | Optional | `8` | Maximum file size for uploaded meal images (in megabytes). |
| `BACKEND_PUBLIC_URL`| Optional | — | Public URL of the backend (e.g. `https://api.nutrisnap.com`) for absolute image URLs. |

> [!CAUTION]
> **Secret Generation**: Never use default or development secrets in production. Generate a secure `AUTH_SECRET` using:
> ```bash
> openssl rand -base64 32
> ```

### Frontend Environment Variables (`nutrisnap-ai/frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | **Yes** | `http://localhost:4000/api` | Full URL to the backend API base path (e.g. `https://api.nutrisnap.com/api`). If hosted behind a reverse proxy routing `/api`, set to `/api`. |

> [!IMPORTANT]
> Because Vite embeds environment variables during the build step, `VITE_API_URL` must be set in your build environment **before** executing `npm run build`.

---

## 3. Database Setup & Migrations

1. Provision your PostgreSQL database on your provider of choice (e.g., Supabase, Neon, or Render).
2. Copy your connection URI to `DATABASE_URL`.
3. If using a remote hosted provider, set `DATABASE_SSL=true`.
4. Run the database migration script to create all tables, indexes, and constraints:
   ```bash
   cd nutrisnap-ai/backend
   npm run build
   npm run migrate:prod
   ```
   *(Or in development: `npm run migrate`)*

Tables created:
- `users`: User identity and hashed credentials (`argon2`).
- `user_profiles`: Biometrics, goals, and daily macro targets.
- `meals`: Meal logs, nutritional values, and image references.
- `meal_foods`: Identified food items and confidence scores.
- `meal_insights`: Health insights and nutritional tips.
- `password_reset_tokens`: Single-use hashed reset tokens with expiry.
- `daily_goals`: Per-day override targets.

---

## 4. Build Commands

### Full Workspace Build
From the workspace root:
```bash
npm run build
```
This builds both the backend (`tsc`) and the frontend (`tsc -b && vite build`).

### Independent Builds
* **Backend**:
  ```bash
  cd nutrisnap-ai/backend
  npm ci
  npm run build
  ```
  Output generated in: `nutrisnap-ai/backend/dist/`

* **Frontend**:
  ```bash
  cd nutrisnap-ai/frontend
  npm ci
  npm run build
  ```
  Output generated in: `nutrisnap-ai/frontend/dist/`

---

## 5. Production Start Commands

### Backend
To start the compiled production server:
```bash
cd nutrisnap-ai/backend
NODE_ENV=production npm start
```
*(Runs `node dist/index.js`)*

---

## 6. Deployment Options

### Option A: PaaS Deployment (Render / Railway / Fly.io)

#### Backend (Web Service):
1. Create a new **Web Service** connected to your repository.
2. Root directory: `nutrisnap-ai/backend`
3. Build command: `npm ci && npm run build`
4. Start command: `npm start`
5. Configure Environment Variables (`NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`, `AUTH_SECRET`, `GEMINI_API_KEY`, `CORS_ORIGIN`, `BACKEND_PUBLIC_URL`).
6. Attach a persistent disk if using `STORAGE_DRIVER=local` mounted at `/app/uploads`.

#### Frontend (Static Site):
1. Create a new **Static Site** on Vercel, Netlify, or Cloudflare Pages.
2. Root directory: `nutrisnap-ai/frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables:
   - `VITE_API_URL`: `https://your-backend-service.onrender.com/api`
6. Add rewrite rule for SPA routing (`/*` -> `/index.html`).

---

### Option B: Docker Container Deployment

A production-ready Dockerfile is provided at `nutrisnap-ai/backend/Dockerfile`.

1. **Build the container**:
   ```bash
   docker build -t nutrisnap-backend -f nutrisnap-ai/backend/Dockerfile nutrisnap-ai/backend
   ```
2. **Run the container**:
   ```bash
   docker run -d \
     --name nutrisnap-backend \
     -p 4000:4000 \
     -e NODE_ENV=production \
     -e DATABASE_URL="postgres://user:pass@host:5432/nutrisnap" \
     -e DATABASE_SSL="true" \
     -e CORS_ORIGIN="https://nutrisnap.yourdomain.com" \
     -e AUTH_SECRET="your-32-char-secret" \
     -e GEMINI_API_KEY="your-gemini-key" \
     -e BACKEND_PUBLIC_URL="https://api.nutrisnap.yourdomain.com" \
     -v nutrisnap_uploads:/app/uploads \
     -v nutrisnap_data:/app/data \
     nutrisnap-backend
   ```

### Option C: Complete Docker Compose Orchestration
Run the full stack with local PostgreSQL:
```bash
docker compose up -d --build
```

---

## 7. Health Check Verification

Verify the deployed backend API:

```bash
curl -i https://api.yourdomain.com/api/health
```

Expected HTTP `200 OK` response:
```json
{
  "success": true,
  "status": "healthy",
  "ok": true,
  "service": "nutrisnap-ai-backend"
}
```

Verify root API status:
```bash
curl -i https://api.yourdomain.com/api
```

Expected HTTP `200 OK` response:
```json
{
  "success": true,
  "message": "NutriSnap AI API is running"
}
```

---

## 8. Troubleshooting Common Production Issues

| Symptom | Probable Cause | Resolution |
|---|---|---|
| **CORS error in browser console** | `CORS_ORIGIN` does not match frontend origin. | Set `CORS_ORIGIN=https://your-frontend-domain.com` in backend environment (exact protocol, domain, no trailing slash). |
| **`Backend server is not reachable at /api`** | Frontend built without `VITE_API_URL`. | Set `VITE_API_URL=https://api.yourdomain.com/api` and re-run frontend build. |
| **500 error on AI scan (`AI_AUTHENTICATION_ERROR`)** | Invalid or missing `GEMINI_API_KEY`. | Verify the key from Google AI Studio and ensure no extraneous quotes or whitespace exist in `backend/.env`. |
| **Database connection ECONNREFUSED or timeout** | Remote PostgreSQL requires SSL or is unreachable. | Set `DATABASE_SSL=true`. Ensure cloud database IP allowlist allows incoming connections from your hosting provider (`0.0.0.0/0` for serverless). |
| **Images not loading on frontend** | `BACKEND_PUBLIC_URL` not set. | Set `BACKEND_PUBLIC_URL=https://api.yourdomain.com` in backend environment so uploaded images generate accessible absolute URLs. |
| **Graceful termination fails** | Process killed before draining connections. | PaaS orchestrators send `SIGTERM`; the server will drain active requests and close the database pool within 10 seconds. |
