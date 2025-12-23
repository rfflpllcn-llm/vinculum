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

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

let supabaseAdminClient: SupabaseClient<Database> | null = null;

export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  supabaseAdminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
};
