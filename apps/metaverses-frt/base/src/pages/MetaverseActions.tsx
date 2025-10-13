import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'

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
            buildProps: (ctx: any) => ({
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
                        await ctx.helpers.refreshList?.()
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('refreshList after success failed', e)
                    }
                },
                onDelete: () => {
                    // Open delete confirmation dialog
                    // MUI will handle focus management between the two dialogs
                    ctx.helpers.openDeleteDialog?.(ctx.entity)
                },
                onSave: async (data: { name: string; description?: string }) => {
                    try {
                        await ctx.api.updateEntity?.(ctx.entity.id, data)
                        await ctx.helpers.refreshList?.()
                    } catch (error: any) {
                        ctx.helpers.enqueueSnackbar?.({
                            message:
                                typeof error?.response?.data === 'object'
                                    ? error.response.data.message
                                    : error?.response?.data || error?.message,
                            options: { variant: 'error' }
                        })
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
            buildProps: (ctx: any) => ({
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
                        await ctx.helpers.refreshList?.()
                    } catch (error: any) {
                        ctx.helpers.enqueueSnackbar?.({
                            message:
                                typeof error?.response?.data === 'object'
                                    ? error.response.data.message
                                    : error?.response?.data || error?.message,
                            options: { variant: 'error' }
                        })
                        throw error
                    }
                }
            })
        }
    }
] as const

export default metaverseActions
