import { createMemberActions } from '@universo/template-mui'
import type { StorageMember } from '../types'

/**
 * Member management actions for storages (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<StorageMember>({
    i18nPrefix: 'storages',
    slotType: 'storage'
})
