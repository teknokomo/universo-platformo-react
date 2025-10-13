import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
type MetaverseActionContext = {
    entity: { id: string; name?: string; description?: string }
    t: (key: string, options?: any) => string
    api: {
        updateEntity?: (id: string, data: { name: string; description?: string }) => Promise<void>
        deleteEntity?: (id: string) => Promise<void>
    }
    helpers?: {
        refreshList?: () => Promise<void>
        enqueueSnackbar?:
            | ((payload: { message: string; options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' } }) => void)
            | ((message: string, options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }) => void)
        openDeleteDialog?: (entity: unknown) => void
    }
}

const notifyError = (ctx: MetaverseActionContext, error: unknown) => {
    const enqueue = ctx.helpers?.enqueueSnackbar
    if (!enqueue) {
        return
    }

    const fallback = ctx.t('common.error') || 'Operation failed'
    const message =
        (error && typeof error === 'object' && 'response' in error &&
            typeof (error as any)?.response?.data?.message === 'string'
            ? (error as any).response.data.message
            : error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : fallback) || fallback

    if (enqueue.length >= 2) {
        ;(enqueue as (message: string, options?: { variant?: string }) => void)(message, { variant: 'error' })
    } else {
        ;(enqueue as (payload: { message: string; options?: { variant?: string } }) => void)({
            message,
            options: { variant: 'error' }
        })
    }
}

// Action descriptors for metaverse entity menu
export const metaverseActions = [
    {
        id: 'edit',
        labelKey: 'metaverses.edit',
        icon: <EditIcon />,
        order: 10,
        dialog: {
            // Direct import without adapter
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx: MetaverseActionContext) => ({
                open: true,
                mode: 'edit',
                title: ctx.t('metaverses.editTitle'),
                nameLabel: ctx.t('metaverses.name'),
                descriptionLabel: ctx.t('metaverses.description'),
                saveButtonText: ctx.t('common.save'),
                savingButtonText: ctx.t('common.saving'),
                cancelButtonText: ctx.t('common.cancel'),
                initialName: ctx.entity.name,
                initialDescription: ctx.entity.description || '',
                // Show Delete button with outlined style (red border + red text)
                showDeleteButton: true,
                deleteButtonText: ctx.t('metaverses.delete'),
                onClose: () => {
                    // BaseEntityMenu handles dialog closing
                },
                onSuccess: async () => {
                    try {
                        await ctx.helpers?.refreshList?.()
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('Failed to refresh metaverse list after successful edit operation', e)
                    }
                },
                onDelete: () => {
                    // Open delete confirmation dialog
                    // MUI will handle focus management between the two dialogs
                    ctx.helpers?.openDeleteDialog?.(ctx.entity)
                },
                onSave: async (data: { name: string; description?: string }) => {
                    try {
                        await ctx.api.updateEntity?.(ctx.entity.id, data)
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
        labelKey: 'metaverses.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        dialog: {
            // Direct import without adapter
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.ConfirmDeleteDialog }
            },
            buildProps: (ctx: MetaverseActionContext) => ({
                open: true,
                title: ctx.t('metaverses.confirmDelete'),
                description: ctx.t('metaverses.confirmDeleteDescription', { name: ctx.entity?.name || '' }),
                confirmButtonText: ctx.t('metaverses.delete'),
                cancelButtonText: ctx.t('common.cancel'),
                onCancel: () => {
                    // BaseEntityMenu handles dialog closing
                },
                onConfirm: async () => {
                    try {
                        await ctx.api.deleteEntity?.(ctx.entity.id)
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

export default metaverseActions
