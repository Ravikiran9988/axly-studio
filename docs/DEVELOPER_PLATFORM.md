# Axly Studio Developer Platform Guide

Programmatic integration guide for the Axly REST API, high-entropy API keys, event webhooks, and team collaboration.

---

## 1. Authentication & API Keys

Axly provides dual authentication:
1. **JWT Bearer Token**: Used by the React web application upon user login (`Authorization: Bearer <jwt>`).
2. **API Keys**: Used by server scripts, CI/CD pipelines, and microservices (`x-api-key: axly_live_<48-hex-chars>` or `Authorization: Bearer axly_live_...`).

### Key Security & Invariants
- Keys are prefixed with `axly_live_` followed by 48 cryptographically random hex characters (192 bits of entropy).
- **Zero plaintext retention**: Only a salted SHA-256 hash (`key_hash`) and a 14-character display prefix (`axly_live_xxxx`) are stored in the database.
- Keys are shown in full **only once** upon generation.

### Scopes Reference

| Scope | Description |
|---|---|
| `links:read` | List shortened links, read link metadata, check health status |
| `links:write` | Create, update, archive, and delete short links |
| `analytics:read` | Retrieve time-series clicks, referrer breakdowns, device and country analytics |
| `campaigns:read` | View marketing campaigns and UTM templates |
| `campaigns:write` | Create and edit campaign parameters |
| `experiments:read` | View A/B experiments and variant conversion rates |
| `experiments:write` | Create and configure A/B traffic split experiments |
| `webhooks:read` | Inspect registered webhooks and delivery audit history |
| `webhooks:write` | Register, rotate secrets, and trigger manual delivery retries |
| `domains:read` | List branded custom domains and DNS verification tokens |
| `domains:write` | Add custom domains and trigger DNS ownership verification probes |
| `*` | Super-admin access across all resources |

---

## 2. Webhooks & SSRF Protection

Axly dispatches asynchronous event webhooks without blocking redirect execution or user transactions.

### Event Catalog

| Event Name | Trigger Condition |
|---|---|
| `link.created` | New link or alias shortened |
| `link.expired` | Link has reached its expiration timestamp |
| `link.health_changed` | Destination uptime probe detected 4xx/5xx or recovered |
| `experiment.completed` | A/B test reached target statistical significance |

### Payload Structure
```json
{
  "eventId": "evt_0192e21a-41e2-7681-9b7e-97c36a439c2d",
  "event": "link.created",
  "version": "1.0",
  "createdAt": "2026-10-12T17:30:00.000Z",
  "data": {
    "id": "url_82f1b4c9-b7b2-4d2a-a9f3-d09f7a771032",
    "shortCode": "summer-sale",
    "shortUrl": "https://s.axly.in/summer-sale",
    "originalUrl": "https://brand.com/deals"
  }
}
```

### Signature Verification

Every request includes the `x-axly-signature` HTTP header with a signed timestamp:
```
x-axly-signature: t=1776000000,v1=9c412b509d738f654b2bb3e18a221f7c...
```

#### Node.js / Express Example:
```javascript
import crypto from 'crypto';

export function verifyAxlyWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(kv => kv.split('='))
  );

  const timestamp = parseInt(parts.t, 10);
  const signature = parts.v1;

  // Prevent replay attacks
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
    throw new Error('Webhook timestamp outside acceptable tolerance (replay protection).');
  }

  const payloadToSign = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadToSign)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    throw new Error('Invalid HMAC-SHA256 signature.');
  }

  return true;
}
```

#### Python / Flask Example:
```python
import hmac
import hashlib
import time

def verify_axly_webhook(raw_body_bytes, signature_header, secret, tolerance_seconds=300):
    parts = dict(item.split("=") for item in signature_header.split(","))
    timestamp = int(parts.get("t"))
    signature = parts.get("v1")

    # Replay protection
    if abs(time.time() - timestamp) > tolerance_seconds:
        raise ValueError("Webhook timestamp is stale.")

    payload = f"{timestamp}.".encode("utf-8") + raw_body_bytes
    expected_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        raise ValueError("Invalid webhook signature.")

    return True
```

### SSRF Protection Policy
To prevent Server-Side Request Forgery against cloud metadata APIs (`169.254.169.254`), container interfaces, or loopback daemons (`localhost`, `127.0.0.1`), Axly strictly validates destinations:
- **Private Networks Blocked**: RFC1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Cloud Metadata Blocked**: AWS, GCP, and Azure metadata endpoints (`169.254.0.0/16`).
- **No Internal Hostnames**: `*.local`, `*.internal`, `localhost`, `instance-data`.
- **Redirects Not Followed Blindly**: Webhook client enforces `redirect: 'error'` to prevent DNS rebinding bypasses via HTTP 302 redirects.

---

## 3. Teams & Workspaces RBAC

Axly supports collaborative multi-tenant workspaces.

### Hierarchy & Permissions

| Action | Owner | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|:---:|
| View links, stats & analytics | ✅ | ✅ | ✅ | ✅ |
| Shorten links & edit rules | ✅ | ✅ | ✅ | ❌ |
| Create & manage campaigns | ✅ | ✅ | ✅ | ❌ |
| Invite team members | ✅ | ✅ | ❌ | ❌ |
| Manage member roles | ✅ | ✅ | ❌ | ❌ |
| Manage custom domains | ✅ | ✅ | ❌ | ❌ |
| Configure webhooks | ✅ | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| Transfer workspace ownership | ✅ | ❌ | ❌ | ❌ |

---

## 4. Custom Branded Domains

Axly enables custom short domains (e.g. `links.yourbrand.com/spring-sale`).

### Verification Workflow:
1. Register domain via `POST /api/domains`.
2. Configure DNS in your registrar:
   - **Primary Routing (CNAME)**: `links.yourbrand.com` -> `cname.axly.in`
   - **Ownership Verification (TXT)**: `_axly-verify.links.yourbrand.com` -> `axly-verify=<token>`
3. Click "Verify DNS" or invoke `POST /api/domains/:id/verify`.
4. Domain activates immediately once DNS propagation completes.
