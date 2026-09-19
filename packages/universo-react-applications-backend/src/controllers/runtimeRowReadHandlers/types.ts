import type { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import type {
    normalizeObjectCollectionRuntimeViewConfig,
    resolveApplicationLifecycleContractFromConfig,
    resolveObjectCollectionLayoutBehaviorConfig
} from '@universo-react/utils'

import type { normalizeRuntimeRecordBehavior } from '../../services/runtimeRecordBehavior'
import type { createQueryHelper, RuntimeDataType, RuntimeRefOption } from '../../shared/runtimeHelpers'
import type { runtimeQuerySchema } from '../runtimeRowSupport/contracts'
import type { readConfiguredWorkflowActions } from '../runtimeRowSupport/workflow'

export type RuntimeReadFailure = { statusCode: number; body: Record<string, unknown> }

export type RuntimeReadQuery = z.infer<typeof runtimeQuerySchema>

export type RuntimeReadComponent = {
    id: string
    codename: string
    column_name: string
    data_type: RuntimeDataType
    is_required: boolean
    is_display_component?: boolean
    presentation?: unknown
    validation_rules?: Record<string, unknown>
    sort_order?: number
    ui_config?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
}

export type RuntimeReadChildComponent = RuntimeReadComponent & { parent_component_id: string }

export type RuntimeReadObjectCollection = {
    id: string
    kind: string
    codename: unknown
    table_name: string | null
    presentation?: unknown
    config?: Record<string, unknown> | null
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
}

export type RuntimeReadRuntimeSection = {
    id: string
    kind: string
    codename: string
    tableName: string | null
    runtimeConfig:
        | ReturnType<typeof resolveObjectCollectionLayoutBehaviorConfig>
        | ReturnType<typeof normalizeObjectCollectionRuntimeViewConfig>
    recordBehavior: ReturnType<typeof normalizeRuntimeRecordBehavior> | undefined
    workflowActions: ReturnType<typeof readConfiguredWorkflowActions>
    name: string
}

export type RuntimeReadColumnDefinition = {
    id: string
    codename: unknown
    field: string
    dataType: RuntimeDataType
    isRequired: boolean
    isDisplayComponent: boolean
    headerName: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    refTargetEntityId: string | null
    refTargetEntityKind: string | null
    refTargetConstantId: string | null
    refOptions?: RuntimeRefOption[]
    enumOptions?: RuntimeRefOption[]
    childColumns?: RuntimeReadColumnDefinition[]
}

export type RuntimeRowReadHandlerDeps = {
    getDbExecutor: () => DbExecutor
    query: ReturnType<typeof createQueryHelper>
}
