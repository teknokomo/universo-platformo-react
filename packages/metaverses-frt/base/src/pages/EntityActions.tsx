import { createEntityActions } from '@universo/template-mui'
import type { Entity } from '../types'

type EntityData = {
    name: string
    description?: string
}

export default createEntityActions<Entity, EntityData>({
    i18nPrefix: 'entities',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
