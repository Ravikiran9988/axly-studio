# Axly Studio Platform Architecture & Design

Axly Studio is an enterprise link intelligence and URL management platform engineered on Node.js/Express, React 18, and Neon PostgreSQL.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    Client["Client / Browser / API Consumer"]
    CDN["Cloud Edge / Nginx Reverse Proxy"]
    
    subgraph Axly Backend ["Axly Node.js / Express Core Service"]
        Router["Express Router & Dispatcher"]
        RateLimiter["Rate Limiters (IP & Token Based)"]
        AuthMiddleware["Auth & Scope Guard (JWT / API Key)"]
        
        subgraph Subsystems ["Engine Subsystems"]
            RedirectEngine["Redirect & Smart Rule Engine"]
            WebhookDispatcher["Async Webhook Engine (HMAC / SSRF Shield)"]
            DNSVerifier["DNS & Domain Verification Probe"]
            AnalyticsCollector["Privacy-Preserving Click Aggregator"]
            AuditLogger["Tamper-Evident Audit System"]
        end
    end
    
    subgraph DataTier ["Persistence Tier (Neon Lakebase Postgres)"]
        DB[(PostgreSQL Primary)]
        Pool["pg.Pool Connection Pool"]
    end
    
    Client -->|HTTPS / REST / WebSocket| CDN
    CDN --> Router
    Router --> RateLimiter
    RateLimiter --> AuthMiddleware
    AuthMiddleware --> Subsystems
    Subsystems --> Pool
    Pool --> DB
```

---

## 2. Redirection & Smart Rules Pipeline

Short link redirection execution path prioritizes sub-millisecond response times:
1. **Host Verification**: Checks if incoming request matches a verified `custom_domain` or the primary short domain (`s.axly.in`).
2. **Code Lookup**: Queries `urls` table by `short_code` (indexed with B-tree).
3. **Status Check**: Verifies link is `active` and has not expired (`expires_at > NOW()`).
4. **Smart Rule Evaluation**: Evaluates device type (`mobile`, `tablet`, `desktop`), operating system (`ios`, `android`, `windows`, `mac`), country code, or active A/B experiment variants.
5. **Password Protection Check**: If `password_hash` is present and unlocked cookie/session is missing, renders unlock challenge.
6. **Async Analytics Tracking**: Dispatches click recording asynchronously (`setImmediate` or fire-and-forget worker query) so caller latency is unaffected.
7. **HTTP 302/301 Redirect**: Emits redirect response.

---

## 3. Webhook Delivery & SSRF Shield Architecture

```mermaid
sequenceDiagram
    participant User as User / App
    participant API as Axly Link API
    participant DB as Postgres DB
    participant Queue as Async Webhook Worker
    participant Ext as Target Webhook Endpoint

    User->>API: POST /api/urls (create link)
    API->>DB: INSERT into urls
    API->>User: 201 Created (immediate response)
    
    API--)Queue: setImmediate(dispatchWebhookEvent)
    Note over Queue: Non-blocking async queue
    Queue->>DB: SELECT active webhooks for event
    
    loop For each subscriber
        Queue->>Queue: SSRF Destination Check (ssrf.js)
        alt Private / Loopback / Cloud Metadata IP
            Queue->>DB: INSERT webhook_deliveries (Blocked by SSRF Policy)
        else Valid External Endpoint
            Queue->>Queue: Sign payload HMAC-SHA256 (t=..., v1=...)
            Queue->>Ext: POST with x-axly-signature (6s timeout)
            Ext-->>Queue: 200 OK / Response
            Queue->>DB: INSERT webhook_deliveries (Log latency & status)
        end
    end
```

---

## 4. Database Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ WORKSPACES : owns
    USERS ||--o{ WORKSPACE_MEMBERS : belongs_to
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : contains
    WORKSPACES ||--o{ WORKSPACE_INVITATIONS : issues
    WORKSPACES ||--o{ URLS : contains
    WORKSPACES ||--o{ CAMPAIGNS : organizes
    WORKSPACES ||--o{ EXPERIMENTS : conducts
    WORKSPACES ||--o{ CUSTOM_DOMAINS : owns
    WORKSPACES ||--o{ WEBHOOKS : registers

    USERS ||--o{ API_KEYS : creates
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : generates

    URLS ||--o{ SMART_RULES : evaluates
    URLS ||--o{ EXPERIMENT_VARIANTS : distributes
    URLS ||--o{ CLICKS : records
    URLS ||--o{ ABUSE_REPORTS : flags

    WEBHOOKS ||--o{ WEBHOOK_DELIVERIES : tracks

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string role
        integer token_version
        boolean is_active
        timestamp created_at
    }

    WORKSPACES {
        uuid id PK
        string name
        string slug UK
        uuid owner_id FK
        boolean is_personal
        timestamp created_at
    }

    URLS {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        uuid custom_domain_id FK
        string short_code UK
        string original_url
        string custom_alias UK
        string status
        timestamp expires_at
        integer click_count
    }

    API_KEYS {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        string name
        string key_prefix
        string key_hash UK
        string_array scopes
        integer rate_limit_per_minute
        boolean is_revoked
        timestamp expires_at
    }

    WEBHOOKS {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        string url
        string secret
        string_array events
        boolean is_active
    }

    CUSTOM_DOMAINS {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        string domain UK
        string verification_token
        string status
        string dns_record_type
        timestamp verified_at
    }
```
