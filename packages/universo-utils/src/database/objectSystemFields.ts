import {
    ComponentDefinitionDataType,
    type ApplicationLifecycleContract,
    type ApplicationLifecycleContractInput,
    type ObjectSystemComponent,
    type ObjectSystemFieldKey,
    type ObjectSystemFieldState,
    type VersionedLocalizedContent
} from '@universo/types'
import { buildVLC } from '../vlc'
import { APP_FIELDS, UPL_FIELDS } from './systemFields'

interface ObjectSystemComponentSeedDefinition extends ObjectSystemComponent {
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string>
}

export interface ObjectSystemFieldToggleValidationResult {
    normalized: ObjectSystemFieldState[]
    errors: string[]
}

export interface ObjectSystemComponentSeedInput {
    key: ObjectSystemFieldKey
    columnName: string
    dataType: ComponentDefinitionDataType
    physicalType: 'boolean' | 'timestamptz' | 'uuid'
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string>
    enabled: boolean
    sortOrder: number
}

export interface ObjectSystemComponentSeedRecord {
    key: ObjectSystemFieldKey
    codename: string
    dataType: ComponentDefinitionDataType
    presentation: {
        name: VersionedLocalizedContent<string>
        description: VersionedLocalizedContent<string>
    }
    sortOrder: number
    isSystem: true
    isSystemManaged: true
    isSystemEnabled: boolean
}

export interface PlatformSystemFieldFamilyContract {
    enabled: boolean
    trackAt: boolean
    trackBy: boolean
}

export interface PlatformSystemFieldsContract {
    archive: PlatformSystemFieldFamilyContract
    delete: PlatformSystemFieldFamilyContract
}

const SYSTEM_FIELD_REGISTRY: readonly ObjectSystemComponentSeedDefinition[] = [
    {
        key: 'app.published',
        columnName: APP_FIELDS.PUBLISHED,
        layer: 'app',
        family: 'published',
        valueType: 'boolean',
        componentDataType: ComponentDefinitionDataType.BOOLEAN,
        physicalType: 'boolean',
        sortOrder: 10,
        defaultEnabled: true,
        canDisable: true,
        name: buildVLC('Published flag', 'Флаг публикации'),
        description: buildVLC('Marks a runtime row as published.', 'Отмечает строку runtime как опубликованную.')
    },
    {
        key: 'app.published_at',
        columnName: APP_FIELDS.PUBLISHED_AT,
        layer: 'app',
        family: 'published',
        valueType: 'timestamp',
        componentDataType: ComponentDefinitionDataType.DATE,
        physicalType: 'timestamptz',
        sortOrder: 20,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.published'],
        name: buildVLC('Published at', 'Дата публикации'),
        description: buildVLC('Stores when the runtime row was published.', 'Хранит дату и время публикации строки runtime.')
    },
    {
        key: 'app.published_by',
        columnName: APP_FIELDS.PUBLISHED_BY,
        layer: 'app',
        family: 'published',
        valueType: 'uuid',
        componentDataType: ComponentDefinitionDataType.STRING,
        physicalType: 'uuid',
        sortOrder: 30,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.published'],
        name: buildVLC('Published by', 'Кем опубликовано'),
        description: buildVLC(
            'Stores the user id that published the runtime row.',
            'Хранит идентификатор пользователя, опубликовавшего строку runtime.'
        )
    },
    {
        key: 'app.archived',
        columnName: APP_FIELDS.ARCHIVED,
        layer: 'app',
        family: 'archived',
        valueType: 'boolean',
        componentDataType: ComponentDefinitionDataType.BOOLEAN,
        physicalType: 'boolean',
        sortOrder: 40,
        defaultEnabled: true,
        canDisable: true,
        name: buildVLC('Archived flag', 'Флаг архивации'),
        description: buildVLC('Marks a runtime row as archived.', 'Отмечает строку runtime как архивную.')
    },
    {
        key: 'app.archived_at',
        columnName: APP_FIELDS.ARCHIVED_AT,
        layer: 'app',
        family: 'archived',
        valueType: 'timestamp',
        componentDataType: ComponentDefinitionDataType.DATE,
        physicalType: 'timestamptz',
        sortOrder: 50,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.archived'],
        name: buildVLC('Archived at', 'Дата архивации'),
        description: buildVLC('Stores when the runtime row was archived.', 'Хранит дату и время архивации строки runtime.')
    },
    {
        key: 'app.archived_by',
        columnName: APP_FIELDS.ARCHIVED_BY,
        layer: 'app',
        family: 'archived',
        valueType: 'uuid',
        componentDataType: ComponentDefinitionDataType.STRING,
        physicalType: 'uuid',
        sortOrder: 60,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.archived'],
        name: buildVLC('Archived by', 'Кем архивировано'),
        description: buildVLC(
            'Stores the user id that archived the runtime row.',
            'Хранит идентификатор пользователя, архивировавшего строку runtime.'
        )
    },
    {
        key: 'app.deleted',
        columnName: APP_FIELDS.DELETED,
        layer: 'app',
        family: 'deleted',
        valueType: 'boolean',
        componentDataType: ComponentDefinitionDataType.BOOLEAN,
        physicalType: 'boolean',
        sortOrder: 70,
        defaultEnabled: true,
        canDisable: true,
        name: buildVLC('Deleted flag', 'Флаг удаления'),
        description: buildVLC('Enables soft-delete tracking for runtime rows.', 'Включает отслеживание soft delete для строк runtime.')
    },
    {
        key: 'app.deleted_at',
        columnName: APP_FIELDS.DELETED_AT,
        layer: 'app',
        family: 'deleted',
        valueType: 'timestamp',
        componentDataType: ComponentDefinitionDataType.DATE,
        physicalType: 'timestamptz',
        sortOrder: 80,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.deleted'],
        name: buildVLC('Deleted at', 'Дата удаления'),
        description: buildVLC('Stores when the runtime row was soft-deleted.', 'Хранит дату и время soft delete для строки runtime.')
    },
    {
        key: 'app.deleted_by',
        columnName: APP_FIELDS.DELETED_BY,
        layer: 'app',
        family: 'deleted',
        valueType: 'uuid',
        componentDataType: ComponentDefinitionDataType.STRING,
        physicalType: 'uuid',
        sortOrder: 90,
        defaultEnabled: true,
        canDisable: true,
        requires: ['app.deleted'],
        name: buildVLC('Deleted by', 'Кем удалено'),
        description: buildVLC(
            'Stores the user id that soft-deleted the runtime row.',
            'Хранит идентификатор пользователя, выполнившего soft delete строки runtime.'
        )
    },
    {
        key: 'upl.archived',
        columnName: UPL_FIELDS.ARCHIVED,
        layer: 'upl',
        family: 'archived',
        valueType: 'boolean',
        componentDataType: ComponentDefinitionDataType.BOOLEAN,
        physicalType: 'boolean',
        sortOrder: 100,
        defaultEnabled: true,
        canDisable: true,
        name: buildVLC('Platform archived flag', 'Платформенный флаг архивации'),
        description: buildVLC('Platform-level archived state for runtime rows.', 'Платформенное состояние архивации для строк runtime.')
    },
    {
        key: 'upl.archived_at',
        columnName: UPL_FIELDS.ARCHIVED_AT,
        layer: 'upl',
        family: 'archived',
        valueType: 'timestamp',
        componentDataType: ComponentDefinitionDataType.DATE,
        physicalType: 'timestamptz',
        sortOrder: 110,
        defaultEnabled: true,
        canDisable: true,
        requires: ['upl.archived'],
        name: buildVLC('Platform archived at', 'Платформенная дата архивации'),
        description: buildVLC(
            'Platform-level archive timestamp for runtime rows.',
            'Платформенная дата и время архивации для строк runtime.'
        )
    },
    {
        key: 'upl.archived_by',
        columnName: UPL_FIELDS.ARCHIVED_BY,
        layer: 'upl',
        family: 'archived',
        valueType: 'uuid',
        componentDataType: ComponentDefinitionDataType.STRING,
        physicalType: 'uuid',
        sortOrder: 120,
        defaultEnabled: true,
        canDisable: true,
        requires: ['upl.archived'],
        name: buildVLC('Platform archived by', 'Кем архивировано на платформе'),
        description: buildVLC(
            'Platform-level archive actor id for runtime rows.',
            'Платформенный идентификатор пользователя, архивировавшего строку runtime.'
        )
    },
    {
        key: 'upl.deleted',
        columnName: UPL_FIELDS.DELETED,
        layer: 'upl',
        family: 'deleted',
        valueType: 'boolean',
        componentDataType: ComponentDefinitionDataType.BOOLEAN,
        physicalType: 'boolean',
        sortOrder: 130,
        defaultEnabled: true,
        canDisable: true,
        name: buildVLC('Platform deleted flag', 'Платформенный флаг удаления'),
        description: buildVLC('Platform-level deletion state for runtime rows.', 'Платформенное состояние удаления для строк runtime.')
    },
    {
        key: 'upl.deleted_at',
        columnName: UPL_FIELDS.DELETED_AT,
        layer: 'upl',
        family: 'deleted',
        valueType: 'timestamp',
        componentDataType: ComponentDefinitionDataType.DATE,
        physicalType: 'timestamptz',
        sortOrder: 140,
        defaultEnabled: true,
        canDisable: true,
        requires: ['upl.deleted'],
        name: buildVLC('Platform deleted at', 'Платформенная дата удаления'),
        description: buildVLC(
            'Platform-level deletion timestamp for runtime rows.',
            'Платформенная дата и время удаления для строк runtime.'
        )
    },
    {
        key: 'upl.deleted_by',
        columnName: UPL_FIELDS.DELETED_BY,
        layer: 'upl',
        family: 'deleted',
        valueType: 'uuid',
        componentDataType: ComponentDefinitionDataType.STRING,
        physicalType: 'uuid',
        sortOrder: 150,
        defaultEnabled: true,
        canDisable: true,
        requires: ['upl.deleted'],
        name: buildVLC('Platform deleted by', 'Кем удалено на платформе'),
        description: buildVLC(
            'Platform-level deletion actor id for runtime rows.',
            'Платформенный идентификатор пользователя, удалившего строку runtime.'
        )
    }
] as const

const SYSTEM_FIELD_DEFINITION_MAP = new Map<ObjectSystemFieldKey, ObjectSystemComponentSeedDefinition>(
    SYSTEM_FIELD_REGISTRY.map((definition) => [definition.key, definition])
)

const normalizeStatesMap = (states?: ObjectSystemFieldState[] | null): Map<ObjectSystemFieldKey, boolean> => {
    const map = new Map<ObjectSystemFieldKey, boolean>()

    for (const definition of SYSTEM_FIELD_REGISTRY) {
        map.set(definition.key, definition.defaultEnabled)
    }

    for (const state of states ?? []) {
        if (SYSTEM_FIELD_DEFINITION_MAP.has(state.key)) {
            map.set(state.key, Boolean(state.enabled))
        }
    }

    return map
}

export const getObjectSystemComponents = (): ObjectSystemComponent[] =>
    SYSTEM_FIELD_REGISTRY.map(({ name: _name, description: _description, ...definition }) => ({ ...definition }))

export const getObjectSystemComponent = (key: ObjectSystemFieldKey): ObjectSystemComponent | undefined => {
    const definition = SYSTEM_FIELD_DEFINITION_MAP.get(key)
    if (!definition) return undefined
    const { name: _name, description: _description, ...plainDefinition } = definition
    return { ...plainDefinition }
}

export const getObjectSystemComponentSeedInputs = (states?: ObjectSystemFieldState[] | null): ObjectSystemComponentSeedInput[] => {
    const normalizedStates = normalizeStatesMap(states)
    return SYSTEM_FIELD_REGISTRY.map((definition) => ({
        key: definition.key,
        columnName: definition.columnName,
        dataType: definition.componentDataType,
        physicalType: definition.physicalType,
        name: definition.name,
        description: definition.description,
        enabled: normalizedStates.get(definition.key) ?? definition.defaultEnabled,
        sortOrder: definition.sortOrder
    }))
}

export const buildObjectSystemComponentSeedRecord = (definition: ObjectSystemComponentSeedInput): ObjectSystemComponentSeedRecord => ({
    key: definition.key,
    codename: definition.columnName,
    dataType: definition.dataType,
    presentation: {
        name: definition.name,
        description: definition.description
    },
    sortOrder: definition.sortOrder,
    isSystem: true,
    isSystemManaged: true,
    isSystemEnabled: definition.enabled
})

export const getObjectSystemComponentSeedRecords = (states?: ObjectSystemFieldState[] | null): ObjectSystemComponentSeedRecord[] =>
    getObjectSystemComponentSeedInputs(states).map(buildObjectSystemComponentSeedRecord)

export const getReservedObjectSystemFieldCodenames = (): string[] => SYSTEM_FIELD_REGISTRY.map((definition) => definition.columnName)

export const getDefaultObjectSystemFieldStates = (): ObjectSystemFieldState[] =>
    SYSTEM_FIELD_REGISTRY.map((definition) => ({ key: definition.key, enabled: definition.defaultEnabled }))

export const validateObjectSystemFieldToggleSet = (states?: ObjectSystemFieldState[] | null): ObjectSystemFieldToggleValidationResult => {
    const normalizedStates = normalizeStatesMap(states)
    const errors: string[] = []

    for (const definition of SYSTEM_FIELD_REGISTRY) {
        const enabled = normalizedStates.get(definition.key) ?? definition.defaultEnabled
        if (!definition.canDisable && !enabled) {
            errors.push(`System field ${definition.key} cannot be disabled`)
        }
        for (const requiredKey of definition.requires ?? []) {
            if (enabled && !normalizedStates.get(requiredKey)) {
                errors.push(`System field ${definition.key} requires ${requiredKey}`)
            }
        }
    }

    return {
        normalized: SYSTEM_FIELD_REGISTRY.map((definition) => ({
            key: definition.key,
            enabled: normalizedStates.get(definition.key) ?? definition.defaultEnabled
        })),
        errors
    }
}

export const deriveApplicationLifecycleContract = (states?: ObjectSystemFieldState[] | null): ApplicationLifecycleContract => {
    const validationResult = validateObjectSystemFieldToggleSet(states)
    if (validationResult.errors.length > 0) {
        throw new Error(validationResult.errors.join('; '))
    }

    const enabledMap = new Map<ObjectSystemFieldKey, boolean>(validationResult.normalized.map((state) => [state.key, state.enabled]))
    const publishEnabled = enabledMap.get('app.published') === true
    const archiveEnabled = enabledMap.get('app.archived') === true
    const deleteEnabled = enabledMap.get('app.deleted') === true

    return {
        publish: {
            enabled: publishEnabled,
            trackAt: publishEnabled && enabledMap.get('app.published_at') === true,
            trackBy: publishEnabled && enabledMap.get('app.published_by') === true
        },
        archive: {
            enabled: archiveEnabled,
            trackAt: archiveEnabled && enabledMap.get('app.archived_at') === true,
            trackBy: archiveEnabled && enabledMap.get('app.archived_by') === true
        },
        delete: {
            mode: deleteEnabled ? 'soft' : 'hard',
            trackAt: deleteEnabled && enabledMap.get('app.deleted_at') === true,
            trackBy: deleteEnabled && enabledMap.get('app.deleted_by') === true
        }
    }
}

export const derivePlatformSystemFieldsContract = (states?: ObjectSystemFieldState[] | null): PlatformSystemFieldsContract => {
    const validationResult = validateObjectSystemFieldToggleSet(states)
    if (validationResult.errors.length > 0) {
        throw new Error(validationResult.errors.join('; '))
    }

    const enabledMap = new Map<ObjectSystemFieldKey, boolean>(validationResult.normalized.map((state) => [state.key, state.enabled]))
    const archiveEnabled = enabledMap.get('upl.archived') === true
    const deleteEnabled = enabledMap.get('upl.deleted') === true

    return {
        archive: {
            enabled: archiveEnabled,
            trackAt: archiveEnabled && enabledMap.get('upl.archived_at') === true,
            trackBy: archiveEnabled && enabledMap.get('upl.archived_by') === true
        },
        delete: {
            enabled: deleteEnabled,
            trackAt: deleteEnabled && enabledMap.get('upl.deleted_at') === true,
            trackBy: deleteEnabled && enabledMap.get('upl.deleted_by') === true
        }
    }
}

export const normalizeApplicationLifecycleContract = (
    contract?: ApplicationLifecycleContractInput | null
): ApplicationLifecycleContract => {
    const publishEnabled = contract?.publish?.enabled !== false
    const archiveEnabled = contract?.archive?.enabled !== false
    const deleteMode = contract?.delete?.mode === 'hard' ? 'hard' : 'soft'

    return {
        publish: {
            enabled: publishEnabled,
            trackAt: publishEnabled && contract?.publish?.trackAt !== false,
            trackBy: publishEnabled && contract?.publish?.trackBy !== false
        },
        archive: {
            enabled: archiveEnabled,
            trackAt: archiveEnabled && contract?.archive?.trackAt !== false,
            trackBy: archiveEnabled && contract?.archive?.trackBy !== false
        },
        delete: {
            mode: deleteMode,
            trackAt: deleteMode === 'soft' && contract?.delete?.trackAt !== false,
            trackBy: deleteMode === 'soft' && contract?.delete?.trackBy !== false
        }
    }
}

export const resolveApplicationLifecycleContractFromConfig = (config?: unknown): ApplicationLifecycleContract => {
    if (!config || typeof config !== 'object') {
        return normalizeApplicationLifecycleContract()
    }

    const rawSystemFields = (config as Record<string, unknown>).systemFields
    const rawContract =
        rawSystemFields && typeof rawSystemFields === 'object'
            ? (rawSystemFields as { lifecycleContract?: ApplicationLifecycleContractInput }).lifecycleContract
            : undefined

    return normalizeApplicationLifecycleContract(rawContract)
}

export const resolvePlatformSystemFieldsContractFromConfig = (config?: unknown): PlatformSystemFieldsContract => {
    if (!config || typeof config !== 'object') {
        return derivePlatformSystemFieldsContract()
    }

    const rawSystemFields = (config as Record<string, unknown>).systemFields
    const rawStates =
        rawSystemFields && typeof rawSystemFields === 'object'
            ? (rawSystemFields as { fields?: ObjectSystemFieldState[] }).fields
            : undefined

    return derivePlatformSystemFieldsContract(Array.isArray(rawStates) ? rawStates : undefined)
}
