import type { DbSession } from '@universo/utils'
import { verifySupabaseJwt } from './verifySupabaseJwt'

const RLS_DEBUG = process.env.AUTH_RLS_DEBUG === 'true'

const logRlsDebug = (message: string, payload?: unknown): void => {
    if (!RLS_DEBUG) return
    if (payload !== undefined) {
        console.log(message, payload)
        return
    }
    console.log(message)
}

/**
 * Apply RLS context to a request-scoped database session by setting PostgreSQL session variables.
 * This enables Row Level Security policies that depend on auth.uid() to work with request-bound queries.
 *
 * @param session - Request-scoped database session bound to a dedicated connection
 * @param accessToken - JWT access token from Supabase session
 */
export async function applyRlsContext(session: DbSession, accessToken: string): Promise<void> {
    logRlsDebug('[RLS:applyContext] Starting RLS context setup')

    try {
        // Verify and decode JWT
        logRlsDebug('[RLS:applyContext] Verifying JWT token...')
        const { payload, protectedHeader } = await verifySupabaseJwt(accessToken)
        logRlsDebug('[RLS:applyContext] ✅ JWT verified successfully', {
            alg: protectedHeader.alg,
            sub: payload.sub,
            role: payload.role,
            exp: payload.exp
        })

        // Set PostgreSQL session variables for RLS.
        // We use set_config(..., true) = transaction-local, which auto-clears on
        // COMMIT/ROLLBACK. The middleware wraps each request in BEGIN/COMMIT,
        // so claims never leak to subsequent requests on the same pooled connection.
        //
        // NOTE: We do NOT change the session role to 'authenticated' because that role may not have
        // USAGE privilege on application schemas (e.g., admin). Instead we only set request.jwt.claims,
        // which is sufficient for auth.uid() and RLS policies.

        // Set JWT claims in session config (makes auth.uid() and auth.jwt() work)
        logRlsDebug('[RLS:applyContext] Setting request.jwt.claims in PostgreSQL session')
        await session.query(`SELECT set_config('request.jwt.claims', $1::text, true)`, [JSON.stringify(payload)])
        logRlsDebug('[RLS:applyContext] ✅ JWT claims configured in session')

        logRlsDebug('[RLS:applyContext] ✅ RLS context fully applied')
    } catch (error) {
        console.error('[RLS:applyContext] ❌ Error during RLS context setup', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name
        })
        throw error
    }
}
