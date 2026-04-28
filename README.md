# Open Banking Hub

The central orchestrator of the Open Banking ecosystem, operated by the **Central Bank (BCV)**. Manages the participant directory, consent lifecycle, data aggregation, and payment initiation across all connected financial institutions.

---

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Banks Directory](#banks-directory)
  - [Consents](#consents)
  - [Banking Data](#banking-data)
  - [Transfers](#transfers)
  - [Admin](#admin)
- [Database Schema](#database-schema)

---

## Overview

```
Fintech App → SDK Client → HUB → Bank Adapter
                            ↓
                       PostgreSQL (consents, banks, transfers)
                       Keycloak   (user identity)
```

The Hub sits between fintechs and banks. It validates consents, stores access tokens, and proxies resource requests — banks never expose their APIs directly to fintechs.

---

## Getting Started

### Requirements

- Node.js v20+
- PostgreSQL 15+
- Keycloak 23+

### Run locally

```bash
npm install
cp .env.example .env       # fill in your values

# Start infrastructure only
docker compose up -d postgres keycloak

# Run migrations
npx knex migrate:latest --knexfile knexfile.cjs

# Start the server
npm run dev
```

Hub listens at `http://127.0.0.1:3000`.

### Run with Docker (full stack)

From the root of the monorepo:

```bash
docker compose up --build
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `open_banking_hub` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASS` | `postgres` | Database password |
| `KC_URL` | `http://127.0.0.1:8080` | Keycloak base URL (internal) |
| `KC_REALM` | `openbanking` | Keycloak realm |
| `KC_CLIENT_ID` | `hub-client` | OAuth2 client ID |
| `KC_CLIENT_SECRET` | `hub-secret-123` | OAuth2 client secret |
| `HUB_PUBLIC_URL` | `http://127.0.0.1:3000` | Public URL of the Hub (browser-facing, used in redirects) |
| `APP_PORTAL_URL` | `http://127.0.0.1:5000` | Portal URL for post-consent redirect |
| `SESSION_SECRET` | — | Session signing secret (min 32 chars) |
| `SEED_DEMO_DATA` | `false` | Set `true` to seed mock banks on first migration |

---

## API Reference

### Banks Directory

#### `GET /banks`

Returns all active banks registered in the directory.

**Response `200`**
```json
[
  {
    "id": "alpha-bank-001",
    "name": "MockBank Alpha",
    "authorise_url": "http://localhost:3001/consents/authorise",
    "api_url": "http://localhost:3001",
    "status": "active",
    "created_at": "2026-04-25T10:00:00.000Z"
  }
]
```

---

### Consents

#### `POST /consents`

Creates a new consent request. Returns the bank's authorization URL so the fintech can redirect the user.

**Request body**
```json
{
  "bank_id": "alpha-bank-001",
  "permissions": ["ACCOUNTS_READ", "TRANSACTIONS_READ", "PAYMENTS_WRITE"],
  "expiration_date": "2026-12-31T00:00:00.000Z"
}
```

| Field | Required | Description |
|---|---|---|
| `bank_id` | yes | ID of a registered bank |
| `permissions` | no | Defaults to `[]` |
| `expiration_date` | no | ISO 8601 timestamp |

**Response `201`**
```json
{
  "id": "e8a90abf-d3e7-4237-94e3-a378eedee27d",
  "user_id": "dev-user-tester",
  "bank_id": "alpha-bank-001",
  "status": "AWAITING_AUTHORISATION",
  "permissions": ["ACCOUNTS_READ", "TRANSACTIONS_READ", "PAYMENTS_WRITE"],
  "redirect_url": "http://localhost:3001/consents/authorise?consentId=e8a90abf-...&redirect_uri=http://localhost:3000/consents/callback",
  "created_at": "2026-04-28T12:00:00.000Z"
}
```

The fintech must redirect the user's browser to `redirect_url`.

---

#### `GET /consents/callback`

Receives the authorization code from the bank after the user approves consent. Internally exchanges the code for tokens and redirects the user back to the Portal. **Not called by fintechs directly — this is a bank-to-hub callback.**

**Query params**
| Param | Description |
|---|---|
| `consentId` | The consent UUID |
| `code` | Authorization code issued by the bank |
| `status` | `REJECTED` if the user denied access |

**Internal flow:**
1. Finds the bank via `consent.bank_id`
2. `POST {bank.api_url}/token` → receives `{ access_token, refresh_token, bank_user_id }`
3. Stores tokens in DB, updates consent → `AUTHORISED`
4. Redirects browser to `APP_PORTAL_URL?consentId=<id>`

---

#### `GET /consents/:consentId`

Returns the current state of a consent.

**Response `200`**
```json
{
  "id": "e8a90abf-d3e7-4237-94e3-a378eedee27d",
  "status": "AUTHORISED",
  "bank_id": "alpha-bank-001",
  "permissions": ["ACCOUNTS_READ", "TRANSACTIONS_READ", "PAYMENTS_WRITE"],
  "bank_user_id": "joao",
  "created_at": "2026-04-28T12:00:00.000Z",
  "updated_at": "2026-04-28T12:01:00.000Z"
}
```

---

### Banking Data

#### `GET /accounts?consentId=<id>`

Fetches accounts from the bank using the stored access token.

**Query params**
| Param | Required | Description |
|---|---|---|
| `consentId` | yes | UUID of an `AUTHORISED` consent |

**Internal request the Hub makes to the bank:**
```
GET {bank.api_url}/accounts
Headers:
  Authorization: Bearer <access_token>
  X-Consent-ID:  <consentId>
  X-User-ID:     <bank_user_id>
```

**Response `200`** (proxied from bank)
```json
{
  "accounts": [
    {
      "id": "acc-alpha-001",
      "accountName": "Conta Corrente",
      "accountType": "SAVINGS",
      "balance": 5420.50,
      "currency": "CVE"
    }
  ],
  "bank": "MockBank Alpha"
}
```

| Status | Reason |
|---|---|
| `400` | Missing `consentId` |
| `403` | Consent not authorised or token missing |
| `502` | Bank communication failure |

---

#### `GET /accounts/:accountId/transactions?consentId=<id>`

Fetches transaction history for an account.

**Internal request the Hub makes to the bank:**
```
GET {bank.api_url}/accounts/:accountId/transactions
Headers:
  Authorization: Bearer <access_token>
  X-User-ID:     <bank_user_id>
```

**Response `200`** (proxied from bank)
```json
{
  "transactions": [
    { "id": "tx-001", "description": "Grocery Store", "amount": -150.20, "date": "2026-04-22" },
    { "id": "tx-002", "description": "Salary Deposit", "amount": 3500.00, "date": "2026-04-20" }
  ]
}
```

---

### Transfers

Transfers follow the **Mojaloop 3-step protocol**: Initiate → Confirm Party → Confirm Quote.

Requires `PAYMENTS_WRITE` in the consent permissions.

---

#### `POST /transfers` — Step 1: Initiate

**Request body**
```json
{
  "consentId": "e8a90abf-...",
  "amount": 1000.00,
  "currency": "CVE",
  "debtorAccount": "acc-alpha-001",
  "creditorAccount": "acc-beta-002",
  "creditorName": "Maria Souza"
}
```

**Internal request to bank:**
```
POST {bank.api_url}/transfers
Headers: Authorization: Bearer <access_token>
Body:    { amount, currency, debtorAccount, creditorAccount, creditorName }
```

**Response `200`**
```json
{
  "id": "f3a1b2c3-...",
  "status": "INITIATED",
  "mojaloop_transfer_id": "MOCK-1714300000-abc12",
  "party_info": {
    "name": "Maria Souza",
    "account": "acc-beta-002",
    "fspId": "mock-bank-fsp"
  }
}
```

---

#### `PUT /transfers/:id/confirm-party` — Step 2: Confirm Recipient

**Internal request to bank:**
```
PUT {bank.api_url}/transfers/:mojaloopId/confirm-party
Body: { acceptParty: true }
```

**Response `200`**
```json
{
  "id": "f3a1b2c3-...",
  "status": "PARTY_CONFIRMED",
  "quote_info": {
    "transferAmount": { "amount": "1000.00", "currency": "CVE" },
    "payeeFspFee":    { "amount": "10.00",   "currency": "CVE" },
    "expiration": "2026-04-28T12:10:00.000Z"
  }
}
```

---

#### `PUT /transfers/:id/confirm-quote` — Step 3: Execute

**Internal request to bank:**
```
PUT {bank.api_url}/transfers/:mojaloopId/confirm-quote
Body: { acceptQuote: true }
```

**Response `200`**
```json
{ "id": "f3a1b2c3-...", "status": "COMPLETED" }
```

**Transfer status flow:**
```
INITIATED → PARTY_CONFIRMED → COMPLETED
                           ↘ FAILED
         ↘ FAILED / REJECTED
```

---

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/banks` | List all banks (including inactive) |
| `POST` | `/admin/banks` | Register a new bank in the directory |
| `GET` | `/health` | Service health check |

**Register bank — request body**
```json
{
  "id": "new-bank-003",
  "name": "New Bank",
  "authorise_url": "https://newbank.cv/consents/authorise",
  "api_url": "https://api.newbank.cv",
  "jwks_url": "https://api.newbank.cv/.well-known/jwks.json"
}
```

---

## Database Schema

### `banks`
| Column | Type | Description |
|---|---|---|
| `id` | string PK | Unique bank identifier |
| `name` | string | Display name |
| `authorise_url` | string | User-facing authorization URL |
| `api_url` | string | Internal API base URL (Hub → Bank) |
| `jwks_url` | string? | Public key endpoint for JWT validation |
| `status` | string | `active` / `inactive` |

### `consents`
| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Consent identifier |
| `user_id` | string | Keycloak user sub |
| `bank_id` | string FK | Associated bank |
| `status` | enum | `AWAITING_AUTHORISATION` / `AUTHORISED` / `REJECTED` / `REVOKED` |
| `permissions` | jsonb | Array of permission strings |
| `access_token` | text | Token from the bank |
| `refresh_token` | text | Refresh token from the bank |
| `bank_user_id` | string | User ID in the bank's own system |
| `expiration_date` | timestamp | When the consent expires |

### `transfers`
| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Transfer identifier |
| `consent_id` | uuid FK | Associated consent |
| `bank_id` | string FK | Source bank |
| `amount` | decimal | Transfer amount |
| `currency` | string | e.g. `CVE` |
| `debtor_account` | string | Source account ID |
| `creditor_account` | string | Destination account ID |
| `creditor_name` | string | Recipient display name |
| `mojaloop_transfer_id` | string? | Mojaloop tracking ID |
| `party_info` | jsonb? | Recipient info from Mojaloop lookup |
| `quote_info` | jsonb? | Quote: amounts, fees, expiry |
| `status` | enum | `INITIATED` / `PARTY_CONFIRMED` / `COMPLETED` / `FAILED` / `REJECTED` |

---

## License

Apache-2.0
