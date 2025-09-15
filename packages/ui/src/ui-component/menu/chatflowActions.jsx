// English-only comments per repository guidelines.
import EditIcon from '@mui/icons-material/Edit'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import FileDownloadIcon from '@mui/icons-material/Downloading'
import FileDeleteIcon from '@mui/icons-material/Delete'
import FileCategoryIcon from '@mui/icons-material/Category'
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt'
import ThumbsUpDownOutlinedIcon from '@mui/icons-material/ThumbsUpDownOutlined'
import VpnLockOutlinedIcon from '@mui/icons-material/VpnLockOutlined'
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined'
import ExportTemplateOutlinedIcon from '@mui/icons-material/BookmarksOutlined'
import { generateExportFlowData } from '@/utils/genericHelper'
import { uiBaseURL } from '@/store/constant'
import chatflowsApi from '@/api/chatflows'

// Helper to export flow data replicating old behavior.
const exportHandler = (ctx) => {
  try {
    const flowData = JSON.parse(ctx.entity.flowData)
    const dataStr = JSON.stringify(generateExportFlowData(flowData), null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const dataUri = URL.createObjectURL(blob)
    const entityLabel = ctx.t(`entities.${ctx.entityKind}`)
    const exportFileDefaultName = `${ctx.entity.name} ${ctx.t('export.fileSuffix', { entity: entityLabel })}.json`
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
  }
}

// Build dialog props common patterns.
const buildTitle = (ctx, key) => ctx.t(key, { name: ctx.entity.name })

export const chatflowActions = [
  {
    id: 'rename',
    labelKey: 'menu.rename',
    icon: <EditIcon />,
    order: 10,
    dialog: {
      loader: () => import('@/ui-component/dialog/SaveChatflowDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: {
          title: ctx.t('dialogs.rename.title', { entity: ctx.t(`entities.${ctx.entityKind}`) }),
          confirmButtonName: ctx.t('dialogs.rename.confirm'),
            cancelButtonName: ctx.t('confirm.delete.cancel')
        },
        onConfirm: async (newName) => {
          try {
            await ctx.api.updateEntity?.(ctx.entity.id, { name: newName, chatflow: ctx.entity })
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
    id: 'duplicate',
    labelKey: 'menu.duplicate',
    icon: <FileCopyIcon />,
    order: 20,
    onSelect: (ctx) => {
      try {
        localStorage.setItem('duplicatedFlowData', ctx.entity.flowData)
        ctx.helpers.openWindow(`${uiBaseURL}/${ctx.entityKind === 'agent' ? 'agentcanvas' : 'canvas'}`)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    }
  },
  {
    id: 'export',
    labelKey: 'menu.export',
    icon: <FileDownloadIcon />,
    order: 30,
    onSelect: exportHandler
  },
  {
    id: 'exportTemplate',
    labelKey: 'menu.exportTemplate',
    icon: <ExportTemplateOutlinedIcon />,
    order: 40,
    dialog: {
      loader: () => import('@/ui-component/dialog/ExportAsTemplateDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: { chatflow: ctx.entity },
        onCancel: () => {},
        onClose: () => {}
      })
    }
  },
  {
    id: 'starterPrompts',
    labelKey: 'menu.starterPrompts',
    icon: <PictureInPictureAltIcon />,
    order: 50,
    dialog: {
      loader: () => import('@/ui-component/dialog/StarterPromptsDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: { title: buildTitle(ctx, 'dialogs.starterPrompts.title'), chatflow: ctx.entity },
        onCancel: () => {}
      })
    }
  },
  {
    id: 'chatFeedback',
    labelKey: 'menu.chatFeedback',
    icon: <ThumbsUpDownOutlinedIcon />,
    order: 60,
    dialog: {
      loader: () => import('@/ui-component/dialog/ChatFeedbackDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: { title: buildTitle(ctx, 'dialogs.chatFeedback.title'), chatflow: ctx.entity },
        onCancel: () => {}
      })
    }
  },
  {
    id: 'allowedDomains',
    labelKey: 'menu.allowedDomains',
    icon: <VpnLockOutlinedIcon />,
    order: 70,
    dialog: {
      loader: () => import('@/ui-component/dialog/AllowedDomainsDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: { title: buildTitle(ctx, 'dialogs.allowedDomains.title'), chatflow: ctx.entity },
        onCancel: () => {}
      })
    }
  },
  {
    id: 'speechToText',
    labelKey: 'menu.speechToText',
    icon: <MicNoneOutlinedIcon />,
    order: 80,
    dialog: {
      loader: () => import('@/ui-component/dialog/SpeechToTextDialog'),
      buildProps: (ctx) => ({
        show: true,
        dialogProps: { title: buildTitle(ctx, 'dialogs.speechToText.title'), chatflow: ctx.entity },
        onCancel: () => {}
      })
    }
  },
  {
    id: 'updateCategory',
    labelKey: 'menu.updateCategory',
    icon: <FileCategoryIcon />,
    order: 90,
    dialog: {
      loader: () => import('@/ui-component/dialog/TagDialog'),
      buildProps: (ctx) => ({
        isOpen: true,
        dialogProps: ctx.entity.category ? { category: ctx.entity.category.split(';') } : {},
        onClose: () => {},
        onSubmit: async (categories) => {
          try {
            const categoryTags = categories.join(';')
            await ctx.api.updateEntity?.(ctx.entity.id, { category: categoryTags, chatflow: ctx.entity })
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
    order: 1000,
    group: 'danger',
    confirm: (ctx) => ({
      titleKey: 'confirm.delete.title',
      descriptionKey: 'confirm.delete.description',
      interpolate: { entity: ctx.t(`entities.${ctx.entityKind}`), name: ctx.entity.name }
    }),
    onSelect: async (ctx) => {
      try {
        await chatflowsApi.deleteChatflow(ctx.entity.id)
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

export default chatflowActions
