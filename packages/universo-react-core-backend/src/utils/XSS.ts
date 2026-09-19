import { Request, Response, NextFunction } from 'express'
import type { CorsOptions } from 'cors'
import sanitizeHtml from 'sanitize-html'

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Decoding is necessary because the browser encodes the URL. Malformed
    // percent-encoding must fail as a controlled 400 instead of an unhandled
    // URIError turning into a 500.
    let decodedURI: string
    try {
        decodedURI = decodeURI(req.url)
    } catch {
        res.status(400).json({ error: 'Malformed request URL' })
        return
    }
    req.url = sanitizeHtml(decodedURI)
    for (let p in req.query) {
        if (Array.isArray(req.query[p])) {
            const sanitizedQ = []
            for (const q of req.query[p] as string[]) {
                sanitizedQ.push(sanitizeHtml(q))
            }
            req.query[p] = sanitizedQ
        } else {
            req.query[p] = sanitizeHtml(req.query[p] as string)
        }
    }
    next()
}

export function getAllowedCorsOrigins(): string {
    // Origins are an explicit comma-separated allowlist. An omitted value is
    // intentionally fail-closed because credentials are enabled below;
    // reflecting an arbitrary Origin together with credentials would allow a
    // cross-origin application to read authenticated API responses.
    return process.env.CORS_ORIGINS ?? ''
}

const getConfiguredCorsOrigins = (): string[] =>
    getAllowedCorsOrigins()
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0 && origin !== '*')

const isConfiguredCorsOrigin = (origin: string | undefined): boolean => Boolean(origin && getConfiguredCorsOrigins().includes(origin))

export function getCorsOptions(): CorsOptions {
    const allowedOriginsArr = getConfiguredCorsOrigins()

    const corsOptions = {
        origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true)

            if (allowedOriginsArr.includes(origin)) {
                // If the origin is in the allowed list, reflect it
                callback(null, origin)
            } else {
                // Otherwise, disallow the origin
                callback(new Error('Not allowed by CORS'))
            }
        },
        // Universo Platformo | Explicitly allow credentials
        credentials: true
    }
    return corsOptions
}

/**
 * Chromium's Private Network Access preflight adds this request header when a
 * sandboxed artifact (for example, localhost) calls a loopback API sibling
 * (127.0.0.1). The regular CORS middleware validates the origin; this narrow
 * response header only authorizes an explicitly allowlisted private-network
 * hop. It is restricted to OPTIONS so an attacker cannot opt ordinary
 * credentialed responses into the PNA permission policy.
 */
export function allowPrivateNetworkAccess(req: Request, res: Response, next: NextFunction): void {
    const origin = req.get('origin')
    if (
        req.method?.toUpperCase() === 'OPTIONS' &&
        req.get('access-control-request-private-network') === 'true' &&
        isConfiguredCorsOrigin(origin)
    ) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    next()
}

export function getAllowedIframeOrigins(): string {
    // Expects FQDN separated by commas, otherwise nothing or * for all.
    // Also CSP allowed values: self or none
    return process.env.IFRAME_ORIGINS ?? '*'
}
