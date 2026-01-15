import { createMemberActions } from '@universo/template-mui'
import type { ApplicationMember } from '../types'

/**
 * Member management actions for applications (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<ApplicationMember>({
    i18nPrefix: 'applications',
    entityType: 'application'
})
