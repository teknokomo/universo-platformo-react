import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import type { ActionContext, ActionDescriptor } from '@universo/template-mui'
import type { FixedValueDisplay, FixedValueLocalizedPayload } from '../../../../../types'

type FixedValueActionContext = ActionContext<FixedValueDisplay, FixedValueLocalizedPayload> & {
    openEditDialog?: (entity: FixedValueDisplay) => void
    openCopyDialog?: (entity: FixedValueDisplay) => void
    openDeleteDialog?: (entity: FixedValueDisplay) => void
    moveFixedValue?: (id: string, direction: 'up' | 'down') => Promise<void>
    orderMap?: Map<string, number>
    totalCount?: number
}

const constantActions: readonly ActionDescriptor<FixedValueDisplay, FixedValueLocalizedPayload>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        order: 10,
        icon: <EditRoundedIcon fontSize='small' />,
        onSelect: (ctx) => {
            ;(ctx as FixedValueActionContext).openEditDialog?.(ctx.entity)
        }
    },
    {
        id: 'copy',
        labelKey: 'common:actions.copy',
        order: 11,
        icon: <ContentCopyRoundedIcon fontSize='small' />,
        onSelect: (ctx) => {
            ;(ctx as FixedValueActionContext).openCopyDialog?.(ctx.entity)
        }
    },
    {
        id: 'move-up',
        labelKey: 'fixedValues.actions.moveUp',
        order: 20,
        group: 'reorder',
        icon: <ArrowUpwardRoundedIcon fontSize='small' />,
        visible: (ctx) => {
            const index = (ctx as FixedValueActionContext).orderMap?.get(ctx.entity.id) ?? 0
            return index > 0
        },
        onSelect: async (ctx) => {
            await (ctx as FixedValueActionContext).moveFixedValue?.(ctx.entity.id, 'up')
        }
    },
    {
        id: 'move-down',
        labelKey: 'fixedValues.actions.moveDown',
        order: 21,
        group: 'reorder',
        icon: <ArrowDownwardRoundedIcon fontSize='small' />,
        visible: (ctx) => {
            const index = (ctx as FixedValueActionContext).orderMap?.get(ctx.entity.id) ?? -1
            const total = (ctx as FixedValueActionContext).totalCount ?? 0
            return index >= 0 && index < total - 1
        },
        onSelect: async (ctx) => {
            await (ctx as FixedValueActionContext).moveFixedValue?.(ctx.entity.id, 'down')
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
            ;(ctx as FixedValueActionContext).openDeleteDialog?.(ctx.entity)
        }
    }
]

export default constantActions
