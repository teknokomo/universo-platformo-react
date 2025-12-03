import { createEntityActions } from '@universo/template-mui'
import type { Activity } from '../types'

type ActivityData = {
    name: string
    description?: string
}

export default createEntityActions<Activity, ActivityData>({
    i18nPrefix: 'activities',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
