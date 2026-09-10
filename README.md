# AI Travel Booking Agent

A deterministic travel-booking backend with a provider abstraction, a Playwright
browser foundation, human-in-the-loop pauses, a payment abstraction, ticket
artifacts, and observability. **No real ticket is booked.** IRCTC is a skeleton.
The system never solves CAPTCHAs, extracts OTPs, bypasses MFA, or automates
payment authentication — those stay with the human.

The AI agent / LLM orchestration layer is **not built yet** (a later phase).
Everything here is the deterministic backend it will call.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS, React Router, Axios, React Hook Form, Zod
- Backend: Node.js, TypeScript, Express, Zod, JWT, bcrypt, Prisma, BullMQ, Playwright
- Database: Neon PostgreSQL · Queue: Redis + BullMQ

## Architecture

```
User
 → Frontend
 → REST API                 (auth, ownership, validation — deterministic)
 → BookingTask              (Postgres = source of truth)
 → Scheduler → BullMQ       (delayed job; the app does not stay running)
 → BookingWorker            (separate process)
 → BookingExecutionService  (state transitions, attempts, logs, audit, metrics)
 → ProviderBookingExecutor  (staged workflow)
 → ProviderFactory → ProviderRegistry
 → TravelProvider           (MOCK | IRCTC skeleton)
 → BrowserProviderAdapter   (browser providers only)
 → BrowserSession → Playwright
```

The worker never imports IRCTC. Playwright types never leak past the browser
adapter. The LLM (future) will only ever call the REST API / tool layer — never
the database, Redis, Playwright, or a shell directly.

```
TRAIN + MOCK  → MockTrainProvider   (in-memory, no browser, drives every outcome)
TRAIN + IRCTC → IrctcProvider       (skeleton → PROVIDER_NOT_IMPLEMENTED)
```

Unsupported combinations → `UNSUPPORTED_PROVIDER`.

## Setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# set DATABASE_URL (Neon) and REDIS_URL in backend/.env
npm install
npm run prisma:migrate -w backend      # or: npx prisma migrate deploy (see below)
npm run prisma:generate -w backend
npm run prisma:seed -w backend          # optional: demo@example.com / password123
npm run playwright:install              # downloads Chromium ONCE (never at app startup)
```

Run everything:

```bash
npm run dev            # API + worker + frontend
# individually:
npm run dev:api -w backend
npm run dev:worker -w backend
npm run dev -w frontend
```

- API `http://localhost:5000` · Swagger `/api/docs` · Frontend `http://localhost:5173`
- Health: `GET /health`, `/health/ready`, `/health/db`, `/health/redis`
- Metrics: `GET /metrics` (Prometheus text), `GET /metrics.json`
- Providers: `GET /api/providers`, `GET /api/providers/:provider`

### Applying migrations

Migrations `20260910130000` … `20260910170000` add: `BookingStatus.UNKNOWN_RESULT`,
`HumanActionRequest`, `ProviderSession`, `PaymentTransaction`, `TicketArtifact`,
`AuditEvent`. Apply them with:

```bash
cd backend && npx prisma migrate deploy      # then: npx prisma generate
```

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | auth token signing |
| `CORS_ORIGIN` | comma-separated allow-list |
| `REDIS_URL` | BullMQ broker (`redis://localhost:6379`) |
| `BOOKING_JOB_ATTEMPTS` | max BullMQ attempts (default 3) |
| `BOOKING_WORKER_CONCURRENCY` | worker concurrency (default 1) |
| `BOOKING_EXECUTION_TIMEOUT_MS` | overall per-execution timeout → `WEBSITE_TIMEOUT` |
| `MOCK_EXECUTOR_OUTCOME`, `MOCK_EXECUTOR_STEP_DELAY_MS` | mock provider behaviour |
| `BROWSER_HEADLESS`, `BROWSER_TIMEOUT_MS`, `BROWSER_NAVIGATION_TIMEOUT_MS` | Playwright |
| `BROWSER_ARTIFACT_DIR`, `BROWSER_ARTIFACT_RETENTION_DAYS`, `BROWSER_TRACE`, `BROWSER_SAVE_TRACE_ON_SUCCESS` | browser artifacts |
| `IRCTC_BASE_URL`, `REDBUS_BASE_URL` | provider base URLs — **leave empty** until a real, authorized integration exists |
| `PROVIDER_RECONCILE_ENABLED` | reconcile `UNKNOWN_RESULT` via `getBookingStatus` |
| `PAYMENT_PROVIDER`, `PAYMENT_CURRENCY`, `PAYMENT_MOCK_AMOUNT_MINOR` | payment abstraction (only `MOCK` implemented) |
| `HUMAN_ACTION_TTL_MS` | how long a human action request stays actionable |
| `TICKET_STORAGE_DIR`, `TICKET_MAX_BYTES` | ticket artifact storage (gitignored) |
| `METRICS_ENABLED` | expose `/metrics` |

Never commit `.env`. Never put a credential, cookie, OTP, or card detail in any
env var, log, or database column.

## PostgreSQL

Neon (managed). `Postgres is the source of truth` for users, passengers,
booking tasks, attempts, execution logs, human action requests, provider
sessions, payment transactions, ticket metadata, and audit events. Redis is
**not** a source of truth.

## Redis

Local dev: `redis://localhost:6379`. BullMQ recommends Redis 6.2+.

- **Windows:** Memurai (native), or `docker run -d -p 6379:6379 redis:7`, or WSL `redis-server`
- **macOS:** `brew install redis && brew services start redis`
- **Linux:** `sudo apt-get install redis-server && sudo systemctl enable --now redis-server`

Do not expose Redis or BullMQ to the frontend.

## Worker

Separate process (`npm run dev:worker -w backend` / `npm run start:worker -w backend`).

- Queue `booking-execution`; job data is `{ bookingTaskId }` only; job id `booking-{uuid}` (idempotent)
- Concurrency `BOOKING_WORKER_CONCURRENCY` (default 1); `lockDuration` tracks the execution timeout; `maxStalledCount: 1`
- Graceful shutdown on SIGINT/SIGTERM closes worker → browser → queue → Redis → DB
- Retryable failure codes: `WEBSITE_TIMEOUT`, `NETWORK_ERROR`, `TEMPORARY_SERVER_ERROR` (5s / 15s / 45s)
- Everything else — and explicitly `UNKNOWN_RESULT`, `BOOKING_NOT_CONFIRMED`, `BOOKING_ALREADY_CONFIRMED`, `PAYMENT_*`, `NO_SEATS`, `TRAIN_NOT_FOUND`, `PROVIDER_NOT_IMPLEMENTED`, `PROVIDER_CAPABILITY_UNSUPPORTED` — is **never** auto-retried

## AI configuration

No LLM is wired in. When it is added it will be a separate orchestration layer
that only calls the REST API described here. It will never touch the database,
Redis, Playwright, or a shell directly, and its output will be validated before
any deterministic service acts on it.

## Providers

`GET /api/providers` returns `{ name, serviceType, available, health, description, capabilities }`.

- `MOCK / TRAIN / available` — capabilities `SEARCH, AVAILABILITY, BOOKING, CANCELLATION, TICKET_DOWNLOAD, STATUS_RECONCILIATION`
- `IRCTC / TRAIN / unavailable` — health `NOT_IMPLEMENTED`; every operation throws `PROVIDER_NOT_IMPLEMENTED`

### How a provider is added

1. `class MyProvider extends BaseTravelProvider` — declare `name`, `serviceTypes`, `capabilities`
2. Implement `search / checkAvailability / prepareBooking / executeBooking`; optionally `getBookingStatus / downloadTicket / cancelBooking` (gated by capability via `assertCapability`)
3. Keep Playwright behind a `BrowserProviderAdapter` + Page Objects (`src/browser/pages/`); never `page.locator(...)` in provider logic
4. Register it in `src/providers/index.ts` — the worker and factory need no change
5. Prefer an official/authorized API over browser automation. Never design around bypassing a provider's security controls.

### Capability system

`getCapabilities()` advertises what a provider supports. The execution engine
checks `SEARCH`, `AVAILABILITY`, `BOOKING` before running and returns a typed
`PROVIDER_CAPABILITY_UNSUPPORTED` failure (not a crash) when a capability is
missing. Optional operations short-circuit the same way.

## Mock provider usage

`POST /api/bookings/:id/run` (dev only) queues immediately. Optional body
`{ "mockOutcome": "NO_SEATS" }`. Supported outcomes: `SUCCESS`, `TRAIN_NOT_FOUND`,
`NO_SEATS`, `WEBSITE_TIMEOUT`, `NETWORK_ERROR`, `TEMPORARY_SERVER_ERROR`,
`PAYMENT_FAILED`, `PAYMENT_REQUIRED`, `AUTHENTICATION_REQUIRED`, `OTP_REQUIRED`,
`CAPTCHA_REQUIRED`, `PRICE_CHANGED`, `BOOKING_REJECTED`, `TICKET_DOWNLOAD_FAILED`,
`UNKNOWN_ERROR`, `UNKNOWN_RESULT`, `UNKNOWN_RESULT_RECONCILE_CONFIRMED`,
`UNKNOWN_RESULT_RECONCILE_FAILED`. The mock provider never launches Playwright.

## State machine

Explicit transitions, each writing an `ExecutionLog` row:

```
DRAFT → SCHEDULED → QUEUED → RUNNING → COMPLETED
RUNNING → AUTHENTICATION_REQUIRED | PAYMENT_REQUIRED | UNKNOWN_RESULT | FAILED | CANCELLED
RUNNING → QUEUED                      (explicit transient-failure retry handoff only)
AUTHENTICATION_REQUIRED | PAYMENT_REQUIRED → QUEUED   (resume, after a human action)
UNKNOWN_RESULT → COMPLETED | FAILED   (reconciliation resolved it)
UNKNOWN_RESULT → QUEUED               (explicit human decision to retry)
UNKNOWN_RESULT → CANCELLED
COMPLETED | FAILED | CANCELLED are terminal.
```

### How retries work

A failure is retryable only if its code is in the transient set **and** the
BullMQ attempt budget is not exhausted. The engine transitions
`RUNNING → QUEUED` and throws a `RetryableExecutionError`; BullMQ re-delivers
after the backoff. On exhaustion it transitions to `FAILED`.

### How UNKNOWN_RESULT works

An ambiguous result (e.g. payment submitted, then the page died) is **never**
retried. The engine asks the provider once via `getBookingStatus`:

```
UNKNOWN_RESULT
  → getBookingStatus()
      CONFIRMED  → COMPLETED (store the reference)
      FAILED / NOT_FOUND / CANCELLED → FAILED (BOOKING_NOT_CONFIRMED)
      else       → stays UNKNOWN_RESULT + a MANUAL_REVIEW human action
```

A `UNKNOWN_RESULT` booking is resumable (an explicit human "retry" decision) or
cancellable, but the worker will not act on it on its own.

## Human-in-the-loop

When a provider reports `AUTHENTICATION_REQUIRED`, `PAYMENT_REQUIRED`, or
`UNKNOWN_RESULT`, the engine:

1. transitions the booking to the matching paused state
2. opens exactly one `HumanActionRequest` (`LOGIN | OTP | CAPTCHA | PAYMENT | CONFIRMATION | MANUAL_REVIEW`), superseding any earlier pending one
3. records an audit event

The user completes the step **with the provider** (never in this app), then:

```
POST /api/bookings/:id/actions/:actionId/resolve   # records completion only — no secret is stored
POST /api/bookings/:id/resume                        # requeues; also closes pending actions
```

`ProviderSession` models the lifecycle of a human-established session (an opaque
reference + status + expiry). Authenticated browser storage state is **not**
persisted in this phase.

## Payment abstraction

The booking engine only calls `PaymentService`. `PaymentProvider`
(`createPaymentRequest / getPaymentStatus / confirmPayment / cancelPayment`) has
one implementation: `MockPaymentProvider`. Flow:

```
PAYMENT_REQUIRED
  → PaymentService.requirePayment()  → one PaymentTransaction (idempotent), provider request → PROCESSING
  → user authorizes out of band
  → POST /api/bookings/:id/payment/authorize → provider.confirmPayment → SUCCESS | FAILED
```

Payment state machine: `REQUIRED → PROCESSING → SUCCESS | FAILED | CANCELLED`;
`FAILED → PROCESSING` retry; `SUCCESS` / `CANCELLED` terminal. A declined payment
leaves the booking paused — it never spawns a duplicate booking attempt.

**Never** stored or logged anywhere: card number, CVV, UPI PIN, OTP, payment
token, provider credentials, cookies, Authorization headers.

### How a payment provider is added

Implement `PaymentProvider`, `registerPaymentProvider(new MyProvider())` in
`src/payment/payment-registry.ts`, set `PAYMENT_PROVIDER`. Prefer
provider-hosted / tokenized flows. Do not charge a user without explicit
authorization and a legitimate provider-supported mechanism.

## Ticket / PDF artifacts

After a confirmed booking, a provider with `TICKET_DOWNLOAD` has its ticket
retrieved (`DOWNLOADING_TICKET` stage), validated (`application/pdf`,
`≤ TICKET_MAX_BYTES`), and written through `FileStorageProvider`
(`LocalFileStorage`, gitignored). `TicketArtifact` stores metadata; the bytes sit
behind an opaque storage key. Ticket retrieval failure is a warning — it never
fails an already-confirmed booking.

```
GET  /api/bookings/:id/tickets
GET  /api/bookings/:id/tickets/:ticketId/download   # auth + ownership, nosniff, attachment
```

Clients never receive a storage key or filesystem path. Path-traversal keys are
rejected.

## Observability & audit

- **Execution logs** — one `ExecutionLog` per stage, shown as a timeline
- **Audit trail** — append-only `AuditEvent` (FK-free, survives deletion), `GET /api/bookings/:id/audit`; redacted metadata
- **Metrics** — `booking_attempts_total`, `booking_success_total`, `booking_failure_total`, `booking_unknown_result_total`, `provider_errors_total`, `payment_failures_total`, `human_action_created_total`, `worker_job_failures_total`, plus live gauges `human_action_pending`, `booking_queue_depth`, `booking_unknown_result_open`
- **Correlation** — every request gets an `x-request-id` (echoed in the response and error logs)

## Security notes

- helmet, CORS allow-list, 100 kb JSON body cap
- JWT auth on every resource route; ownership (`requireOwned`) on every booking sub-resource (no IDOR)
- Auth register/login rate-limited
- Zod validation on every write; Prisma parameterizes all queries
- Error responses never leak stack traces in production
- Ticket storage keys are opaque UUIDs; traversal/escape rejected; downloads send `X-Content-Type-Options: nosniff`
- Logger + audit + execution-log metadata run through a redaction filter (`password|secret|token|authorization|cookie|credential|card|cvv|otp|…`)
- Browser session details, cookies, and storage state are never returned to the frontend or committed
- `artifacts/` (browser + tickets) is gitignored

## Playwright

Browsers are **not** installed on API/worker startup.

```bash
npm run playwright:install    # Chromium
npm run playwright:test       # opens backend/tests/browser/mock-provider.html only
```

The Playwright test books **mock** train 20902 (BRC → MMCT) for Rahul Jani on a
local HTML page. It never contacts IRCTC or any real site.

### Debug

- `BROWSER_HEADLESS=false` for a visible browser
- Failed runs store traces under `artifacts/browser/booking-{id}/traces/`; inspect with `npx playwright show-trace <trace.zip>`

## Testing

```bash
npm test                       # backend vitest
npm run playwright:test
```

- **Unit / component (no Redis):** provider factory & registry, capabilities, error → state mapping, retry classification, reconciliation outcomes, mock train provider, payment state machine + mock provider + registry, local file storage (round-trip + path-traversal rejection), metrics, human-action type mapping, booking state machine, browser session lifecycle, Playwright mock-page booking.
- **Integration (`tests/*.integration.test.ts`, `auth/booking/passenger/health` API tests):** require a running Redis at `REDIS_URL` and the migrations applied. They cover scheduling, delayed jobs, worker execution, transitions, cancellation, reschedule, run-now, retries, idempotency, ownership, resume, `AUTHENTICATION_REQUIRED` / `PAYMENT_REQUIRED` pauses.

## End-to-end happy path

```
Create BookingTask (TRAIN + MOCK, future scheduledAt)
 → SCHEDULED → BullMQ delayed job
 → at execution time: QUEUED → RUNNING
 → search → verify journey → availability → select → passenger details
 → [AUTHENTICATION_REQUIRED?] human action → resolve → resume
 → [PAYMENT_REQUIRED?] PaymentTransaction → authorize → resume
 → confirm → provider booking reference
 → [TICKET_DOWNLOAD?] ticket stored
 → COMPLETED (bookingReference persisted; audit + metrics recorded)
```

The API always reports status from Postgres, not from any cached or inferred
state.

## Production deployment

- Run API and worker as separate services; both need `DATABASE_URL` + `REDIS_URL`
- `npm run build` then `npm run start -w backend` / `npm run start:worker -w backend`
- `npx prisma migrate deploy` on release
- Set `NODE_ENV=production` (forces headless browser, hides stack traces, disables mock-outcome overrides)
- Point a Prometheus scrape at `/metrics`; use `/health/ready` as the readiness probe
- Put `TICKET_STORAGE_DIR` / `BROWSER_ARTIFACT_DIR` on a writable volume; schedule `cleanupExpiredArtifacts()` yourself (no built-in scheduler)

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Redis is required for Phase 2 tests` | start Redis at `REDIS_URL` |
| `column ... does not exist` / enum value missing | `npx prisma migrate deploy` then `npx prisma generate` |
| Playwright test cannot find Chromium | `npm run playwright:install` |
| Worker never picks up a job | is the worker process running? is `REDIS_URL` the same for API and worker? |
| Booking stuck in `UNKNOWN_RESULT` | intentional — investigate with the provider, then resume or cancel; never mass-retry |
| `/metrics` returns 404 | `METRICS_ENABLED` is off |

## What is NOT implemented

Real IRCTC / MakeMyTrip / RedBus / airline booking · CAPTCHA solving · OTP/MFA
interception · anti-bot evasion · payment automation · card/CVV/UPI storage ·
the AI/LLM orchestration layer · a real object-store or secret manager (local
mock adapters only) · an artifact-cleanup scheduler.
