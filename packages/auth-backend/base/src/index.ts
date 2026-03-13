export { default as passport } from './passport'
export { default as createAuthRouter } from './routes/auth'
export { ensureAuthenticated, ensureAndRefresh, getSupabaseForReq } from './services/supabaseSession'
export { ensureAuth } from './middlewares/ensureAuth'
export { createEnsureAuthWithRls } from './middlewares/ensureAuthWithRls'
export { applyRlsContext } from './utils/rlsContext'
export type { SessionTokens, AuthenticatedRequest, SessionWithTokens } from './services/supabaseSession'
export type { RequestWithDbContext, EnsureAuthWithRlsOptions } from './middlewares/ensureAuthWithRls'

/**
 * Plain row type for auth.users table (read-only, Supabase-managed).
 * Replaces the former TypeORM AuthUser entity.
 */
export interface AuthUserRow {
    id: string
    email: string | null
    raw_user_meta_data: Record<string, unknown> | null
    confirmed_at: Date | null
    last_sign_in_at: Date | null
    banned_until: Date | null
}

/**
 * Compute user status from raw auth row fields.
 */
export function computeAuthUserStatus(
    row: Pick<AuthUserRow, 'confirmed_at' | 'last_sign_in_at' | 'banned_until'>
): 'active' | 'inactive' | 'pending' | 'banned' {
    const now = new Date()
    if (row.banned_until && new Date(row.banned_until as unknown as string) > now) return 'banned'
    if (!row.confirmed_at) return 'pending'
    if (row.last_sign_in_at) {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (new Date(row.last_sign_in_at as unknown as string) > thirtyDaysAgo) return 'active'
    }
    return 'inactive'
}

/**
 * Get user's full name from raw_user_meta_data
 */
export function getAuthUserFullName(row: Pick<AuthUserRow, 'raw_user_meta_data'>): string | null {
    if (!row.raw_user_meta_data) return null
    return (row.raw_user_meta_data['full_name'] as string) || null
}

// Access guards
export { createAccessGuards } from './guards'
export type { AccessGuardsConfig, MembershipContext, RolePermission } from './guards'

// CASL Permission service and middleware
export { createPermissionService, initPermissionService, getPermissionService } from './services/permissionService'
export type { IPermissionService, PermissionServiceOptions, FullPermissionsResponse } from './services/permissionService'

export {
    createAbilityMiddleware,
    getAbilityFromRequest,
    requireAbility,
    createPermissionCheck,
    ForbiddenError
} from './middlewares/abilityMiddleware'
export type { RequestWithAbility, AbilityMiddlewareOptions } from './middlewares/abilityMiddleware'
