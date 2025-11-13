import { createEntityActions } from '@universo/template-mui'
import type { Unik } from '../types'

type UnikData = {
    name: string
    description?: string
}

export default createEntityActions<Unik, UnikData>({
    i18nPrefix: 'uniks',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
