# Axly URL Shortener > **Production-Ready URL Shortener & Analytics Platform** — Shorten long URLs, manage custom vanity aliases, generate downloadable QR codes, and track visitor engagement with privacy-first analytics. Built with React (Vite), Node.js (Express), and PostgreSQL / Supabase Cloud. [![CI Pipeline](https://github.com/Ravikiran9988/axly-url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/Ravikiran9988/axly-url-shortener/actions/workflows/ci.yml)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb)](./frontend)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)](./backend)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-3ecf8e)](./backend/src/db)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)](./docker-compose.yml) --- ## Table of Contents - [Architecture Overview](#-architecture-overview)
- [Target Production Domains](#-target-production-domains)
- [Quick Start (Local Development)](#-quick-start-local-development)
- [Database Configuration: Supabase vs Local](#-database-configuration-supabase-vs-local)
- [Docker & Docker Compose](#-docker--docker-compose)
- [API Reference](#-api-reference)
- [Security & Privacy Features](#-security--privacy-features)
- [Automated Testing & CI](#-automated-testing--ci)
- [Deployment & DNS Setup](#-deployment--dns-setup) --- ## Architecture Overview ``` ┌───────────────────────────────┐ │ Client Web Browser │ └───────────────┬───────────────┘ │ ┌──────────────────────────────┴──────────────────────────────┐ │ │ ▼ (url.axly.in) ▼ (s.axly.in/:code) ┌───────────────────────────────┐ ┌───────────────────────────────┐ │ Nginx / Frontend SPA │ │ Node.js Express API │ │ (React 18 + Vite) │───────────/api/────────────▶│ (Auth, URLs, Redirects) │ └───────────────────────────────┘ └───────────────┬───────────────┘ │ ┌────────────────────────┴────────────────────────┐ ▼ (Local Dev / Docker) ▼ (Production) ┌───────────────────────────────┐ ┌───────────────────────────────┐ │ Local PostgreSQL │ │ Supabase Cloud │ │ (Port 5432 - ACID) │ │ (PostgreSQL + SSL/TLS) │ └───────────────────────────────┘ └───────────────────────────────┘
``` - **Frontend**: Single-page application built with React 18, Vite, Lucide Icons, and Recharts. The design system features glassmorphic styling, full dark/light theme switching, and responsive layouts.
- **Backend**: Express REST API with input validation, rate limiting, Helmet security headers, CORS, JWT authentication, and bcrypt password hashing.
- **Database**: PostgreSQL accessed via the `pg` pool driver. Supports both local PostgreSQL instances and managed Supabase Cloud databases using `DATABASE_URL` with strict TLS certificate verification. --- ## Target Production Domains The application is structured to support clean separation between the product dashboard and short links: | Domain | Purpose | Routing Target |
|--------|---------|----------------|
| `https://url.axly.in` | Main Web App & Dashboard | Serves React SPA & proxies `/api/` |
| `https://s.axly.in/<shortCode>` | Short Link Redirections | Direct 302 redirect via Node.js API |
| `https://url.axly.in/api` | REST API Endpoints | Node.js Backend API | *Note: These domains are production targets. They require valid DNS records (CNAME/A) and TLS certificates in your hosting environment before activation.* --- ## Quick Start (Local Development) ### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)
- npm ### 1. Clone Repository
```bash
git clone https://github.com/Ravikiran9988/axly-url-shortener.git
cd axly-url-shortener
``` ### 2. Configure & Start Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your local PostgreSQL credentials (or Supabase connection string)
npm install
npm run migrate
# Optional: create your own administrator account; this prompts for credentials
# npm run admin:create
# Optional dev sample links: first register a normal account, then set SEED_USER_EMAIL
# PowerShell: $env:SEED_USER_EMAIL="you@example.com"; npm run seed
# macOS/Linux: SEED_USER_EMAIL="you@example.com" npm run seed
npm run dev
``` ### 3. Configure & Start Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
``` The frontend will run at `http://localhost:5173`. Vite automatically proxies `/api` requests to `http://localhost:5000`. --- ## Database Configuration: Supabase vs Local The connection pool in [`backend/src/db/pool.js`](./backend/src/db/pool.js) automatically selects the appropriate connection mode: ### Option A: Supabase Cloud PostgreSQL (Production)
1. Create a project in [Supabase](https://supabase.com).
2. Go to **Project Settings** → **Database** → **Connection String**.
3. Select **URI** (Session mode on port 5432 or Transaction Pooler on port 6543).
4. Set the following in `backend/.env`: ```env NODE_ENV=production DATABASE_URL=postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require DB_SSL=true JWT_SECRET=generate_a_secure_random_32_character_string_here ```
5. Run migrations against your Supabase database: ```bash npm run migrate ``` *Security Note: TLS certificate verification is enforced when connecting to Supabase (`rejectUnauthorized: true`). Never disable certificate verification.* ### Option B: Local PostgreSQL (Development)
When `DATABASE_URL` is omitted, the pool reads discrete variables:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=axly_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false
``` --- ## Docker & Docker Compose A complete containerized stack is available in [`docker-compose.yml`](./docker-compose.yml): ```bash
# 1. Copy Docker environment variables
cp .env.example .env # 2. Build and start services (Postgres, Backend, Frontend with Nginx)
docker compose up --build -d # 3. Run database migrations inside the backend container
docker compose exec backend npm run migrate # 4. View logs
docker compose logs -f # 5. Stop containers (preserves database volume)
docker compose down
``` ### Services Started:
- **`axly_frontend`**: Nginx web server on `http://localhost:80` (handles SPA routing and proxies `/api`).
- **`axly_backend`**: Node.js container on `http://localhost:5000`.
- **`axly_postgres`**: PostgreSQL 16 container bound strictly to `127.0.0.1:5432` with health checks. --- ## API Reference ### Health Check
- `GET /api/health` — Verifies API status and database connectivity latency. ### Authentication
- `POST /api/auth/register` — Register a new user account. ```json // Request { "name": "Jane Doe", "email": "jane@example.com", "password": "securePassword123" } // Response (201 Created) { "success": true, "token": "jwt_token...", "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com" } } ```
- `POST /api/auth/login` — Sign in with email and password.
- `GET /api/auth/me` — Retrieve current authenticated user profile (`Authorization: Bearer <token>`). ### URL Management
- `POST /api/urls` (Optional Auth) — Create short URL. ```json // Request { "url": "https://example.com/long-product-link", "customAlias": "summer-sale", // Optional: 3-30 chars "title": "Summer Promotion", // Optional "expiresAt": "2026-12-31T23:59:59Z" // Optional: Future ISO timestamp } ```
- `GET /api/urls` (Auth Required) — List authenticated user's URLs with pagination (`page`, `limit`) and search (`search`).
- `GET /api/urls/stats` (Auth Required) — Overall dashboard metrics (total links, clicks, active links, 7-day activity).
- `GET /api/urls/:id` (Auth Required) — Details for a specific URL.
- `PATCH /api/urls/:id` (Auth Required) — Partial update URL (`title`, `status`, `expiresAt`). - **Partial Update Behavior**: Omitting `expiresAt` preserves the existing expiration timestamp. Passing explicit `null` clears expiration.
- `DELETE /api/urls/:id` (Auth Required) — Delete short URL and its click events.
- `GET /api/urls/:id/qr` (Auth Required) — Generate QR code PNG data URL.
- `GET /api/urls/:id/analytics` (Auth Required) — Detailed analytics (browsers, devices, referrers, timeline). ### Public Redirection
- `GET /:shortCode` — Redirects (302) to original target URL. - Returns `404` if link does not exist. - Returns `410` if link is disabled or expired. --- ## Security & Privacy Features 1. **Privacy-Preserving Visitor Deduplication**: - Unique visitor counts (`unique_clicks`) are calculated using a salted HMAC-SHA256 hash of the visitor's IP and User-Agent. - Raw personal browsing profiles are not permanently retained.
2. **Open Redirect & Protocol Prevention**: - Destination URLs must use `http:` or `https:`. Dangerous protocols (`javascript:`, `data:`, `file:`) are strictly rejected. - Redirect destinations are read solely from authenticated database records.
3. **Collision & Custom Alias Protection**: - Reserved keywords (`api`, `auth`, `login`, `admin`, `settings`, etc.) are prohibited as custom aliases. - Concurrent insert conflicts (PostgreSQL code `23505`) are caught and handled gracefully with 409 Conflict responses.
4. **Rate Limiting**: - Authentication limiter: 10 attempts per 15-minute window. - URL creation limiter: 50 creations per hour. - Global API limiter: 100 requests per 15-minute window.
5. **Production Secrets Startup Enforcement**: - The server validates environment variables at boot. In production mode, startup immediately halts with a clean error if `JWT_SECRET` is missing, shorter than 32 characters, or using a well-known development fallback. - Generate a strong secret with: ```bash node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ``` --- ## Automated Testing & CI The backend includes a comprehensive automated test suite utilizing Node.js's native test runner (`node:test`) and `supertest`: ```bash
cd backend
npm test
``` ### Covered Test Suites:
- [YES] Production environment validation & insecure secret rejection
- [YES] Email format normalization & password complexity validation
- [YES] Registration race-condition conflict handling
- [YES] Authentication token verification & expired/invalid token handling
- [YES] Account-disabled access restriction
- [YES] URL creation, protocol validation, and reserved alias rejection
- [YES] **Expiration bug regression test**: Partial updates omitting `expiresAt` preserve existing expiration dates
- [YES] Explicit `null` expiration clearing
- [YES] Redirection HTTP status codes (302, 404, 410) & XSS-safe error rendering GitHub Actions automatically runs backend tests and frontend production builds on every push to `master`. --- ## Deployment & DNS Setup To configure custom domains: 1. **DNS Records**: - Point `url.axly.in` (CNAME or A record) to your web server / load balancer. - Point `s.axly.in` (CNAME or A record) to your web server / load balancer.
2. **Reverse Proxy / Nginx**: - The provided [`frontend/nginx.conf`](./frontend/nginx.conf) routes `url.axly.in` to the React SPA and proxies `s.axly.in` directly to the backend redirection service.
3. **Environment Configuration**: - Set `APP_URL=https://url.axly.in` - Set `FRONTEND_URL=https://url.axly.in` - Set `SHORT_DOMAIN=https://s.axly.in` - Set `TRUST_PROXY=1` (or `true`) --- ## License MIT © 2026 Axly
