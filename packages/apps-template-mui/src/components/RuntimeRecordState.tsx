import Chip from '@mui/material/Chip'
import type { ObjectRecordBehavior } from '@universo/types'
import type { RuntimeRecordCommand } from '../api/types'

export type RuntimeRecordState = 'draft' | 'posted' | 'voided' | string

export interface RuntimeRecordStateLabels {
    draft: string
    posted: string
    voided: string
    unknown: string
}

export const getRuntimeRecordState = (row: Record<string, unknown> | null | undefined): RuntimeRecordState =>
    typeof row?._app_record_state === 'string' && row._app_record_state.trim() ? row._app_record_state : 'draft'

export const isRuntimeRecordBehaviorCommandable = (behavior: ObjectRecordBehavior | null | undefined): boolean =>
    Boolean(behavior && behavior.posting.mode !== 'disabled')

export const canRunRuntimeRecordCommand = (params: {
    behavior: ObjectRecordBehavior | null | undefined
    row: Record<string, unknown> | null | undefined
    command: RuntimeRecordCommand
    canEdit: boolean
}): boolean => {
    if (!params.canEdit || !isRuntimeRecordBehaviorCommandable(params.behavior) || !params.row) {
        return false
    }

    const state = getRuntimeRecordState(params.row)
    if (params.command === 'post') return state === 'draft'
    if (params.command === 'unpost') return state === 'posted'
    if (params.command === 'void') return state === 'draft' || state === 'posted'
    return false
}

export function RuntimeRecordStateChip({
    row,
    labels
}: {
    row: Record<string, unknown> | null | undefined
    labels: RuntimeRecordStateLabels
}) {
    const state = getRuntimeRecordState(row)
    const label = state === 'draft' || state === 'posted' || state === 'voided' ? labels[state] : labels.unknown
    const color = state === 'posted' ? 'success' : state === 'voided' ? 'default' : 'warning'

    return <Chip size='small' variant='outlined' color={color} label={label} />
}
