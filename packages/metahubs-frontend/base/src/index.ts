// Register i18n namespace (side-effect import must come first)
import './i18n'

// Main page exports
export { default as MetahubList } from './domains/metahubs/ui/MetahubList'
export { default as MetahubBoard } from './domains/metahubs/ui/MetahubBoard'
export { default as MetahubMembers } from './domains/metahubs/ui/MetahubMembers'

// Publication (Information Base) pages
export { default as PublicationList } from './domains/publications/ui/PublicationList'

// Branches
export { default as BranchList } from './domains/branches/ui/BranchList'

// New Hub/Catalog/Attribute/Element pages
export { default as HubList } from './domains/hubs/ui/HubList'
export { default as CatalogList } from './domains/catalogs/ui/CatalogList'
export { default as AttributeList } from './domains/attributes/ui/AttributeList'
export { default as ElementList } from './domains/elements/ui/ElementList'
export { default as MetahubLayouts } from './domains/layouts/ui/LayoutList'
export { default as MetahubLayoutDetails } from './domains/layouts/ui/LayoutDetails'

export { default as metahubsDashboard } from './menu-items/metahubDashboard'
export { metahubsTranslations } from './i18n'

// Types - Entity interfaces
export type {
    Metahub,
    MetahubDisplay,
    MetahubBranch,
    MetahubBranchDisplay,
    BlockingBranchUser,
    Hub,
    HubDisplay,
    HubRef,
    Catalog,
    CatalogDisplay,
    Attribute,
    AttributeDisplay,
    AttributeDataType,
    HubElement,
    HubElementDisplay
} from './types'

// Types - Payloads
export type { MetahubLocalizedPayload, HubLocalizedPayload, CatalogLocalizedPayload, AttributeLocalizedPayload } from './types'
export type { BranchLocalizedPayload } from './types'

// Types - Pagination (re-exported from @universo/types)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from './types'

// Types - VLC utilities (re-exported from @universo/utils/vlc)
export type { VersatileLocalizedContent, SimpleLocalizedInput } from './types'

// Display converters
export { toMetahubDisplay, toBranchDisplay, toHubDisplay, toCatalogDisplay, toAttributeDisplay, toHubElementDisplay } from './types'

// VLC utilities
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from './types'
