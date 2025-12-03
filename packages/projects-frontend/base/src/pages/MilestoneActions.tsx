import { createEntityActions } from '@universo/template-mui'
import type { Milestone } from '../types'

type MilestoneData = {
    name: string
    description?: string
}

export default createEntityActions<Milestone, MilestoneData>({
    i18nPrefix: 'projects',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
