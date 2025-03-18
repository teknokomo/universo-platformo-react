import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL
const SUPABASE_ANON_KEY =
    process.env.REACT_APP_SUPABASE_ANON_KEY
console.log('[supabaseClient] Using credentials:')
console.log('SUPABASE_URL =', SUPABASE_URL)
console.log('SUPABASE_ANON_KEY =', SUPABASE_ANON_KEY.slice(0, 10) + '...')

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true, // Автоматическое обновление access_token при истечении срока
        persistSession: true // Сохранение сессии в localStorage (или cookies)
    }
})
