import type {
    ApplicationCopyOptions,
    BranchCopyOptionKey,
    BranchCopyOptions,
    BranchCopyOptionsInput,
    ComponentCopyOptions,
    FixedValueCopyOptions,
    LayoutCopyOptions,
    ObjectCollectionCopyOptions,
    ObjectCollectionCopyOptionsInput,
    OptionListCopyOptions,
    OptionListCopyOptionsInput,
    RecordCopyOptions,
    TreeEntityCopyOptionKey,
    TreeEntityCopyOptions,
    TreeEntityCopyOptionsInput,
    ValueGroupCopyOptions,
    ValueGroupCopyOptionsInput
} from '@universo/types'
import {
    BRANCH_COPY_OPTION_KEYS,
    DEFAULT_APPLICATION_COPY_OPTIONS,
    DEFAULT_COMPONENT_COPY_OPTIONS,
    DEFAULT_BRANCH_COPY_OPTIONS,
    DEFAULT_FIXED_VALUE_COPY_OPTIONS,
    TREE_ENTITY_COPY_OPTION_KEYS,
    DEFAULT_TREE_ENTITY_COPY_OPTIONS,
    DEFAULT_OBJECT_COLLECTION_COPY_OPTIONS,
    DEFAULT_OPTION_LIST_COPY_OPTIONS,
    DEFAULT_VALUE_GROUP_COPY_OPTIONS,
    DEFAULT_LAYOUT_COPY_OPTIONS,
    DEFAULT_RECORD_COPY_OPTIONS
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

const resolveBranchCopyOptionValue = (
    input: BranchCopyOptionsInput | null | undefined,
    key: BranchCopyOptionKey,
    fallback: boolean
): boolean => {
    return toBoolean(input?.[key] ?? fallback)
}

export const normalizeBranchCopyOptions = (input?: BranchCopyOptionsInput | null): BranchCopyOptions => {
    const hasExplicitFullCopyOff = input?.fullCopy === false
    const hasExplicitChildValues = BRANCH_COPY_OPTION_KEYS.some((key) => input?.[key] !== undefined)

    const merged: BranchCopyOptions = {
        fullCopy: toBoolean(input?.fullCopy ?? DEFAULT_BRANCH_COPY_OPTIONS.fullCopy),
        copyLayouts: resolveBranchCopyOptionValue(input, 'copyLayouts', DEFAULT_BRANCH_COPY_OPTIONS.copyLayouts),
        copyTreeEntities: resolveBranchCopyOptionValue(input, 'copyTreeEntities', DEFAULT_BRANCH_COPY_OPTIONS.copyTreeEntities),
        copyObjectCollections: resolveBranchCopyOptionValue(
            input,
            'copyObjectCollections',
            DEFAULT_BRANCH_COPY_OPTIONS.copyObjectCollections
        ),
        copyValueGroups: resolveBranchCopyOptionValue(input, 'copyValueGroups', DEFAULT_BRANCH_COPY_OPTIONS.copyValueGroups),
        copyOptionLists: resolveBranchCopyOptionValue(input, 'copyOptionLists', DEFAULT_BRANCH_COPY_OPTIONS.copyOptionLists)
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

const areAllTreeEntityChildrenEnabled = (options: Pick<TreeEntityCopyOptions, TreeEntityCopyOptionKey>): boolean => {
    return TREE_ENTITY_COPY_OPTION_KEYS.every((key) => options[key] === true)
}

const resolveTreeEntityCopyOptionValue = (
    input: TreeEntityCopyOptionsInput | null | undefined,
    key: TreeEntityCopyOptionKey,
    fallback: boolean
): boolean => {
    return toBoolean(input?.[key] ?? fallback)
}

export const normalizeTreeEntityCopyOptions = (input?: TreeEntityCopyOptionsInput | null): TreeEntityCopyOptions => {
    const hasExplicitCopyAllOff = input?.copyAllRelations === false
    const hasExplicitChildValues = TREE_ENTITY_COPY_OPTION_KEYS.some((key) => input?.[key] !== undefined)

    const merged: TreeEntityCopyOptions = {
        copyAllRelations: toBoolean(input?.copyAllRelations ?? DEFAULT_TREE_ENTITY_COPY_OPTIONS.copyAllRelations),
        copyObjectCollectionRelations: resolveTreeEntityCopyOptionValue(
            input,
            'copyObjectCollectionRelations',
            DEFAULT_TREE_ENTITY_COPY_OPTIONS.copyObjectCollectionRelations
        ),
        copyValueGroupRelations: resolveTreeEntityCopyOptionValue(
            input,
            'copyValueGroupRelations',
            DEFAULT_TREE_ENTITY_COPY_OPTIONS.copyValueGroupRelations
        ),
        copyOptionListRelations: resolveTreeEntityCopyOptionValue(
            input,
            'copyOptionListRelations',
            DEFAULT_TREE_ENTITY_COPY_OPTIONS.copyOptionListRelations
        )
    }

    if (merged.copyAllRelations) {
        for (const key of TREE_ENTITY_COPY_OPTION_KEYS) {
            merged[key] = true
        }
        return merged
    }

    if (hasExplicitCopyAllOff && !hasExplicitChildValues) {
        for (const key of TREE_ENTITY_COPY_OPTION_KEYS) {
            merged[key] = false
        }
        return merged
    }

    return {
        ...merged,
        copyAllRelations: areAllTreeEntityChildrenEnabled(merged)
    }
}

export const normalizeObjectCollectionCopyOptions = (input?: ObjectCollectionCopyOptionsInput | null): ObjectCollectionCopyOptions => {
    const normalized: ObjectCollectionCopyOptions = {
        copyComponents: toBoolean(input?.copyComponents ?? DEFAULT_OBJECT_COLLECTION_COPY_OPTIONS.copyComponents),
        copyRecords: toBoolean(input?.copyRecords ?? DEFAULT_OBJECT_COLLECTION_COPY_OPTIONS.copyRecords)
    }

    if (!normalized.copyComponents) {
        normalized.copyRecords = false
    }

    return normalized
}

export const normalizeOptionListCopyOptions = (input?: OptionListCopyOptionsInput | null): OptionListCopyOptions => {
    return {
        copyOptionValues: toBoolean(input?.copyOptionValues ?? DEFAULT_OPTION_LIST_COPY_OPTIONS.copyOptionValues)
    }
}

export const normalizeValueGroupCopyOptions = (input?: ValueGroupCopyOptionsInput | null): ValueGroupCopyOptions => {
    return {
        copyFixedValues: toBoolean(input?.copyFixedValues ?? DEFAULT_VALUE_GROUP_COPY_OPTIONS.copyFixedValues)
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

export const normalizeComponentCopyOptions = (input?: Partial<ComponentCopyOptions> | null): ComponentCopyOptions => {
    return {
        copyChildComponents: toBoolean(input?.copyChildComponents ?? DEFAULT_COMPONENT_COPY_OPTIONS.copyChildComponents)
    }
}

export const normalizeFixedValueCopyOptions = (input?: Partial<FixedValueCopyOptions> | null): FixedValueCopyOptions => {
    return {
        copyValue: toBoolean(input?.copyValue ?? DEFAULT_FIXED_VALUE_COPY_OPTIONS.copyValue)
    }
}

export const normalizeRecordCopyOptions = (input?: Partial<RecordCopyOptions> | null): RecordCopyOptions => {
    return {
        copyChildTables: toBoolean(input?.copyChildTables ?? DEFAULT_RECORD_COPY_OPTIONS.copyChildTables)
    }
}
