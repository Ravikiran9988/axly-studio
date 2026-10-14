# Axly Studio Telegram bot

Production operations and developer guide for the separate Telegraf bot in this package. It connects to the Axly backend over HTTP; it does not own the website or database.

## Capabilities

- /start — welcome screen and deep-link account linking.
- /help — command guide and inline menu.
- /shorten URL — shorten an HTTP/HTTPS URL; direct URL messages are also processed.
- /alias URL alias — create a custom alias; requires a linked Axly account.
- /qr URL — create a QR image; the QR prompt can also be opened from the menu.
- /mylinks — list the linked account's URLs with pagination.
- /stats and /stats CODE — account/link analytics when the account is linked.
- /account — account-link status and connection actions.
- /link CODE — connect Telegram to the Axly account with a short-lived code.
- /settings — bot preferences such as Auto-QR.
- /cancel — cancel a pending prompt.
- Inline callbacks provide the main menu, pagination, QR actions, linking/unlinking confirmation and settings.
- Forwarded text/captions and messages with multiple extracted URLs can be shortened while preserving surrounding content in a reply; the bot cannot edit the original message.

The registered Telegram command menu in src/index.js and help text in src/handlers/help.js are the sources of truth. Update both when adding or removing commands.

## Architecture

- src/index.js validates environment values, creates the health server, checks the Telegram token with getMe, registers the command menu, then starts long polling or webhook handling.
- src/bot.js wires command handlers, callbacks, middleware, message processing and error handling.
- src/handlers/ contains command-specific behavior.
- src/services/ calls the Axly API and implements account-linking interactions.
- src/middleware/ implements rate limiting, update deduplication and per-user conversation state.
- src/utils/ contains URL validation, Telegram-safe formatting and inline keyboards.
- tests/bot.test.js covers bot utility and handler behavior. Run the suite to determine its current test count; do not pin test counts in docs.

## Runtime and environment

The package is ESM and declares Node.js >=18. Node.js 20+ is recommended for parity with repository CI.

Copy .env.example to .env for local development. The example file is authoritative for current variable names.

| Variable | Required | Notes |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | Yes | Secret issued by BotFather; never commit it or post it in logs/issues |
| AXLY_API_URL | Yes | Absolute API origin; local value is http://localhost:5000 and production must use HTTPS |
| AXLY_FRONTEND_URL | Recommended | Website URL used in bot messages/buttons; canonical production value https://studio.axly.in |
| TELEGRAM_BOT_SECRET | Production | Strong random shared secret; must match backend TELEGRAM_BOT_SECRET for protected service calls |
| NODE_ENV | Production | Set to production on production service |
| PORT | No | Health listener port; defaults to 3000; hosting provider may inject it |
| USE_WEBHOOK | No | false/0 uses long polling; true/1 enables webhook mode |
| WEBHOOK_DOMAIN | Webhook only | Public HTTPS base URL of this bot service |
| WEBHOOK_SECRET_TOKEN | Webhook only | Random 32–256 character value checked against Telegram's secret header |

Generate a secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the value privately in API and bot service settings. Do not reuse JWT_SECRET, database credentials, the Telegram token or webhook token as the bot shared secret.

## Local development

Start the backend first and confirm database readiness. Then, from this directory:

```bash
npm ci
# Create .env from .env.example, then set TELEGRAM_BOT_TOKEN.
npm run dev
```

For local account linking, set AXLY_API_URL=http://localhost:5000 and AXLY_FRONTEND_URL=http://localhost:5173. Use the same TELEGRAM_BOT_SECRET in both local service environments. The bot calls Telegram getMe during startup to validate the token.

Run tests with npm test.

## Production deployment on Render

If Render is the selected host, deploy this package as a separate service so the API and bot can restart/deploy independently.

- Repository: Ravikiran9988/axly-studio
- Branch: master (the repository's default branch)
- Root directory: telegram-bot
- Install command: npm ci
- Start command: npm start
- Health path: /healthz
- Health port: PORT, default 3000

Required settings are TELEGRAM_BOT_TOKEN, AXLY_API_URL, NODE_ENV=production and a strong TELEGRAM_BOT_SECRET when API account-linking/service functions are used. Set AXLY_FRONTEND_URL=https://studio.axly.in. Webhook-only settings are required only when USE_WEBHOOK=true. Never put credentials in a build command or committed configuration.

Long polling is the simpler default when one bot instance is used. Startup removes any existing Telegram webhook before starting polling. Do not run multiple competing polling instances with the same token. Webhook mode requires HTTPS, WEBHOOK_DOMAIN, WEBHOOK_SECRET_TOKEN and a host capable of routing requests to the configured webhook endpoint.

## Health checks and logs

GET /, GET /health and GET /healthz return a status object from the health server. It returns 503 until the Telegram token has been checked and the bot has started. HTTP 200 means the bot process initialized; it does not independently prove the backend database or every API operation is healthy.

On startup, inspect logs for the successful getMe check, command-menu registration and polling/webhook activation. Treat token validation, polling failure, webhook registration failure or an unhealthy probe as a release blocker.

## Account linking and security

- Linking begins from the authenticated website settings page and uses a short-lived code/deep link.
- Users should never submit their Axly password to Telegram.
- The bot and backend share TELEGRAM_BOT_SECRET for server-to-server operations; keep both values equal and private.
- Account-specific link lists and analytics require a linked Axly account.
- Do not log tokens, shared secrets, JWTs, raw credentials or full private account payloads.
- Treat URLs and forwarded message content as untrusted input. Do not remove URL validation or SSRF protection to make a failing example pass.
- Conversation state is held in process memory in the current implementation; restarting the service clears pending prompt state. Do not claim durable distributed state or horizontal-scaling safety without implementing and testing it.

## BotFather setup

In BotFather, set display name, avatar, description and about text. Confirm the real username before publishing deep links; the code defaults TELEGRAM_BOT_USERNAME to AxlyStudioBot, but it must match the username actually registered.

The setcommands menu is registered by the bot at startup. If commands change, update the registration in src/index.js, help text, this README and tests together.

## Release checklist

- [ ] Backend /readyz is healthy and bot API origin is correct.
- [ ] Required production variables exist and secrets match where needed.
- [ ] The token passes getMe in the target environment.
- [ ] CI bot tests pass for the release commit.
- [ ] /healthz returns 200 after startup.
- [ ] Smoke-test /start, /help, /shorten, /alias with linked account, /qr, /mylinks, /stats, /account, /settings and /cancel.
- [ ] Test forwarded-message handling and inline callbacks.
- [ ] Website links use studio.axly.in and generated short links use the configured short-link host.
- [ ] Only one polling process is active when long polling is enabled.

## Troubleshooting

- **Startup exits immediately:** verify TELEGRAM_BOT_TOKEN, AXLY_API_URL and production shared-secret format.
- **Bot is healthy but API commands fail:** check backend readiness, API origin, network access and matching TELEGRAM_BOT_SECRET on both services.
- **Account linking fails:** generate a new code from the authenticated website, confirm it has not expired, and check logs without exposing tokens.
- **No updates arrive:** check Telegram webhook/polling mode and ensure only one polling instance uses the token.
- **Health check stays 503:** inspect startup logs for token, network, polling or webhook registration errors.
