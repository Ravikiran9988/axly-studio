# Axly Studio backend and REST API

Express API and PostgreSQL data layer for Axly Studio. Entrypoint: src/index.js. Route modules are mounted below /api unless a root-level health or redirect route is explicitly noted.

## Stack and commands

- Node.js ES modules, Express 4, PostgreSQL through pg.
- JWT/user authentication and API-key authentication on selected modules.
- Helmet, CORS origin checks, request-size limits and rate limiting.
- npm run dev — nodemon development server.
- npm start — start service; set NODE_ENV=production in production.
- npm run migrate — apply migrations.
- npm test — Node test runner over tests/*.test.js.
- npm run seed — sample data utility; development only.
- npm run admin:create — interactive administrator creation helper; use only for intentional administrative setup.

When src/index.js is run as the service entrypoint, it runs the migration routine before opening the listener. Plan migrations as part of a release and make sure a recoverable backup exists before schema changes.

## Local setup

1. Install Node.js 20+ (CI uses Node 20).
2. Ensure PostgreSQL is running.
3. Copy .env.example to .env and configure local database details and unique local secrets.
4. Run:

```bash
npm ci
npm run migrate
npm run dev
```

Default listener: http://localhost:5000. Never use production credentials in local development.

## Environment variables

backend/.env.example is the complete variable template; src/config/env.js controls defaults and validation.

| Variable | Role | Production guidance |
|---|---|---|
| NODE_ENV | Runtime mode | Set to production on the production service |
| PORT | HTTP listener | Honor the hosting platform's assigned port |
| DATABASE_URL | PostgreSQL connection URI | Prefer provider-issued TLS URI; keep credentials private |
| DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD | Discrete database settings | Used when DATABASE_URL is not configured |
| DB_SSL | Enable database TLS | Set appropriately for the database provider; the current config enables TLS for recognized Supabase/Neon URLs |
| DB_POOL_MAX | Maximum pg pool size | Tune to database limits and service concurrency |
| DB_CONNECT_TIMEOUT_MS, DB_IDLE_TIMEOUT_MS | Pool timing | Tune with provider and traffic profile |
| JWT_SECRET | JWT signing key | Required in production; at least 32 characters and not a known placeholder |
| JWT_EXPIRES_IN | JWT lifetime | Default 7d; choose intentionally |
| VISITOR_SALT | Salt for privacy-preserving visitor deduplication | Required in production; at least 32 characters and non-placeholder. Changing it affects unique-visitor continuity |
| APP_URL | Application/API base URL | Set to the real API origin if the API emits absolute URLs |
| FRONTEND_URL | First-party web origin | Intended canonical host: https://studio.axly.in |
| SHORT_DOMAIN | Generated short-link hostname | Use the hostname actually routed to the redirect service, expected to be https://s.axly.in |
| TRUST_PROXY | Trust proxy configuration | Enable only behind trusted proxy infrastructure; code accepts true or 1 |
| RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX | Global API limit | Code defaults: 15 minutes / 100 requests |
| CREATE_RATE_LIMIT_WINDOW_MS, CREATE_RATE_LIMIT_MAX | Authenticated URL creation limit | Code defaults: 1 hour / 50 links |
| GUEST_CREATE_RATE_LIMIT_WINDOW_MS, GUEST_CREATE_RATE_LIMIT_MAX | Guest URL creation limit | Code defaults: 1 hour / 10 links |
| AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX | Login/register attempts | Code defaults: 15 minutes / 10 attempts |
| TELEGRAM_BOT_SECRET | Internal bot service authentication | Set the same strong random value in API and bot services |
| TELEGRAM_BOT_USERNAME | Username used in linking UX | Confirm the actual username in BotFather |
| AI_COPY_API_URL, AI_COPY_API_KEY, AI_COPY_MODEL | Optional AI page-copy suggestions | Server-side only; leave unset to disable |
| RESEND_API_KEY, LEAD_NOTIFICATION_FROM | Optional lead notification email | Leave unset to store leads without sending email; use a verified sender |

In production, validation fails if JWT_SECRET, VISITOR_SALT or database configuration is missing/weak. The backend warns when TELEGRAM_BOT_SECRET is missing/weak; bot service calls and account linking will not work correctly unless secrets match. Keep production and development secrets separate.

## API module index

Prefixes below are relative to /api.

| Prefix | Functionality | Access model (high level) |
|---|---|---|
| /auth | Register, login, read/update current user | Register/login are public and rate-limited; /me requires a session |
| /urls | Create/list/detail/update/delete, QR, analytics, bulk actions/import/export and smart rules | Guest create is supported with stricter rate limiting; most management uses session or API key plus required scopes |
| /analytics | Account analytics and CSV export | Session or API key with analytics:read |
| /campaigns | List/create/detail/update/delete/CSV export | Session or API key with campaigns:read/write |
| /experiments | List/create/detail/update/delete and public conversion tracking | Management requires experiments:read/write; POST /:id/convert is public |
| /domains | List/create/verify/delete custom domains | Session or API key with domains:read/write |
| /keys | List/create/revoke/rotate API keys | User session required |
| /webhooks | List/create/delete; deliveries, retry and secret rotation | Session or API key with webhooks:read/write |
| /workspaces | List/create/accept invitation and member administration | Session required; workspace role checks protect scoped actions |
| /pages | Public templates/page read/events/leads and authenticated page builder, revisions, analytics and leads | Only explicit /public/* routes are public; builder requires session |
| /notifications | List and mark notifications read | User session required |
| /user | Export data and delete account | User session required |
| /telegram | Generate link code, status, verify link, session retrieval and unlink | Mixed user and bot service flow; shared secret is private |
| /reports | Submit an abuse report | Public and rate-limited |
| /admin | User/platform moderation, diagnostics, moderation reports, audit and health tools | Authenticated admin only |

Root-level endpoints: GET /health, GET /healthz, GET /readyz, GET /api/health, GET /api/announcement, GET /:shortCode and POST /:shortCode/unlock. GET /healthz is a liveness probe; GET /readyz checks database connectivity and returns 503 when not ready.

Consult src/routes/ for authoritative route definitions. docs/openapi.yaml is a machine-readable API subset and should not be treated as exhaustive until its endpoint coverage is compared with all route modules.

## Custom-domain deployment caveat

The current domain controller returns url.axly.in as the CNAME target for page-type custom domains and axly-api.onrender.com for short-link domains. Since url.axly.in is intended to redirect to studio.axly.in, validate the page-domain DNS and Vercel routing end to end before declaring custom page domains production-ready. The expected DNS target is implementation-specific; coordinate any change across backend code, DeveloperPage help/fallbacks, DNS validation, tests and docs.

## Authentication and permissions

- Browser sessions use the auth middleware and JWT handling implemented by the backend.
- Selected routes use authenticateOrApiKey plus explicit scopes such as links:read/write, analytics:read, campaigns:read/write, experiments:read/write, domains:read/write and webhooks:read/write.
- API key lifecycle endpoints require a normal user session.
- /admin routes require both authentication and administrator role.
- Public access exists only on routes explicitly coded for it. Do not infer access rules from UI visibility.
- Public custom-domain registration does not grant API permissions.

## Database, migration and health checks

- Schema/migration code lives under src/db/.
- The server entrypoint invokes migrations before listening.
- For planned maintenance, take a verified backup, run the intended migration/release, then check readiness and core workflows.
- Keep database connection URLs private and preserve TLS verification for supported managed database endpoints.

Health endpoints:
- GET /health — process liveness.
- GET /healthz — liveness probe.
- GET /readyz — database connectivity; HTTP 503 means not ready.
- GET /api/health — API/database health detail.

Before release: npm ci, npm test, green CI checks, backup/migration plan, deploy, verify /healthz and /readyz, then smoke-test auth, link create/redirect, QR, pages, analytics and bot account linking if enabled.

## Security notes

Never log or return secret values. Keep JWT_SECRET, VISITOR_SALT, TELEGRAM_BOT_SECRET, DB credentials, AI provider credentials, email provider keys and API keys in server-side secret storage. Treat destination URLs, custom domains, reports, leads, webhook targets, CSV files and public-page input as untrusted. Report security-sensitive findings privately.
