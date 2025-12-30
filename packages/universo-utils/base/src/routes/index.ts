/**
 * Universo Platformo | Public Routes Constants
 *
 * Centralized definitions for public routes used across backend and frontend.
 * This module provides the single source of truth for:
 * - Backend API endpoints that don't require JWT authentication
 * - Frontend UI routes where 401 should not trigger redirect to /auth
 */

/**
 * Backend API endpoints that don't require JWT authentication.
 * Used by flowise-core-backend authentication middleware.
 *
 * These endpoints are accessible without a valid JWT token.
 * Add new public API endpoints here when needed.
 */
export const API_WHITELIST_URLS = [
    '/api/v1/verify/unik/',
    '/public/canvases',
    '/api/v1/bots/',
    '/api/v1/bots/config/',
    '/api/v1/bots/render/',
    '/api/v1/prediction/',
    '/api/v1/vector/upsert/',
    '/api/v1/node-icon/',
    '/api/v1/components-credentials-icon/',
    '/api/v1/canvas-streaming',
    '/api/v1/openai-assistants-file/download',
    '/api/v1/feedback',
    '/api/v1/leads',
    '/api/v1/get-upload-file',
    '/api/v1/ip',
    '/api/v1/ping',
    '/api/v1/version',
    '/api/v1/attachments',
    '/api/v1/metrics',
    '/api/v1/nvidia-nim',
    // Public publication endpoints (accessible without authentication)
    '/api/v1/publish/arjs/public/',
    '/api/v1/publish/public/',
    '/api/v1/publish/canvas/public/'
] as const

/**
 * Frontend UI routes where 401 response should NOT trigger redirect to /auth.
 * These are pages accessible to guests (non-authenticated users).
 *
 * Routes are matched with startsWith, except '/' which requires exact match.
 */
export const PUBLIC_UI_ROUTES = [
    '/', // Landing page - exact match only
    '/auth', // Auth page itself - prevents infinite redirect loop
    '/terms', // Terms of Service (public legal page)
    '/privacy', // Privacy Policy (public legal page)
    '/p/', // Public publish pages
    '/b/', // Public bot pages
    '/chatbot/', // Chatbot embeds
    '/bots/', // Bot public views
    '/execution/', // Execution views
    '/public-executions/' // Public execution results
] as const

/**
 * Check if a pathname matches any public UI route.
 * Used by API clients to determine if 401 should trigger auth redirect.
 *
 * @param pathname - Current window.location.pathname
 * @returns true if the route is public (no auth redirect needed)
 *
 * @example
 * ```typescript
 * if (isPublicRoute(window.location.pathname)) {
 *   // Don't redirect to /auth on 401
 * }
 * ```
 */
export function isPublicRoute(pathname: string): boolean {
    return PUBLIC_UI_ROUTES.some((route) => {
        // Exact match for root
        if (route === '/') return pathname === '/'
        // Exact match for /auth (not /authentication or other similar paths)
        if (route === '/auth') return pathname === '/auth' || pathname.startsWith('/auth/')
        // Prefix match for other routes
        return pathname.startsWith(route)
    })
}

/**
 * Check if an API path is whitelisted (doesn't require authentication).
 * Used by backend middleware.
 *
 * @param path - Request path (e.g., '/api/v1/ping')
 * @returns true if the path is whitelisted
 */
export function isWhitelistedApiPath(path: string): boolean {
    return API_WHITELIST_URLS.some((url) => path.startsWith(url))
}

// Type exports for consumers
export type ApiWhitelistUrl = (typeof API_WHITELIST_URLS)[number]
export type PublicUiRoute = (typeof PUBLIC_UI_ROUTES)[number]
