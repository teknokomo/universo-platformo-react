import { createEntityActions } from '@universo/template-mui'
import type { Section } from '../types'

type SectionData = {
    name: string
    description?: string
}

export default createEntityActions<Section, SectionData>({
    i18nPrefix: 'sections',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
