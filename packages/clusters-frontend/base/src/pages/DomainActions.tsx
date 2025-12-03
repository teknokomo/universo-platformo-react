import { createEntityActions } from '@universo/template-mui'
import type { Domain } from '../types'

type DomainData = {
    name: string
    description?: string
}

export default createEntityActions<Domain, DomainData>({
    i18nPrefix: 'clusters',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
