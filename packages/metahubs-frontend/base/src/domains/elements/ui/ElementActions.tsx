import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import type { ActionDescriptor } from '@universo/template-mui'
import type { HubElement, HubElementDisplay } from '../../../types'

type ElementData = {
    data: Record<string, unknown>
}

type ElementActionContextExtras = {
    moveElement?: (id: string, direction: 'up' | 'down') => Promise<void>
    orderMap?: Map<string, number>
    totalCount?: number
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
        id: 'move-up',
        labelKey: 'elements.actions.moveUp',
        icon: <ArrowUpwardRoundedIcon />,
        order: 20,
        group: 'reorder',
        visible: (ctx) => {
            const index = (ctx as unknown as ElementActionContextExtras).orderMap?.get(ctx.entity.id) ?? 0
            return index > 0
        },
        onSelect: async (ctx) => {
            await (ctx as unknown as ElementActionContextExtras).moveElement?.(ctx.entity.id, 'up')
        }
    },
    {
        id: 'move-down',
        labelKey: 'elements.actions.moveDown',
        icon: <ArrowDownwardRoundedIcon />,
        order: 21,
        group: 'reorder',
        visible: (ctx) => {
            const index = (ctx as unknown as ElementActionContextExtras).orderMap?.get(ctx.entity.id) ?? -1
            const total = (ctx as unknown as ElementActionContextExtras).totalCount ?? 0
            return index >= 0 && index < total - 1
        },
        onSelect: async (ctx) => {
            await (ctx as unknown as ElementActionContextExtras).moveElement?.(ctx.entity.id, 'down')
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
