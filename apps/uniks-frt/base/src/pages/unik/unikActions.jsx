// English-only comments. Minimal action set for Unik entities: rename + delete.
import EditIcon from '@mui/icons-material/Edit'
import FileDeleteIcon from '@mui/icons-material/Delete'

export const unikActions = [
  {
    id: 'rename',
    labelKey: 'menu.rename',
    icon: <EditIcon />,
    order: 10,
    dialog: {
      loader: async () => import('../../../../../../packages/ui/src/ui-component/dialog/SaveChatflowDialog.jsx'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: {
          title: ctx.t('dialogs.rename.title', { entity: ctx.t(`entities.${ctx.entityKind}`) }),
          confirmButtonName: ctx.t('dialogs.rename.confirm'),
          cancelButtonName: ctx.t('confirm.delete.cancel'),
          initialValue: ctx.entity.name
        },
        onConfirm: async (newName) => {
          try {
            await ctx.api.updateEntity?.(ctx.entity.id, { name: newName, entity: ctx.entity })
            await ctx.helpers.refreshList?.()
          } catch (error) {
            ctx.helpers.enqueueSnackbar?.({
              message: typeof error?.response?.data === 'object' ? error.response.data.message : error?.response?.data,
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
    icon: <FileDeleteIcon />,
    order: 100,
    group: 'danger',
    confirm: (ctx) => ({
      titleKey: 'confirm.delete.title',
      descriptionKey: 'confirm.delete.description',
      interpolate: { entity: ctx.t(`entities.${ctx.entityKind}`), name: ctx.entity.name }
    }),
    onSelect: async (ctx) => {
      try {
        await ctx.api.deleteEntity?.(ctx.entity.id)
        await ctx.helpers.refreshList?.()
      } catch (error) {
        ctx.helpers.enqueueSnackbar?.({
          message: typeof error?.response?.data === 'object' ? error.response.data.message : error?.response?.data,
          options: { variant: 'error' }
        })
      }
    }
  }
]

export default unikActions
