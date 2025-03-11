import { createClient } from '@supabase/supabase-js'

// Временно захардкоженные строки:
const SUPABASE_URL = 'XXXXXXXXX'
const SUPABASE_ANON_KEY = 'XXXXXXXX'

// Для отладки выведем в консоль (браузера):
console.log('[supabaseClient] Using HARDCODED credentials:')
console.log('SUPABASE_URL =', SUPABASE_URL)
console.log('SUPABASE_ANON_KEY =', SUPABASE_ANON_KEY.slice(0, 10) + '...')

// Инициализация клиента
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
