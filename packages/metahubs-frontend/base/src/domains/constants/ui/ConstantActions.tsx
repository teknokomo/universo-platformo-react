import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import type { ActionContext, ActionDescriptor } from '@universo/template-mui'
import type { ConstantDisplay, ConstantLocalizedPayload } from '../../../types'

type ConstantActionContext = ActionContext<ConstantDisplay, ConstantLocalizedPayload> & {
    openEditDialog?: (entity: ConstantDisplay) => void
    openCopyDialog?: (entity: ConstantDisplay) => void
    openDeleteDialog?: (entity: ConstantDisplay) => void
    moveConstant?: (id: string, direction: 'up' | 'down') => Promise<void>
    orderMap?: Map<string, number>
    totalCount?: number
}

const constantActions: readonly ActionDescriptor<ConstantDisplay, ConstantLocalizedPayload>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        order: 10,
        icon: <EditRoundedIcon fontSize='small' />,
        onSelect: (ctx) => {
            ;(ctx as ConstantActionContext).openEditDialog?.(ctx.entity)
        }
    },
    {
        id: 'copy',
        labelKey: 'common:actions.copy',
        order: 11,
        icon: <ContentCopyRoundedIcon fontSize='small' />,
        onSelect: (ctx) => {
            ;(ctx as ConstantActionContext).openCopyDialog?.(ctx.entity)
        }
    },
    {
        id: 'move-up',
        labelKey: 'constants.actions.moveUp',
        order: 20,
        group: 'reorder',
        icon: <ArrowUpwardRoundedIcon fontSize='small' />,
        visible: (ctx) => {
            const index = (ctx as ConstantActionContext).orderMap?.get(ctx.entity.id) ?? 0
            return index > 0
        },
        onSelect: async (ctx) => {
            await (ctx as ConstantActionContext).moveConstant?.(ctx.entity.id, 'up')
        }
    },
    {
        id: 'move-down',
        labelKey: 'constants.actions.moveDown',
        order: 21,
        group: 'reorder',
        icon: <ArrowDownwardRoundedIcon fontSize='small' />,
        visible: (ctx) => {
            const index = (ctx as ConstantActionContext).orderMap?.get(ctx.entity.id) ?? -1
            const total = (ctx as ConstantActionContext).totalCount ?? 0
            return index >= 0 && index < total - 1
        },
        onSelect: async (ctx) => {
            await (ctx as ConstantActionContext).moveConstant?.(ctx.entity.id, 'down')
        }
    },
    {
        id: 'delete',
        labelKey: 'common:actions.delete',
        order: 99,
        icon: <DeleteRoundedIcon fontSize='small' />,
        tone: 'danger',
        group: 'danger',
        onSelect: (ctx) => {
            ;(ctx as ConstantActionContext).openDeleteDialog?.(ctx.entity)
        }
    }
]

export default constantActions
