import { Request, Response, NextFunction } from 'express'
import sanitizeHtml from 'sanitize-html'

export function sanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
    // decoding is necessary as the url is encoded by the browser
    const decodedURI = decodeURI(req.url)
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
    // Expects FQDN separated by commas, otherwise nothing or * for all.
    return process.env.CORS_ORIGINS ?? '*'
}

export function getCorsOptions(): any {
    const allowedOriginsStr = getAllowedCorsOrigins() // Reads process.env.CORS_ORIGINS ?? '*'
    const allowedOriginsArr = allowedOriginsStr === '*' ? ['*'] : allowedOriginsStr.split(',').map((origin) => origin.trim())

    const corsOptions = {
        origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true)

            if (allowedOriginsArr[0] === '*') {
                // If '*' is configured, reflect the request's origin
                // This is safe for credentials when '*' is intended, but specific origins are preferred for production
                callback(null, origin)
            } else if (allowedOriginsArr.includes(origin)) {
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

export function getAllowedIframeOrigins(): string {
    // Expects FQDN separated by commas, otherwise nothing or * for all.
    // Also CSP allowed values: self or none
    return process.env.IFRAME_ORIGINS ?? '*'
}
