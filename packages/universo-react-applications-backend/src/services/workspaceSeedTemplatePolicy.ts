import { resolveAccessLinkIntakePolicy, type AccessLinkIntakePolicyResolution } from './guestAccessLinkIntakePolicy'
import { resolveTrustedServerOwnedSeedValue } from './trustedSeedValues'

export type WorkspaceSeedComponentMetadata = {
    objectId: string
    componentId: string
    parentComponentId: string | null
    codename: string
    columnName: string
    dataType: string
    isRequired?: boolean
    uiConfig: Record<string, unknown> | null
    validationRules: Record<string, unknown> | null
    targetObjectId: string | null
    targetObjectKind: string | null
}

type WorkspaceSeedObjectMetadata = {
    objectId: string
    codename: string
}

type ServerOwnedSeedFieldScope = 'workspace seed' | 'workspace child seed'

const normalizeSeedCodename = (value: string): string => value.trim().toLowerCase()

const getCaseInsensitiveRecordValue = (record: Record<string, unknown>, key: string): unknown => {
    const normalizedKey = normalizeSeedCodename(key)
    for (const [entryKey, entryValue] of Object.entries(record)) {
        if (normalizeSeedCodename(entryKey) === normalizedKey) return entryValue
    }
    return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Resolves one workspace seed row with the shared guest AccessLinks policy rules. */
export function resolveWorkspaceSeedIntakePolicy(input: {
    objectCodename: string
    components: WorkspaceSeedComponentMetadata[]
    row: Record<string, unknown>
    applyDefaults?: boolean
}): AccessLinkIntakePolicyResolution {
    return resolveAccessLinkIntakePolicy({
        objectCodename: input.objectCodename,
        fields: input.components.map((component) => ({
            codename: component.codename,
            columnName: component.columnName,
            dataType: component.dataType,
            defaultValue: component.uiConfig?.defaultValue
        })),
        row: input.row,
        applyDefaults: input.applyDefaults
    })
}

/** Applies trusted snapshot values and metadata defaults to server-owned seed fields. */
export function applyWorkspaceServerOwnedSeedValues(
    sourceData: Record<string, unknown>,
    components: WorkspaceSeedComponentMetadata[],
    fieldScope: ServerOwnedSeedFieldScope
): { seedData: Record<string, unknown>; serverOwnedComponents: WorkspaceSeedComponentMetadata[] } {
    const seedData = { ...sourceData }
    const serverOwnedComponents = components.filter((component) => component.uiConfig?.serverOwned === true)

    for (const component of serverOwnedComponents) {
        const normalizedCodename = normalizeSeedCodename(component.codename)
        const normalizedColumnName = normalizeSeedCodename(component.columnName)
        const hasSnapshotCodename = Object.keys(sourceData).some((key) => normalizeSeedCodename(key) === normalizedCodename)
        const hasSnapshotColumn = Object.keys(sourceData).some((key) => normalizeSeedCodename(key) === normalizedColumnName)
        const hasSnapshotValue = hasSnapshotCodename || hasSnapshotColumn
        const trustedSnapshotValue = hasSnapshotCodename
            ? getCaseInsensitiveRecordValue(sourceData, component.codename)
            : getCaseInsensitiveRecordValue(sourceData, component.columnName)

        for (const key of Object.keys(seedData)) {
            if (normalizeSeedCodename(key) === normalizedCodename || normalizeSeedCodename(key) === normalizedColumnName) {
                delete seedData[key]
            }
        }

        const seedValue = resolveTrustedServerOwnedSeedValue({
            hasTrustedValue: hasSnapshotValue,
            trustedValue: trustedSnapshotValue,
            hasMetadataDefault: Boolean(component.uiConfig && Object.prototype.hasOwnProperty.call(component.uiConfig, 'defaultValue')),
            metadataDefault: component.uiConfig?.defaultValue,
            resetOnCopy: component.uiConfig?.resetOnCopy === true
        })
        if (component.isRequired && (!seedValue.hasValue || seedValue.value === null || seedValue.value === undefined)) {
            throw new Error(`Required server-owned ${fieldScope} field has no trusted value: ${component.codename}`)
        }
        if (seedValue.hasValue) seedData[component.codename] = seedValue.value
    }

    return { seedData, serverOwnedComponents }
}

/** Validates and normalizes AccessLinks rows before their workspace seed template is persisted. */
export function normalizeWorkspaceSeedTemplateAccessLinks(
    elements: Record<string, unknown[]>,
    objects: WorkspaceSeedObjectMetadata[],
    components: WorkspaceSeedComponentMetadata[]
): Record<string, unknown[]> {
    const accessLinksObject = objects.find((object) => normalizeSeedCodename(object.codename) === 'accesslinks')
    const sourceRows = accessLinksObject ? elements[accessLinksObject.objectId] : undefined
    if (!accessLinksObject || !Array.isArray(sourceRows) || sourceRows.length === 0) return elements

    const accessLinkComponents = components.filter(
        (component) => component.objectId === accessLinksObject.objectId && component.parentComponentId === null
    )
    const normalizedRows = sourceRows.map((sourceRow) => {
        if (!isRecord(sourceRow) || typeof sourceRow.id !== 'string') return sourceRow

        const sourceData = isRecord(sourceRow.data) ? sourceRow.data : {}
        const { seedData } = applyWorkspaceServerOwnedSeedValues(sourceData, accessLinkComponents, 'workspace seed')
        const policy = resolveWorkspaceSeedIntakePolicy({
            objectCodename: accessLinksObject.codename,
            components: accessLinkComponents,
            row: seedData,
            applyDefaults: true
        })
        if (!policy.valid) throw new Error('Invalid guest access-link intake policy in workspace seed')

        const normalizedData = { ...seedData }
        for (const component of accessLinkComponents) {
            if (Object.prototype.hasOwnProperty.call(policy.valuesByColumn, component.columnName)) {
                normalizedData[component.codename] = policy.valuesByColumn[component.columnName]
            }
        }

        return { ...sourceRow, data: normalizedData }
    })

    return { ...elements, [accessLinksObject.objectId]: normalizedRows }
}
