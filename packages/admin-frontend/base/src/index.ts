// Types
export type {
    GlobalRole,
    GlobalAssignableRole,
    GlobalUserMember,
    AdminStats,
    PaginationParams,
    PaginatedResponse,
    RoleMetadata,
    LocalizedString,
    Instance,
    InstanceStatus,
    InstanceStats,
    UpdateInstancePayload
} from './types'

// API
export { createAdminApi, type AdminApi, type GrantRolePayload, type UpdateRolePayload, type MyRoleResponse } from './api/adminApi'
export { createInstancesApi, type InstancesApi, type InstancesListParams } from './api/instancesApi'
export { createRolesApi, type RolesApi, type RoleListItem, type RolesListParams, type RoleUsersParams, type RoleUser } from './api/rolesApi'
export { adminQueryKeys, instancesQueryKeys, rolesQueryKeys } from './api/queryKeys'

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
    useRevokeGlobalRole,
    useInstanceDetails,
    useInstancesList,
    useInstanceStats,
    useUpdateInstance
} from './hooks'

// Components
export { ColorPicker, PermissionMatrix } from './components'

// Pages are exported via package.json exports field: ./pages/*
