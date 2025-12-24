import { createEntityActions } from '@universo/template-mui'
import type { HubRecordDisplay } from '../types'

type RecordData = {
    data: Record<string, unknown>
}

/**
 * Action descriptors for HubRecord entity menu.
 * Uses HubRecordDisplay (with string name) for compatibility with createEntityActions.
 * HubRecord data must be converted to HubRecordDisplay before passing to BaseEntityMenu.
 */
export default createEntityActions<HubRecordDisplay, RecordData>({
    i18nPrefix: 'records',
    getInitialFormData: (entity) => ({
        initialName: entity.name || entity.id.slice(0, 8),
        initialDescription: entity.description || ''
    })
})
