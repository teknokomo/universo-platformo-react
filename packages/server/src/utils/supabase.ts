import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Anon Key are required')
}

// Universo Platformo | Global client, if needed for operations without specific authentication
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Creates a new SupabaseClient instance with the Authorization header set.
 * This ensures that each request will be executed with the provided token,
 * without affecting the state of the global client.
 */
export const getSupabaseClientWithAuth = (token: string): SupabaseClient => {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    })
}
