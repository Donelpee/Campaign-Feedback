# Load Testing Runbook

This runbook is the repeatable path for validating that Client Pulse Lens is ready for multi-company traffic and sustained response collection.

## What these scripts validate

- Public feedback submission latency and error rates
- Admin response dashboard read pressure
- Failure patterns captured during load in `system_health_events`
- Whether current anti-abuse limits behave as intended under repeated requests

## Scripts

- `npm run load:submit -- scripts/load/submit-feedback-load.config.example.json`
- `npm run load:admin -- scripts/load/admin-read-load.config.example.json`

## Modes for `load:submit`

### `public_edge`

Use this when you want to exercise the real user-facing path:

- Edge Function execution
- request validation
- submission rate limiting
- cooldown handling
- notification side effects

Use this for realistic smoke and soak tests, not for synthetic 2,000-response blasts from one machine, because the IP/browser throttling is supposed to block repeated submissions from the same origin.

Recommended use:

- 10 to 50 unique active link codes
- 1 request per code if you expect all requests to succeed
- higher request counts only when intentionally validating throttling behavior

### `service_rpc`

Use this only in staging or a protected test environment when you want to validate raw write throughput:

- database insert capacity
- RPC latency
- downstream reporting read paths after bulk inserts

This mode bypasses the public duplicate-submission protections and is the right way to simulate 2,000+ successful submissions from a controlled environment.

## Recommended staged test plan

### Phase 1: Public-path smoke

- Use `public_edge`
- 10 companies
- 1 active link code per company minimum
- 10 to 20 concurrent requests
- Goal: confirm low error rate and confirm expected throttling only where intended

### Phase 2: High-volume write validation

- Use `service_rpc`
- 10+ companies worth of active link codes
- 500 submissions
- then 1,000 submissions
- then 2,000 submissions
- Run with increasing concurrency such as 10, 25, 50
- Goal: measure p50, p95, p99 latency and identify the first point where errors climb

### Phase 3: Admin read pressure

- Use `load:admin`
- Mix summary and paginated response RPCs
- Run while Phase 2 traffic is active or immediately after it
- Goal: confirm the admin experience remains responsive while responses are being written

## Environment variables

Set these before running the scripts:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOAD_TEST_ADMIN_JWT`

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required only for `service_rpc`
- `LOAD_TEST_ADMIN_JWT` is required only for `load:admin`
- Never expose the service role key to browser code or production client bundles

## Config files

Example configs live in:

- [scripts/load/submit-feedback-load.config.example.json](/c:/Users/Hp/client-pulse-lens/scripts/load/submit-feedback-load.config.example.json)
- [scripts/load/admin-read-load.config.example.json](/c:/Users/Hp/client-pulse-lens/scripts/load/admin-read-load.config.example.json)

Create project-specific copies before running large tests.

## Reading the reports

Each run writes a JSON report to `load-test-results/` with:

- total requests
- success and failure counts
- HTTP status distribution
- p50, p95, and p99 latency
- top error messages
- sample responses

## How to judge readiness

You are looking for:

- stable p95 latency under target concurrency
- no unexpected 5xx spikes
- no admin read failures during heavy submission windows
- system health events that stay low and understandable
- predictable throttling behavior in public-edge mode

## Follow-up after each test run

After a run:

1. Review the JSON report in `load-test-results/`
2. Query recent `system_health_events` for new errors and warnings
3. Check whether `feedback_submission_attempts` and `feedback_response_email_events` behave as expected
4. If p95 or failure rates degrade, optimize the slowest RPCs and rerun the same scenario
