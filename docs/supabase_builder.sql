-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.audit_sessions CASCADE;
DROP TABLE IF EXISTS public.generation_tasks CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;

-- Drop existing type if it exists
DROP TYPE IF EXISTS public.task_type_enum CASCADE;

-- Create enum type for task_type
CREATE TYPE public.task_type_enum AS ENUM (
  'audit',
  'explain',
  'compare'
);

-- Create documents table
CREATE TABLE public.documents (
  document_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drive_file_id TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generation_tasks table
CREATE TABLE public.generation_tasks (
  task_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT 'Task created'::text,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_sessions table
CREATE TABLE public.audit_sessions (
  audit_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  alignment_id UUID,
  prompt_text TEXT NOT NULL,
  gpt_response TEXT NOT NULL,
  gpt_model TEXT DEFAULT 'gpt-4'::text,
  task_type public.task_type_enum NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  original_text TEXT,
  source_language TEXT,
  target_language TEXT,
  original_language TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  task_name TEXT
);

-- Create indexes (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_drive_file_id') THEN
    CREATE INDEX idx_documents_drive_file_id ON public.documents USING btree (drive_file_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_generation_tasks_user_id') THEN
    CREATE INDEX idx_generation_tasks_user_id ON public.generation_tasks USING btree (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_sessions_user_id') THEN
    CREATE INDEX idx_audit_sessions_user_id ON public.audit_sessions USING btree (user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_sessions_alignment_id') THEN
    CREATE INDEX idx_audit_sessions_alignment_id ON public.audit_sessions USING btree (alignment_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_sessions_created_at') THEN
    CREATE INDEX idx_audit_sessions_created_at ON public.audit_sessions USING btree (created_at);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can insert their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can update their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can delete their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can view their own audit sessions" ON public.audit_sessions;
DROP POLICY IF EXISTS "Users can insert their own audit sessions" ON public.audit_sessions;
DROP POLICY IF EXISTS "Users can update their own audit sessions" ON public.audit_sessions;
DROP POLICY IF EXISTS "Users can delete their own audit sessions" ON public.audit_sessions;

-- RLS Policies for documents
CREATE POLICY "Users can view all documents"
  ON public.documents FOR SELECT
  USING (true);

CREATE POLICY "Users can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update documents"
  ON public.documents FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete documents"
  ON public.documents FOR DELETE
  USING (true);

-- RLS Policies for generation_tasks
CREATE POLICY "Users can view their own generation tasks"
  ON public.generation_tasks FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own generation tasks"
  ON public.generation_tasks FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own generation tasks"
  ON public.generation_tasks FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own generation tasks"
  ON public.generation_tasks FOR DELETE
  USING (auth.uid()::text = user_id);

-- RLS Policies for audit_sessions
CREATE POLICY "Users can view their own audit sessions"
  ON public.audit_sessions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own audit sessions"
  ON public.audit_sessions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own audit sessions"
  ON public.audit_sessions FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own audit sessions"
  ON public.audit_sessions FOR DELETE
  USING (auth.uid()::text = user_id);
