---
name: audit-history-storage-implementation-plan-codex-reviewed
description: Add PostgreSQL database (via Supabase) to store AI audit sessions, enabling users to save GPT-generated analysis results and view their audit history through a dedicated side panel.
---

# Plan

Revise the audit-history storage plan to resolve auth/RLS mismatch, prevent service key exposure, and make user identity stable. The approach is to pick a single auth model (server-only or RLS-based), separate Supabase client/admin modules, and tighten schema + API validation.

## Requirements
- Audit history persists with user-scoped access.
- No service role key ever reaches client bundles.
- Stable user identity not tied to mutable email.
- Clear validation and size limits for stored audit results.

## Scope
- In: Supabase setup, schema updates, API route behavior, client/admin separation, input validation, UI save flow.
- Out: Auto-calling GPT APIs, vector DB features, multi-tenant org roles.

## Files and entry points
- src/app/api/ai/audit/save/route.ts
- src/app/api/ai/audit/history/route.ts
- src/app/api/ai/audit/[auditId]/route.ts
- src/lib/supabaseClient.ts
- src/lib/supabaseAdmin.ts
- src/types/schemas.ts
- src/components/AIAuditModal.tsx
- src/components/AuditHistoryPanel.tsx
- .env.local
- .env.example

## Data model / API changes
- Add user_id (text/uuid) column; keep user_email optional for display.
- Add task_type enum or check constraint.
- Ensure UUID generation with explicit extension (pgcrypto) or alternative.
- Add indexes on (user_id, created_at) and (user_id, alignment_id).

## Action items
[ ] Choose auth model:
    - Option A (server-only): Use service role in API routes, filter by session user_id, disable RLS for this table.
    - Option B (RLS): Mint Supabase JWTs with user_id and email; use anon client with RLS.
[ ] Separate Supabase clients into supabaseClient (browser) and supabaseAdmin (server-only); enforce server-only usage.
[ ] Update schema: add user_id, constraints, extension, indexes; adjust policies if RLS chosen.
[ ] Add Zod (or equivalent) validation for save/history/delete endpoints, including max size for gpt_response.
[ ] Update AIAuditModal to send user_id and enforce required fields.
[ ] Implement AuditHistoryPanel with filters and delete handling.
[ ] Update env vars docs; confirm no service role exposure.

## Testing and validation
- Save audit result and verify row contains correct user_id.
- Fetch history only returns current user’s rows.
- Attempt access without auth returns 401.
- Confirm service role key is not used client-side.
- Validate large payload handling (size limit).

## Risks and edge cases
- RLS model fails without Supabase JWT minting.
- Email-only identity causes history drift if user email changes.
- Large GPT responses can exceed request limits.

## Open questions
- Use server-only access or RLS with Supabase JWTs?
- Is a stable user.id available from NextAuth session for user_id?
