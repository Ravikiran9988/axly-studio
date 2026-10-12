# Axly URL Shortener 🔗

> **The smart link shortener** — Create, manage and track short URLs with beautiful analytics, custom aliases, QR codes, and more.

[![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)](./frontend)
[![Tech Stack](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](./backend)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)](./backend/src/db)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](./docker-compose.yml)

---

## 🌐 URLs

| Service | URL |
|---------|-----|
| Main site | https://url.axly.in |
| Short links | https://s.axly.in/aB72x |
| Dashboard | https://url.axly.in/dashboard |
| API | https://url.axly.in/api/v1 |

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

### 1. Clone and setup
```bash
git clone <repo-url>
cd axly-url-shortener
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials
npm install
npm run migrate   # Create database tables
npm run seed      # Insert demo data (optional)
npm run dev       # Start backend on :5000
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev       # Start frontend on :5173
```

### 4. Open in browser
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/health
- Demo login: `demo@axly.in` / `demo1234`

---

## 🐳 Docker (Production-like)
```bash
docker-compose up --build
```
Access at http://localhost

---

## 📁 Project Structure

```
Axly Link Shortener/
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Public home page with URL shortener
│   │   │   ├── LoginPage.jsx       # Auth - split panel design
│   │   │   ├── RegisterPage.jsx    # Auth - with password strength
│   │   │   ├── DashboardPage.jsx   # Main dashboard with stats + chart
│   │   │   ├── LinksPage.jsx       # All links with search + pagination
│   │   │   ├── AnalyticsPage.jsx   # Per-link analytics
│   │   │   └── SettingsPage.jsx    # Profile + preferences
│   │   ├── components/
│   │   │   ├── Sidebar.jsx         # Nav sidebar (mobile responsive)
│   │   │   ├── LinkCard.jsx        # Reusable link card
│   │   │   ├── CreateLinkModal.jsx # Create link modal with success state
│   │   │   ├── QRModal.jsx         # QR code generator + download
│   │   │   └── ProtectedLayout.jsx # Auth guard + layout wrapper
│   │   ├── context/
│   │   │   ├── AuthContext.jsx     # JWT auth + axios instance
│   │   │   └── ThemeContext.jsx    # Dark/light mode persistence
│   │   └── index.css              # Complete design system (CSS variables)
│   ├── public/favicon.svg
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js       # Register, login, getMe
│   │   │   ├── urlController.js        # CRUD, QR, analytics
│   │   │   └── redirectController.js   # Short URL redirect + tracking
│   │   ├── middleware/
│   │   │   └── auth.js                 # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── urls.js
│   │   ├── db/
│   │   │   ├── pool.js                 # PostgreSQL connection pool
│   │   │   ├── migrate.js              # Create all tables
│   │   │   └── seed.js                 # Demo data
│   │   └── index.js                    # Express entry point
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml          # Full stack Docker orchestration
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS with design tokens |
| Charts | Recharts |
| Routing | React Router v6 |
| HTTP | Axios |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Short codes | nanoid |
| QR codes | qrcode |
| Analytics | UA-Parser-JS |
| Container | Docker + Docker Compose |

---

## 📡 API Reference

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

## 🗄️ Database Schema

```sql
users         — id, name, email, password_hash, plan, is_active
urls          — id, short_code, original_url, custom_alias, title, user_id, 
                click_count, unique_clicks, status, expires_at
click_events  — id, url_id, ip_address, user_agent, referer, country, 
                city, device_type, browser, os, clicked_at
```

---

## ✨ Features

- **Phase 1** ✅
  - URL shortening (anonymous + authenticated)
  - Short URL redirect with click tracking
  - Device, browser, OS detection
  - User authentication (JWT)

- **Phase 2** ✅
  - User dashboard with stats + 7-day chart
  - Link management (create, edit, delete, disable)
  - Custom aliases
  - Link expiration
  - Click analytics (countries, devices, browsers, referrers)
  - QR code generation + download
  - Dark/light mode toggle
  - Search + pagination

- **Phase 3 (planned)** 🔜
  - Redis caching for redirects
  - Rate limiting per user
  - Kafka async analytics
  - API keys
  - Advanced security (malicious URL detection)

- **Phase 4 (planned)** 🔜
  - AWS deployment
  - Kubernetes
  - CDN / CloudFront
  - Auto-scaling

---

## 🏗️ Architecture

```
Browser
   ↓
React + Vite (Frontend)
   ↓  (API calls)
Express (Backend) ←→ PostgreSQL
   ↓  (redirects)
s.axly.in/:code → original URL
```

---

## 📜 License

MIT © Axly 2026
