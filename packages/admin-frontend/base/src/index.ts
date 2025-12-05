// Types
export type { GlobalRole, GlobalAssignableRole, GlobalUserMember, AdminStats, PaginationParams, PaginatedResponse, RoleMetadata, LocalizedString } from './types'

// API
export { createAdminApi, type AdminApi, type GrantRolePayload, type UpdateRolePayload, type MyRoleResponse } from './api/adminApi'
export { adminQueryKeys } from './api/queryKeys'

// Hooks
export {
    useGlobalRole,
    useIsSuperadmin,
    useHasGlobalAccess,
    useCurrentGlobalRole,
    useGlobalRoleMetadata,
    globalRoleQueryKey,
    useGrantGlobalRole,
    useUpdateGlobalRole,
    useRevokeGlobalRole
} from './hooks'

// Pages are exported via package.json exports field: ./pages/*
