import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Anon Key are required')
}

// Universo Platformo | Global client, if needed for operations without specific authentication
export const supabase = createClient(supabaseUrl, supabaseKey)
