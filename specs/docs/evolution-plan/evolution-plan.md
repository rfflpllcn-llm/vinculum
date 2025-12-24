# Vinculum — Evolution Plan (from “dev self-hosted” to “hosted web app”)

> Goal: turn Vinculum from a developer-installed stack (Docker + Supabase + Google Console setup) into a hosted, scholar-friendly web app that feels like: **open URL → sign in → pick PDFs → read + anchor + annotate**.

---

## 0) Current state (baseline)

### What exists today
- Next.js web app (local dev via Docker / npm)
- Google OAuth / Drive integration (user must configure Google Cloud Console)
- Supabase backend (user must create project, run SQL, handle service role key)
- Secrets and env variables managed manually
- Setup is documented but still “platform bootstrap” level complexity

### Why this blocks adoption
End users (scholars/translators) must:
- install Docker / WSL2
- create a Google Cloud project + OAuth client + redirect URIs
- create a Supabase project + run schema SQL
- copy/paste secrets correctly

This is acceptable for developers; it’s not acceptable for mainstream users.

---

## 1) Target product (Hosted Vinculum)

### The user promise
- **File-level access they choose** (via Drive picker)
- **Read-only** access to their PDFs (Vinculum does not modify the PDFs)
- **Clear retention rules** (what is stored, for how long, where)
- **Easy disconnect** (revokes access, deletes tokens, optional data deletion)

### Desired user journey
1. Visit `app.vinculum.xyz`
2. Sign in with Google
3. Click “Connect Drive”
4. Pick PDFs (or a folder) → Vinculum shows a library
5. Open a PDF → render pages
6. Create anchors/rectangles → write notes → run AI audit (optional)
7. Disconnect any time

No Docker, no Supabase project creation, no Google Cloud Console steps for the user.

---

## 2) Architecture changes (high level)

### From…
- “User hosts everything”
- Per-user Supabase + per-user Google Cloud Console setup
- Manual schema scripts

### To…
- **One hosted app** + **one managed database**
- **One OAuth app** owned by Vinculum (users only consent)
- Automated DB migrations
- Multi-tenant security (RLS)

---

## 3) Drive integration: how to keep “read-only” while storing metadata

### Key constraint
If the app creates a normal folder/files in the user’s Drive, it needs write scopes.
That conflicts with the “read-only” promise.

### Recommended solution: metadata NOT in normal Drive
Pick one of these two “acceptance-grade” strategies:

#### Strategy A — Store metadata in Vinculum Cloud (default)
- PDFs remain in user’s Drive
- Vinculum stores only:
  - document references (Drive file IDs)
  - anchors/rectangles + note markdown
  - alignment mappings and AI outputs (optional)
- Benefits:
  - **true read-only** access to PDFs
  - simplest UX
  - fastest performance
- Tradeoff:
  - user trusts Vinculum to store annotations

#### Strategy B — Store metadata in Google Drive `appDataFolder` (privacy-friendly)
- Same as A, but metadata is stored in Drive’s hidden app data space (not visible clutter)
- Still avoids modifying PDFs
- Benefits:
  - no visible “Vinculum folder” clutter
  - users feel “my data stays in my Google account”
- Tradeoff:
  - more complex token handling + metadata sync

> Strong recommendation: **Default to Strategy A**, optionally offer Strategy B as “private storage in Google app data”.

#### Avoid by default — Visible “Vinculum Metadata” folder
- Only offer as an **Export** feature:
  - “Export notes + anchors as JSON/MD into Drive folder”
- If you make it the default, trust and adoption drop.

---

## 4) Multi-tenant data model & security (must-have)

### Data model (minimum)
- `users`
- `projects` (optional grouping)
- `documents` (Drive file ID, title, mime, owner user_id)
- `anchors` (doc_id, page, rect, type, created_by)
- `notes` (anchor_id or doc_id, markdown, created_by)
- `drive_tokens` (encrypted refresh token, scopes, provider metadata)
- `jobs` (OCR/embedding/alignment status)

### Security essentials
- **RLS everywhere**: user only reads/writes their own rows
- Never accept client-provided `user_id` as truth
- Server routes with elevated privileges must be narrow and auditable

---

## 5) “Clear retention rules” (product + UI)

### Default retention statement (recommended)
- PDFs remain in your Google Drive.
- Vinculum **does not modify** your PDFs.
- Vinculum stores:
  - selected file IDs (references)
  - anchors/rectangles and notes
  - optional AI analysis outputs
- Vinculum does **not** store full PDF contents unless you enable caching.

### Settings page should include
- Toggle: “Cache rendered pages / extracted text for speed” (off by default)
- “Export my data” (zip/json/md)
- “Delete my data”
- “Disconnect Google Drive”

---

## 6) “Easy disconnect” (what it must do)

A single action “Disconnect Drive” should:
1. Revoke OAuth grant (or revoke refresh token)
2. Delete tokens from DB
3. Stop background jobs / syncing immediately
4. Offer checkboxes:
   - delete Vinculum cloud annotations
   - delete Drive appData metadata (if used)
   - keep exported files (if any)

This is the trust anchor.

---

## 7) Migration plan (phased evolution)

### Phase 1 — Hosted MVP (ship fast)
**Outcome:** users can use Vinculum from a URL with Google sign-in.

- Host Next.js (Vercel or Cloud Run)
- Create one Supabase project owned by Vinculum
- Add DB migrations (no manual SQL copy/paste)
- Implement RLS + user-scoped tables
- Implement Drive picker + document library
- Implement anchors + notes saving
- Add `/settings/privacy` and `/disconnect`

Acceptance criteria:
- New user can start in < 5 minutes
- No “developer setup” steps
- Disconnect works and is obvious

---

### Phase 2 — Reliability + speed
**Outcome:** feels stable on real-world PDFs.

- Add caching layer (optional, user-controlled)
- Add background worker for heavier tasks (OCR/embeddings/alignment)
- Add job status UI + retries
- Add rate limiting + basic monitoring

Acceptance criteria:
- large PDFs remain responsive
- long tasks don’t block UI
- errors are actionable (no generic 500s)

---

### Phase 3 — Scholar-grade portability & trust
**Outcome:** users can keep their work independent of Vinculum.

- Export/import project bundles
- Optional Drive `appDataFolder` metadata mode
- “Share read-only link” or team sharing (optional)
- Institutional-ready documentation (privacy, data handling)

Acceptance criteria:
- user can export everything and leave
- privacy posture is clear and credible

---

## 8) Changes to docs (what to remove / replace)

### Deprecate for end users
- Docker Desktop / WSL2 setup
- “Create your own Google Cloud project”
- “Create your own Supabase project”
- Manual SQL execution steps

### Replace with
- “Hosted app Quick Start”
- “Privacy & Drive permissions explained”
- “How to disconnect and delete”
- “How to export your work”

Keep the Docker/self-host docs, but label them “for developers / institutions”.

---

## 9) Risks & mitigations

### Risk: Drive scopes look scary
Mitigation:
- Use smallest scopes possible
- Explain clearly: “only files you pick”
- Provide upload/import alternative

### Risk: Token security
Mitigation:
- Encrypt refresh tokens at rest
- Key rotation plan
- One-click disconnect + delete

### Risk: Multi-tenancy bugs
Mitigation:
- RLS + server-side guards
- Automated tests for access isolation
- Audit log for privileged operations

---

## 10) Success metrics (practical)
- Onboarding completion rate (sign-in → first PDF opened)
- Time to first anchor
- Disconnect usage works reliably
- Support tickets per 100 users (should drop sharply vs self-hosted)

---

## Summary
This evolution turns Vinculum into a product scholars will accept:
- **Hosted by default**
- **Drive access is limited and transparent**
- **PDFs stay in Drive**
- **Annotations are controlled, exportable, deletable**
- **Disconnect is one click**

Next step: implement Phase 1 + decide metadata storage strategy:
- default: Supabase (cloud metadata)
- optional: Drive appDataFolder
