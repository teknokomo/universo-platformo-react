import type { Request } from 'express'

export const parseSafeHttpOrigin = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim()) return undefined
    try {
        const parsed = new URL(value.trim())
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            return undefined
        }
        return parsed.origin
    } catch {
        return undefined
    }
}

export const resolveRequestOrigin = (req: Request): string | undefined => {
    const origin = req.get('origin')
    const parsedOrigin = parseSafeHttpOrigin(origin)
    if (parsedOrigin) return parsedOrigin
    const referer = req.get('referer')
    if (!referer) return undefined
    return parseSafeHttpOrigin(referer)
}

export const resolvePlatformApiOrigin = (req: Request): string | undefined => {
    const configuredOrigin = parseSafeHttpOrigin(process.env.PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN)
    if (configuredOrigin) {
        return configuredOrigin
    }

    const trustProxyHeaders = process.env.PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS === 'true'
    const forwardedHost = trustProxyHeaders ? req.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined
    const host = forwardedHost || req.get('host')
    if (!host) return undefined
    const forwardedProto = trustProxyHeaders ? req.get('x-forwarded-proto')?.split(',')[0]?.trim() : undefined
    const protocol = forwardedProto || req.protocol || 'http'
    return parseSafeHttpOrigin(`${protocol}://${host}`)
}

export const normalizeOrigin = (value: unknown): string | null => {
    const origin = parseSafeHttpOrigin(value)
    if (!origin) return null
    try {
        const url = new URL((value as string).trim())
        if (url.pathname !== '/' || url.search || url.hash) return null
        return origin
    } catch {
        return null
    }
}

export const resolveLoopbackSiblingOrigin = (origin: string | undefined): string | null => {
    if (!origin) return null
    try {
        const url = new URL(origin)
        if (url.hostname === '127.0.0.1') {
            url.hostname = 'localhost'
            return url.origin
        }
        if (url.hostname === 'localhost') {
            url.hostname = '127.0.0.1'
            return url.origin
        }
        return null
    } catch {
        return null
    }
}

export const addSafeOrigin = (origins: Set<string>, value: string | undefined | null): void => {
    const parsed = parseSafeHttpOrigin(value)
    if (parsed) origins.add(parsed)
}

export const addConfiguredArtifactOrigins = (origins: Set<string>): void => {
    for (const value of (
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS ??
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN ??
        ''
    )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)) {
        addSafeOrigin(origins, value)
    }
}

export const resolveAllowedArtifactOrigins = (requestOrigin: string | undefined, apiOrigin: string | undefined): Set<string> => {
    const origins = new Set<string>()
    addSafeOrigin(origins, requestOrigin)
    addSafeOrigin(origins, apiOrigin)
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(requestOrigin))
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(apiOrigin))
    addConfiguredArtifactOrigins(origins)
    return origins
}

export const resolveAllowedFullBootArtifactOrigins = (apiOrigin: string | undefined): Set<string> => {
    const origins = new Set<string>()
    addSafeOrigin(origins, apiOrigin)
    addSafeOrigin(origins, resolveLoopbackSiblingOrigin(apiOrigin))
    addConfiguredArtifactOrigins(origins)
    return origins
}

export const isAllowedArtifactOrigin = (origin: string, requestOrigin: string | undefined, apiOrigin: string | undefined): boolean =>
    resolveAllowedArtifactOrigins(requestOrigin, apiOrigin).has(origin)

export const isAllowedFullBootArtifactOrigin = (origin: string, apiOrigin: string | undefined): boolean =>
    resolveAllowedFullBootArtifactOrigins(apiOrigin).has(origin)
