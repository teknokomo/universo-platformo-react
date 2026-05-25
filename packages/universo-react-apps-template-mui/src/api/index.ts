export {
    fetchAppData,
    fetchAppRow,
    createAppRow,
    updateAppRow,
    deleteAppRow,
    restoreAppRow,
    runAppRecordCommand,
    runAppWorkflowAction,
    updateLearningContentProgress,
    fetchRuntimeLedgers,
    fetchRuntimeLedgerFacts,
    fetchRuntimeLedgerProjection,
    fetchRuntimeRecordsUnion,
    setRuntimeLibraryRelation,
    exportRuntimeReportCsv,
    appDataResponseSchema
} from './api'
export { dashboardLayoutConfigSchema } from '@universo-react/types'
export type {
    AppDataResponse,
    ApplicationRuntimeResponse,
    DashboardLayoutConfig,
    RuntimeLedgerFactsResponse,
    RuntimeLedgerMetadataResponse,
    RuntimeLedgerProjectionResponse
} from './api'

export { appQueryKeys, runtimeKeys, useAppRow, useCreateAppRow, useUpdateAppRow, useDeleteAppRow, useRestoreAppRow } from './mutations'

// Adapter pattern
export type { CrudDataAdapter, CellRendererOverrides, RuntimeRecordCommand, RuntimeRestoreTarget } from './types'
export { createStandaloneAdapter } from './adapters'

// Tabular part (TABLE component) adapter
/** @deprecated Use direct API helpers with RuntimeInlineTabularEditor instead */
export { createTabularPartAdapter } from './TabularPartAdapter'
/** @deprecated Use direct API helpers with RuntimeInlineTabularEditor instead */
export type { TabularPartAdapterParams } from './TabularPartAdapter'
