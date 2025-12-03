import { createEntityActions } from '@universo/template-mui'
import type { Project } from '../types'

type ProjectData = {
    name: string
    description?: string
}

export default createEntityActions<Project, ProjectData>({
    i18nPrefix: 'projects',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
