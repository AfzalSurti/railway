# AI Travel Booking Agent

Phase 3 adds a **provider abstraction** and a **Playwright browser foundation**. The mock train provider is the working executor. The IRCTC provider is a skeleton only. The system still does **not** book real tickets, solve CAPTCHAs, extract OTPs, or automate payment.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS, React Router, Axios, React Hook Form, Zod
- Backend: Node.js, TypeScript, Express, Zod, JWT, bcrypt, Prisma, BullMQ, Playwright
- Database: Neon PostgreSQL
- Queue: Redis + BullMQ

## Architecture

```
User
 → BookingTask
 → Scheduler
 → BullMQ
 → BookingWorker
 → BookingExecutionService
 → ProviderFactory
 → TravelProvider
 → ProviderAdapter (browser providers only)
 → BrowserSession
 → Playwright
```

The worker never imports IRCTC. It only calls `BookingExecutionService`.

```
TRAIN + MOCK  → MockTrainProvider (in-memory, no Playwright)
TRAIN + IRCTC → IrctcProvider (skeleton, returns PROVIDER_NOT_IMPLEMENTED)
```

Unsupported combinations return `UNSUPPORTED_PROVIDER`.

## Human-in-the-loop

Providers may return `AUTHENTICATION_REQUIRED`, `PAYMENT_REQUIRED`, `CAPTCHA_REQUIRED`, or `UNKNOWN_RESULT`. The engine does **not** bypass login, OTP, MFA, CAPTCHA, or payment. It pauses the booking and records an action-required state. Resume with:

```
POST /api/bookings/:id/resume
```

That requeues the task after a human action. It does not automate authentication.

## Setup

1. Copy environment templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Set `DATABASE_URL` in `backend/.env` to your Neon PostgreSQL connection string.
3. Set `REDIS_URL=redis://localhost:6379` (default).
4. Install dependencies:

```bash
npm install
```

5. Run migrations:

```bash
npm run prisma:migrate -w backend
npm run prisma:generate -w backend
```

6. Optional seed (`demo@example.com` / `password123`):

```bash
npm run prisma:seed -w backend
```

7. Install Playwright Chromium **once** (not at application startup):

```bash
npm run playwright:install
```

## Playwright

Browsers are **not** installed when the API or worker starts.

```bash
npm run playwright:install    # downloads Chromium
npm run playwright:test       # local mock HTML page only
```

The Playwright test opens `backend/tests/browser/mock-provider.html` and books **mock** train 20902 (BRC → MMCT) for Rahul Jani. It never contacts IRCTC or any real travel website.

### Debug Playwright

- Set `BROWSER_HEADLESS=false` in `backend/.env` for a visible browser during development.
- Failed runs store traces under `artifacts/browser/booking-{id}/traces/` when tracing is enabled.
- Inspect a trace with `npx playwright show-trace path/to/trace.zip` from `backend/`.
- Keep `IRCTC_BASE_URL` empty until a later phase. Do not store IRCTC passwords, OTP, or payment credentials.

### Artifacts

```
artifacts/browser/booking-{bookingTaskId}/
  screenshots/
  traces/
  logs/
```

Artifacts are gitignored. The API exposes a safe `artifactId` only — never raw filesystem paths, cookies, or Authorization headers. `BROWSER_ARTIFACT_RETENTION_DAYS` configures how long files should be kept. `cleanupExpiredArtifacts()` can delete old folders; there is no cleanup scheduler yet.

## Redis

Development Redis is local: `redis://localhost:6379`.

Do not commit Redis credentials. Do not expose Redis or BullMQ to the frontend.

### Windows

Practical options:

- **Docker Desktop:** `docker run -d --name redis -p 6379:6379 redis:7`
- **WSL Ubuntu:** `sudo apt-get install redis-server && sudo service redis-server start`
- **Memurai** (Windows Redis-compatible server)

### macOS

```bash
brew install redis
brew services start redis
```

### Linux

```bash
sudo apt-get install redis-server
sudo systemctl enable --now redis-server
```

BullMQ recommends Redis **6.2+**. Redis 5 will emit a version warning but basic queue operations still work.

## Commands

Root:

```bash
npm run dev              # API + worker + frontend
npm run dev:api
npm run dev:worker
npm run dev:frontend
npm run build
npm run lint
npm test
npm run playwright:install
npm run playwright:test
```

Backend:

```bash
npm run dev:api -w backend
npm run dev:worker -w backend
npm run start -w backend
npm run start:worker -w backend
npm run prisma:migrate -w backend
npm run prisma:generate -w backend
npm run prisma:seed -w backend
npm run test -w backend
npm run playwright:install -w backend
npm run playwright:test -w backend
```

Frontend:

```bash
npm run dev -w frontend
npm run build -w frontend
```

- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/api/docs`
- Frontend: `http://localhost:5173`
- Health: `GET /health`, `GET /health/db`, `GET /health/redis`
- Providers: `GET /api/providers`, `GET /api/providers/:provider`

## Scheduling

`scheduledAt` is stored as a timezone-aware UTC timestamp. ISO strings such as `2026-08-27T09:55:00+05:30` are parsed by the JavaScript `Date` API. Delay is `max(0, scheduledAt - now)` in UTC milliseconds. The frontend countdown is display-only.

## State machine

Allowed transitions are explicit. Examples: `SCHEDULED → QUEUED → RUNNING → COMPLETED`. `COMPLETED → RUNNING` is rejected. `RUNNING → QUEUED` is allowed only as an explicit retry handoff after a transient failure. `AUTHENTICATION_REQUIRED → QUEUED` and `PAYMENT_REQUIRED → QUEUED` are used by resume.

Every transition writes an `ExecutionLog` row.

## Queue and worker

- Queue name: `booking-execution`
- Job data: `{ bookingTaskId }` only
- Job id: `booking-{uuid}` (idempotent; no colons)
- Worker is a **separate process**
- Worker concurrency: `BOOKING_WORKER_CONCURRENCY` (default `1`)
- Retryable failures: `WEBSITE_TIMEOUT`, `NETWORK_ERROR`, `TEMPORARY_SERVER_ERROR` (3 attempts, 5s / 15s / 45s)
- Not retried: `NO_SEATS`, `TRAIN_NOT_FOUND`, `PAYMENT_FAILED`, `AUTHENTICATION_REQUIRED`, `PAYMENT_REQUIRED`, `UNKNOWN_RESULT`, `PROVIDER_NOT_IMPLEMENTED`

`UNKNOWN_RESULT` fails immediately and asks for manual investigation. The engine must not blindly retry after an unknown payment/booking result.

## Providers

`GET /api/providers` returns:

- `MOCK` / `TRAIN` / `available: true`
- `IRCTC` / `TRAIN` / `available: false` (`NOT_IMPLEMENTED`)

The mock provider simulates search, availability, prepare, and execute using `mockOutcome`. It does not launch Playwright.

The IRCTC provider is intentionally unimplemented. If executed it returns `PROVIDER_NOT_IMPLEMENTED`.

## Mock outcomes (development/test only)

`POST /api/bookings/:id/run` queues work immediately. Optional body:

```json
{ "mockOutcome": "NO_SEATS" }
```

Ignored in production. Default env: `MOCK_EXECUTOR_OUTCOME=SUCCESS`.

## Tests

```bash
npm test
npm run playwright:test
```

Requires PostgreSQL (Neon) and Redis. Tests cover scheduling, delayed jobs, worker execution, transitions, cancellation, reschedule, run now, retries, idempotency, ownership, provider factory/registry, mock provider, error mapping, resume, and local Playwright mock-page booking.
