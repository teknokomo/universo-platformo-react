import { createMemberActions } from '@universo/template-mui'
import type { GlobalUserMember } from '../types'

/**
 * Member management actions for admin module (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 *
 * Note: For global users, we use 'userId' as the member identifier instead of 'id'
 * since the entity stores user_id as the unique identifier for API operations
 *
 * Dynamic roles: Instead of hardcoding availableRoles here, the roles are passed
 * dynamically via context.meta.dynamicRoles from useAssignableGlobalRoles hook.
 * This allows the role dropdown to include custom roles created by admins.
 */
export default createMemberActions<GlobalUserMember>({
    i18nPrefix: 'admin',
    entityType: 'global-user',
    // Roles are passed dynamically via context.meta.dynamicRoles
    getMemberEmail: (member) => member.email || '',
    getMemberId: (member) => member.userId,
    getInitialFormData: (member) => ({
        initialEmail: member.email || '',
        initialRole: member.role,
        initialComment: member.comment || ''
    })
})
