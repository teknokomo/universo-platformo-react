import { createEntityActions } from '@universo/template-mui'
import type { MetaSection } from '../types'

type SectionData = {
    name: string
    description?: string
}

export default createEntityActions<MetaSection, SectionData>({
    i18nPrefix: 'meta_sections',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
