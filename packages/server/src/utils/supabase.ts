import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL и Anon Key обязательны')
}

// Глобальный клиент, если требуется для операций без специфической аутентификации
export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Создаёт новый экземпляр SupabaseClient с установленным заголовком Authorization.
 * Это гарантирует, что каждый запрос будет выполняться с переданным токеном,
 * не затрагивая состояние глобального клиента.
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
