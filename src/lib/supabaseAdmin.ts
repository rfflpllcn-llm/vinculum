import "server-only";

/**
 * Server-side Supabase client
 *
 * CRITICAL: This file must ONLY be imported in server-side code:
 * - API route handlers (app/api/**​/route.ts)
 * - Server actions
 * - Server components (use with caution)
 *
 * NEVER import this in client components - it contains the service role key!
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
