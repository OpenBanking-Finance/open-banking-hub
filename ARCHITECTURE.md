# Hub Architecture & API Documentation 📖🧠

This document provides a deep dive into the Open Banking Open Banking Hub internal logic and specifications.

## 📐 Data Flow (The "Handshake")

The Hub manages the "Three-Legged Consent Flow":

1.  **PDI (Public Discovery)**: The Hub fetches the list of active banks from the `banks` table.
2.  **Initiation**: A Fintech (Portal) requests a new consent. The Hub generates a `consentId` and redirects the user to the Bank's `authorise_url`.
3.  **Authorization**: The User logs in at the Bank. The Bank sends an `auth_code` back to the Hub's callback.
4.  **Exchange**: The Hub exchanges the `auth_code` for an `access_token` and `refresh_token`.
5.  **Aggregation**: The Hub uses the stored token to fetch account and transaction data secretly from the Bank's API.

## 🛣️ API Endpoints

### 🏦 Participant Directory (Admin)
- `GET /admin/banks`: List all registered banks.
- `POST /admin/banks`: Register a new institution (ID, Name, Authorize URL, API URL, JWKS).

### 📝 Consent Management
- `POST /consents`: Create a new consent request.
- `GET /consents/:id`: Check consent status.
- `GET /consents/callback`: Handle redirection from banking providers.

### 💰 Banking Aggregator
- `GET /accounts?consentId=...`: Fetch all authorized accounts for a consent.
- `GET /accounts/:id/transactions?consentId=...`: Fetch transaction history.

## 🗄️ Database Schema (Knex)

### Tables:
- **`banks`**: Stores institution metadata (URLs, status).
- **`consents`**: Tracks user permission, status (AWAITING/AUTHORISED/REJECTED), and holds the encrypted tokens.

## 🔐 Security
The Hub supports **mTLS** for provider communication and stores **JWKS** URLs for dynamic cryptographic validation of signed payloads.


