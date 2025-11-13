import { createMemberActions } from '@universo/template-mui'
import type { UnikMember } from '../types'

/**
 * Member management actions for uniks (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<UnikMember>({
    i18nPrefix: 'uniks',
    entityType: 'unik'
})
