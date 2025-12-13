import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { createEntityActions } from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'
import { resolveLocalizedContent } from '@universo/utils'

import type { RoleListItem } from '../api/rolesApi'

/**
 * Data structure for role form updates
 */
type RoleData = {
    name: string
    description?: string
}

/**
 * Extended action context with navigation support
 */
interface RoleActionContext {
    entity: RoleListItem
    meta?: {
        navigate?: (path: string) => void
        instanceId?: string
    }
}

/**
 * Base CRUD actions for roles (only delete) using standard factory
 */
const baseActions = createEntityActions<RoleListItem, RoleData>({
    // Use 'admin' namespace; role strings live under admin.roles.*
    i18nPrefix: 'admin',
    i18nKeys: {
        editTitle: 'roles.editTitle',
        confirmDelete: 'roles.confirmDelete',
        confirmDeleteDescription: 'roles.confirmDeleteDescription'
    },
    getEntityName: (role) => resolveLocalizedContent(role.name, 'en', role.codename),
    getInitialFormData: (entity) => ({
        initialName: resolveLocalizedContent(entity.name, 'en', entity.codename),
        initialDescription: resolveLocalizedContent(entity.description, 'en', '')
    })
})

/**
 * Custom edit action: Navigate to full edit page instead of showing dialog
 */
const editRoleAction: ActionDescriptor<RoleListItem, RoleData> = {
    id: 'edit',
    labelKey: 'common:actions.edit',
    icon: <EditRoundedIcon />,
    order: 10,
    onSelect: (ctx: RoleActionContext) => {
        if (ctx.meta?.navigate && ctx.meta?.instanceId) {
            ctx.meta.navigate(`/admin/instance/${ctx.meta.instanceId}/roles/${ctx.entity.id}`)
        }
    }
}

/**
 * Additional action: View users assigned to this role
 */
const viewUsersAction: ActionDescriptor<RoleListItem, RoleData> = {
    id: 'viewUsers',
    labelKey: 'roles.viewUsers',
    icon: <PeopleRoundedIcon />,
    order: 20,
    onSelect: (ctx: RoleActionContext) => {
        if (ctx.meta?.navigate && ctx.meta?.instanceId) {
            ctx.meta.navigate(`/admin/instance/${ctx.meta.instanceId}/roles/${ctx.entity.id}/users`)
        }
    }
}

/**
 * Combined role actions: edit, viewUsers, delete
 * Order: edit (10), viewUsers (20), delete (100)
 */
const roleActions: readonly ActionDescriptor<RoleListItem, RoleData>[] = [
    editRoleAction, // edit (order: 10) - navigate to edit page
    viewUsersAction, // viewUsers (order: 20)
    baseActions[1] // delete (order: 100)
]

export default roleActions
