# Let-s-trade + Guardrail Gate

This repository now preserves the original **Let's Trade** demo at `/` while adding **Guardrail Gate**, an inline AI policy gateway and admin console for enterprise AI agent safety.

## What ships in this v1

- Existing Let-s-trade UI remains intact.
- Inline policy gateway at `POST /api/guardrail/decide` for prompt and tool-call payloads.
- Relational data model for `tenants`, `users`, `policies`, `requests`, `request_redactions`, and immutable `audit_events` via Prisma schema + migration.
- Deterministic `pass`, `redact`, and `block` decisions with:
  - prompt injection detection
  - unsafe tool-call blocking
  - sensitive field redaction
  - default-deny unknown tool actions when policy rules require it
- Adapter boundaries for Cloudflare AI Security for Apps and an AWS detector fallback, with safe local behavior when credentials are absent.
- Admin console routes:
  - `/login`
  - `/dashboard`
  - `/policies/[id]`
  - `/requests/[id]`
  - `/audit`
- Auditable human review actions that **do not** override original safety decisions.
- Focused tests for policy evaluation, the adversarial fixture, redaction/hash behavior, tenant isolation, gateway persistence behavior, and key UI rendering.

## Architecture

Because the repo started as a very small single-app Next.js project, Guardrail Gate is implemented as an **additive App Router extension** instead of introducing a separate NestJS service. This keeps the change compatible with the existing architecture while still providing clean boundaries:

- `app/api/guardrail/decide` — inline gateway endpoint
- `app/api/policies/*` — policy CRUD + publish
- `app/api/requests/[id]/review` — auditable human review
- `app/api/audit/export` — CSV export
- `lib/guardrail/*` — auth, persistence, detectors, policy engine, and request processing
- `prisma/schema.prisma` — relational model

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Optional but recommended: initialize local Prisma persistence.
   ```bash
   export DATABASE_URL="file:./prisma/dev.db"
   npm run prisma:generate
   npm run db:push
   ```
   If `DATABASE_URL` is omitted, the app falls back to an in-memory mock repository so a developer can still exercise the gateway locally.
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open:
   - `http://localhost:3000/` for the original Let-s-trade experience
   - `http://localhost:3000/login` for Guardrail Gate

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | No | Enables Prisma-backed persistence; otherwise mock persistence is used. |
| `SESSION_SECRET` | No | Signs the local admin session cookie. |
| `GUARDRAIL_SHARED_TOKEN` | No | If set, `POST /api/guardrail/decide` requires a matching bearer token. |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | No | Cloudflare detector adapter boundary. When unset, local heuristics remain authoritative. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | No | AWS detector adapter boundary. When unset, local heuristics remain authoritative. |

## API examples

### OpenAI-style prompt proxy

```bash
curl -X POST http://localhost:3000/api/guardrail/decide \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-slug: demo-tenant' \
  -H 'x-actor-email: admin@guardrail.local' \
  -d '{
    "requestType": "prompt",
    "provider": "openai",
    "prompt": "Summarize this report without exposing credentials"
  }'
```

### Anthropic/custom tool-call proxy

```bash
curl -X POST http://localhost:3000/api/guardrail/decide \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-slug: demo-tenant' \
  -H 'x-actor-email: admin@guardrail.local' \
  -d '{
    "requestType": "tool_call",
    "provider": "anthropic",
    "toolCall": {
      "name": "lookup-balance",
      "arguments": {
        "accountId": "acct_123",
        "authorization": "******"
      }
    }
  }'
```

### Expected response shape

```json
{
  "requestId": "...",
  "policyId": "...",
  "decision": "redact",
  "hardBlock": false,
  "riskScore": 0.82,
  "riskBreakdown": {
    "promptInjection": 0,
    "dataLeak": 0.82,
    "unsafeTool": 0
  },
  "matchedRules": [],
  "detectorResults": [],
  "sanitizedPayload": {},
  "redactions": []
}
```

## Threat model and secure defaults

Guardrail Gate v1 is designed to reduce common enterprise AI gateway risks before traffic reaches downstream models:

- blocks high-confidence prompt injection attempts
- blocks unsafe or unknown tool actions when tenant policy requires it
- redacts configured sensitive fields before persistence and before admin review
- stores hashes and sanitized previews instead of raw secrets
- assigns request IDs to every decision
- creates immutable audit events for decisions, matched rules, policy changes, and reviews
- fails clearly when request validation or body-size limits are exceeded

The included Japanese fixture is treated only as adversarial test input. It is never executed as an instruction.

## Limitations

- Cloudflare, AWS, Clerk, Redis/BullMQ, and ClickHouse are **adapter boundaries** only in this v1; they are documented but not actively called unless you extend the adapters.
- The current persistence implementation defaults to mock mode unless `DATABASE_URL` is configured.
- For compatibility with the existing repository, the gateway runs inside the Next.js app instead of a separate NestJS service.
- Local auth is a signed-cookie development boundary, not a production-ready IAM replacement.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run prisma:generate
npm run db:push
```

## Roadmap

### Phase 1
- inline policy gateway
- admin console starter UI
- immutable audit trail
- local detector heuristics

### Phase 2
- real Cloudflare/AWS scoring adapters
- Clerk-backed authn/authz
- Redis/BullMQ async review workflows
- ClickHouse-scale analytics

### Phase 3
- richer tool-risk scoring
- tenant-managed policy bundles
- OpenTelemetry exporters and SIEM forwarding
