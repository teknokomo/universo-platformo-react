import { createEntityActions } from '@universo/template-mui'
import type { Container } from '../types'

type ContainerData = {
    name: string
    description?: string
}

export default createEntityActions<Container, ContainerData>({
    i18nPrefix: 'containers',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
