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
import EntityBlockContentPageComponent from './domains/entities/ui/EntityBlockContentPage'
import {
    StandardEntityChildCollectionPage as StandardEntityChildCollectionPageComponent,
    BuiltinEntityCollectionPage as BuiltinEntityCollectionPageComponent
} from './domains/entities/ui/BuiltinEntityCollectionPage'
import SelectableOptionListComponent from './domains/entities/metadata/optionValue/ui/SelectableOptionList'
import ComponentListComponent from './domains/entities/metadata/component/ui/ComponentList'
import RecordListComponent from './domains/entities/metadata/record/ui/RecordList'
import FixedValueListComponent from './domains/entities/metadata/fixedValue/ui/FixedValueList'
import SharedResourcesPageComponent from './domains/entities/shared/ui/SharedResourcesPage'
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
export const EntityBlockContentPage = withMetahubDialogSettings(EntityBlockContentPageComponent)
export const BuiltinEntityCollectionPage = withMetahubDialogSettings(BuiltinEntityCollectionPageComponent)
export const StandardEntityChildCollectionPage = withMetahubDialogSettings(StandardEntityChildCollectionPageComponent)

// Entity metadata pages
export const SelectableOptionList = withMetahubDialogSettings(SelectableOptionListComponent)
export const ComponentList = withMetahubDialogSettings(ComponentListComponent)
export const RecordList = withMetahubDialogSettings(RecordListComponent)
export const FixedValueList = withMetahubDialogSettings(FixedValueListComponent)
export const MetahubResources = withMetahubDialogSettings(SharedResourcesPageComponent)
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
    TreeEntity,
    TreeEntityDisplay,
    TreeEntityRef,
    ObjectCollectionEntity,
    ObjectCollectionDisplay,
    ValueGroupEntity,
    ValueGroupDisplay,
    OptionListEntity,
    OptionListDisplay,
    OptionValue,
    OptionValueDisplay,
    Component,
    ComponentDisplay,
    ComponentDefinitionDataType,
    FixedValue,
    FixedValueDisplay,
    FixedValueDataType,
    RecordItem,
    RecordItemDisplay
} from './types'

// Types - Payloads
export type {
    MetahubLocalizedPayload,
    TreeEntityLocalizedPayload,
    ObjectCollectionLocalizedPayload,
    ValueGroupLocalizedPayload,
    OptionListLocalizedPayload,
    OptionValueLocalizedPayload,
    ComponentLocalizedPayload,
    FixedValueLocalizedPayload
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
    toTreeEntityDisplay,
    toObjectCollectionDisplay,
    toValueGroupDisplay,
    toOptionListDisplay,
    toOptionValueDisplay,
    toComponentDisplay,
    toFixedValueDisplay,
    toRecordItemDisplay
} from './types'

// VLC utilities
export { getVLCString, getVLCStringWithFallback, normalizeLocale } from './types'
