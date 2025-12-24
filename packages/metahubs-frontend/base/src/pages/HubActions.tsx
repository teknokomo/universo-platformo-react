import { createEntityActions } from '@universo/template-mui'
import type { HubDisplay } from '../types'

type HubData = {
    codename: string
    name?: { en?: string; ru?: string }
    description?: { en?: string; ru?: string }
}

/**
 * Action descriptors for Hub entity menu.
 * Uses HubDisplay (with string name/description) for compatibility with createEntityActions.
 * Hub data must be converted to HubDisplay before passing to BaseEntityMenu.
 */
export default createEntityActions<HubDisplay, HubData>({
    i18nPrefix: 'hubs',
    getInitialFormData: (entity) => ({
        initialName: entity.name || entity.codename,
        initialDescription: entity.description || ''
    })
})
