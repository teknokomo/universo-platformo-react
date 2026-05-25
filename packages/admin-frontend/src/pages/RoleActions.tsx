import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { createEntityActions } from '@universo/template-mui'
import type { ActionDescriptor } from '@universo/template-mui'
import { resolveLocalizedContent, getCodenamePrimary, createCodenameVLC } from '@universo/utils'
import type { VersionedLocalizedContent } from '@universo/types'

import type { RoleListItem } from '../api/rolesApi'
import RoleFormDialog from '../components/RoleFormDialog'
import type { RoleFormDialogSubmitData } from '../components/RoleFormDialog'

/**
 * Append "(копия)"/"(copy)" suffix to each locale in a VLC value
 */
const appendCopySuffix = (vlc: VersionedLocalizedContent<string> | null | undefined): VersionedLocalizedContent<string> | null => {
    if (!vlc) return null

    const nextLocales = { ...(vlc.locales || {}) } as Record<string, { content?: string }>
    for (const [locale, localeValue] of Object.entries(nextLocales)) {
        const normalizedLocale = locale.split('-')[0] || 'en'
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${suffix}` }
        }
    }

    return { ...vlc, locales: nextLocales }
}

/**
 * Data structure for role form updates
 */
type RoleData = Omit<RoleFormDialogSubmitData, 'copyPermissions'>

/**
 * Extended action context with navigation support
 */
interface RoleActionContext {
    entity: RoleListItem
    t: (key: string, params?: Record<string, unknown>) => string
    api?: {
        updateEntity?: (id: string, data: RoleData) => Promise<void>
        deleteEntity?: (id: string) => Promise<void>
    }
    meta?: {
        navigate?: (path: string) => void
        instanceId?: string
        copyRole?: (roleId: string, data: RoleFormDialogSubmitData) => Promise<void>
        locale?: string
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
    getEntityName: (role) => resolveLocalizedContent(role.name, 'en', getCodenamePrimary(role.codename)),
    getInitialFormData: (entity) => ({
        initialName: resolveLocalizedContent(entity.name, 'en', getCodenamePrimary(entity.codename)),
        initialDescription: resolveLocalizedContent(entity.description, 'en', '')
    })
})

const deleteAction = baseActions.find((a) => a.id === 'delete')!

/**
 * Custom edit action: open dialog instead of navigating to the legacy edit flow
 */
const editRoleAction: ActionDescriptor<RoleListItem, RoleData> = {
    id: 'edit',
    labelKey: 'common:actions.edit',
    icon: <EditRoundedIcon />,
    order: 10,
    dialog: {
        loader: async () => {
            return { default: RoleFormDialog }
        },
        buildProps: (ctx: RoleActionContext) => {
            const locale = ctx.meta?.locale || 'en'
            return {
                open: true,
                title: ctx.t('roles.editTitle', {
                    name: resolveLocalizedContent(ctx.entity.name, locale, getCodenamePrimary(ctx.entity.codename))
                }),
                submitLabel: ctx.t('common:actions.save', 'Save'),
                initialCodename: ctx.entity.codename,
                initialName: ctx.entity.name,
                initialDescription: ctx.entity.description ?? null,
                initialColor: ctx.entity.color,
                codenameDisabled: ctx.entity.isSystem,
                showCopyPermissions: false,
                onClose: () => {
                    // BaseEntityMenu handles close state.
                },
                onSubmit: async (data: RoleFormDialogSubmitData) => {
                    await ctx.api?.updateEntity?.(ctx.entity.id, {
                        codename: data.codename,
                        name: data.name,
                        description: data.description,
                        color: data.color
                    })
                }
            }
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

const copyRoleAction: ActionDescriptor<RoleListItem, RoleData> = {
    id: 'copy',
    labelKey: 'roles.copy',
    icon: <ContentCopyRoundedIcon />,
    order: 15,
    dialog: {
        loader: async () => {
            return { default: RoleFormDialog }
        },
        buildProps: (ctx: RoleActionContext) => {
            const locale = ctx.meta?.locale || 'en'
            const baseCodename = getCodenamePrimary(ctx.entity.codename)
            const COPY_SUFFIX = '_copy'
            const MAX_CODENAME_LENGTH = 50
            const truncatedBase =
                baseCodename.length + COPY_SUFFIX.length > MAX_CODENAME_LENGTH
                    ? baseCodename.slice(0, MAX_CODENAME_LENGTH - COPY_SUFFIX.length)
                    : baseCodename
            const copyCodenameText = truncatedBase ? `${truncatedBase}${COPY_SUFFIX}` : ''
            const initialCodename = copyCodenameText ? createCodenameVLC(ctx.entity.codename?._primary || 'en', copyCodenameText) : null
            return {
                open: true,
                title: ctx.t('roles.copyTitle', {
                    name: resolveLocalizedContent(ctx.entity.name, locale, getCodenamePrimary(ctx.entity.codename))
                }),
                submitLabel: ctx.t('roles.copySubmit', 'Copy role'),
                initialCodename,
                initialName: appendCopySuffix(ctx.entity.name),
                initialDescription: ctx.entity.description ?? null,
                initialColor: ctx.entity.color,
                initialCopyPermissions: false,
                showCopyPermissions: true,
                onClose: () => {
                    // BaseEntityMenu handles close state.
                },
                onSubmit: async (data: RoleFormDialogSubmitData) => {
                    await ctx.meta?.copyRole?.(ctx.entity.id, data)
                }
            }
        }
    }
}

/**
 * Combined role actions: edit, viewUsers, delete
 * Order: edit (10), viewUsers (20), delete (100)
 */
const roleActions: readonly ActionDescriptor<RoleListItem, RoleData>[] = [
    editRoleAction,
    copyRoleAction, // copy (order: 15)
    viewUsersAction, // viewUsers (order: 20)
    deleteAction // delete (order: 100)
]

export default roleActions
