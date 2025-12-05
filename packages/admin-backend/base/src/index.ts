// Migrations
export { adminMigrations } from './database/migrations/postgres'

// Entities
export { adminEntities, Role, RolePermission, UserRole } from './database/entities'

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
export {
    createEnsureGlobalAccess,
    isGlobalAdminEnabled,
    type RequestWithGlobalRole
} from './guards/ensureGlobalAccess'

// Routes
export { createGlobalUsersRoutes, type GlobalUsersRoutesConfig } from './routes'

// Schemas
export { GrantRoleSchema, formatZodError, validateListQuery, type GrantRoleInput, type ListQueryInput } from './schemas'
