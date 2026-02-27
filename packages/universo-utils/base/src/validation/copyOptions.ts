import type {
    ApplicationCopyOptions,
    BranchCopyOptionKey,
    BranchCopyOptions,
    HubCopyOptionKey,
    HubCopyOptions,
    CatalogCopyOptions,
    EnumerationCopyOptions,
    LayoutCopyOptions
} from '@universo/types'
import {
    BRANCH_COPY_OPTION_KEYS,
    DEFAULT_APPLICATION_COPY_OPTIONS,
    DEFAULT_BRANCH_COPY_OPTIONS,
    HUB_COPY_OPTION_KEYS,
    DEFAULT_HUB_COPY_OPTIONS,
    DEFAULT_CATALOG_COPY_OPTIONS,
    DEFAULT_ENUMERATION_COPY_OPTIONS,
    DEFAULT_LAYOUT_COPY_OPTIONS
} from '@universo/types'

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

const areAllHubChildrenEnabled = (options: Pick<HubCopyOptions, HubCopyOptionKey>): boolean => {
    return HUB_COPY_OPTION_KEYS.every((key) => options[key] === true)
}

export const normalizeHubCopyOptions = (input?: Partial<HubCopyOptions> | null): HubCopyOptions => {
    const hasExplicitCopyAllOff = input?.copyAllRelations === false
    const hasExplicitChildValues = HUB_COPY_OPTION_KEYS.some((key) => input?.[key] !== undefined)

    const merged: HubCopyOptions = {
        copyAllRelations: toBoolean(input?.copyAllRelations ?? DEFAULT_HUB_COPY_OPTIONS.copyAllRelations),
        copyCatalogRelations: toBoolean(input?.copyCatalogRelations ?? DEFAULT_HUB_COPY_OPTIONS.copyCatalogRelations),
        copyEnumerationRelations: toBoolean(input?.copyEnumerationRelations ?? DEFAULT_HUB_COPY_OPTIONS.copyEnumerationRelations)
    }

    if (merged.copyAllRelations) {
        for (const key of HUB_COPY_OPTION_KEYS) {
            merged[key] = true
        }
        return merged
    }

    if (hasExplicitCopyAllOff && !hasExplicitChildValues) {
        for (const key of HUB_COPY_OPTION_KEYS) {
            merged[key] = false
        }
        return merged
    }

    return {
        ...merged,
        copyAllRelations: areAllHubChildrenEnabled(merged)
    }
}

export const normalizeCatalogCopyOptions = (input?: Partial<CatalogCopyOptions> | null): CatalogCopyOptions => {
    const normalized: CatalogCopyOptions = {
        copyAttributes: toBoolean(input?.copyAttributes ?? DEFAULT_CATALOG_COPY_OPTIONS.copyAttributes),
        copyElements: toBoolean(input?.copyElements ?? DEFAULT_CATALOG_COPY_OPTIONS.copyElements)
    }

    if (!normalized.copyAttributes) {
        normalized.copyElements = false
    }

    return normalized
}

export const normalizeEnumerationCopyOptions = (input?: Partial<EnumerationCopyOptions> | null): EnumerationCopyOptions => {
    return {
        copyValues: toBoolean(input?.copyValues ?? DEFAULT_ENUMERATION_COPY_OPTIONS.copyValues)
    }
}

export const normalizeLayoutCopyOptions = (input?: Partial<LayoutCopyOptions> | null): LayoutCopyOptions => {
    const normalized: LayoutCopyOptions = {
        copyWidgets: toBoolean(input?.copyWidgets ?? DEFAULT_LAYOUT_COPY_OPTIONS.copyWidgets),
        deactivateAllWidgets: toBoolean(input?.deactivateAllWidgets ?? DEFAULT_LAYOUT_COPY_OPTIONS.deactivateAllWidgets)
    }

    if (!normalized.copyWidgets) {
        normalized.deactivateAllWidgets = false
    }

    return normalized
}
