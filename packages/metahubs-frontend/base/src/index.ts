// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetahubList } from './pages/MetahubList'
export { default as MetahubBoard } from './pages/MetahubBoard'

// i18n exports
export { metahubsTranslations } from './i18n'

// Types exports
export type { Metahub, SysEntity, SysField, UserDataRecord, PaginationMeta, PaginatedResponse } from './types'

// API exports
export * as metahubsApi from './api/metahubs'
export { metahubsQueryKeys } from './api/queryKeys'

// Hooks exports
export {
    useCreateMetahub,
    useUpdateMetahub,
    useDeleteMetahub,
    useCreateEntity,
    useDeleteEntity,
    useCreateField,
    useDeleteField,
    useCreateRecord,
    useUpdateRecord,
    useDeleteRecord
} from './hooks/mutations'
