import { createEntityActions } from '@universo/template-mui'
import type { Department } from '../types'

type DepartmentData = {
    name: string
    description?: string
}

export default createEntityActions<Department, DepartmentData>({
    i18nPrefix: 'departments',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
