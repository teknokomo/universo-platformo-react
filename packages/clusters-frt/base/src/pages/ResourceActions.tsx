import { createEntityActions } from '@universo/template-mui'
import type { Resource } from '../types'

type ResourceData = {
    name: string
    description?: string
}

export default createEntityActions<Resource, ResourceData>({
    i18nPrefix: 'clusters',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
