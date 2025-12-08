import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { createEntityActions } from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'

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
 * Base CRUD actions for roles (edit, delete) using standard factory
 */
const baseActions = createEntityActions<RoleListItem, RoleData>({
    i18nPrefix: 'roles',
    getEntityName: (role) => role.displayName?.['en'] || role.name,
    getInitialFormData: (entity) => ({
        initialName: entity.name,
        initialDescription: entity.description || ''
    })
})

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
    baseActions[0], // edit (order: 10)
    viewUsersAction, // viewUsers (order: 20)
    baseActions[1] // delete (order: 100)
]

export default roleActions
