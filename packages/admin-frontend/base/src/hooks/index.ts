export {
    useGlobalRole,
    useIsSuperadmin,
    useHasGlobalAccess,
    useCurrentGlobalRole,
    useGlobalRoleMetadata,
    globalRoleQueryKey
} from './useGlobalRole'
export { useGrantGlobalRole, useUpdateGlobalRole, useRevokeGlobalRole, adminQueryKeys } from './mutations'
export { useInstanceDetails, useInstancesList, useInstanceStats, useInstanceName, truncateInstanceName } from './useInstanceDetails'
export { useUpdateInstance } from './instanceMutations'
export { instancesQueryKeys, rolesQueryKeys } from '../api/queryKeys'
export { useRoleDetails, useRoleName, truncateRoleName } from './useRoleDetails'

// Unified roles hook (replaces useAssignableGlobalRoles and useAllRoles)
export { useRoles } from './useRoles'
export type { UseRolesOptions, UseRolesResult } from './useRoles'

// Legacy exports for backward compatibility (deprecated, use useRoles instead)
export { useAssignableGlobalRoles } from './useAssignableGlobalRoles'
export type { UseAssignableGlobalRolesResult } from './useAssignableGlobalRoles'
export { useAllRoles } from './useAllRoles'
export type { UseAllRolesResult } from './useAllRoles'
