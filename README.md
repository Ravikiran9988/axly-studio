# Axly Studio

Axly Studio is a link-management platform with a React web application, a Node.js/Express API, PostgreSQL persistence, and a separate Telegram bot. This repository contains application code, deployment configuration, tests, the API specification, and operator documentation.

> **Production note:** These guides describe the implementation and intended configuration in this repository. Confirm live environment variables, DNS and redirect behavior, database backups, and deployment health in the hosting dashboards before treating a deployment as production-ready.

[![CI](https://github.com/Ravikiran9988/axly-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Ravikiran9988/axly-studio/actions/workflows/ci.yml)

## Product overview

- **Website:** short-link management; QR codes; public profile/pages; click analytics; campaigns and experiments; bulk URL import/export; custom domains; API keys; webhooks; workspaces; profile/settings; admin and moderation tools.
- **REST API:** authentication, URL management and redirects, analytics, pages, domains, campaigns, experiments, notifications, workspaces, API keys, webhooks, privacy export/deletion, and Telegram account linking.
- **Telegram bot:** /shorten, /alias, /qr, /mylinks, /stats, /account, /link, /settings, /cancel, /help; inline menus; direct URL messages; QR generation; forwarded/multiple URL handling; optional Axly account linking.
- **Database:** PostgreSQL through the Node pg driver. The application supports a connection URL or discrete local database settings; cloud TLS behavior depends on database configuration.

## Canonical domains

| Host | Intended role | Notes |
|---|---|---|
| https://studio.axly.in | Canonical website | Primary user-facing Axly Studio domain |
| https://url.axly.in | Secondary/legacy website host | Configure a permanent Vercel 301 redirect to studio.axly.in; test path and query preservation after saving |
| https://s.axly.in/yourCode | Short-link hostname | Configure DNS/routing and SHORT_DOMAIN consistently with the redirect service |
| https://axly-api.onrender.com | API service hostname | Current documented Render API origin; /api/* is proxied by frontend/vercel.json |

The frontend Vercel rewrite sends /api/:path* to https://axly-api.onrender.com/api/:path* and rewrites other paths to /index.html for SPA routing. Keep the API origin and custom domains synchronized when hosting changes. A valid domain status alone does not prove that redirects, application routes, or API requests work end to end.

## Repository layout

```text
.
├── frontend/                 # React/Vite application and Vercel config
├── backend/                  # Express API, PostgreSQL migrations and tests
├── telegram-bot/             # Telegraf bot, handlers and bot tests
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT_AND_SECURITY.md
│   ├── DEVELOPER_PLATFORM.md
│   ├── OPERATIONS_RUNBOOK.md
│   └── openapi.yaml
├── .github/workflows/ci.yml  # Backend tests, bot tests, frontend build
└── docker-compose.yml        # Local PostgreSQL + backend + Nginx frontend
```

## Architecture at a glance

1. A visitor loads the frontend on Vercel. Public routes include landing, login/register, QR, public page views, help, contact, abuse reporting, security, terms, privacy, and acceptable-use information.
2. The browser calls the API through /api. Vercel rewrites this path to the configured Render API origin.
3. The API validates requests, enforces authentication/scopes and rate limits where configured, stores data in PostgreSQL, and handles short-link redirects.
4. The Telegram bot runs as a separate Node service and calls Axly through AXLY_API_URL. Authenticated bot features use the Telegram account-linking flow and shared service secret.
5. PostgreSQL schema changes are managed by migration code. Backend startup runs migrations before listening; npm run migrate is available for explicit operations.

See [Architecture](./docs/ARCHITECTURE.md) for component flow and [Deployment, Operations & Security](./docs/DEPLOYMENT_AND_SECURITY.md) for operational guidance.

## Prerequisites

- Node.js 20 or newer is recommended for local development and matches CI. The bot package declares Node.js 18 or newer.
- npm and Git.
- PostgreSQL, either local/Docker or a managed PostgreSQL service.
- A Telegram bot token only when running the bot.
- Hosting accounts and permissions for the selected deployment targets (Vercel frontend; Render API and bot if those remain the active services).

## Local development

Use separate terminals for the API, frontend and optional bot. Never commit .env files, real tokens, API keys, database credentials or generated backups.

### 1. Start PostgreSQL

Use a local PostgreSQL instance, or start the repository's database container:

```bash
docker compose up -d postgres
```

Default Compose credentials are for local development only. Do not use them in a public or production deployment.

### 2. Configure and start the API

```bash
cd backend
npm ci
# Copy .env.example to .env and configure DB, JWT and visitor salt values.
npm run migrate
npm run dev
```

By default, the API listens on http://localhost:5000. For local work, use NODE_ENV=development, a local database, APP_URL=http://localhost:5000, FRONTEND_URL=http://localhost:5173, SHORT_DOMAIN=http://localhost:5000, and TRUST_PROXY=false. Generate unique local secrets instead of copying production secrets.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite serves the application at http://localhost:5173. The checked-in frontend environment example uses VITE_API_URL=/api. Confirm the Vite dev proxy when changing the API port.

### 4. Start the Telegram bot (optional)

In a third terminal:

```bash
cd telegram-bot
npm ci
# Copy .env.example to .env and set TELEGRAM_BOT_TOKEN.
npm run dev
```

Set AXLY_API_URL=http://localhost:5000, AXLY_FRONTEND_URL=http://localhost:5173, and the same TELEGRAM_BOT_SECRET in the local backend and bot environments. The bot requires a valid Telegram token and API URL. In production, AXLY_API_URL must use HTTPS and the shared secret must be a strong random value.

See [Frontend guide](./frontend/README.md), [Backend/API guide](./backend/README.md), and [Telegram bot guide](./telegram-bot/README.md).

## Environment configuration

The checked-in examples are the starting point for available variables. Copy them into ignored local .env files, then define production variables in each hosting service's secret settings.

| Component | Main settings | Notes |
|---|---|---|
| Backend | NODE_ENV, PORT, DATABASE_URL or DB_*, JWT_SECRET, VISITOR_SALT, APP_URL, FRONTEND_URL, SHORT_DOMAIN, TRUST_PROXY | Production validation requires strong JWT secret, visitor salt and database configuration. The bot shared secret must match when Telegram service endpoints are used. |
| Frontend | VITE_API_URL | VITE_* values are exposed to browser assets. Never put server-side secrets in them. Production /api routing is configured in frontend/vercel.json. |
| Telegram bot | TELEGRAM_BOT_TOKEN, AXLY_API_URL, AXLY_FRONTEND_URL, TELEGRAM_BOT_SECRET, PORT, USE_WEBHOOK and webhook-only values | In webhook mode, use HTTPS and a random Telegram webhook secret token. Never commit a real bot token. |

See the [backend environment reference](./backend/README.md#environment-variables) and [operations runbook](./docs/OPERATIONS_RUNBOOK.md). Generate random secrets with node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" and store them only in hosting secret settings or ignored local .env files.

## Tests and build checks

Run the same package checks before pushing:

```bash
# Backend API tests
cd backend
npm ci
npm test

# Bot tests
cd ../telegram-bot
npm ci
npm test

# Frontend production build
cd ../frontend
npm ci
npm run build
```

The workflow in .github/workflows/ci.yml runs backend tests against PostgreSQL, bot tests, and the frontend production build on pushes and pull requests to master or main. It does not currently run the frontend lint script as a CI job. The workflow status for the release commit is authoritative; passing local commands do not replace live service smoke tests.

## Deployment overview

- **Frontend / Vercel:** project root directory frontend; build command npm run build; output directory dist; API rewrite and SPA fallback are in frontend/vercel.json. Canonical host intent is studio.axly.in. Keep url.axly.in as a secondary redirect only after saving and testing the domain-level redirect.
- **API / Render (documented target):** hostname https://axly-api.onrender.com; root directory backend; install with npm ci; start with npm start. Configure all required production environment values. Backend startup runs migrations before opening the port.
- **Telegram bot / Render (if deployed there):** separate service; root directory telegram-bot; install with npm ci; start with npm start; configure token, API URL, frontend URL, shared secret and polling/webhook mode.

Use the [production runbook](./docs/OPERATIONS_RUNBOOK.md) for pre-deploy checks, smoke tests, rollback, incident handling, secret rotation and database backup/restore. Hosting details above describe the intended configuration; verify the actual dashboard settings and live health endpoints for each release.

## Production readiness checklist

- [ ] Confirm studio.axly.in points to the production frontend and TLS is valid.
- [ ] Save and test the Vercel 301 redirect from url.axly.in, including paths, query strings and HTTPS.
- [ ] Confirm s.axly.in DNS and routing resolve generated short links correctly.
- [ ] Verify the custom-page-domain CNAME target end to end: current backend code still expects url.axly.in for page domains, while that host is intended to redirect to studio.axly.in.
- [ ] Confirm Vercel /api rewrite reaches the intended API origin.
- [ ] Confirm production secrets are strong, unique and stored only in secret settings.
- [ ] Confirm database backups, retention and a tested restore procedure.
- [ ] Run CI on the release commit and inspect every required job.
- [ ] Smoke-test authentication, link create/redirect, QR, public pages, analytics and bot commands.
- [ ] Verify monitoring/alerts, access permissions and rollback plan.
- [ ] Review Terms, Privacy, abuse-reporting and acceptable-use content before public launch.

## Documentation index

| Document | Purpose |
|---|---|
| [Frontend README](./frontend/README.md) | Website routes, build, routing and deployment |
| [Backend README](./backend/README.md) | API modules, auth/scopes, environment, migrations and tests |
| [Telegram bot README](./telegram-bot/README.md) | Commands, account linking, local setup, deployment and troubleshooting |
| [Architecture](./docs/ARCHITECTURE.md) | Component and data flow |
| [Deployment, Operations & Security](./docs/DEPLOYMENT_AND_SECURITY.md) | Config, security boundaries and deployment |
| [Operations runbook](./docs/OPERATIONS_RUNBOOK.md) | Preflight, release, rollback, incident and recovery |
| [Developer platform guide](./docs/DEVELOPER_PLATFORM.md) | API keys, scopes, webhooks and workspaces |
| [OpenAPI specification](./docs/openapi.yaml) | Machine-readable API contract subset; check route coverage before treating it as exhaustive |

## Contributing and security

Keep documentation and implementation changes together. A new route, environment variable, bot command, schema migration or production setting should update the relevant guide and tests. Never publish secrets in issues or logs. Report security-sensitive findings privately to the repository maintainer.

Check the current repository LICENSE file before redistributing.
