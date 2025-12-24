import { createEntityActions } from '@universo/template-mui'
import type { Metahub } from '../types'

type MetahubData = {
    name: string
    description?: string
}

export default createEntityActions<Metahub, MetahubData>({
    i18nPrefix: 'metahubs',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
