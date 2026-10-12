# Axly URL Shortener 🔗

> **The smart link shortener** — Create, manage and track short URLs with analytics, custom aliases, QR codes, and more.

[![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)](./frontend)
[![Tech Stack](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](./backend)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)](./backend/src/db)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](./docker-compose.yml)

---

## 🌐 Planned production URLs

These are configuration examples; deploy and configure DNS before using them.

| Service | URL |
|---------|-----|
| Dashboard / frontend | https://url.axly.in |
| Short links | https://s.axly.in/aB72x |
| API health check | https://url.axly.in/api/health |

---

## 🚀 Quick Start (local development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Docker)
- npm

### 1. Clone and setup
```bash
git clone https://github.com/Ravikiran9988/axly-url-shortener.git
cd axly-url-shortener
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env with your local PostgreSQL credentials
npm install
npm run migrate
npm run seed # Optional demo data; do not run against production data
npm run dev
```

### 3. Frontend setup
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open the frontend at http://localhost:5173. The backend health endpoint is http://localhost:5000/api/health.

---

## ☁️ Supabase PostgreSQL (production database)

Axly uses the standard PostgreSQL driver (`pg`), so it can connect to Supabase PostgreSQL without replacing the database layer. The backend supports either a hosted `DATABASE_URL` or the individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables for local development.

1. Create a project in [Supabase](https://supabase.com/).
2. In the Supabase dashboard, open **Connect** and copy a PostgreSQL connection string. Use the Session Pooler connection string if your application host cannot connect to the direct endpoint (for example, if it does not support IPv6).
3. Set these environment variables in the backend hosting provider's secret/environment settings:
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://...your-Supabase-connection-string...
   DB_SSL_REJECT_UNAUTHORIZED=true
   JWT_SECRET=your-long-random-production-secret
   JWT_EXPIRES_IN=7d
   PORT=5000
   APP_URL=https://url.axly.in
   FRONTEND_URL=https://url.axly.in
   SHORT_DOMAIN=https://s.axly.in
   ```
   Replace the example values with the actual URLs and connection string. Never commit the real connection string or JWT secret.
4. Run the existing schema migration once against the intended Supabase database from the backend environment:
   ```bash
   npm install
   npm run migrate
   ```
5. Deploy the frontend and backend, configure DNS/TLS and reverse-proxy or hosting routes for the dashboard, API and short-link hostname, then test registration, login, URL creation and redirects.

**Important:** Supabase provides the PostgreSQL database; it does not automatically host this Express API or React frontend. Those still need to be deployed separately. The hostnames above are planned examples, not proof that DNS or deployment is already configured.

### Database configuration notes
- If `DATABASE_URL` is set, it takes precedence over the local `DB_*` variables.
- TLS certificate verification is enabled by default for `DATABASE_URL` connections. Do not disable verification to work around a connection error; check the connection string and provider's TLS guidance.
- Use the database password from Supabase, URL-encoded if it contains special characters.
- Keep `backend/.env` out of Git and use your hosting provider's secret manager for production values.
- Do not run the seed script on a production database unless you intentionally want demo records.

---

## 🐳 Docker (local PostgreSQL)
```bash
docker compose up --build
```
The current Compose stack includes a local PostgreSQL container for development. It is separate from Supabase; configure the backend hosting environment with `DATABASE_URL` to use Supabase in a deployed environment.

---

## 📁 Project structure

```
axly-url-shortener/
├── frontend/                   # React + Vite frontend
├── backend/                    # Node.js + Express API
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── db/
│           ├── pool.js         # Local or hosted PostgreSQL connection
│           ├── migrate.js      # Create database tables
│           └── seed.js          # Optional demo data
└── docker-compose.yml          # Local full-stack development
```

---

## 🛠️ Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL (local or Supabase-hosted) |
| Auth | JWT + bcrypt |
| Short codes | nanoid |
| Container | Docker + Docker Compose |

---

## 📡 API reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get profile |

### URLs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/urls` | Optional | Create short URL |
| `GET` | `/api/urls` | Required | List user URLs |
| `GET` | `/api/urls/stats` | Required | Dashboard stats |
| `GET` | `/api/urls/:id` | Required | Get URL details |
| `PATCH` | `/api/urls/:id` | Required | Update URL |
| `DELETE` | `/api/urls/:id` | Required | Delete URL |
| `GET` | `/api/urls/:id/qr` | Required | Get QR code |
| `GET` | `/api/urls/:id/analytics` | Required | Click analytics |

### Redirect
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/:shortCode` | Redirect to original URL |

---

## 🗄️ Database schema

The migration script creates the `users`, `urls`, and `click_events` tables in the configured PostgreSQL database. Run `npm run migrate` against the database you intend to use.

---

## ✨ Features

- URL shortening (anonymous + authenticated)
- Short URL redirects with click tracking
- Device, browser and OS detection
- JWT user authentication
- Dashboard and link management
- Custom aliases and link expiration
- QR code generation
- Dark/light mode
- Search and pagination

---

## 📜 License

MIT © Axly 2026
