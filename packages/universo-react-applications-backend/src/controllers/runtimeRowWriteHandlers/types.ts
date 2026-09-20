import type { DbExecutor } from '@universo-react/utils'

import type { RuntimeRecordCommandService } from '../../services/runtimeRecordBehavior'
import type { createQueryHelper, RuntimeTableChildComponentMeta } from '../../shared/runtimeHelpers'
import type { readRuntimeCopyRelations } from '../runtimeRowSupport/access'
import type { RuntimeObjectCollectionAttr } from '../runtimeRowSupport/contracts'
import type { resolveRuntimeObjectCollection } from '../runtimeRowSupport/objects'

export type RuntimeWriteResolvedObjectCollection = NonNullable<
    Awaited<ReturnType<typeof resolveRuntimeObjectCollection>>['objectCollection']
>

export type RuntimeWriteColumnValue = { column: string; value: unknown }

export type RuntimeTableChildAttrRow = {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
    ui_config?: Record<string, unknown>
}

export type RuntimeWriteTableDataEntry = {
    tabTableName: string
    rows: Array<Record<string, unknown>>
    childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
}

export type RuntimeWriteTableDataEntryWithAttr = RuntimeWriteTableDataEntry & {
    cmp: RuntimeObjectCollectionAttr
}

export type RuntimeWriteCopyRelationsConfig = Exclude<ReturnType<typeof readRuntimeCopyRelations>, { invalid: true }>

export type RuntimeRowWriteDeps = {
    getDbExecutor: () => DbExecutor
    query: ReturnType<typeof createQueryHelper>
    recordCommandService: RuntimeRecordCommandService
}
