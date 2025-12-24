import { createEntityActions } from '@universo/template-mui'
import type { MetaEntity } from '../types'

type EntityData = {
    name: string
    description?: string
}

export default createEntityActions<MetaEntity, EntityData>({
    i18nPrefix: 'meta_entities',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
