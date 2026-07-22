# Supabase production migration

This directory is a production-oriented scaffold, not an automatically deployed database.

## Database

Apply `schema.sql` in a new Supabase project after reviewing the RLS policies for the exact disclosure and matching workflow.

The schema includes:

- homeowner, contractor, and admin profiles
- projects and structured estimate snapshots
- private project photo metadata and storage policies
- contractor public and private profiles
- traceable pricing sources and assumption versions
- intelligence run audit records
- project match decisions and project event history

## AI intake Edge Function

Deploy `functions/ai-intake/index.ts` and set secrets:

```bash
supabase secrets set OPENAI_API_KEY=YOUR_KEY
supabase secrets set OPENAI_MODEL=gpt-5
supabase functions deploy ai-intake
```

The browser should call the Edge Function with the signed-in user's Supabase access token. Do not expose the OpenAI key to the browser.

## Required production review

- Restrict CORS to the production domains.
- Decide exactly when homeowner identity and property details become visible to contractors.
- Verify storage access for matched contractors if photos are shared.
- Add rate limiting and abuse controls to the AI function.
- Add admin approval before contractor profiles become active.
- Add license and insurance verification jobs with timestamps and evidence.
- Add database backups, error monitoring, and audit retention rules.
