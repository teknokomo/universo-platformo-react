import EditRoundedIcon from '@mui/icons-material/EditRounded'
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded'
import type { ActionDescriptor } from '@universo/template-mui'

import type { RoleListItem } from '../api/rolesApi'
import UserFormDialog from '../components/UserFormDialog'
import type { UserFormDialogSubmitData } from '../components/UserFormDialog'
import type { GlobalUserMember } from '../types'

interface UserActionContext {
    entity: GlobalUserMember
    t: (key: string, params?: Record<string, unknown>) => string
    meta?: {
        roles?: RoleListItem[]
        loading?: boolean
        error?: string | null
    }
    api?: {
        updateEntity?: (userId: string, data: UserFormDialogSubmitData) => Promise<void>
        deleteEntity?: (userId: string) => Promise<void>
    }
    helpers?: {
        refreshList?: () => Promise<void>
    }
}

const userActions: readonly ActionDescriptor<GlobalUserMember, UserFormDialogSubmitData>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditRoundedIcon />,
        order: 10,
        dialog: {
            loader: async () => {
                return { default: UserFormDialog }
            },
            buildProps: (ctx: UserActionContext) => ({
                open: true,
                mode: 'edit' as const,
                title: ctx.t('users.editUser', { defaultValue: 'Edit user' }),
                submitLabel: ctx.t('common.save', { defaultValue: 'Save' }),
                roles: ctx.meta?.roles ?? [],
                loading: ctx.meta?.loading,
                error: ctx.meta?.error,
                initialEmail: ctx.entity.email ?? '',
                initialComment: ctx.entity.comment ?? '',
                initialRoleIds: ctx.entity.roles.map((role) => role.id),
                onClose: () => {
                    // BaseEntityMenu owns dialog lifecycle.
                },
                onSubmit: async (data: UserFormDialogSubmitData) => {
                    await ctx.api?.updateEntity?.(ctx.entity.userId, data)
                    await ctx.helpers?.refreshList?.()
                }
            })
        }
    },
    {
        id: 'clearRoles',
        labelKey: 'users.clearRoles',
        icon: <RemoveCircleOutlineRoundedIcon />,
        tone: 'danger',
        order: 100,
        group: 'danger',
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx: UserActionContext) => ({
                open: true,
                title: ctx.t('users.clearRolesTitle', { defaultValue: 'Clear all roles?' }),
                description: ctx.t('users.clearRolesDescription', {
                    email: ctx.entity.email ?? '',
                    defaultValue: 'Remove all global roles for {{email}}?'
                }),
                confirmButtonText: ctx.t('users.clearRoles', { defaultValue: 'Clear roles' }),
                cancelButtonText: ctx.t('common.cancel', { defaultValue: 'Cancel' }),
                deletingButtonText: ctx.t('users.clearingRoles', { defaultValue: 'Clearing roles...' }),
                onCancel: () => {
                    // BaseEntityMenu owns dialog lifecycle.
                },
                onConfirm: async () => {
                    await ctx.api?.deleteEntity?.(ctx.entity.userId)
                    await ctx.helpers?.refreshList?.()
                }
            })
        }
    }
]

export default userActions
