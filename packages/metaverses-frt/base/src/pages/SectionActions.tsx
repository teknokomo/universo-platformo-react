import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionContext } from '@universo/template-mui'
import type { Section } from '../types'

type SectionData = {
    name: string
    description?: string
}

type SectionActionContext = ActionContext<Section, SectionData> & {
    helpers?: ActionContext<Section, SectionData>['helpers'] & {
        openDeleteDialog?: (entity: Section) => void
    }
}

const notifyError = (ctx: SectionActionContext, error: unknown) => {
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

const sectionActions = [
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
            buildProps: (ctx: SectionActionContext) => ({
                open: true,
                mode: 'edit',
                title: ctx.t('sections.editTitle'),
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
                        console.error('Failed to refresh section list after edit', e)
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
            buildProps: (ctx: SectionActionContext) => ({
                open: true,
                title: ctx.t('sections.confirmDelete'),
                description: ctx.t('sections.confirmDeleteDescription', { name: ctx.entity?.name || '' }),
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

export default sectionActions
