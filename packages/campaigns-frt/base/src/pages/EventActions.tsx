import { createEntityActions } from '@universo/template-mui'
import type { Event } from '../types'

type EventData = {
    name: string
    description?: string
}

export default createEntityActions<Event, EventData>({
    i18nPrefix: 'events',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
