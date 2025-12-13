// Migrations
export { adminMigrations } from './database/migrations/postgres'

// Entities
export { adminEntities, Instance, Locale, Role, RolePermission, UserRole } from './database/entities'

// Services
export {
    createGlobalAccessService,
    isSuperuserByDataSource,
    canAccessAdminByDataSource,
    getGlobalRoleCodenameByDataSource,
    hasSubjectPermissionByDataSource,
    type GlobalAccessService,
    type GlobalAccessServiceDeps,
    type ListGlobalUsersParams,
    type GlobalAccessInfo
} from './services/globalAccessService'

// Guards
export {
    createEnsureGlobalAccess,
    type RequestWithGlobalRole,
    type CrudAction,
    type EnsureGlobalAccessOptions
} from './guards/ensureGlobalAccess'

// Re-export admin config utilities from @universo/utils for convenience
export { isAdminPanelEnabled, isGlobalAdminEnabled, getAdminConfig, type AdminConfig } from '@universo/utils'

// Routes
export { createGlobalUsersRoutes, type GlobalUsersRoutesConfig } from './routes'
export { createInstancesRoutes, type InstancesRoutesConfig } from './routes'
export { createRolesRoutes, type RolesRoutesConfig } from './routes/rolesRoutes'
export { createLocalesRoutes, type LocalesRoutesConfig } from './routes'
export { createPublicLocalesRoutes, type PublicLocalesRoutesConfig } from './routes'

// Schemas
export {
    GrantRoleSchema,
    CreateRoleSchema,
    UpdateRoleSchema,
    formatZodError,
    validateListQuery,
    type GrantRoleInput,
    type ListQueryInput
} from './schemas'
