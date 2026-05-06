import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Service-role Supabase client with no cookie dependency.
 * Use this in Inngest functions, background jobs, and any context
 * where Next.js request/response cookies are not available.
 * This client bypasses RLS — always filter by tenant_id explicitly.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
