import { createMemberActions } from '@universo/template-mui'
import type { MetahubMember } from '../types'

/**
 * Member management actions for metahubs (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<MetahubMember>({
    i18nPrefix: 'metahubs',
    entityType: 'metahub'
})
