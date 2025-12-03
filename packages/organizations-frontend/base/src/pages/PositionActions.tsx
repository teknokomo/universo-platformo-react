import { createEntityActions } from '@universo/template-mui'
import type { Position } from '../types'

type PositionData = {
    name: string
    description?: string
}

export default createEntityActions<Position, PositionData>({
    i18nPrefix: 'positions',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
