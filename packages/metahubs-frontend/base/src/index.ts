// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetahubList } from './pages/MetahubList'
export { default as MetahubBoard } from './pages/MetahubBoard'
export { default as MetahubMembers } from './pages/MetahubMembers'

// Publication (Information Base) pages
export { default as PublicationList } from './pages/PublicationList'
export { default as PublicationBoard } from './pages/PublicationBoard'

// New Hub/Catalog/Attribute/Record pages
export { default as HubList } from './pages/HubList'
export { default as CatalogList } from './pages/CatalogList'
export { default as AttributeList } from './pages/AttributeList'
export { default as RecordList } from './pages/RecordList'

export { default as metahubsDashboard } from './menu-items/metahubDashboard'
export { metahubsTranslations } from './i18n'

// Types - Entity interfaces
export type {
    Metahub,
    MetahubDisplay,
    Hub,
    HubDisplay,
    HubRef,
    Catalog,
    CatalogDisplay,
    Attribute,
    AttributeDisplay,
    AttributeDataType,
    HubRecord,
    HubRecordDisplay
} from './types'

// Types - Payloads
export type { MetahubLocalizedPayload, HubLocalizedPayload, CatalogLocalizedPayload, AttributeLocalizedPayload } from './types'

// Types - Pagination (re-exported from @universo/types)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from './types'

// Types - VLC utilities (re-exported from @universo/utils/vlc)
export type { VersatileLocalizedContent, SimpleLocalizedInput } from './types'

// Display converters
export { toMetahubDisplay, toHubDisplay, toCatalogDisplay, toAttributeDisplay, toHubRecordDisplay } from './types'

// VLC utilities
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from './types'
