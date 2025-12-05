import { createMemberActions } from '@universo/template-mui'
import type { GlobalUserMember } from '../types'

/**
 * Member management actions for admin module (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 *
 * Note: For global users, we use 'userId' as the member identifier instead of 'id'
 * since the entity stores user_id as the unique identifier for API operations
 */
export default createMemberActions<GlobalUserMember>({
    i18nPrefix: 'admin',
    entityType: 'global-user',
    availableRoles: ['superadmin', 'supermoderator'],
    getMemberEmail: (member) => member.email || '',
    getMemberId: (member) => member.userId,
    getInitialFormData: (member) => ({
        initialEmail: member.email || '',
        initialRole: member.role,
        initialComment: member.comment || ''
    })
})
