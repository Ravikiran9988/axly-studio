# Axly Studio Deployment, Operations & Security Guide

Comprehensive operations manual for configuring, deploying, hardening, and maintaining Axly Studio in production environments.

---

## 1. Environment Variables Reference

| Variable | Description | Example / Default | Required |
|---|---|---|:---:|
| `PORT` | HTTP port for Node.js API server | `5000` | No |
| `NODE_ENV` | Environment mode (`production`, `development`, `test`) | `production` | Yes |
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` | Yes |
| `JWT_SECRET` | 256-bit entropy secret for signing session tokens | `64-character-hex-string` | Yes |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` | No |
| `FRONTEND_URL` | URL of the frontend web application | `https://axly.in` | Yes |
| `SHORT_DOMAIN` | Canonical short domain hostname | `s.axly.in` | Yes |
| `COOKIE_SECURE` | Set `true` in production to enforce HTTPS-only cookies | `true` | No |
| `TRUST_PROXY` | Number of reverse proxy hops (e.g. Nginx, Cloudflare) | `1` | In Prod |

---

## 2. Neon Lakebase Postgres Setup & Migrations

Axly is engineered to run seamlessly on Neon serverless PostgreSQL with connection pooling.

### Connection Architecture
- **Pooled Endpoint (`-pooler`)**: Used for web traffic and API endpoints (`PORT=5000`). Neon's PgBouncer handles auto-scaling and connection bursts without connection pool exhaustion.
- **SSL Enforcement**: `sslmode=require` ensures all network traffic between the container and database is encrypted via TLS 1.3.

### Executing Migrations
Database migrations are strictly idempotent and additive:
```bash
# In backend directory
npm run migrate
```
To seed demo links and initial accounts (development only):
```bash
npm run seed
```
To bootstrap an administrator account:
```bash
node scripts/createAdmin.js admin@axly.in "SecureMasterPass123!" "Platform Admin"
```

---

## 3. Production Hardening Checklist

| Layer | Hardening Implementation |
|---|---|
| **Liveness & Readiness** | `/healthz` provides fast container liveness check; `/readyz` tests database connectivity. |
| **Graceful Shutdown** | Handlers on `SIGTERM` and `SIGINT` drain pending HTTP requests and close PostgreSQL pool cleanly before process exit. |
| **SSRF Protection** | Every outbound destination (destination URLs and webhook endpoints) is checked against RFC1918 private IPs, loopback, and cloud metadata (`169.254.169.254`). |
| **Rate Limiting** | Dual-tier rate limiting: IP-based strict limits for anonymous guests and token-based limits for authenticated users. |
| **Secret Redaction** | High-entropy API keys store only SHA-256 hashes (`key_hash`). User passwords hashed with bcrypt (salt rounds = 10). |
| **Security Headers** | Helmet enforces strict X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, and cross-origin resource policies. |

---

## 4. Docker & Production Container Setup

### Running with Docker Compose
```bash
# Build and run backend and frontend containers
docker compose up -d --build
```

### Healthcheck Definition
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/readyz"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 5s
```

---

## 5. Backup & Recovery Operations

### Automated Neon Point-in-Time Recovery (PITR)
Neon automatically records WAL files allowing instant point-in-time branch creation and zero-downtime rollbacks.
To restore state to a specific point:
1. In the Neon Console or via Neon CLI:
   ```bash
   neon branches create --name restore-checkpoint --from-time 2026-10-12T12:00:00Z
   ```
2. Update `DATABASE_URL` in container environment to point to the restored branch.

### Manual Logical Backup
```bash
pg_dump "$DATABASE_URL" --format=custom --file=axly_backup_$(date +%Y%m%d_%H%M%S).dump
```
### Restore from Logical Backup
```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" axly_backup.dump
```

---

## 6. Troubleshooting Guide

- **`EADDRINUSE: address already in use :::5000`**: Another process or previous node process is bound to port 5000. Identify with `netstat -ano | findstr 5000` and terminate with `taskkill /F /PID <pid>`.
- **Webhook Delivery 0 Status Code**: Indicates network timeout (>6000ms) or destination unreachable.
- **SSRF Violation Warning**: Destination endpoint resolves to a loopback (`127.0.0.1`), private RFC1918 IP, or metadata endpoint (`169.254.169.254`). Change to a publicly routable HTTPS URL.
