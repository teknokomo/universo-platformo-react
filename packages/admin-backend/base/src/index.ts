// Migrations
export { adminMigrations } from './database/migrations/postgres'

// Entities
export { adminEntities, Instance, Role, RolePermission, UserRole } from './database/entities'

// Services
export {
    createGlobalAccessService,
    hasGlobalAccessByDataSource,
    getGlobalRoleNameByDataSource,
    type GlobalAccessService,
    type GlobalAccessServiceDeps,
    type ListGlobalUsersParams,
    type GlobalAccessInfo
} from './services/globalAccessService'

// Guards
export { createEnsureGlobalAccess, type RequestWithGlobalRole } from './guards/ensureGlobalAccess'

// Re-export admin config utilities from @universo/utils for convenience
export { isAdminPanelEnabled, isGlobalAdminEnabled, getAdminConfig, type AdminConfig } from '@universo/utils'

// Routes
export { createGlobalUsersRoutes, type GlobalUsersRoutesConfig } from './routes'
export { createInstancesRoutes, type InstancesRoutesConfig } from './routes'

// Schemas
export { GrantRoleSchema, formatZodError, validateListQuery, type GrantRoleInput, type ListQueryInput } from './schemas'
