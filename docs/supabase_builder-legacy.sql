-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.generation_tasks CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;

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

-- Create indexes (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_drive_file_id') THEN
    CREATE INDEX idx_documents_drive_file_id ON public.documents USING btree (drive_file_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'generation_tasks_user_id_idx') THEN
    CREATE INDEX generation_tasks_user_id_idx ON public.generation_tasks USING btree (user_id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can insert their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can update their own generation tasks" ON public.generation_tasks;
DROP POLICY IF EXISTS "Users can delete their own generation tasks" ON public.generation_tasks;

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