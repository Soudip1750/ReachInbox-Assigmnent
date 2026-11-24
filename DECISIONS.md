# DECISIONS.md — Architecture Decisions & Assumptions

## D1: BullMQ Delayed Jobs (not cron)

**Decision**: All scheduling uses BullMQ `delay` option with `jobId = emailJobId`.
**Reason**: The assignment explicitly forbids cron. Delayed jobs are persistent in Redis (with AOF), idempotent (same jobId = no-op), and restart-safe.
**Trade-off**: Jobs fire at "approximately" the scheduled time (depends on Redis availability and worker load), not exactly. This is acceptable for email scheduling.

## D2: Schedule Spreading (round-robin + floor division)

**Formula**: `scheduledAt_i = startTime + floor(i / S) * delayMs`, `sender = senders[i % S]`
**Reason**: Distributes load across S senders while maintaining lead order and per-sender cadence = `delayMs`.
**Trade-off**: Lead order within a "batch" (group of S) may not be sequential, but overall order is preserved.

## D3: Per-Sender Rate Limit (not global)

**Decision**: Rate limits and min-gap are enforced per sender (not globally).
**Reason**: Each sender has its own SMTP credentials and delivery reputation. Mixing senders would make it harder to track limits and debug deliverability issues.
**Trade-off**: A campaign with `hourlyLimit=3` and 3 senders can actually send 9 emails/hour total. This is documented in README.

## D4: Ethereal SMTP (not real email)

**Decision**: Using `nodemailer.createTestAccount()` for SMTP credentials.
**Reason**: The assignment specifies Ethereal. All sends produce a preview URL accessible at `https://ethereal.email/message/...`.
**Trade-off**: Not real delivery. For production, replace `src/services/mailer.ts` with SendGrid/SES adapter.

## D5: JWT in httpOnly Cookie (not Authorization header)

**Decision**: Session stored as JWT in httpOnly, SameSite=Lax cookie.
**Reason**: XSS-safe (JS cannot read httpOnly cookies). SameSite=Lax prevents CSRF on state-changing requests while allowing OAuth redirects.
**Trade-off**: No session revocation (JWT is valid until expiry). Mitigated by 7-day expiry and logout clearing the cookie.

## D6: Atomic Lua Script for Slot Reservation

**Decision**: One Lua script handles gap-key + counter atomically.
**Reason**: Redis is single-threaded and Lua scripts are atomic, eliminating race conditions across multiple worker processes/instances.
**Trade-off**: Counter is incremented on reservation, not on successful send. This means if a send fails permanently, the hour's budget is slightly under-used (conservative, not over-used).

## D7: Sent Counter vs Reservation Counter

**Decision**: Two separate counters: `cnt:{sender}:{window}` for reservations, `sent:{sender}:{window}` for actual sends.
**Reason**: The rate-limit counter `cnt` prevents over-reservation; `sent` is used to trigger the Slack notification exactly once per window boundary.
**Trade-off**: `cnt` is "reserved slots" and may be slightly higher than actual sends (due to failures). `sent` is ground truth for Slack notifications.

## D8: Slack Webhook (not Bot Token for messages)

**Decision**: Using `incoming-webhook` scope, which provides a webhook URL for posting messages.
**Reason**: Simpler OAuth flow, no need to manage channels. The webhook URL is scoped to a specific channel at authorization time.
**Trade-off**: Can only post to the channel chosen during OAuth. For multi-channel support, `chat:write` scope + Bot Token would be needed.

## D9: RUN_WORKER_IN_API=true (single process)

**Decision**: Default is to run the BullMQ worker in the same Node process as the API.
**Reason**: Simpler for development and demo. The worker can be separated by setting `RUN_WORKER_IN_API=false` and running `npm run worker` separately.
**Trade-off**: API and worker share CPU/memory. For production, separate processes (or separate containers) are recommended.

## D10: Elasticsearch Best-Effort Indexing

**Decision**: ES indexing failures are logged but don't block email sending.
**Reason**: Email delivery is the core feature; search is a secondary feature. ES unavailability should not cause email failures.
**Trade-off**: ES may be temporarily stale. `npm run reindex` repairs this.

## D11: At-Least-Once Delivery (Crash Window)

**Decision**: Acknowledged at-least-once delivery with documented crash window.
**Scenario**: Worker crashes after SMTP success but before marking DB as SENT.
**Mitigation**: Deterministic Message-ID (`<emailJobId@reachinbox.local>`) allows receivers to deduplicate. Stale PROCESSING rows are reset after `CLAIM_TIMEOUT_MS` and retried with the same Message-ID.

## D12: Slack Connect/Disconnect in Header

**Decision**: Slack connection is shown as a chip in the header (not in a settings page).
**Reason**: The Figma design did not specify a settings page for Slack. The header is the most visible location.
**Note**: Recorded in DECISIONS.md as required by RI-1501.

## D13: Pagination Defaults

- Page size: 20 items per page
- Max page size: 100
- Max leads per campaign: 10,000 (configurable via `MAX_LEADS` env)

## D14: No Real-Clock Waiting in Tests

**Decision**: The Lua slot reservation uses injected `nowMs` (ARGV[1]), so tests can inject fake timestamps without waiting for real hours.

## D15: Redis Key Namespace

All Redis keys are prefixed with `ri:` to avoid collisions with other applications sharing the same Redis instance.
