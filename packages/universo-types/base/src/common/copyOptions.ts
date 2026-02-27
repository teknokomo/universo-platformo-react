export interface ApplicationCopyOptions {
    copyConnector: boolean
    createSchema: boolean
    copyAccess: boolean
}

export const DEFAULT_APPLICATION_COPY_OPTIONS: ApplicationCopyOptions = {
    copyConnector: true,
    createSchema: false,
    copyAccess: false
}

export const BRANCH_COPY_OPTION_KEYS = ['copyLayouts', 'copyHubs', 'copyCatalogs', 'copyEnumerations'] as const

export type BranchCopyOptionKey = (typeof BRANCH_COPY_OPTION_KEYS)[number]

export interface BranchCopyOptions {
    fullCopy: boolean
    copyLayouts: boolean
    copyHubs: boolean
    copyCatalogs: boolean
    copyEnumerations: boolean
}

export const DEFAULT_BRANCH_COPY_OPTIONS: BranchCopyOptions = {
    fullCopy: true,
    copyLayouts: true,
    copyHubs: true,
    copyCatalogs: true,
    copyEnumerations: true
}

export const HUB_COPY_OPTION_KEYS = ['copyCatalogRelations', 'copyEnumerationRelations'] as const

export type HubCopyOptionKey = (typeof HUB_COPY_OPTION_KEYS)[number]

export interface HubCopyOptions {
    copyAllRelations: boolean
    copyCatalogRelations: boolean
    copyEnumerationRelations: boolean
}

export const DEFAULT_HUB_COPY_OPTIONS: HubCopyOptions = {
    copyAllRelations: true,
    copyCatalogRelations: true,
    copyEnumerationRelations: true
}

export interface CatalogCopyOptions {
    copyAttributes: boolean
    copyElements: boolean
}

export const DEFAULT_CATALOG_COPY_OPTIONS: CatalogCopyOptions = {
    copyAttributes: true,
    copyElements: true
}

export interface EnumerationCopyOptions {
    copyValues: boolean
}

export const DEFAULT_ENUMERATION_COPY_OPTIONS: EnumerationCopyOptions = {
    copyValues: true
}

export interface LayoutCopyOptions {
    copyWidgets: boolean
    deactivateAllWidgets: boolean
}

export const DEFAULT_LAYOUT_COPY_OPTIONS: LayoutCopyOptions = {
    copyWidgets: true,
    deactivateAllWidgets: false
}
