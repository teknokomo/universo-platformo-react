import { createEntityActions } from '@universo/template-mui'
import type { Slot } from '../types'

type SlotData = {
    name: string
    description?: string
}

export default createEntityActions<Slot, SlotData>({
    i18nPrefix: 'slots',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
