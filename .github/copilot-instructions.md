<!-- Copied into repo by AI assistant. Keep concise and actionable. -->
# Copilot / AI Agent Instructions — Unit 48 Financial Management

Purpose: Quickly orient coding agents to the repo structure, runtime commands, data flows, and project-specific conventions so code changes are correct and low-risk.

- **Big picture**: frontend is a Vite + React + TypeScript single-page app (root files, `components/`). Backend is a lightweight Express mock server under `server/` implemented in CommonJS (`server/index.cjs`) that exposes a generic CRUD `/api/:table` pattern and a `/api/sync` endpoint that returns all tables in camelCase.

- **Key files**:
  - `package.json` — start scripts: `npm run dev` (client) and `npm run server` (backend).
  - `vite.config.ts` — dev server config and environment variable mapping.
  - `server/index.cjs` — REST API, table list, special endpoints (`/api/reset`, `/api/reset-zero`, `/api/payment/:id/status`, `/api/members/bulk_upsert`).
  - `server/mockData.cjs` & `services/mockData.ts` — canonical mock datasets and seed shape.
  - `services/storageService.ts` — single source of truth for frontend data fetching, caching, sync logic, polling (every 5s) and writes to backend.
  - `services/geminiService.ts` — AI integration; uses Google GenAI client and expects a Vite env var for the key.

- **Runtime / developer workflows**:
  - Start backend: `npm run server` (runs `node server/index.cjs`, listens on port 3005).
  - Start frontend: `npm run dev` (Vite dev server on port 3000).
  - Both should run concurrently for full local experience.
  - Environment variables: use Vite-style names. Recommended `.env` entries:
    - `VITE_API_URL=http://localhost:3005/api`
    - `VITE_GEMINI_API_KEY=your_key_here`

- **Data flow & conventions (critical)**:
  - Backend DB fields are snake_case; frontend works in camelCase. `server/index.cjs` converts DB results to camelCase for the frontend. `server` expects table names: `member`, `payment`, `ledger_entry`, `expense`, `dues_config`, `audit_log`.
  - Use `StorageService` in `services/storageService.ts` for reads/writes and syncing — it centralizes conversion logic, polling, and derived calculations (e.g., per-member current-year isolation, arrears calculation).
  - Posting ledger/payment/expense entries should use the table names above and the shape exemplified in `server/mockData.cjs` / `services/mockData.ts`.

- **Integration points & gotchas**:
  - AI calls: `services/geminiService.ts` instantiates `GoogleGenAI` with `import.meta.env.VITE_GEMINI_API_KEY`. Ensure `VITE_GEMINI_API_KEY` is set; otherwise the function returns a fallback message.
  - `vite.config.ts` contains `define` mappings for env vars — prefer `VITE_` prefixes for client visibility.
  - The project uses `type: "module"` in `package.json` but the server intentionally uses `.cjs` (CommonJS). Keep that in mind when editing server files.
  - `StorageService.sync()` calls `/sync` which returns a full dataset — prefer this over many granular requests for consistent cache state.

- **Small, actionable examples**:
  - To add a verified payment and ensure ledger posting: call `StorageService.addPayment(payment, adminId)` then `StorageService.verifyPayment(paymentId, adminId)` — the service will post ledger entries and sync cache.
  - Bulk member import: POST to `/api/members/bulk_upsert` with `{ members: [...] }` (see `server/index.cjs`).

- **When editing code**:
  - Update both sides for schema/shape changes: if you change DB column names, update `server` conversions and any `StorageService` logic that relies on field names.
  - Prefer modifying `services/*` helpers (e.g., `StorageService`) instead of scattering fetch calls in components.
  - Keep polling and sync behavior in mind — a small change that writes data should usually call `StorageService.sync()` to keep UI state consistent.

- **No tests / CI found**: there are no test scripts in `package.json`. Validate changes manually by running `npm run server` and `npm run dev` and using the UI to exercise flows.

If anything here is unclear or you want more detail about a specific area (DB schema, StorageService internals, or AI prompts), tell me which part and I will expand or update this file.
