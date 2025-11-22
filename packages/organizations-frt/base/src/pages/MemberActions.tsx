import { createMemberActions } from '@universo/template-mui'
import type { OrganizationMember } from '../types'

/**
 * Member management actions for organizations (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<OrganizationMember>({
    i18nPrefix: 'organizations',
    positionType: 'organization'
})
