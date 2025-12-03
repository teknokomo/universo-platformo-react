import { createEntityActions } from '@universo/template-mui'
import type { Organization } from '../types'

type OrganizationData = {
    name: string
    description?: string
}

export default createEntityActions<Organization, OrganizationData>({
    i18nPrefix: 'organizations',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
