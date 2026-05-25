import {
    createRemoteJWKSet,
    decodeProtectedHeader,
    jwtVerify,
    type JWSHeaderParameters,
    type JWTPayload,
    type JWTVerifyOptions,
    type JWTVerifyResult
} from 'jose'

const DEFAULT_SUPABASE_JWT_AUDIENCE = 'authenticated'
const SUPABASE_AUTH_BASE_PATH = '/auth/v1'
const SUPABASE_JWKS_PATH = `${SUPABASE_AUTH_BASE_PATH}/.well-known/jwks.json`

const remoteJwkSetCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export type VerifiedSupabaseJwtClaims = JWTPayload & {
    user_id?: string
    uid?: string
    role?: string
}

type ResolvedSupabaseJwtConfig = {
    issuer?: string
    audience: string
    legacySecret?: string
    jwksUrl?: string
}

const normalizeEnvValue = (value?: string): string | undefined => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

const deriveSupabaseAuthIssuer = (supabaseUrl?: string): string | undefined => {
    const normalizedSupabaseUrl = normalizeEnvValue(supabaseUrl)
    if (!normalizedSupabaseUrl) return undefined

    return new URL(SUPABASE_AUTH_BASE_PATH, normalizedSupabaseUrl).toString().replace(/\/$/, '')
}

const deriveSupabaseJwksUrl = (supabaseUrl?: string): string | undefined => {
    const normalizedSupabaseUrl = normalizeEnvValue(supabaseUrl)
    if (!normalizedSupabaseUrl) return undefined

    return new URL(SUPABASE_JWKS_PATH, normalizedSupabaseUrl).toString()
}

const resolveSupabaseJwtConfig = (env: NodeJS.ProcessEnv = process.env): ResolvedSupabaseJwtConfig => ({
    issuer: normalizeEnvValue(env.SUPABASE_JWT_ISSUER) ?? deriveSupabaseAuthIssuer(env.SUPABASE_URL),
    audience: normalizeEnvValue(env.SUPABASE_JWT_AUDIENCE) ?? DEFAULT_SUPABASE_JWT_AUDIENCE,
    legacySecret: normalizeEnvValue(env.SUPABASE_JWT_SECRET),
    jwksUrl: normalizeEnvValue(env.SUPABASE_JWKS_URL) ?? deriveSupabaseJwksUrl(env.SUPABASE_URL)
})

const isHmacAlgorithm = (alg?: string): boolean => typeof alg === 'string' && alg.startsWith('HS')

const getCachedRemoteJwkSet = (jwksUrl: string): ReturnType<typeof createRemoteJWKSet> => {
    const cached = remoteJwkSetCache.get(jwksUrl)
    if (cached) {
        return cached
    }

    const remoteJwkSet = createRemoteJWKSet(new URL(jwksUrl))
    remoteJwkSetCache.set(jwksUrl, remoteJwkSet)
    return remoteJwkSet
}

const buildJwtVerifyOptions = (config: ResolvedSupabaseJwtConfig, protectedHeader: JWSHeaderParameters): JWTVerifyOptions => ({
    issuer: config.issuer,
    audience: config.audience,
    algorithms: protectedHeader.alg ? [protectedHeader.alg] : undefined
})

export function assertSupabaseJwtVerificationConfig(env: NodeJS.ProcessEnv = process.env): void {
    const config = resolveSupabaseJwtConfig(env)
    if (config.legacySecret) {
        return
    }

    if (config.jwksUrl && config.issuer) {
        return
    }

    throw new Error(
        'Auth configuration error: configure SUPABASE_JWT_SECRET for legacy HS256 verification or SUPABASE_URL/SUPABASE_JWKS_URL with SUPABASE_JWT_ISSUER for JWKS verification'
    )
}

export async function verifySupabaseJwt(
    accessToken: string,
    env: NodeJS.ProcessEnv = process.env
): Promise<JWTVerifyResult<VerifiedSupabaseJwtClaims>> {
    const protectedHeader = decodeProtectedHeader(accessToken)
    const algorithm = protectedHeader.alg
    if (!algorithm) {
        throw new Error('JWT verification error: token header does not contain alg')
    }

    const config = resolveSupabaseJwtConfig(env)
    const verifyOptions = buildJwtVerifyOptions(config, protectedHeader)

    if (isHmacAlgorithm(algorithm)) {
        if (!config.legacySecret) {
            throw new Error('Auth configuration error: SUPABASE_JWT_SECRET is required to verify legacy HS256 Supabase tokens')
        }

        return jwtVerify<VerifiedSupabaseJwtClaims>(accessToken, new TextEncoder().encode(config.legacySecret), verifyOptions)
    }

    if (!config.jwksUrl || !config.issuer) {
        throw new Error(
            'Auth configuration error: SUPABASE_URL or SUPABASE_JWKS_URL plus SUPABASE_JWT_ISSUER are required to verify asymmetric Supabase tokens'
        )
    }

    return jwtVerify<VerifiedSupabaseJwtClaims>(accessToken, getCachedRemoteJwkSet(config.jwksUrl), verifyOptions)
}
