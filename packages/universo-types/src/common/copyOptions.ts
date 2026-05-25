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

export const BRANCH_COPY_OPTION_KEYS = [
    'copyLayouts',
    'copyTreeEntities',
    'copyObjectCollections',
    'copyValueGroups',
    'copyOptionLists'
] as const

export type BranchCopyOptionKey = (typeof BRANCH_COPY_OPTION_KEYS)[number]

export interface BranchCopyOptions {
    fullCopy: boolean
    copyLayouts: boolean
    copyTreeEntities: boolean
    copyObjectCollections: boolean
    copyValueGroups: boolean
    copyOptionLists: boolean
}

export type BranchCopyOptionsInput = Partial<BranchCopyOptions>

export const DEFAULT_BRANCH_COPY_OPTIONS: BranchCopyOptions = {
    fullCopy: true,
    copyLayouts: true,
    copyTreeEntities: true,
    copyObjectCollections: true,
    copyValueGroups: true,
    copyOptionLists: true
}

export const TREE_ENTITY_COPY_OPTION_KEYS = ['copyObjectCollectionRelations', 'copyValueGroupRelations', 'copyOptionListRelations'] as const

export type TreeEntityCopyOptionKey = (typeof TREE_ENTITY_COPY_OPTION_KEYS)[number]

export interface TreeEntityCopyOptions {
    copyAllRelations: boolean
    copyObjectCollectionRelations: boolean
    copyValueGroupRelations: boolean
    copyOptionListRelations: boolean
}

export type TreeEntityCopyOptionsInput = Partial<TreeEntityCopyOptions>

export const DEFAULT_TREE_ENTITY_COPY_OPTIONS: TreeEntityCopyOptions = {
    copyAllRelations: true,
    copyObjectCollectionRelations: true,
    copyValueGroupRelations: true,
    copyOptionListRelations: true
}

export interface ObjectCollectionCopyOptions {
    copyComponents: boolean
    copyRecords: boolean
}

export type ObjectCollectionCopyOptionsInput = Partial<ObjectCollectionCopyOptions>

export const DEFAULT_OBJECT_COLLECTION_COPY_OPTIONS: ObjectCollectionCopyOptions = {
    copyComponents: true,
    copyRecords: true
}

export interface OptionListCopyOptions {
    copyOptionValues: boolean
}

export type OptionListCopyOptionsInput = Partial<OptionListCopyOptions>

export const DEFAULT_OPTION_LIST_COPY_OPTIONS: OptionListCopyOptions = {
    copyOptionValues: true
}

export interface ValueGroupCopyOptions {
    copyFixedValues: boolean
}

export type ValueGroupCopyOptionsInput = Partial<ValueGroupCopyOptions>

export const DEFAULT_VALUE_GROUP_COPY_OPTIONS: ValueGroupCopyOptions = {
    copyFixedValues: true
}

export interface LayoutCopyOptions {
    copyWidgets: boolean
    deactivateAllWidgets: boolean
}

export const DEFAULT_LAYOUT_COPY_OPTIONS: LayoutCopyOptions = {
    copyWidgets: true,
    deactivateAllWidgets: false
}

export interface ComponentCopyOptions {
    copyChildComponents: boolean
}

export const DEFAULT_COMPONENT_COPY_OPTIONS: ComponentCopyOptions = {
    copyChildComponents: true
}

export interface FixedValueCopyOptions {
    copyValue: boolean
}

export const DEFAULT_FIXED_VALUE_COPY_OPTIONS: FixedValueCopyOptions = {
    copyValue: true
}

export interface RecordCopyOptions {
    copyChildTables: boolean
}

export const DEFAULT_RECORD_COPY_OPTIONS: RecordCopyOptions = {
    copyChildTables: true
}
