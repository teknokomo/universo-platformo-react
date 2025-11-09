import { createMemberActions } from '@universo/template-mui'
import type { MetaverseMember } from '../types'

/**
 * Member management actions for metaverses (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<MetaverseMember>({
    i18nPrefix: 'metaverses',
    entityType: 'metaverse'
})
