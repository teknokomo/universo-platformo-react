// Platform migration definitions (native SQL)
export {
    createAdminSchemaMigrationDefinition,
    finalizeAdminSchemaSupportMigrationDefinition,
    prepareAdminSchemaSupportMigrationDefinition,
    seedAdminLifecycleRolesMigrationDefinition
} from './platform/migrations'
export { adminSystemAppDefinition } from './platform/systemAppDefinition'

// Services
export {
    createGlobalAccessService,
    isSuperuser,
    getGlobalRoleCodename,
    hasSubjectPermission,
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
export { createDashboardRoutes, type DashboardRoutesConfig } from './routes'
export { createInstancesRoutes, type InstancesRoutesConfig } from './routes'
export { createRolesRoutes, type RolesRoutesConfig } from './routes/rolesRoutes'
export { createLocalesRoutes, type LocalesRoutesConfig } from './routes'
export { createPublicLocalesRoutes, type PublicLocalesRoutesConfig } from './routes'
export { createAdminSettingsRoutes, type AdminSettingsRoutesConfig } from './routes'

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
