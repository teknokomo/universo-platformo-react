import http from 'http'
import type { AddressInfo } from 'net'
import { SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose'
import type { DbSession } from '@universo/utils'
import { applyRlsContext } from '../../utils/rlsContext'

const secret = 'test-supabase-jwt-secret'
const legacySupabaseUrl = 'https://legacy-project.supabase.co'

type ServerHandle = {
    baseUrl: string
    close: () => Promise<void>
}

async function signAccessToken(payload: Record<string, unknown>) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(`${legacySupabaseUrl}/auth/v1`)
        .setAudience('authenticated')
        .sign(new TextEncoder().encode(secret))
}

describe('applyRlsContext', () => {
    const originalSecret = process.env.SUPABASE_JWT_SECRET
    const originalSupabaseUrl = process.env.SUPABASE_URL
    const originalSupabaseJwksUrl = process.env.SUPABASE_JWKS_URL
    const originalSupabaseJwtIssuer = process.env.SUPABASE_JWT_ISSUER
    const originalSupabaseJwtAudience = process.env.SUPABASE_JWT_AUDIENCE

    beforeEach(() => {
        process.env.SUPABASE_JWT_SECRET = secret
        process.env.SUPABASE_URL = legacySupabaseUrl
        delete process.env.SUPABASE_JWKS_URL
        delete process.env.SUPABASE_JWT_ISSUER
        delete process.env.SUPABASE_JWT_AUDIENCE
    })

    afterEach(() => {
        process.env.SUPABASE_JWT_SECRET = originalSecret
        process.env.SUPABASE_URL = originalSupabaseUrl
        process.env.SUPABASE_JWKS_URL = originalSupabaseJwksUrl
        process.env.SUPABASE_JWT_ISSUER = originalSupabaseJwtIssuer
        process.env.SUPABASE_JWT_AUDIENCE = originalSupabaseJwtAudience
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

    it('verifies asymmetric Supabase JWTs through JWKS and writes claims into request.jwt.claims', async () => {
        const { publicKey, privateKey } = await generateKeyPair('ES256')
        const publicJwk = (await exportJWK(publicKey)) as JWK & { kid?: string; alg?: string; use?: string; key_ops?: string[] }
        publicJwk.kid = 'test-es256-key'
        publicJwk.alg = 'ES256'
        publicJwk.use = 'sig'
        publicJwk.key_ops = ['verify']

        const jwksServer = await createJwksServer({ keys: [publicJwk] })
        const issuer = `${jwksServer.baseUrl}/auth/v1`

        process.env.SUPABASE_URL = jwksServer.baseUrl
        process.env.SUPABASE_JWKS_URL = `${jwksServer.baseUrl}/auth/v1/.well-known/jwks.json`
        process.env.SUPABASE_JWT_ISSUER = issuer
        process.env.SUPABASE_JWT_AUDIENCE = 'authenticated'
        delete process.env.SUPABASE_JWT_SECRET

        const session: DbSession = {
            query: jest.fn(async () => []),
            isReleased: () => false
        }

        const token = await new SignJWT({ sub: 'user-es256', role: 'authenticated', tenant_id: 'tenant-es256' })
            .setProtectedHeader({ alg: 'ES256', kid: publicJwk.kid })
            .setIssuer(issuer)
            .setAudience('authenticated')
            .sign(privateKey)

        try {
            await applyRlsContext(session, token)
        } finally {
            await jwksServer.close()
        }

        expect(session.query).toHaveBeenCalledTimes(1)
        expect(session.query.mock.calls[0][0]).toBe("SELECT set_config('request.jwt.claims', $1::text, true)")
        expect(JSON.parse(session.query.mock.calls[0][1][0])).toEqual(
            expect.objectContaining({
                sub: 'user-es256',
                role: 'authenticated',
                tenant_id: 'tenant-es256'
            })
        )
    })
})

async function createJwksServer(jwks: { keys: JWK[] }): Promise<ServerHandle> {
    const server = http.createServer((req, res) => {
        if (req.url === '/auth/v1/.well-known/jwks.json') {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify(jwks))
            return
        }

        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'not_found' }))
    })

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error)
                        return
                    }
                    resolve()
                })
            })
    }
}
