import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'

export const clusterActions = [
    {
        id: 'rename',
        labelKey: 'menu.rename',
        icon: <EditIcon />,
        order: 10,
        dialog: {
            loader: async () => import('../../../../../../packages/ui/src/ui-component/dialog/SaveCanvasDialog.jsx'),
            buildProps: (ctx: any) => ({
                show: true,
                dialogProps: {
                    title: ctx.t('dialogs.rename.title', { entity: ctx.t(`entities.${ctx.entityKind}`) }),
                    confirmButtonName: ctx.t('dialogs.rename.confirm'),
                    cancelButtonName: ctx.t('confirm.delete.cancel'),
                    initialValue: ctx.entity.name
                },
                onConfirm: async (newName: string) => {
                    try {
                        await ctx.api.updateEntity?.(ctx.entity.id, { name: newName, entity: ctx.entity })
                        await ctx.helpers.refreshList?.()
                    } catch (error: any) {
                        ctx.helpers.enqueueSnackbar?.({
                            message:
                                typeof error?.response?.data === 'object'
                                    ? error.response.data.message
                                    : error?.response?.data || error?.message,
                            options: { variant: 'error' }
                        })
                    }
                }
            })
        }
    },
    {
        id: 'delete',
        labelKey: 'menu.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        confirm: (ctx: any) => ({
            titleKey: 'confirm.delete.title',
            descriptionKey: 'confirm.delete.description',
            interpolate: { entity: ctx.t(`entities.${ctx.entityKind}`), name: ctx.entity.name }
        }),
        onSelect: async (ctx: any) => {
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
            }
        }
    }
] as const

export default clusterActions
