export { default as passport } from './passport'
export { default as createAuthRouter } from './routes/auth'
export { ensureAuthenticated, ensureAndRefresh, getSupabaseForReq } from './services/supabaseSession'
export { ensureAuth } from './middlewares/ensureAuth'
export { createEnsureAuthWithRls } from './middlewares/ensureAuthWithRls'
export { applyRlsContext } from './utils/rlsContext'
export type { SessionTokens, AuthenticatedRequest, SessionWithTokens } from './services/supabaseSession'
export type { RequestWithDbContext, EnsureAuthWithRlsOptions } from './middlewares/ensureAuthWithRls'

// Database entities
export { AuthUser } from './database/entities'

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
