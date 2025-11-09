import { createEntityActions } from '@universo/template-mui'
import type { Metaverse } from '../types'

type MetaverseData = {
    name: string
    description?: string
}

export default createEntityActions<Metaverse, MetaverseData>({
    i18nPrefix: 'metaverses',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
