// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetahubList } from './pages/MetahubList'
export { default as MetahubBoard } from './pages/MetahubBoard'
export { default as MetahubMembers } from './pages/MetahubMembers'

// New Hub/Catalog/Attribute/Record pages
export { default as HubList } from './pages/HubList'
export { default as CatalogList } from './pages/CatalogList'
export { default as AttributeList } from './pages/AttributeList'
export { default as RecordList } from './pages/RecordList'

export { default as metahubsDashboard } from './menu-items/metahubDashboard'
export { metahubsTranslations } from './i18n'

// Types
export type {
    Hub,
    HubDisplay,
    Catalog,
    CatalogDisplay,
    Attribute,
    AttributeDisplay,
    HubRecord,
    HubRecordDisplay,
    AttributeDataType,
    Metahub,
    MetahubDisplay,
    VersatileLocalizedContent,
    SimpleLocalizedInput,
    MetahubLocalizedPayload
} from './types'
export {
    toMetahubDisplay,
    toHubDisplay,
    toCatalogDisplay,
    toAttributeDisplay,
    toHubRecordDisplay,
    getVLCString,
    getLocalizedString
} from './types'
