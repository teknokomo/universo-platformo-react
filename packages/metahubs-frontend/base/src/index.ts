// Register i18n namespace (side-effect import must come first)
import './i18n'
import MetahubListComponent from './domains/metahubs/ui/MetahubList'
import MetahubBoardComponent from './domains/metahubs/ui/MetahubBoard'
import MetahubMembersComponent from './domains/metahubs/ui/MetahubMembers'
import PublicationListComponent from './domains/publications/ui/PublicationList'
import { PublicationVersionList as PublicationVersionListComponent } from './domains/publications/ui/PublicationVersionList'
import { PublicationApplicationList as PublicationApplicationListComponent } from './domains/publications/ui/PublicationApplicationList'
import BranchListComponent from './domains/branches/ui/BranchList'
import MetahubMigrationsComponent from './domains/migrations/ui/MetahubMigrations'
import EntitiesWorkspaceComponent from './domains/entities/ui/EntitiesWorkspace'
import EntityInstanceListComponent from './domains/entities/ui/EntityInstanceList'
import HubListComponent from './domains/hubs/ui/HubList'
import CatalogListComponent from './domains/catalogs/ui/CatalogList'
import EnumerationListComponent from './domains/enumerations/ui/EnumerationList'
import EnumerationValueListComponent from './domains/enumerations/ui/EnumerationValueList'
import AttributeListComponent from './domains/attributes/ui/AttributeList'
import ElementListComponent from './domains/elements/ui/ElementList'
import SetListComponent from './domains/sets/ui/SetList'
import ConstantListComponent from './domains/constants/ui/ConstantList'
import GeneralPageComponent from './domains/general/ui/GeneralPage'
import MetahubLayoutsComponent from './domains/layouts/ui/LayoutList'
import MetahubLayoutDetailsComponent from './domains/layouts/ui/LayoutDetails'
import SettingsPageComponent from './domains/settings/ui/SettingsPage'
import { withMetahubDialogSettings } from './domains/settings/ui/MetahubDialogSettingsProvider'

// Main page exports
export const MetahubList = withMetahubDialogSettings(MetahubListComponent)
export const MetahubBoard = withMetahubDialogSettings(MetahubBoardComponent)
export const MetahubMembers = withMetahubDialogSettings(MetahubMembersComponent)

// Publication (Information Base) pages
export const PublicationList = withMetahubDialogSettings(PublicationListComponent)
export const PublicationVersionList = withMetahubDialogSettings(PublicationVersionListComponent)
export const PublicationApplicationList = withMetahubDialogSettings(PublicationApplicationListComponent)

// Branches
export const BranchList = withMetahubDialogSettings(BranchListComponent)
export const MetahubMigrations = withMetahubDialogSettings(MetahubMigrationsComponent)
export { default as MetahubMigrationGuard } from './domains/migrations/ui/MetahubMigrationGuard'
export const EntitiesWorkspace = withMetahubDialogSettings(EntitiesWorkspaceComponent)
export const EntityInstanceList = withMetahubDialogSettings(EntityInstanceListComponent)

// New Hub/Catalog/Attribute/Element pages
export const HubList = withMetahubDialogSettings(HubListComponent)
export const CatalogList = withMetahubDialogSettings(CatalogListComponent)
export const EnumerationList = withMetahubDialogSettings(EnumerationListComponent)
export const EnumerationValueList = withMetahubDialogSettings(EnumerationValueListComponent)
export const AttributeList = withMetahubDialogSettings(AttributeListComponent)
export const ElementList = withMetahubDialogSettings(ElementListComponent)
export const SetList = withMetahubDialogSettings(SetListComponent)
export const ConstantList = withMetahubDialogSettings(ConstantListComponent)
export const MetahubCommon = withMetahubDialogSettings(GeneralPageComponent)
export const MetahubLayouts = withMetahubDialogSettings(MetahubLayoutsComponent)
export const MetahubLayoutDetails = withMetahubDialogSettings(MetahubLayoutDetailsComponent)

// Settings
export const MetahubSettings = withMetahubDialogSettings(SettingsPageComponent)
export { useEntityPermissions } from './domains/settings/hooks/useEntityPermissions'

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
    MetahubSet,
    MetahubSetDisplay,
    Enumeration,
    EnumerationDisplay,
    EnumerationValue,
    EnumerationValueDisplay,
    Attribute,
    AttributeDisplay,
    AttributeDataType,
    Constant,
    ConstantDisplay,
    ConstantDataType,
    HubElement,
    HubElementDisplay
} from './types'

// Types - Payloads
export type {
    MetahubLocalizedPayload,
    HubLocalizedPayload,
    CatalogLocalizedPayload,
    SetLocalizedPayload,
    EnumerationLocalizedPayload,
    EnumerationValueLocalizedPayload,
    AttributeLocalizedPayload,
    ConstantLocalizedPayload
} from './types'
export type { BranchLocalizedPayload } from './types'

// Types - Pagination (re-exported from @universo/types)
export type { PaginationParams, PaginationMeta, PaginatedResponse } from './types'

// Types - VLC utilities (re-exported from @universo/utils/vlc)
export type { VersatileLocalizedContent, SimpleLocalizedInput } from './types'

// Display converters
export {
    toMetahubDisplay,
    toBranchDisplay,
    toHubDisplay,
    toCatalogDisplay,
    toSetDisplay,
    toEnumerationDisplay,
    toEnumerationValueDisplay,
    toAttributeDisplay,
    toConstantDisplay,
    toHubElementDisplay
} from './types'

// VLC utilities
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from './types'
