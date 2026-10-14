# Axly Studio developer platform guide

This guide documents the API-key, webhook and workspace integration features implemented by the backend. For route-level truth, check backend/src/routes and controllers; docs/openapi.yaml currently covers only a subset of the API.

## API base URL

The API is mounted beneath /api on the website origin:

```text
https://studio.axly.in/api
```

The frontend Vercel config proxies /api/* to the current direct API origin documented as https://api.axly.in/api/*. For local development, the API base is http://localhost:5000/api. Confirm the host/route rewrite after any deployment or domain change.

## Authentication

Browser requests use normal user authentication. Selected API modules also accept API keys using either header:

```http
x-api-key: axly_live_REDACTED
```

or:

```http
Authorization: Bearer axly_live_REDACTED
```

Do not include a real key in documentation, source, shell history shared with others, browser code or issue reports. The API-key middleware hashes the supplied key with SHA-256 for lookup. The full key is returned only when created or rotated; store it immediately in a secret manager. The database stores the hash, not the full API key.

## API key lifecycle

API key management endpoints are mounted at /api/keys and require an authenticated user session:

| Method | Path | Purpose |
|---|---|---|
| GET | /api/keys | List keys owned by the user; workspaceId may be supplied for workspace key management |
| POST | /api/keys | Create a key and return the full secret once |
| DELETE | /api/keys/:id | Revoke a key |
| POST | /api/keys/:id/rotate | Revoke old key and return a new key |

Create-key example:

```bash
curl -X POST "https://studio.axly.in/api/keys" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"CI reporting","scopes":["links:read","analytics:read"],"expiresInDays":90}'
```

Use the returned key immediately in a secret store. Avoid logging the response body. Do not assume a configured key rate_limit_per_minute is globally enforced unless the runtime code path has been verified for your deployment.

### Available API-key scopes

The backend's allowed list currently includes:

| Scope | General purpose |
|---|---|
| links:read | Read/list URL records and metadata on supported URL routes |
| links:write | Create/update/delete URL records, bulk operations and rules on supported routes |
| analytics:read | Read analytics and analytics exports |
| campaigns:read | Read campaigns and exports |
| campaigns:write | Create/update/delete campaigns |
| experiments:read | Read experiment configuration/results |
| experiments:write | Create/update/delete experiments |
| domains:read | List configured custom domains |
| domains:write | Register, verify and remove custom domains |
| webhooks:read | List webhooks and inspect delivery logs |
| webhooks:write | Create/delete webhooks, retry deliveries and rotate signing secrets |
| * | Wildcard access recognized by the current scope-check function; grant only where full API access is intended |

The middleware enforces required scopes only when the request authenticates with an API key. A user JWT is governed by normal user/workspace permissions. Page-builder, API-key lifecycle and other user-session routes may not accept API keys; check each route module before integrating.

## Webhooks

Webhook management uses /api/webhooks and supports:

| Method | Path | Purpose |
|---|---|---|
| GET | /api/webhooks | List webhooks |
| POST | /api/webhooks | Register a destination |
| GET | /api/webhooks/:id/deliveries | View paginated delivery history |
| POST | /api/webhooks/:id/deliveries/:deliveryId/retry | Retry a recorded delivery |
| POST | /api/webhooks/:id/rotate-secret | Rotate signing secret |
| DELETE | /api/webhooks/:id | Delete endpoint |

Allowed event names in the current webhook controller:

- link.created
- link.expired
- link.health_changed
- experiment.completed

Create endpoint example (run with a user JWT or API key that has webhooks:write):

```bash
curl -X POST "https://studio.axly.in/api/webhooks" \
  -H "Authorization: Bearer <USER_JWT_OR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://receiver.example.com/axly-events","events":["link.created"]}'
```

The returned webhook secret is private; store it safely. The webhook list endpoint masks the stored secret. The rotate-secret endpoint returns the replacement secret, so update the receiver's secret store promptly.

### Signature verification

The dispatcher sends JSON by POST with headers x-axly-event, x-axly-delivery and x-axly-signature. Signature header format is:

```text
t=<unix_seconds>,v1=<hex_hmac_sha256>
```

The HMAC-SHA256 input is the timestamp, a period, and the exact JSON request body bytes as serialized by the sender: timestamp + "." + raw_body. Verify against the raw body before parsing/re-serializing JSON, compare signatures in constant time, and reject timestamps outside your replay window. The shared webhook secret must never be returned in logs or responses after setup.

Delivery behavior observed in the current code:
- Destination is checked against SSRF policy and DNS resolution immediately before a delivery.
- DNS results are pinned for the request, and HTTP redirects are not followed.
- The request timeout is six seconds.
- Delivery records contain status, duration, attempt count, bounded response preview and error details.
- Events are dispatched asynchronously by the API process; do not assume a durable external queue or exactly-once delivery. Implement receiver-side idempotency using the delivery/event identifiers.

## Workspaces

Workspace routes are mounted at /api/workspaces and require a user session. The current code provides:

- GET /api/workspaces — list workspaces
- POST /api/workspaces — create a workspace
- POST /api/workspaces/invites/accept — accept an invitation
- GET /api/workspaces/:id — view workspace (viewer role or higher)
- PATCH /api/workspaces/:id — update workspace (admin role or higher)
- DELETE /api/workspaces/:id — delete workspace (owner)
- POST /api/workspaces/:id/invites — invite a member (admin or owner)
- PATCH /api/workspaces/:id/members/:userId — change member role (admin or owner)
- DELETE /api/workspaces/:id/members/:userId — remove member (admin or owner)
- POST /api/workspaces/:id/transfer-ownership — transfer ownership (owner)

Workspace memberships are a tenant boundary. Keep workspaceId constraints server-enforced and test cross-workspace access when changing a controller or repository query.

## Custom domains

Domain-management routes are mounted at /api/domains and accept a domainType of shortlinks or page. Current code chooses DNS target values based on that type:
- page: url.axly.in
- shortlinks: api.axly.in

This is an implementation-specific target selection, not a statement that all custom domains are live. The legacy website host is intended to redirect to studio.axly.in; therefore, test custom page-domain routing end to end before treating this DNS model as production-safe. Changing the canonical host/redirect or DNS target requires coordinated code, UI help, tests and deployment changes. DNS verification and TLS provisioning are separate: the API sets SSL status to pending after DNS verification.

## Security checklist for integrations

- Use least privilege: grant only scopes required by the integration.
- Store keys and webhook secrets server-side; do not ship them to browser code.
- Rotate immediately after exposure; revoke unused keys.
- Verify signatures over raw body bytes and reject stale timestamps.
- Make webhook receivers idempotent and handle retries/timeouts.
- Reject webhook endpoints that target private/loopback/metadata addresses; never disable SSRF checks.
- Keep API credentials out of analytics events, exception text and customer-facing error messages.
- Test authorization across accounts/workspaces, not just the happy path.

## OpenAPI contract

docs/openapi.yaml is a convenience specification for a subset of endpoints, not a complete definition of every backend route. Treat backend/src/routes as authoritative when a discrepancy exists. Update the OpenAPI file in the same change whenever an endpoint documented there changes, and expand route coverage before using it as the only generated client contract.
