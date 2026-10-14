# Axly Studio frontend

React single-page application built with Vite. It provides the public website, authenticated workspace, public-page rendering and administrative interface.

## Stack and scripts

- React 19, React Router 7 and Vite 8 as declared in package.json.
- Axios for API requests, Lucide icons, Recharts, qrcode.react and react-hot-toast.
- npm run dev — local Vite server.
- npm run build — production output in dist/.
- npm run preview — serve the built output locally.
- npm run lint — run Oxlint locally. The current GitHub Actions workflow does not run this command as a CI job.

Node.js 20+ is recommended to match CI.

## Routes

Routes are declared in src/App.jsx. Frontend guards improve navigation and UX; backend authorization remains the security boundary.

### Public routes

| Path | Purpose |
|---|---|
| / | Landing page on recognized Axly hosts; mapped public page on a custom hostname |
| /login, /register | Authentication |
| /qr | Public QR generator; signed-in users go to /app/qr |
| /p/:slug | Public page by slug |
| /help, /contact, /report-abuse, /security, /terms, /privacy, /acceptable-use | Public information pages |

### Authenticated /app area

| Path | Purpose |
|---|---|
| /app/dashboard | Dashboard |
| /app/links, /app/links/:id | Link list and details |
| /app/qr | QR generator |
| /app/pages | Public-page builder |
| /app/domains | Custom domain management |
| /app/campaigns, /app/experiments | Campaigns and experiments |
| /app/teams | Team/workspace collaboration |
| /app/developer | Developer tools, API keys and webhooks |
| /app/bulk | Bulk import |
| /app/analytics, /app/analytics/:id | Analytics |
| /app/profile, /app/settings, /app/help | Profile, settings and help |

The /admin route is protected by AdminRoute. Legacy paths including /dashboard, /links, /analytics and /settings redirect into the /app area.

## Local setup

From this directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

PowerShell users can run Copy-Item .env.example .env. The checked-in example uses VITE_API_URL=/api; keep the relative path when the application is configured to proxy requests. Confirm the Vite dev proxy when the backend address changes.

## Environment variables

| Variable | Purpose | Notes |
|---|---|---|
| VITE_API_URL | API base path compiled into the browser bundle | Use /api with the configured proxy. All VITE_* variables are browser-visible; never put secrets here. |

## Vercel deployment

Expected settings for the repository layout:

- Git repository: Ravikiran9988/axly-studio
- Root Directory: frontend
- Build command: npm run build
- Output directory: dist
- API rewrite and SPA fallback: frontend/vercel.json

The current Vercel configuration proxies /api/:path* to https://axly-api.onrender.com/api/:path* and rewrites other paths to /index.html. If the API host changes, update and test this rewrite in the same release.

Canonical domain intent is https://studio.axly.in. The legacy https://url.axly.in domain must be a separate Vercel permanent redirect to the canonical host; frontend/vercel.json does not define that domain-level redirect. Confirm that it is saved in the dashboard and test it before calling the cutover complete.

## Pre-release verification

1. Run npm ci, npm run lint and npm run build.
2. Test /, /login, /register, /qr, /p/example and direct refresh/navigation to /app routes.
3. Confirm browser API calls use /api and the deployed rewrite reaches the intended API.
4. Confirm no private secret is stored in a VITE_* variable or compiled asset.
5. Test desktop/mobile layouts and browser console/network errors.
6. Confirm canonical metadata points to studio.axly.in.
7. After deployment, verify TLS, legacy-domain redirect, route refreshes, API health, authentication, link creation, QR, public pages and analytics.

## Troubleshooting

- **API calls return 404:** inspect VITE_API_URL, Vite proxy and vercel.json.
- **Deep route fails on refresh:** confirm the SPA fallback is deployed.
- **Protected pages fail after login:** inspect session handling and API responses; do not bypass authorization in the frontend.
- **QR/public-page examples use an old host:** update website references without replacing the separate short-link hostname s.axly.in.
