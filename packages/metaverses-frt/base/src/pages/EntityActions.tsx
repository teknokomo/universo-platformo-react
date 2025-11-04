import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionContext } from '@universo/template-mui'
import type { Entity } from '../types'

type EntityData = {
    name: string
    description?: string
}

type EntityActionContext = ActionContext<Entity, EntityData> & {
    helpers?: ActionContext<Entity, EntityData>['helpers'] & {
        openDeleteDialog?: (entity: Entity) => void
    }
}

const notifyError = (ctx: EntityActionContext, error: unknown) => {
    const enqueue = ctx.helpers?.enqueueSnackbar
    if (!enqueue) return

    const fallback = ctx.t('common.error') || 'Operation failed'
    const candidateMessage =
        error && typeof error === 'object' && 'response' in error && typeof (error as any)?.response?.data?.message === 'string'
            ? (error as any).response.data.message
            : error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : fallback
    const message = candidateMessage && candidateMessage.length > 0 ? candidateMessage : fallback

    if (enqueue.length >= 2) {
        ;(enqueue as (message: string, options?: { variant?: string }) => void)(message, { variant: 'error' })
    } else {
        ;(enqueue as (payload: { message: string; options?: { variant?: string } }) => void)({
            message,
            options: { variant: 'error' }
        })
    }
}

const entityActions = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx: EntityActionContext) => ({
                open: true,
                mode: 'edit',
                title: ctx.t('entities.editTitle'),
                nameLabel: ctx.t('common:fields.name'),
                descriptionLabel: ctx.t('common:fields.description'),
                saveButtonText: ctx.t('common:actions.save'),
                savingButtonText: ctx.t('common:actions.saving'),
                cancelButtonText: ctx.t('common:actions.cancel'),
                initialName: ctx.entity.name,
                initialDescription: ctx.entity.description || '',
                showDeleteButton: true,
                deleteButtonText: ctx.t('common:actions.delete'),
                onClose: () => {},
                onSuccess: async () => {
                    try {
                        await ctx.helpers?.refreshList?.()
                    } catch (e) {
                        console.error('Failed to refresh entity list after edit', e)
                    }
                },
                onDelete: () => {
                    ctx.helpers?.openDeleteDialog?.(ctx.entity)
                },
                onSave: async (data: { name: string; description?: string }) => {
                    try {
                        await ctx.api?.updateEntity?.(ctx.entity.id, data)
                        await ctx.helpers?.refreshList?.()
                    } catch (error: unknown) {
                        notifyError(ctx, error)
                        throw error
                    }
                }
            })
        }
    },
    {
        id: 'delete',
        labelKey: 'common:actions.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx: EntityActionContext) => ({
                open: true,
                title: ctx.t('entities.confirmDelete'),
                description: ctx.t('entities.confirmDeleteDescription', { name: ctx.entity?.name || '' }),
                confirmButtonText: ctx.t('common:actions.delete'),
                cancelButtonText: ctx.t('common:actions.cancel'),
                onCancel: () => {},
                onConfirm: async () => {
                    try {
                        await ctx.api?.deleteEntity?.(ctx.entity.id)
                        await ctx.helpers?.refreshList?.()
                    } catch (error: unknown) {
                        notifyError(ctx, error)
                        throw error
                    }
                }
            })
        }
    }
] as const

export default entityActions
