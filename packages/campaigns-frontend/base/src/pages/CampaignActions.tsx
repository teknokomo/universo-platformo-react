import { createEntityActions } from '@universo/template-mui'
import type { Campaign } from '../types'

type CampaignData = {
    name: string
    description?: string
}

export default createEntityActions<Campaign, CampaignData>({
    i18nPrefix: 'campaigns',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
