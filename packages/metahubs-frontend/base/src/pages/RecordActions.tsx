import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ActionDescriptor } from '@universo/template-mui'
import type { HubRecord, HubRecordDisplay } from '../types'

type RecordData = {
    data: Record<string, unknown>
}

const recordActions: readonly ActionDescriptor<HubRecordDisplay, RecordData>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        onSelect: async (ctx) => {
            const helpers = ctx.helpers as {
                openEditDialog?: (entity: HubRecord | HubRecordDisplay) => void | Promise<void>
            } | undefined
            const rawRecord = (ctx as { rawRecord?: HubRecord }).rawRecord
            await helpers?.openEditDialog?.(rawRecord ?? ctx.entity)
        }
    },
    {
        id: 'delete',
        labelKey: 'common:actions.delete',
        icon: <DeleteIcon />,
        order: 100,
        group: 'danger',
        onSelect: (ctx) => {
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default recordActions
