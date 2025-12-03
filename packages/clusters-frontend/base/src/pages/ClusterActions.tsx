import { createEntityActions } from '@universo/template-mui'
import type { Cluster } from '../types'

type ClusterData = {
    name: string
    description?: string
}

export default createEntityActions<Cluster, ClusterData>({
    i18nPrefix: 'clusters',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
