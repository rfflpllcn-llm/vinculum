# Phase 1: Audit History Storage Implementation Plan

## Overview

Add PostgreSQL database (via Supabase) to store AI audit sessions, enabling users to save GPT-generated analysis results and view their audit history through a dedicated side panel.

## Key Decisions (from user preferences)

- **Database**: Supabase (managed PostgreSQL with built-in auth)
- **UI Pattern**: Right side panel (similar to LibraryPanel.tsx)
- **User Tracking**: Link to Google account email from NextAuth session (no separate users table)
- **Save Trigger**: Manual "Save Result" button in AIAuditModal

## Current State

- Next.js 15 App Router with NextAuth (Google OAuth)
- No database - only Google Drive storage
- AIAuditModal generates prompts but doesn't save results
- Manual workflow: user copies prompt → pastes to GPT → gets markdown table

## Target State

- Supabase PostgreSQL for audit history
- User-triggered save workflow (manual button)
- Right-side history panel
- Email-based user tracking with RLS security

---

## Implementation Steps

### Step 1: Supabase Setup

**1.1 Create Supabase Project**
- Go to https://supabase.com
- Create new project
- Copy project URL and API keys

**1.2 Install Dependencies**
```bash
npm install @supabase/supabase-js
```

**1.3 Add Environment Variables**

Add to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add to `.env.example`:
```bash
# Supabase (Phase 1: Audit History)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**1.4 Create Database Schema**

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Create audit_sessions table
CREATE TABLE audit_sessions (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  alignment_id UUID,
  prompt_text TEXT NOT NULL,
  gpt_response TEXT NOT NULL,
  gpt_model TEXT DEFAULT 'gpt-4',
  task_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  original_text TEXT,
  source_language TEXT,
  target_language TEXT,
  original_language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_sessions_user_email ON audit_sessions(user_email);
CREATE INDEX idx_audit_sessions_alignment_id ON audit_sessions(alignment_id) WHERE alignment_id IS NOT NULL;
CREATE INDEX idx_audit_sessions_created_at ON audit_sessions(created_at DESC);
CREATE INDEX idx_audit_sessions_user_created ON audit_sessions(user_email, created_at DESC);
CREATE INDEX idx_audit_sessions_user_alignment ON audit_sessions(user_email, alignment_id) WHERE alignment_id IS NOT NULL;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audit_sessions_updated_at
  BEFORE UPDATE ON audit_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own audit sessions"
  ON audit_sessions FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can insert own audit sessions"
  ON audit_sessions FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can update own audit sessions"
  ON audit_sessions FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can delete own audit sessions"
  ON audit_sessions FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');
```

---

### Step 2: Create Supabase Client Configuration

**File: `/src/lib/supabase.ts` (NEW)**

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Client-side Supabase client (uses anon key + RLS)
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side Supabase client (bypasses RLS for admin operations)
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

### Step 3: Add Type Definitions

**File: `/src/types/supabase.ts` (NEW)**

Add Supabase database types for type safety. See full implementation in detailed plan.

**File: `/src/types/schemas.ts` (MODIFY)**

Add to end of file:

```typescript
// ============================================================================
// 12. Audit History (Phase 1)
// ============================================================================

export interface AuditSession {
  auditId: UUID;
  userEmail: string;
  alignmentId: UUID | null;
  promptText: string;
  gptResponse: string;
  gptModel: string;
  taskType: AITask;
  sourceText: string;
  targetText: string;
  originalText: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  originalLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveAuditSessionRequest {
  alignmentId: string | null;
  promptText: string;
  gptResponse: string;
  gptModel: string;
  taskType: AITask;
  sourceText: string;
  targetText: string;
  originalText: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  originalLanguage: string | null;
}

export interface SaveAuditSessionResponse {
  audit: AuditSession;
}

export interface GetAuditHistoryParams {
  alignmentId?: string | null;
  limit?: number;
  offset?: number;
}

export interface GetAuditHistoryResponse {
  audits: AuditSession[];
  total: number;
}
```

---

### Step 4: Create API Routes

**File: `/src/app/api/ai/audit/save/route.ts` (NEW)**

POST endpoint to save audit sessions. Key logic:
1. Check NextAuth session for user email
2. Validate request body (required: promptText, gptResponse, taskType, sourceText, targetText)
3. Insert into Supabase audit_sessions table
4. Return saved audit with camelCase field names

Pattern follows existing routes like `/src/app/api/anchors/route.ts`

**File: `/src/app/api/ai/audit/history/route.ts` (NEW)**

GET endpoint to fetch audit history. Key features:
1. Check authentication
2. Parse query params: alignmentId (filter), limit (default 50), offset (default 0)
3. Query Supabase with RLS filtering by user_email
4. Order by created_at DESC
5. Return audits array + total count

**File: `/src/app/api/ai/audit/[auditId]/route.ts` (NEW)**

DELETE endpoint for removing audits. Features:
1. Check authentication
2. Delete from Supabase (RLS ensures user can only delete own audits)
3. Return success status

---

### Step 5: Modify AIAuditModal

**File: `/src/components/AIAuditModal.tsx` (MODIFY)**

**Add new state variables (after existing state ~line 60):**
```typescript
const [gptResult, setGptResult] = useState<string>('');
const [gptModel, setGptModel] = useState<string>('gpt-4');
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

**Add save handler (before return statement ~line 330):**
```typescript
const handleSaveResult = async () => {
  if (!prompt || !gptResult) {
    setSaveError('Both prompt and result are required');
    return;
  }

  setSaving(true);
  setSaveError(null);
  setSaveSuccess(false);

  try {
    const response = await authFetch('/api/ai/audit/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alignmentId: alignment?.alignmentId || null,
        promptText: prompt,
        gptResponse: gptResult,
        gptModel,
        taskType: task,
        sourceText: editableSourceText,
        targetText: editableTargetText,
        originalText: task === 'audit' && originalLanguageCode ? /* build original text */ : null,
        sourceLanguage: sourceLanguageCode,
        targetLanguage: targetLanguageCode,
        originalLanguage: originalLanguageCode,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save');

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  } catch (err) {
    setSaveError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setSaving(false);
  }
};
```

**Add UI after prompt textarea (~line 482):**
```typescript
{prompt && (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">Paste GPT Result</h3>
      <select
        value={gptModel}
        onChange={(e) => setGptModel(e.target.value)}
        className="text-xs border rounded px-2 py-1"
      >
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        <option value="o1">o1</option>
      </select>
    </div>
    <textarea
      value={gptResult}
      onChange={(e) => setGptResult(e.target.value)}
      placeholder="Paste the markdown table result from GPT here..."
      className="w-full h-64 border rounded p-2 text-xs font-mono resize-none"
    />
    <button
      onClick={handleSaveResult}
      disabled={!gptResult || saving}
      className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
    >
      {saving ? 'Saving...' : 'Save Result'}
    </button>
    {saveSuccess && (
      <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
        Audit result saved to history.
      </div>
    )}
    {saveError && (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
        {saveError}
      </div>
    )}
  </div>
)}
```

**Reset state on modal close:**
```typescript
useEffect(() => {
  if (!isOpen) {
    setGptResult('');
    setGptModel('gpt-4');
    setSaving(false);
    setSaveSuccess(false);
    setSaveError(null);
  }
}, [isOpen]);
```

---

### Step 6: Create AuditHistoryPanel Component

**File: `/src/components/AuditHistoryPanel.tsx` (NEW)**

Right-side panel component following LibraryPanel.tsx pattern. Key features:

**Structure:**
- Fixed overlay with backdrop (similar to LibraryPanel)
- Width: 600px (wider than LibraryPanel's 384px for better content display)
- Header with title and close button
- Optional filter toggle (show only current alignment's audits)
- Scrollable list of audit cards
- Click to expand full details
- Copy prompt/result buttons
- Delete button with confirmation

**State:**
- audits: AuditSession[]
- selectedAudit: AuditSession | null
- loading, error
- filterByAlignment boolean

**Functionality:**
- Load audits on open via GET /api/ai/audit/history
- Filter by alignmentId if toggle enabled
- Expand/collapse audit details on click
- Copy to clipboard functionality
- Delete audit with confirmation

---

### Step 7: Integrate into Main App

**File: `/src/app/page.tsx` (MODIFY)**

**Add import (~line 13):**
```typescript
import AuditHistoryPanel from "@/components/AuditHistoryPanel";
```

**Add state (~line 65):**
```typescript
const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
```

**Add button in toolbar (~line 570):**
```typescript
<button
  onClick={() => setAuditHistoryOpen(true)}
  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded hover:bg-gray-100"
>
  Audit History
</button>
```

**Add panel component (before closing </main> ~line 808):**
```typescript
<AuditHistoryPanel
  isOpen={auditHistoryOpen}
  onClose={() => setAuditHistoryOpen(false)}
  alignmentId={selectedAlignment?.alignmentId}
/>
```

---

## Critical Files

### Files to Create (6)
1. `/src/lib/supabase.ts` - Supabase client initialization
2. `/src/types/supabase.ts` - Database types
3. `/src/app/api/ai/audit/save/route.ts` - Save audit endpoint
4. `/src/app/api/ai/audit/history/route.ts` - Get history endpoint
5. `/src/app/api/ai/audit/[auditId]/route.ts` - Delete audit endpoint
6. `/src/components/AuditHistoryPanel.tsx` - History panel UI

### Files to Modify (3)
1. `/src/types/schemas.ts` - Add AuditSession types
2. `/src/components/AIAuditModal.tsx` - Add save functionality
3. `/src/app/page.tsx` - Integrate history panel

### Configuration Files to Update (2)
1. `.env.local` - Add Supabase credentials
2. `.env.example` - Document Supabase env vars

---

## Testing Checklist

### Setup Verification
- [ ] Supabase project created
- [ ] Environment variables set
- [ ] Database schema created (verify in Supabase Table Editor)
- [ ] npm install completed
- [ ] App runs without errors

### Audit Saving Flow
- [ ] Load alignment in dual view
- [ ] Click "AI Audit" button
- [ ] Generate prompt (triple alignment)
- [ ] Copy prompt to GPT
- [ ] Paste markdown result into modal
- [ ] Select GPT model
- [ ] Click "Save Result"
- [ ] See success message
- [ ] Verify row in Supabase Table Editor

### Audit History Panel
- [ ] Click "Audit History" button
- [ ] Panel slides in from right
- [ ] Audits load (newest first)
- [ ] Click audit to expand details
- [ ] Test "Copy Prompt" button
- [ ] Test "Copy Result" button
- [ ] Test filter toggle (current alignment only)
- [ ] Test delete button
- [ ] Close panel with X button

### Edge Cases
- [ ] Try saving without GPT result (should show error)
- [ ] Open history with no audits (should show empty state)
- [ ] Filter by alignment with no matching audits
- [ ] Very long GPT response (>10KB)
- [ ] Sign out and verify can't access history
- [ ] Sign in as different user (separate histories)

### Security
- [ ] Verify RLS policies (user A can't see user B's audits)
- [ ] Try accessing API without auth (should 401)
- [ ] Verify service role key not exposed to client

---

## User Workflow (After Implementation)

1. User generates audit prompt in AIAuditModal
2. User copies prompt → pastes to ChatGPT/Claude
3. GPT returns markdown table with analysis
4. User pastes result into "GPT Result" textarea
5. User selects GPT model from dropdown
6. User clicks "Save Result" button
7. Success message appears
8. User can open "Audit History" panel anytime
9. User can filter history by current alignment
10. User can copy prompts/results for reuse
11. User can delete old audits

---

## Implementation Notes

- Keep existing manual GPT workflow (don't auto-call GPT API)
- Follow existing patterns from LibraryPanel.tsx and AIAuditModal.tsx
- Use authFetch for API calls (handles session)
- RLS policies enforce user privacy at database level
- Pagination support built in (limit/offset) for future scalability
- All timestamps in ISO-8601 format for consistency
