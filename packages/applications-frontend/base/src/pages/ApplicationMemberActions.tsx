import { createMemberActions } from '@universo/template-mui'
import type { ApplicationMember } from '../types'

/**
 * Member management actions for applications (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<ApplicationMember>({
    i18nPrefix: 'applications',
    entityType: 'application',
    localizedComment: true,
    getInitialFormData: (member) => ({
        initialEmail: member.email || '',
        initialRole: member.role,
        initialComment: member.comment || '',
        initialCommentVlc: member.commentVlc ?? null
    })
})
