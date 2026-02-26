import type { ApplicationCopyOptions, BranchCopyOptionKey, BranchCopyOptions } from '@universo/types'
import { BRANCH_COPY_OPTION_KEYS, DEFAULT_APPLICATION_COPY_OPTIONS, DEFAULT_BRANCH_COPY_OPTIONS } from '@universo/types'

const toBoolean = (value: unknown): boolean => value === true

export const normalizeApplicationCopyOptions = (input?: Partial<ApplicationCopyOptions> | null): ApplicationCopyOptions => {
    const normalized: ApplicationCopyOptions = {
        copyConnector: toBoolean(input?.copyConnector ?? DEFAULT_APPLICATION_COPY_OPTIONS.copyConnector),
        createSchema: toBoolean(input?.createSchema ?? DEFAULT_APPLICATION_COPY_OPTIONS.createSchema),
        copyAccess: toBoolean(input?.copyAccess ?? DEFAULT_APPLICATION_COPY_OPTIONS.copyAccess)
    }

    if (!normalized.copyConnector) {
        normalized.createSchema = false
    }

    return normalized
}

const areAllBranchChildrenEnabled = (options: Pick<BranchCopyOptions, BranchCopyOptionKey>): boolean => {
    return BRANCH_COPY_OPTION_KEYS.every((key) => options[key] === true)
}

export const normalizeBranchCopyOptions = (input?: Partial<BranchCopyOptions> | null): BranchCopyOptions => {
    const hasExplicitFullCopyOff = input?.fullCopy === false
    const hasExplicitChildValues = BRANCH_COPY_OPTION_KEYS.some((key) => input?.[key] !== undefined)

    const merged: BranchCopyOptions = {
        fullCopy: toBoolean(input?.fullCopy ?? DEFAULT_BRANCH_COPY_OPTIONS.fullCopy),
        copyLayouts: toBoolean(input?.copyLayouts ?? DEFAULT_BRANCH_COPY_OPTIONS.copyLayouts),
        copyHubs: toBoolean(input?.copyHubs ?? DEFAULT_BRANCH_COPY_OPTIONS.copyHubs),
        copyCatalogs: toBoolean(input?.copyCatalogs ?? DEFAULT_BRANCH_COPY_OPTIONS.copyCatalogs),
        copyEnumerations: toBoolean(input?.copyEnumerations ?? DEFAULT_BRANCH_COPY_OPTIONS.copyEnumerations)
    }

    if (merged.fullCopy) {
        for (const key of BRANCH_COPY_OPTION_KEYS) {
            merged[key] = true
        }
        return merged
    }

    if (hasExplicitFullCopyOff && !hasExplicitChildValues) {
        for (const key of BRANCH_COPY_OPTION_KEYS) {
            merged[key] = false
        }
        return merged
    }

    return {
        ...merged,
        fullCopy: areAllBranchChildrenEnabled(merged)
    }
}
