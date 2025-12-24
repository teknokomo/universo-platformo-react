import { createEntityActions } from '@universo/template-mui'
import type { AttributeDisplay } from '../types'

type AttributeData = {
    codename: string
    dataType: string
    name?: { en?: string; ru?: string }
    description?: { en?: string; ru?: string }
    isRequired?: boolean
}

/**
 * Action descriptors for Attribute entity menu.
 * Uses AttributeDisplay (with string name/description) for compatibility with createEntityActions.
 * Attribute data must be converted to AttributeDisplay before passing to BaseEntityMenu.
 */
export default createEntityActions<AttributeDisplay, AttributeData>({
    i18nPrefix: 'attributes',
    getInitialFormData: (entity) => ({
        initialName: entity.name || entity.codename,
        initialDescription: entity.description || ''
    })
})
