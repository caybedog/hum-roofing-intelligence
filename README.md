# HUM Home Project Planner

HUM is a homeowner-only planning tool for getting an explainable home-project
price range before calling contractors. The active landing page offers a quick
photo path and a guided self-inspection path across roofing, gutters, windows,
doors, plumbing, painting, flooring, electrical, HVAC, siding, decks,
bathrooms, kitchens, fencing, concrete, and landscaping.

AI organizes homeowner language and visible photo facts. It never sets the
price. A deterministic engine uses an immutable, versioned Humboldt County
catalog, confirmed quantities, conditions, access, complexity, and explicit
unknowns to calculate the range.

No account is required to generate a planning range. A homeowner can optionally
create an account to save the estimate privately and later upload a real quote
or final invoice for consented, anonymous calibration.

## Active homeowner MVP

- two-to-four-minute photo-first quote path
- five-to-eight-minute guided self-inspection
- plain-language measurement help and safe-photo guidance
- structured OpenAI image/text extraction with deterministic fallback
- source-backed low, expected, and high planning scenarios
- explicit confidence, assumptions, unknowns, and catalog version
- printable estimate summary
- private saved estimates and uploads
- optional real-quote and final-invoice calibration consent
- contractor identity excluded as a pricing feature

The first catalog is strongest for asphalt roofing. Other categories are marked
low confidence and intentionally use wider regional planning ranges until HUM
has enough reviewed, consented local outcomes.

## Preserved roofing pilot

The former HUM Roofing Intelligence product is preserved in Git history and the
public archive branch `archive/roofing-pilot-vercel-2026-07-26`. Its existing
Supabase records, roles, contractor workflows, and evidence remain intact. The
new planner uses only `planner_*` tables and the private `planner-uploads`
bucket in that same Supabase project.

The later roofing marketplace, agreement, and construction screens remain at
`/prototypes` for reference; they are not part of the active homeowner product
and do not represent completed roadmap rounds.

## What the preserved roofing foundation includes

- Email registration, sign-in, sign-out, and password recovery
- Separate homeowner, contractor, and administrator roles
- Server-enforced row-level security for every product table
- Multiple persistent projects per homeowner with archive-not-delete behavior
- Private project-photo storage with expiring signed previews
- Structured server-side OpenAI intake with validation, timeout, rate limiting, metadata-only request logs, and deterministic fallback
- A deterministic estimate engine that keeps AI out of monetary calculations
- Immutable, versioned Humboldt County pricing catalogs
- Reproducible estimate versions that retain their inputs, outputs, confidence, missing information, and pricing version
- Explicit project sharing to one existing contractor account at a time
- Separate contractor corrections and pricing observations
- Administrator review, role, pricing-version, AI-health, and audit controls

Round 4 does **not** activate a public marketplace, competitive bidding, bid awarding, payments, agreements, external messaging, public contractor profiles, multiple trades, or a public Humboldt launch.

## Round 4 controlled pilot

Round 4 adds the evidence workflow needed to decide whether the roofing intelligence is useful on real Humboldt projects:

- homeowner-controlled pilot enrollment and consent
- expiring contractor invitation links stored only as hashes
- manual contractor pilot approval
- protected, printable contractor project briefs
- contractor estimate review and correction records
- itemized actual quote capture
- HUM estimate-versus-quote comparisons
- reason codes and explanations for material, labor, scope, measurement, access, permit, disposal, warranty, allowance, and market differences
- homeowner and contractor feedback
- final accepted contract and change-order observations recorded as outside-HUM outcomes
- support and critical privacy/authorization issue queues
- intake and pilot event analytics
- administrator accuracy evidence and exit-gate dashboard

Round 5 remains locked until at least ten real roofing projects have comparable quotes, major differences are explained, both audiences understand the brief, and no critical privacy or authorization failure remains.

## Phase 4A administrator QA

Phase 4A adds a protected rehearsal lane before a real homeowner enters the pilot:

- disposable, role-separated homeowner and contractor QA accounts
- permanent test-account and test-project classification
- automatic exclusion of every QA record from the ten-project exit gate
- a ten-step administrator rehearsal checklist across homeowner, contractor, and administrator roles
- persistent pilot controls for enrollment pause, invitation expiry, variance review, and support routing
- audit records for settings changes, QA creation, and QA reset
- exact-confirmation cleanup that removes only the selected rehearsal’s accounts, projects, photos, estimates, shares, invitations, quotes, reasons, feedback, issues, and outcomes

The `phase4a-admin` Edge Function performs privileged account creation and cleanup only after verifying an active non-test HUM administrator. Temporary passwords are returned once and are never stored in HUM’s database.

## Update and run on macOS

```bash
cd ~/Downloads/hum-roofing-intelligence
git pull --ff-only origin main
npm install
npm run dev -- --open
```

If the browser does not open automatically:

```bash
open http://localhost:5173
```

The public Supabase URL and publishable browser key are safe client configuration and are included in the app. The local app still works without an OpenAI key by using its deterministic intake fallback. To exercise live OpenAI intake locally, copy `.env.example` to `.env.local` and add your own server-side `OPENAI_API_KEY`. Never commit `.env.local`.

## Architecture

| Layer | Responsibility |
|---|---|
| Supabase Auth | Account sessions and password recovery |
| PostgreSQL RLS | Project ownership, contractor sharing, administrator access, and role enforcement |
| Supabase Storage | Private JPEG, PNG, and WebP project photos up to 8 MB |
| OpenAI Responses API | Structured interpretation of homeowner language only |
| Deterministic estimate engine | All quantities, costs, overhead, contingency, and planning-price calculations |
| Versioned pricing | Region, effective date, sources, confidence, approval, and immutable history |
| Audit tables | Security-relevant record changes and metadata-only AI request health |

The browser never receives the OpenAI key. API routes verify the bearer session with Supabase before accessing a project. Approved pricing rows cannot be edited; administrators clone them into a proposed version and explicitly approve the new version.

## Local setup from a fresh clone

Prerequisites:

- Node.js `>=22.13.0`
- npm
- Supabase CLI dependencies if you want a fully local database

Install and start the app:

```bash
npm install
npm run dev
```

Optional local environment:

```bash
cp .env.example .env.local
```

Add an OpenAI API key only if you need to test the live interpreter. Keep it server-side.

## Database setup

The canonical schema is:

```text
supabase/migrations/20260724191417_secure_intelligence_foundation.sql
```

Apply migrations with the Supabase CLI when the project is linked:

```bash
npx supabase db push
```

For a disposable local Supabase stack:

```bash
npx supabase start
npx supabase db reset
```

The migration is repeatable through a clean reset and creates:

- product enums and tables
- indexes and explicit grants
- signup/profile and audit triggers
- authorization helper functions and RPCs
- row-level security policies
- a private `project-photos` bucket and storage policies
- the first approved Humboldt County roofing pricing version

The homeowner planner and preserved roofing pilot share the hosted HUM Supabase
project but use separately named tables, storage paths, and row-level-security
policies. No existing roofing records are migrated, deleted, or counted as
planner calibration data.

## Pricing and estimate reproducibility

The seeded baseline is `HUM-HC-ROOF-2026.07-BASELINE`. Every pricing row records a unit, low/expected/high values, source, source URL when applicable, verification date, confidence, and change note.

Every generated estimate stores:

- the homeowner facts used at that moment
- the AI interpretation, if any
- the exact pricing version ID and normalized pricing inputs
- low, expected, and high calculation results
- confidence and missing-information lists
- the deterministic calculation audit

Regenerating an estimate creates a new immutable estimate version. It does not rewrite an earlier result.

## Security model

- New signup metadata can request only `homeowner` or `contractor`; it can never self-assign `administrator`.
- Homeowners can create and update only their own projects.
- Contractors can read only projects with an active explicit share to their authenticated account.
- Contractors write corrections into separate review records; they cannot overwrite homeowner facts or estimates.
- Administrators are checked by a server-side database role helper.
- Project photos are private and use five-minute signed URLs.
- Storage paths begin with the authenticated homeowner ID and project ID.
- The OpenAI endpoint permits ten requests per account per hour, validates structured output, times out after 15 seconds, and logs no homeowner narrative.
- UI visibility is never treated as authorization.

## Verification

Run the complete local verification set:

```bash
npm run check
```

Individual commands:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:rendered
```

Database security tests live in `supabase/tests/rls_policies.sql`. They verify project isolation, contractor share/revocation behavior, role protection, and administrator visibility in a transaction that rolls back its test records.

## Deployment

The site supports two production build targets:

- OpenAI Sites uses `npm run build` and the project declared in `.openai/hosting.json`.
- Vercel uses `npm run build:vercel` through `vercel.json` and deploys automatically from GitHub.

Both production environments must define:

```text
OPENAI_API_KEY       secret
OPENAI_MODEL         gpt-5.6
```

The Supabase URL and publishable key may use the defaults in `app/foundation/config.ts` or matching environment values. The Supabase Auth production redirect allowlist must include:

```text
https://hum-roofing-intelligence.caybedog707.chatgpt.site/**
https://<production-vercel-domain>/**
```

The live landing page is the homeowner planner. The preserved roofing pilot
remains archived and its former ten-project launch gate is not treated as
completed by planner estimates or planner calibration uploads.
