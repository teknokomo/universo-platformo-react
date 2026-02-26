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
