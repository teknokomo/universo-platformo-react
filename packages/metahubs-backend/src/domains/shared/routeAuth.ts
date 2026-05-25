import type { Request } from 'express'

/**
 * Unified user shape attached to request by auth middleware.
 * Covers Supabase (`sub`), internal (`id`, `user_id`), and legacy (`userId`) tokens.
 */
export interface AuthLikeUser {
    id?: string
    sub?: string
    user_id?: string
    userId?: string
}

export type RequestWithAuthUser = Request & { user?: AuthLikeUser }

/**
 * Extract user ID from an authenticated request, supporting all known token shapes.
 */
export const resolveUserId = (req: Request): string | undefined => {
    const user = (req as RequestWithAuthUser).user
    if (!user) return undefined
    return user.id ?? user.sub ?? user.user_id ?? user.userId
}
