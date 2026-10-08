import type { GridLocaleText } from '@mui/x-data-grid'
import type {
    ApplicationTemplateHostCapability,
    CreateTargetDefault,
    DashboardLayoutConfig,
    DashboardSideMenuMode,
    RelationBuilderWidgetConfig,
    RuntimePageBlock
} from '@universo-react/types'
import type { AppDataResponse } from '../api/api'
import type { RuntimeRelationScope } from '../api/types'
import type { ResourceSourceTypeOption } from '../components/dialogs/FormDialog'
import type { RuntimePlacement } from './runtime/widgetPlacementGraph'

export interface DashboardFooterLink {
    label: string
    href: string
}

export interface DashboardFooterMetadata {
    siteName: string
    legalLinks?: readonly DashboardFooterLink[]
    contactLinks?: readonly DashboardFooterLink[]
}

export interface DashboardDetailsSlot {
    title: string
    applicationId?: string
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    sections?: Array<{ id: string; codename: string }>
    objectCollections?: Array<{ id: string; codename: string }>
    apiBaseUrl?: string
    locale?: string
    /** Effective application/workspace runtime settings used by presentation adapters. */
    settings?: AppDataResponse['settings']
    currentWorkspaceId?: string | null
    /** Current authenticated host identity; never populated from widget data. */
    currentUser?: { displayName: string } | null
    /** Host capabilities available to system widgets in this runtime. */
    hostCapabilities?: readonly ApplicationTemplateHostCapability[]
    /** Allowlisted application/site metadata exposed to the host-owned footer widget. */
    footerMetadata?: DashboardFooterMetadata
    runtimeAccessMode?: 'member' | 'public'
    runtimeQueryKeyPrefix?: readonly unknown[]
    workspacesEnabled?: boolean
    permissions?: AppDataResponse['permissions']
    banner?: React.ReactNode
    content?: React.ReactNode
    pageSizeOptions?: number[]
    /** Optional toolbar actions (e.g. Create button) rendered next to the title. */
    actions?: React.ReactNode
    /** Optional host-provided SPA navigation handler for runtime widgets. */
    navigate?: (href: string) => void
    /** MUI DataGrid locale text overrides (e.g. from @mui/x-data-grid/locales) */
    localeText?: Partial<GridLocaleText>
    /** Optional persisted row-reorder contract for the current object runtime. */
    rowReorder?: {
        onReorder: (params: {
            objectCollectionCodename: string
            orderedRowIds: string[]
            expectedVersionsByRowId: Record<string, number>
        }) => Promise<void>
        isPending?: boolean
    }
    /** Parent-scoped row ordering for entity-backed relation panels. */
    relationRowReorder?: {
        onReorder: (params: {
            objectCollectionCodename: string
            parentFieldCodename: string
            parentRecordId: string
            orderedRowIds: string[]
            expectedVersionsByRowId: Record<string, number>
        }) => Promise<void>
        isPending?: boolean
    }
    /** Structured Page metadata blocks, compatible with the Editor.js block shape. */
    pageBlocks?: RuntimePageBlock[]
    /** Runtime learner page/player display settings. */
    pagePlayer?: {
        showOutline?: boolean
        showProgressHeader?: boolean
        completeButtonMode?: 'manual' | 'autoAfterOpen' | 'hidden'
        progressStorageKey?: string
        onProgressChange?: (payload: {
            action: 'view' | 'complete'
            target?: { objectCodename: string; recordHandle: string }
        }) => Promise<void> | void
    }
    /** Generic resource-source type policy supplied by the host application settings. */
    resourceSourceTypes?: ResourceSourceTypeOption[]
    /** Entity-backed create target handler supplied by the host application. */
    onOpenCreateTarget?: (target: DashboardCreateTarget) => void
    /** Entity-backed row action menu handler supplied by the host application. */
    onOpenRowMenu?: (event: React.MouseEvent<HTMLElement>, rowId: string, target?: DashboardRowActionTarget) => void
    /** Entity-backed source row action handler supplied by the host application. */
    onOpenRowTarget?: (target: DashboardRowTarget, action: DashboardRowTargetAction) => void
    /** Refreshes effective-layout widget data after a runtime entity mutation. */
    onRuntimeDataChanged?: () => void | Promise<unknown>
}

export interface DashboardCreateTarget {
    id: string
    label: unknown
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    icon?: string | null
    surface?: 'dialog' | 'page'
    disabled?: boolean
    disabledReason?: unknown
    createDefaults?: readonly CreateTargetDefault[]
    /** Localized field groups reused by the shared FormDialog wizard. */
    createWizard?: RelationBuilderWidgetConfig['panels'][number]['createWizard']
    /** Transient host-only values used by safe contextPath defaults; never persisted as layout configuration. */
    createDefaultContext?: Record<string, unknown>
    /** Transient relation target metadata supplied by the relationBuilder host callback. */
    relationScope?: RuntimeRelationScope
}

export type DashboardRowTargetAction = 'edit' | 'copy' | 'delete'

export interface DashboardRowActionTarget {
    entityCodename: string
    recordHandle: string
    relationScope?: RuntimeRelationScope
}

export interface DashboardRowTarget {
    rowId: string
    /** Current source row revision used by host-owned optimistic mutations. */
    expectedVersion?: number
    sectionId?: string | null
    sectionCodename?: string | null
    objectCollectionId?: string | null
    objectCollectionCodename?: string | null
    /** Transient relation target metadata supplied by the relationBuilder host callback. */
    relationScope?: RuntimeRelationScope
}

export type ZoneWidgetItem = RuntimePlacement

export interface ZoneWidgets {
    left: ZoneWidgetItem[]
    top?: ZoneWidgetItem[]
    right?: ZoneWidgetItem[]
    bottom?: ZoneWidgetItem[]
    center?: ZoneWidgetItem[]
}

export interface DashboardProps {
    layoutConfig?: Pick<DashboardLayoutConfig, 'sideMenu'>
    zoneWidgets?: ZoneWidgets
    details?: DashboardDetailsSlot
}

export type { DashboardLayoutConfig, DashboardSideMenuMode }
