import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import type { ActionDescriptor } from '@universo/template-mui'
import type { HubElement, HubElementDisplay } from '../../../types'

type ElementData = {
    data: Record<string, unknown>
}

const elementActions: readonly ActionDescriptor<HubElementDisplay, ElementData>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        onSelect: async (ctx) => {
            const helpers = ctx.helpers as
                | {
                      openEditDialog?: (entity: HubElement | HubElementDisplay) => void | Promise<void>
                  }
                | undefined
            const rawElement = (ctx as { rawElement?: HubElement }).rawElement
            await helpers?.openEditDialog?.(rawElement ?? ctx.entity)
        }
    },
    {
        id: 'copy',
        labelKey: 'common:actions.copy',
        icon: <ContentCopyRoundedIcon />,
        order: 15,
        onSelect: async (ctx) => {
            const helpers = ctx.helpers as
                | {
                      openCopyDialog?: (entity: HubElement | HubElementDisplay) => void | Promise<void>
                  }
                | undefined
            const rawElement = (ctx as { rawElement?: HubElement }).rawElement
            await helpers?.openCopyDialog?.(rawElement ?? ctx.entity)
        }
    },
    {
        id: 'delete',
        labelKey: 'common:actions.delete',
        icon: <DeleteIcon />,
        tone: 'danger',
        order: 100,
        group: 'danger',
        onSelect: (ctx) => {
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default elementActions
