import { createEntityActions } from '@universo/template-mui'
import type { MetahubDisplay } from '../types'

type MetahubData = {
    name: string
    description?: string
}

/**
 * Action descriptors for Metahub entity menu.
 * Uses MetahubDisplay (with string name/description) for compatibility with createEntityActions.
 * Metahub data must be converted to MetahubDisplay via toMetahubDisplay before passing to BaseEntityMenu.
 */
export default createEntityActions<MetahubDisplay, MetahubData>({
    i18nPrefix: 'metahubs',
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})
