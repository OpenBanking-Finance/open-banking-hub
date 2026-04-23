# Open Banking Hub

The central orchestrator of the Open Finance ecosystem.

## Key Features

- **Participant Directory**: Manage and resolve bank endpoints dynamically.
- **Consent Lifecycle**: Full management of data sharing requests (Initiation to Authorization).
- **Secure Aggregation**: Unified API for fetching balances and transactions from multiple banks.
- **Admin Control Plane**: Endpoints to register and monitor participating institutions.

## Getting Started

### 1. Requirements
- Node.js v20+
- Docker (for Database & Keycloak)

### 2. Infrastructure
Launch the database and identity provider:
```bash
docker-compose up -d
```

### 3. Setup
```bash
npm install
npx knex migrate:latest --knexfile knexfile.cjs
```

### 4. Run
```bash
npm run dev
```

The Hub will be listening at `http://127.0.0.1:3000`.

## 📖 In-Depth Documentation
For detailed API specs and security flows, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 📄 License
Apache-2.0
