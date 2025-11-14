import { createMemberActions } from '@universo/template-mui'
import type { ClusterMember } from '../types'

/**
 * Member management actions for clusters (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<ClusterMember>({
    i18nPrefix: 'clusters',
    resourceType: 'cluster'
})
