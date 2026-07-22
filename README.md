# HUM Roofing Intelligence — Round 2

A dependency-free roofing project intelligence prototype with a production-ready data and AI foundation.

## Fastest Mac preview

1. Double-click `start_mac.command`.
2. If macOS blocks it, right-click it, choose **Open**, then **Open** again.
3. The script opens HUM on the Mac and prints the Wi-Fi link for a phone.
4. Keep the Terminal window open while testing.

## Manual start

```bash
npm start
```

Open `http://localhost:4173`. The server listens on `0.0.0.0`, so another device on the same Wi-Fi can open `http://YOUR-MAC-IP:4173`.

## Optional live AI intake

The app always has a deterministic offline language parser. To enable live structured AI extraction, set the API key only on the server:

```bash
export OPENAI_API_KEY="your_key"
export OPENAI_MODEL="gpt-5" # optional
npm start
```

Never place the API key in `app.js`, `index.html`, or browser localStorage. The local Node server calls `/v1/responses` with a strict JSON schema and `store: false`.

## Round-two features

- Multiple-project library and status pipeline
- AI-assisted free-text roofing intake
- Safe offline parser when live AI is unavailable
- Deterministic pricing remains separate from AI output
- Traceable material, labor, disposal, and allowance source ledger
- Verification, source confidence, location, date, and unit metadata
- Weighted proposals from verified cost evidence
- Explicit approval before any assumption changes
- Contractor fit scoring with reasons and concerns
- Homeowner report now shows a demo matching preview
- Supabase PostgreSQL schema, storage bucket, audit records, and RLS policies
- Supabase Edge Function scaffold for secure AI intake
- Local-first storage so the runnable prototype works immediately

## Test

```bash
npm test
```

The test suite covers replacement and repair scenarios, margin integrity, confidence behavior, text extraction, weighted knowledge updates, and contractor ranking.

## Production migration files

- `supabase/schema.sql`
- `supabase/functions/ai-intake/index.ts`
- `.env.example`

## Current boundaries

- Cost records included in the demo are unverified examples.
- Contractor profiles shown in matching are fictional demonstrations.
- The standalone build does not create real accounts or synchronize data until Supabase is configured.
- AI interpretation does not diagnose a roof or determine the selling price.
- Final measurements, concealed conditions, code requirements, and binding quotes require qualified professionals.
