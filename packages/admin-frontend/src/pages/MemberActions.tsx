import { createMemberActions } from '@universo/template-mui'
import type { GlobalUserMember } from '../types'

/**
 * Member management actions for admin module (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 *
 * Note: For global users, we use 'id' (user_roles record id) as the member identifier
 * since the backend updateAssignment uses assignment id, not user_id.
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
    // Use assignment id (record id in user_roles table), not userId
    getMemberId: (member) => member.id,
    getInitialFormData: (member) => ({
        initialEmail: member.email || '',
        // Backend returns roleCodename for dynamic roles
        initialRole: member.roleCodename,
        initialComment: member.comment || ''
    })
})
