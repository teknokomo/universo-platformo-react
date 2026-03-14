import { SignJWT } from 'jose'
import type { DbSession } from '@universo/utils'
import { applyRlsContext } from '../../utils/rlsContext'

const secret = 'test-supabase-jwt-secret'

async function signAccessToken(payload: Record<string, unknown>) {
    return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret))
}

describe('applyRlsContext', () => {
    const originalSecret = process.env.SUPABASE_JWT_SECRET

    beforeEach(() => {
        process.env.SUPABASE_JWT_SECRET = secret
    })

    afterEach(() => {
        process.env.SUPABASE_JWT_SECRET = originalSecret
        jest.restoreAllMocks()
    })

    it('writes verified JWT claims into request.jwt.claims', async () => {
        const session: DbSession = {
            query: jest.fn(async () => []),
            isReleased: () => false
        }
        const token = await signAccessToken({ sub: 'user-1', role: 'authenticated', tenant_id: 'tenant-1' })

        await applyRlsContext(session, token)

        expect(session.query).toHaveBeenCalledTimes(1)
        expect(session.query.mock.calls[0][0]).toBe("SELECT set_config('request.jwt.claims', $1::text, true)")
        expect(JSON.parse(session.query.mock.calls[0][1][0])).toEqual(
            expect.objectContaining({
                sub: 'user-1',
                role: 'authenticated',
                tenant_id: 'tenant-1'
            })
        )
    })

    it('keeps request claim payloads isolated per session', async () => {
        const sessionA: DbSession = {
            query: jest.fn(async () => []),
            isReleased: () => false
        }
        const sessionB: DbSession = {
            query: jest.fn(async () => []),
            isReleased: () => false
        }
        const tokenA = await signAccessToken({ sub: 'user-a', role: 'authenticated', org_id: 'org-a' })
        const tokenB = await signAccessToken({ sub: 'user-b', role: 'authenticated', org_id: 'org-b' })

        await Promise.all([applyRlsContext(sessionA, tokenA), applyRlsContext(sessionB, tokenB)])

        const claimsA = JSON.parse(sessionA.query.mock.calls[0][1][0])
        const claimsB = JSON.parse(sessionB.query.mock.calls[0][1][0])

        expect(claimsA).toEqual(expect.objectContaining({ sub: 'user-a', org_id: 'org-a' }))
        expect(claimsB).toEqual(expect.objectContaining({ sub: 'user-b', org_id: 'org-b' }))
        expect(claimsA).not.toEqual(claimsB)
    })
})
