import type { QueryRunner } from 'typeorm'
import { jwtVerify } from 'jose'

/**
 * Apply RLS context to a TypeORM QueryRunner by setting PostgreSQL session variables.
 * This enables Row Level Security policies that depend on auth.uid() to work with TypeORM.
 *
 * @param runner - TypeORM QueryRunner connected to the database
 * @param accessToken - JWT access token from Supabase session
 */
export async function applyRlsContext(runner: QueryRunner, accessToken: string): Promise<void> {
    console.log('[RLS:applyContext] Starting RLS context setup')

    const secret = process.env.SUPABASE_JWT_SECRET
    if (!secret) {
        console.error('[RLS:applyContext] ❌ SUPABASE_JWT_SECRET environment variable is missing')
        throw new Error('SUPABASE_JWT_SECRET environment variable is required for RLS context')
    }

    console.log('[RLS:applyContext] JWT secret found, length:', secret.length)

    try {
        // Verify and decode JWT
        console.log('[RLS:applyContext] Verifying JWT token...')
        const { payload } = await jwtVerify(accessToken, new TextEncoder().encode(secret))
        console.log('[RLS:applyContext] ✅ JWT verified successfully', {
            sub: payload.sub,
            role: payload.role,
            exp: payload.exp
        })

        // Set PostgreSQL session variables for RLS
        // 1. Set role to 'authenticated' (matches Supabase RLS policies)
        console.log("[RLS:applyContext] Executing: SET LOCAL role = 'authenticated'")
        await runner.query(`SET LOCAL role = 'authenticated'`)
        console.log('[RLS:applyContext] ✅ Role set to authenticated')

        // 2. Set JWT claims in session config (makes auth.uid() and auth.jwt() work)
        console.log('[RLS:applyContext] Setting request.jwt.claims in PostgreSQL session')
        await runner.query(`SELECT set_config('request.jwt.claims', $1::text, true)`, [JSON.stringify(payload)])
        console.log('[RLS:applyContext] ✅ JWT claims configured in session')

        console.log('[RLS:applyContext] ✅ RLS context fully applied')
    } catch (error) {
        console.error('[RLS:applyContext] ❌ Error during RLS context setup', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            errorType: error?.constructor?.name
        })
        throw error
    }
}
