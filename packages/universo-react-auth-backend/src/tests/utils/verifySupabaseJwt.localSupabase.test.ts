import { SignJWT } from 'jose'
import { verifySupabaseJwt } from '../../utils/verifySupabaseJwt'

describe('verifySupabaseJwt local Supabase compatibility', () => {
    it('verifies HS256 tokens with SUPABASE_JWT_SECRET from local Supabase profiles', async () => {
        const secret = 'local-jwt-secret-that-is-long-enough-for-tests'
        const token = await new SignJWT({ sub: 'user-1', role: 'authenticated' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer('http://127.0.0.1:54321/auth/v1')
            .setAudience('authenticated')
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode(secret))

        const result = await verifySupabaseJwt(token, {
            SUPABASE_URL: 'http://127.0.0.1:54321',
            SUPABASE_JWT_SECRET: secret
        } as NodeJS.ProcessEnv)

        expect(result.payload.sub).toBe('user-1')
        expect(result.payload.role).toBe('authenticated')
    })
})
