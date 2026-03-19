import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const createSupabaseAdminClient = (supabaseUrl: string, serviceRoleKey: string): SupabaseClient =>
    createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
