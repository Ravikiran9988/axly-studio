# 🤖 Axly Studio Telegram Bot (`@AxlyStudioBot`)

Production-ready Telegram bot integration for the **Axly URL Shortener** ecosystem. Built with Node.js and Telegraf, seamlessly connecting with Axly's existing Express/PostgreSQL backend API and web application.

---

## 🚀 Key Features

- **⚡ Instant Link Shortening**: Send `/shorten <url>` or paste any HTTP/HTTPS web link directly into the chat to receive an immediate trackable short link.
- **📱 QR Code Generation**: Send `/qr <url>` or tap the **QR Code** inline button on any link to generate high-resolution PNG QR codes directly in Telegram.
- **📂 My Links Management**: Paginate through your links (`/mylinks`) with real-time click counters.
- **📊 Detailed Clickstream Analytics**: View overall dashboard metrics (`/stats`) or deep-dive into single-link performance (`/stats <code>`) with top countries, devices, and referrers.
- **🔐 Secure Single-Use Account Linking**: Hybrid guest + authenticated access model. Guest links work instantly; authenticated links securely bind your Telegram user ID to your Axly account using short-lived (10-minute), single-use cryptographic codes.
- **🛡️ Enterprise Abuse Prevention**: Per-user sliding-window rate limiting, loopback/cloud-metadata SSRF guards, duplicate Telegram update deduplication, and zero secret leakage.

---

## 📁 Architecture Overview

```
telegram-bot/
├── src/
│   ├── index.js                  # Application entry point (health server, signals, start)
│   ├── bot.js                    # Telegraf bot configuration, routing, error handler
│   ├── handlers/
│   │   ├── start.js              # /start and deep-linking verification (/start link_<CODE>)
│   │   ├── help.js               # /help command & usage manual
│   │   ├── shorten.js            # /shorten command & conversational/direct URL handling
│   │   ├── qr.js                 # /qr command & QR code rendering
│   │   ├── myLinks.js            # /mylinks command with interactive pagination
│   │   ├── stats.js              # /stats command (overall & link-specific analytics)
│   │   ├── account.js            # /account, /link <code>, and unlink confirmation
│   │   ├── settings.js           # /settings command and preference toggles (Auto-QR)
│   │   └── cancel.js             # /cancel command (resets conversation state)
│   ├── services/
│   │   ├── axlyApi.js            # HTTP client for existing Axly Express endpoints
│   │   └── accountLinking.js     # User session management and memory cache
│   ├── middleware/
│   │   ├── rateLimit.js          # Anti-abuse rate limiter & update_id deduplication
│   │   └── authSession.js        # Context enrichment with verified user sessions & state
│   └── utils/
│       ├── validation.js         # URL validation, protocol check & SSRF guards
│       ├── formatters.js         # Telegram HTML formatting with Axly purple branding
│       └── keyboards.js          # Reusable inline keyboards
├── tests/
│   └── bot.test.js               # 22 automated unit & integration tests
├── .env.example                  # Environment configuration template
├── package.json
└── README.md
```

---

## 🔒 Security & Authentication Design

1. **Hybrid Access Model**:
   - **Public**: Users can shorten links and generate QR codes without an account.
   - **Authenticated**: Account-specific data (`/mylinks`, `/stats`) requires a verified Axly account link.
2. **Single-Use Expiring Verification**:
   - Users generate a 10-minute code from their Axly dashboard (e.g. `AX-849201`) or via 1-click deep link `https://t.me/AxlyStudioBot?start=link_AX-849201`.
   - The token is invalidated immediately upon use (`used_at = NOW()`) to prevent replay attacks.
3. **No Password Ingestion in Telegram**:
   - Users never provide their passwords to the Telegram chat.
4. **Scoped Bearer Tokens**:
   - Authenticated API requests use standard JWT Bearer tokens signed by the backend. User ownership and RBAC permissions are enforced on every request.
5. **SSRF & Loopback Filtering**:
   - Localhost (`127.0.0.1`), metadata services (`169.254.169.254`), and non-HTTP protocols (`javascript:`, `file:`, `data:`) are strictly rejected.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js >= 18.0.0
- Running instance of Axly Backend API (`npm run dev` in `backend/`)

### 2. Configure Environment
```bash
cd telegram-bot
cp .env.example .env
```

Edit `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
AXLY_API_URL=http://localhost:5000
AXLY_FRONTEND_URL=http://localhost:5173
TELEGRAM_BOT_SECRET=REPLACE_WITH_RANDOM_32_CHAR_OR_LONGER_SECRET
PORT=3000
USE_WEBHOOK=false
```

### 3. Install & Start
```bash
npm install
npm run dev
```

### 4. Run Automated Tests
```bash
npm test
```

---

## 🌐 Production Deployment on Render

Deploy the bot as a **separate service** on Render so your existing website and backend deployments remain completely independent.

### Option A: Render Web Service (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New + > Web Service**.
2. Connect your repository: `https://github.com/Ravikiran9988/axly-studio`.
3. Configure the service settings:
   - **Name**: `axly-telegram-bot`
   - **Region**: Same region as your API (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: `telegram-bot`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Set **Environment Variables**:
   | Key | Value | Note |
   |---|---|---|
   | `TELEGRAM_BOT_TOKEN` | `123456789:ABC...` | From `@BotFather` |
   | `AXLY_API_URL` | `https://axly-api.onrender.com` | Production API URL |
   | `AXLY_FRONTEND_URL` | `https://url.axly.in` | Production Web URL |
   | `TELEGRAM_BOT_SECRET` | `(32-char secret)` | Must match backend `TELEGRAM_BOT_SECRET` |
   | `PORT` | `3000` | Health check port |
   | `USE_WEBHOOK` | `false` | Recommended: use automatic long-polling |
   | `WEBHOOK_DOMAIN` | HTTPS service URL | Required only when `USE_WEBHOOK=true` |
   | `WEBHOOK_SECRET_TOKEN` | Random 32+ character token | Required only when `USE_WEBHOOK=true`; Telegram requests are checked against it |
   | `NODE_ENV` | `production` | Production mode |
5. Click **Create Web Service**. Render will monitor `/healthz` on port 3000. The health endpoint returns HTTP 503 until Telegram startup succeeds and returns to 503 if polling fails.

---

## 🤖 Configuring Your Bot in Telegram via `@BotFather`

Follow these steps with [@BotFather](https://t.me/BotFather) to configure Axly Studio branding:

### 1. Create Bot & Get Token
1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. **Name**: `Axly Studio`
4. **Username**: `AxlyStudioBot` (or your chosen available username ending in `bot`).
5. Copy the HTTP API token provided and save it as `TELEGRAM_BOT_TOKEN`.

### 2. Configure Profile & Description
- Send `/setdescription` to `@BotFather`:
  > Axly Studio 🚀 — Create trackable short links, generate instant QR codes, and view click analytics directly from Telegram. Powered by https://url.axly.in
- Send `/setabouttext` to `@BotFather`:
  > Official URL shortener, QR generator, and analytics bot for Axly Studio (https://url.axly.in).
- Send `/setuserpic` to upload your Axly Studio purple icon.

### 3. Configure Telegram Command Menu
Send `/setcommands` to `@BotFather`, select your bot, and paste this exact command list:

```
start - Open welcome screen and main menu
shorten - Shorten a long URL
qr - Generate a QR code for a link
mylinks - View and manage your links
stats - View click analytics and statistics
account - View or connect your Axly account
link - Link your Axly account with a code
settings - Change bot preferences
cancel - Cancel active prompt
help - View help guide and instructions
```

---

## 🧪 Testing Summary

- `backend`: `node --test tests/*.test.js`
  - 89 core tests passed + 7 Telegram account-linking tests passed = **96 passing backend tests**.
- `telegram-bot`: `node --test tests/*.test.js`
  - **22 unit & integration tests passed**.
- `frontend`: `npm run build`
  - **Built cleanly in 10.99s with zero errors**.


## Forwarded links

Forward a text or caption containing a web URL to the bot. Axly shortens the URL and replies with a copy that keeps the surrounding text/media while replacing the URL. Telegram does not allow bots to edit the original incoming message.
