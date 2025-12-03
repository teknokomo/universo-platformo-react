import { createMemberActions } from '@universo/template-mui'
import type { CampaignMember } from '../types'

/**
 * Member management actions for campaigns (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<CampaignMember>({
    i18nPrefix: 'campaigns',
    activityType: 'campaign'
})
