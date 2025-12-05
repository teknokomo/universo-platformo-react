import { createEntityActions } from '@universo/template-mui'
import type { Instance } from '../types'

type InstanceData = {
    name: string
    description?: string
}

/**
 * Instance entity actions for BaseEntityMenu
 * MVP: Only edit action is fully available
 * - edit: Enabled for superadmin (rename instance)
 * - delete: Shown but disabled in MVP (local instance cannot be deleted)
 */
const baseActions = createEntityActions<Instance, InstanceData>({
    i18nPrefix: 'admin',
    // Override i18n keys to use instances.* namespace
    i18nKeys: {
        editTitle: 'instances.editTitle',
        confirmDelete: 'instances.confirmDelete',
        confirmDeleteDescription: 'instances.confirmDeleteDescription'
    },
    // Show delete button in edit dialog but disabled for MVP
    showDeleteInEdit: true,
    deleteButtonDisabledInEdit: true,
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})

/**
 * Get instance actions with delete always disabled for MVP
 * Delete action is visible but disabled to indicate future functionality
 */
export const getInstanceActions = () => {
    return baseActions.map((action) => {
        if (action.id === 'delete') {
            return {
                ...action,
                // Always disabled for MVP - local instance cannot be deleted
                enabled: () => false
            }
        }
        return action
    })
}

export default baseActions
