import { createEntityActions } from '@universo/template-mui'
import type { Storage } from '../types'

type StorageData = {
    name: string
    description?: string
}

export default createEntityActions<Storage, StorageData>({
    i18nPrefix: 'storages',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
