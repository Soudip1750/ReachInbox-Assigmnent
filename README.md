# ReachInbox — Email Job Scheduler

A production-quality full-stack email campaign scheduler built with **TypeScript, Express, React, BullMQ, PostgreSQL, Redis, and Elasticsearch**.

## ✨ Features

| Feature | Detail |
|---|---|
| **Google OAuth** | Real auth-code flow; httpOnly JWT cookie; header with avatar/name/email |
| **BullMQ Delayed Jobs** | No cron anywhere; all scheduling via delayed jobs with AOF Redis persistence |
| **Multi-Sender** | N Ethereal accounts provisioned at boot; round-robin assignment per campaign |
| **Atomic Rate Limiting** | Redis Lua script; min gap + hourly cap per sender; multi-worker safe |
| **Restart-Safe** | Boot reconciler re-enqueues jobs from Postgres; AOF ensures Redis survives restarts |
| **Idempotency** | 6-layer defence: BullMQ jobId dedup, DB unique constraint, atomic claim, deterministic Message-ID |
| **Slack Notifications** | Real OAuth v2; notifies on rate-limit hit per (sender, hour); disconnect/reconnect safe |
| **Elasticsearch** | Full-text search over recipient/subject/body; best-effort indexing; reindex script |
| **Bull Board** | Live queue dashboard at `/admin/queues` |
| **React Dashboard** | Dark theme; Scheduled/Sent tabs; Compose modal with CSV upload; real-time refresh every 10s |

---

## 🛠 Prerequisites

- **Node.js** ≥ 20
- **Docker Desktop** (for Postgres, Redis, Elasticsearch)
- **Google Cloud Console** — OAuth 2.0 client (Web application)
- **Slack App** — with `incoming-webhook` scope + HTTPS redirect URI (use `ngrok` locally)

---

## 🚀 Quick Start

### 1. Start Infrastructure

```bash
docker compose up -d
# Wait for all services to be healthy (~30s for Elasticsearch)
```

### 2. Backend Setup

```bash
cd backend
cp ../.env.example .env
# Fill in .env (see Environment Variables section below)

npm install
npx prisma migrate dev --name init
npm run dev
# Server starts on http://localhost:4000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
# Create frontend/.env.local if needed:
# VITE_BACKEND_URL=http://localhost:4000
npm run dev
# Dev server starts on http://localhost:5173
```

### 4. Open the app

Navigate to **http://localhost:5173** and sign in with Google.

---

## 🔧 Environment Variables

Copy `.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (default: `redis://localhost:6379`) |
| `ELASTICSEARCH_URL` | ES endpoint (default: `http://localhost:9200`) |
| `JWT_SECRET` | ≥16 character secret for JWT signing |
| `ENCRYPTION_KEY` | 32-byte base64 key for SMTP/Slack secrets. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4000/auth/google/callback` |
| `SLACK_CLIENT_ID` | From your Slack App settings |
| `SLACK_CLIENT_SECRET` | From your Slack App settings |
| `SLACK_REDIRECT_URI` | Must be HTTPS — use ngrok: `ngrok http 4000`, then set to `https://xxxx.ngrok.io/auth/slack/callback` |
| `ADMIN_EMAILS` | Comma-separated emails that can access Bull Board |
| `SENDER_COUNT` | Number of Ethereal accounts to provision (default: 3) |
| `SMTP_MODE` | `ethereal` (real) or `stub` (for tests) |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency (default: 5) |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Min gap between sends per sender (default: 2000ms) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Hourly cap per sender (default: 200) |

---

## 🏗 Architecture

```
Browser → React (Vite) → Express API → BullMQ Worker
                                    ↓
                              PostgreSQL (source of truth)
                              Redis AOF (delayed jobs + rate state)
                              Elasticsearch (search index)
                              Ethereal SMTP (email delivery)
                              Slack API (rate-limit notifications)
```

### Scheduling Flow

1. `POST /api/campaigns` validates, deduplicates, and calculates scheduled times with **D2 spreading**: `scheduledAt_i = startTime + floor(i / senderCount) * delayMs`, sender = `senders[i % S]`.
2. A DB transaction inserts campaign + N email_jobs (status: `SCHEDULED`), then `addBulk` enqueues all to BullMQ with their delay.
3. When a job fires, the worker runs an **atomic Lua script** (D3) to reserve a slot respecting both min-gap and hourly limit. If the limit is exceeded, the job is moved to `delayed` (not retried, not lost).
4. On success: job is marked `SENT`, ES is updated, and if the sent count equals the hourly limit, a Slack notification fires exactly once per `(sender, hour)`.

### Persistence on Restart

- Redis uses **AOF** (`appendonly yes`), so delayed jobs survive Redis restarts.
- On server boot, the **reconciler** (D5) finds any `SCHEDULED` rows missing from BullMQ and re-adds them, and resets stale `PROCESSING` rows.

### Rate Limiting

The Lua script (`reserveSlot.lua`) is atomic across any number of workers:
- `gap:{sender}` tracks the next available send time (min-gap enforcement)
- `cnt:{sender}:{window}` counts reservations per hour window
- When a window is full, the slot spills to the next hour boundary
- Counter TTL is set to 2h + margin to avoid memory leaks

**Defaults**: 2000ms min gap, 200 emails/hour/sender, 5 worker concurrency.

### Idempotency (6-layer Defence)

1. BullMQ `jobId = emailJobId` → duplicate enqueue is a no-op
2. `UNIQUE(campaign_id, recipient_email)` in DB
3. Atomic `UPDATE ... WHERE status='SCHEDULED'` claim → 0 rows = skip
4. Final `PROCESSING → SENT` guarded by `WHERE status='PROCESSING'`
5. Deterministic `Message-ID: <emailJobId@reachinbox.local>`
6. Stale `PROCESSING` rows reset by reconciler after `CLAIM_TIMEOUT_MS`

---

## 📋 API Reference

| Method & Path | Auth | Description |
|---|---|---|
| `GET /auth/google` | No | Redirect to Google OAuth |
| `GET /auth/google/callback` | No | Exchange code, set cookie |
| `GET /auth/me` | Yes | Current user info + Slack status |
| `POST /auth/logout` | Yes | Clear session cookie |
| `GET /auth/slack` | Yes | Start Slack OAuth |
| `GET /auth/slack/callback` | Yes | Complete Slack OAuth |
| `POST /api/campaigns` | Yes | Create & schedule email campaign |
| `GET /api/emails?status=scheduled\|sent&page&pageSize` | Yes | List emails (paginated) |
| `GET /api/emails/search?q&status&page` | Yes | Elasticsearch search |
| `GET /api/emails/stats` | Yes | Counts per status |
| `GET /api/slack/status` | Yes | Slack connection status |
| `DELETE /api/slack` | Yes | Disconnect Slack |
| `GET /admin/queues` | Admin | Bull Board dashboard |
| `POST /admin/reconcile` | Admin | Trigger reconciler manually |
| `GET /health` | No | Liveness + dependency checks |

---

## 🧪 Running Tests

```bash
# Backend unit tests (no external services needed)
cd backend
npm test

# With coverage
npm run test:all -- --coverage

# Lint
npm run lint
```

For integration tests (requires Docker services running):
```bash
docker compose up -d
# Then run tests in backend/tests/integration/
```

---

## 🔄 Reindex Elasticsearch

If the ES index becomes stale:

```bash
cd backend
npm run reindex
```

---

## 🚦 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Application type: **Web application**
5. Authorized redirect URIs: `http://localhost:4000/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

---

## 💬 Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. OAuth & Permissions → Redirect URLs: add your HTTPS URL (e.g., `https://xxxx.ngrok.io/auth/slack/callback`)
3. Scopes → Bot Token Scopes: add `incoming-webhook`
4. Install App → Copy Client ID and Client Secret to `.env`
5. Start ngrok: `ngrok http 4000`
6. Set `SLACK_REDIRECT_URI=https://xxxx.ngrok.io/auth/slack/callback` in `.env`

---

## ⚠️ Known Limitations

- **Ethereal email** delivers to Ethereal's test mailbox (not real inboxes). For production, replace with SendGrid/SES.
- **Crash window**: If the server crashes after SMTP success but before DB update, the email may be sent again on retry (at-least-once). Mitigated by deterministic Message-ID and stale claim detection.
- **Slack HTTPS requirement**: Slack OAuth redirect must be HTTPS. Use ngrok locally.
- **ES best-effort**: Elasticsearch indexing failures don't block email sending. Use `npm run reindex` to repair.

---

## 📂 Repository Structure

```
/
├── docker-compose.yml          # Postgres 16, Redis 7 (AOF), Elasticsearch 8
├── .env.example                # All environment variables documented
├── README.md
├── DECISIONS.md                # Architecture decisions & trade-offs
├── scripts/demo.md             # Demo walkthrough (≤5 min)
├── backend/
│   ├── prisma/schema.prisma    # Data model
│   ├── src/
│   │   ├── config/             # Zod-validated env, logger
│   │   ├── db/                 # Prisma client
│   │   ├── redis/              # Connections, Lua slot-reservation
│   │   ├── queue/              # BullMQ queue, Bull Board
│   │   ├── worker/             # Email worker processor
│   │   ├── modules/            # auth, campaigns, emails, slack, admin
│   │   ├── services/           # mailer, reconciler, search, slack, crypto
│   │   ├── middleware/         # auth, validate, error
│   │   └── app.ts, server.ts
│   └── tests/
└── frontend/
    └── src/
        ├── api/                # Axios client, React Query hooks
        ├── components/ui/      # Button, Input, Modal, Table, Badge, etc.
        ├── components/layout/  # Header
        ├── features/           # compose, emails, slack
        ├── pages/              # Login, Dashboard
        ├── lib/                # csv.ts, date.ts
        └── types/
```
