import { createMemberActions } from '@universo/template-mui'
import type { MetahubMember } from '../../../types'

/**
 * Member management actions for metahubs (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<MetahubMember>({
    i18nPrefix: 'metahubs',
    entityType: 'metahub',
    localizedComment: true,
    getInitialFormData: (member) => ({
        initialEmail: member.email || '',
        initialRole: member.role,
        initialComment: member.comment || '',
        initialCommentVlc: member.commentVlc ?? null
    })
})
