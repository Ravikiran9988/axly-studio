# Axly Studio deployment, operations and security

This guide defines deployment practices for the current repository topology. Dashboard settings, active DNS records, runtime environment and live service health must be checked during release; code alone cannot confirm those states.

## Deployment topology

| Component | Expected target | Configuration |
|---|---|---|
| Website | Vercel | Root directory frontend; build npm run build; output dist/ |
| API | Render service documented as axly-api.onrender.com | Root directory backend; install npm ci; start npm start |
| Telegram bot | Separate Node service if hosted on Render | Root directory telegram-bot; install npm ci; start npm start |
| Database | PostgreSQL provider selected per environment | DATABASE_URL or DB_* variables; TLS per provider requirements |

## Domains and routing

- Canonical website intent: https://studio.axly.in.
- Secondary domain: https://url.axly.in should permanently redirect to https://studio.axly.in using a Vercel domain redirect.
- Short URLs: use the hostname configured by SHORT_DOMAIN, expected to be https://s.axly.in when DNS/routing is set up for it.
- The frontend API rewrite is checked in at frontend/vercel.json: /api/:path* forwards to https://axly-api.onrender.com/api/:path*.
- The domain-level redirect is configured in Vercel settings, not by frontend/vercel.json. Verify it is saved and test final Location values with an HTTP client.

Do not claim production cutover is complete until DNS, certificate, redirect behavior, API proxy and short-link routing have been tested from outside the hosting dashboard. Also validate the custom-page-domain flow: the current domain controller expects page-type custom domains to point at url.axly.in. That target must be reviewed alongside the intended redirect-only behavior for the legacy host.

## Production environment

### Backend

Use backend/.env.example and backend/src/config/env.js for variable names and runtime validation. At minimum, production configuration must include:

- NODE_ENV=production
- PORT supplied/accepted by the host
- DATABASE_URL or valid DB_* configuration
- A random JWT_SECRET of at least 32 characters that is not a placeholder
- A random VISITOR_SALT of at least 32 characters that is not a placeholder
- Correct APP_URL, FRONTEND_URL and SHORT_DOMAIN values
- TRUST_PROXY only when the application is behind trusted proxy infrastructure
- TELEGRAM_BOT_SECRET matching the bot service where Telegram service operations are enabled
- Optional AI/email credentials only if those features are intentionally enabled

Production startup validation rejects missing/weak JWT_SECRET, VISITOR_SALT and incomplete database configuration. The code warns if TELEGRAM_BOT_SECRET is weak or missing; configure it before enabling service-to-service bot features.

### Frontend

- Use VITE_API_URL=/api with the configured API rewrite.
- Never put credentials or private keys in any VITE_* value; Vite embeds them in browser assets.
- Check the production bundle for accidental secrets before release.

### Telegram bot

Set TELEGRAM_BOT_TOKEN, AXLY_API_URL, AXLY_FRONTEND_URL, NODE_ENV and TELEGRAM_BOT_SECRET as appropriate. AXLY_API_URL must be HTTPS in production. In webhook mode, WEBHOOK_DOMAIN must use HTTPS and WEBHOOK_SECRET_TOKEN must be a random 32–256 character string. Use only one polling instance per bot token.

Generate random secret material locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never put generated values in Git, screenshots, tickets or logs.

## Deploy sequence

1. Review code and documentation together. Confirm route changes, environment changes and migrations have matching documentation/tests.
2. Run backend tests, bot tests, frontend lint and frontend build locally.
3. Push the intended release commit and wait for required GitHub Actions checks. Investigate failures; do not infer success from a green badge for a different commit.
4. Confirm database backup and recovery readiness before a migration that may affect existing data.
5. Deploy the backend and monitor startup logs. Startup invokes migrations before opening the listener.
6. Verify backend liveness/readiness, then test core API flows.
7. Deploy the frontend and inspect build status, production URL, domain status and /api rewrite behavior.
8. Deploy/restart the bot separately. Check getMe/command registration logs and the health endpoint.
9. Verify the canonical domain and secondary redirect externally. Verify short links with a real newly created test link.
10. Record commit SHA, deployment identifiers, operator, smoke-test results and follow-up work.

## Health checks

### API

```bash
curl -fsS https://axly-api.onrender.com/healthz
curl -i https://axly-api.onrender.com/readyz
curl -i https://axly-api.onrender.com/api/health
```

- GET /healthz is liveness only.
- GET /readyz checks database connectivity; HTTP 503 means not ready.
- GET /api/health reports API/database health.
- If using a custom domain or proxy, test through that public path too.

### Website and redirect

```bash
curl -sS -I https://studio.axly.in/
curl -sS -I https://url.axly.in/
curl -sS -I "https://url.axly.in/example-path?probe=1"
```

For the legacy host, expect a permanent redirect (usually 301) whose Location points to studio.axly.in and preserves intended path/query. A dashboard label saying “Valid Configuration” is not a substitute for checking the HTTP response.

### Telegram bot

GET /healthz on the bot service should return 200 after token validation and polling/webhook initialization. It returns 503 while not ready. A healthy bot process does not prove the backend database is healthy; also check backend readiness.

## Security controls and boundaries

The code implements controls including production secret validation, Helmet, CORS checks, request-size limits, rate limiters, authenticated/admin routes, API-key scopes and input/URL safety checks. These reduce risk but do not replace monitoring, patching, backups, review or external security testing.

- Use least-privilege database and hosting credentials.
- Rotate leaked or exposed tokens immediately.
- Keep JWT_SECRET and VISITOR_SALT strong and private. Rotating JWT_SECRET may invalidate sessions; rotating VISITOR_SALT changes visitor de-duplication continuity.
- Rotate TELEGRAM_BOT_SECRET in a coordinated window: update both services consistently, then verify account linking.
- Rotate a Telegram bot token through BotFather if exposed, then update the deployed service.
- Protect database/API hosting access with MFA and restrict team access.
- Treat custom domains, webhook URLs and public-page inputs as untrusted. Do not disable validation to work around individual inputs.
- Review rate limits against real traffic; defaults are not a substitute for load testing.

## Backup and restore

Use the selected database provider's backup/snapshot feature and document retention, region/access, RPO and RTO values appropriate for the service. The repository does not prove that automated production backups are configured; verify this in the provider dashboard and run a restore drill.

A logical PostgreSQL backup can be made with PostgreSQL client tools from an authorized environment:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="axly_backup_YYYYMMDD_HHMMSS.dump"
```

Restore only into an explicitly chosen target database after checking the destination and impact. Prefer a staging/restore environment first:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" axly_backup.dump
```

Never restore over production as an initial test. Confirm schema compatibility, extensions, role/ownership handling and application reads after restore. Record last successful backup and restore test in the operations log.

## Rollback

- **Frontend:** use Vercel deployment rollback/promote to return to a known-good deployment. Recheck environment variables, domain assignment and API rewrite.
- **API/bot:** redeploy the previously known-good commit/deployment through the host. Confirm environment compatibility and health.
- **Database:** application rollback may not reverse schema/data changes. Assess the migration that shipped and follow a restore/forward-fix plan. Do not blindly restore production data without an incident decision and backup.
- After rollback, repeat health checks and a minimal end-to-end smoke test.

## Incident triage

### Website 5xx or build failure

1. Inspect Vercel build/deployment status and logs for the exact production branch/commit.
2. Separate platform/build-rate-limit failure from compilation/test failure.
3. Inspect Vercel domain assignment and TLS.
4. Test /api/health through the website proxy; if it fails only through Vercel, investigate rewrite configuration.

### API unavailable or not ready

1. Check Render service state and latest logs.
2. Call /healthz, /readyz and /api/health.
3. Verify database connectivity, migrations, pool limits and provider status.
4. Never paste connection strings or secret values into incident notes.

### Bot stopped responding

1. Check bot service logs and /healthz.
2. Verify TELEGRAM_BOT_TOKEN, API URL and outbound connectivity.
3. Ensure only one instance uses long polling; inspect webhook setup if webhook mode is enabled.
4. Verify API readiness and matching TELEGRAM_BOT_SECRET where protected endpoints are used.

### Redirect/domain failure

1. Check DNS and TLS for both hosts.
2. Inspect actual response status and Location header.
3. Confirm url.axly.in redirects to studio.axly.in without a loop.
4. Confirm s.axly.in is routed to the short-link handler and SHORT_DOMAIN matches generated URLs.
5. Change one layer at a time and test before proceeding.

## Release evidence

For every release, record commit SHA, CI results, hosting deployment identifiers/URLs, database backup/migration evidence, domain/redirect tests, API health, bot health and command smoke tests, operator/time, and outstanding issues. Do not label a release production-approved while required checks fail or critical domain/deployment behavior is unverified.
