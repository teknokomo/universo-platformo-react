export type FixtureNormalizerMaps = {
    uuid: Map<string, string>
    hash64: Map<string, string>
}

const createNormalizerMaps = (): FixtureNormalizerMaps => ({
    uuid: new Map(),
    hash64: new Map()
})

const volatileTimestampFields = new Set(['createdAt', 'updatedAt', 'publishedAt', 'generatedAt', 'exportedAt'])
const volatileUuidFields = new Set([
    'ArticleId',
    'BadgeId',
    'ContentNodeId',
    'ContentNodeIdRef',
    'CourseId',
    'EnrollmentClassId',
    'EnrollmentStatus',
    'EnrollmentStudentId',
    'FolderId',
    'ItemType',
    'LinkClassId',
    'PlanId',
    'ProgressStudentId',
    'ProjectId',
    'PublicationStatus',
    'QuestionType',
    'QuizId',
    'ReportType',
    'ResourceId',
    'ResourceType',
    'SectionId',
    'SourceObjectId',
    'SourceType',
    'SpaceId',
    'StageId',
    'Status',
    'StudentId',
    'TargetId',
    'TargetRecordId',
    'TierRef',
    'TrackId',
    'assetId',
    'attachedToId',
    'baseLayoutId',
    'baseWidgetId',
    'children',
    'controlledEntityId',
    'controlledObjectId',
    'defaultLayoutId',
    'defaultProjectId',
    'defaultSceneId',
    'hubs',
    'id',
    'layoutId',
    'metahubId',
    'objectCollectionId',
    'objectId',
    'parentComponentId',
    'parentWidgetId',
    'projectId',
    'sceneId',
    'scopeEntityId',
    'scriptAssetId',
    'sectionId',
    'sectionIds',
    'sharedEntityId',
    'sourceId',
    'startPage',
    'targetEntityId',
    'targetObjectId'
])
const uuidTextPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const uuidSubstringPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu
const physicalTableNamePattern = /^(obj|enum|set)_([0-9a-f]{32})$/iu
const generatedEditorAssetIdPattern = /^editor-[0-9a-f]{32}$/iu
const generatedSceneAssetIdPattern = /^scene:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/iu

const expandCompactUuid = (value: string): string =>
    `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`

const tokenFor = (map: Map<string, string>, value: string, prefix: string): string => {
    const existing = map.get(value)
    if (existing) return existing
    const token = `<${prefix}:${map.size + 1}>`
    map.set(value, token)
    return token
}

const normalizeString = (value: string, maps: FixtureNormalizerMaps, pathSegments: string[]): string => {
    const fieldName = [...pathSegments].reverse().find((segment) => !/^\d+$/u.test(segment))
    const pathEndsWith = (...segments: string[]): boolean =>
        segments.every((segment, index) => pathSegments.at(index - segments.length) === segment)
    if (fieldName === 'snapshotHash' && /^[0-9a-f]{64}$/i.test(value)) {
        return tokenFor(maps.hash64, value.toLowerCase(), 'snapshot-hash')
    }
    if (pathEndsWith('sourceStorage', 'lastCompileAt') && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
        return '<timestamp>'
    }
    if (pathEndsWith('runtimeManifest', 'checksum') && /^[0-9a-f]{64}$/iu.test(value)) {
        return '<runtime-manifest-checksum>'
    }
    if (
        fieldName === 'checksum' &&
        pathSegments.at(-3) === 'runtimeManifests' &&
        pathSegments.includes('playcanvasProjects') &&
        /^[0-9a-f]{64}$/iu.test(value)
    ) {
        return '<playcanvas-runtime-manifest-checksum>'
    }
    if (
        fieldName === 'sourceProjectChecksum' &&
        pathSegments.at(-2) === 'metadata' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('runtimeManifests') &&
        /^[0-9a-f]{64}$/iu.test(value)
    ) {
        return '<playcanvas-source-project-checksum>'
    }
    if (
        (fieldName === 'id' || fieldName === 'name') &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('runtimeManifests') &&
        pathSegments.includes('assets')
    ) {
        const sceneAssetMatch = generatedSceneAssetIdPattern.exec(value)
        if (sceneAssetMatch) return `scene:${tokenFor(maps.uuid, sceneAssetMatch[1].toLowerCase(), 'uuid')}`
    }
    if (
        fieldName === 'id' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('runtimeManifests') &&
        pathSegments.includes('assets') &&
        generatedEditorAssetIdPattern.test(value)
    ) {
        return '<editor-asset-id>'
    }
    if (
        fieldName === 'sceneEntityStableId' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('runtimeManifests') &&
        pathSegments.includes('scripts') &&
        uuidTextPattern.test(value)
    ) {
        return tokenFor(maps.uuid, value.toLowerCase(), 'uuid')
    }
    if (
        fieldName === 'sceneEntityStableId' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('sceneScriptBindings') &&
        uuidTextPattern.test(value)
    ) {
        return tokenFor(maps.uuid, value.toLowerCase(), 'uuid')
    }
    if (
        fieldName === 'checksum' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('scenes') &&
        /^[0-9a-f]{64}$/iu.test(value)
    ) {
        return '<playcanvas-scene-checksum>'
    }
    if (
        fieldName === 'hash' &&
        pathSegments.at(-2) === 'payloadFile' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('scenes') &&
        /^[0-9a-f]{64}$/iu.test(value)
    ) {
        return '<playcanvas-scene-payload-hash>'
    }
    if (
        fieldName === 'snapshotContentBase64' &&
        pathSegments.at(-2) === 'payloadFile' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('scenes')
    ) {
        return '<playcanvas-scene-payload-base64>'
    }
    if (
        fieldName === 'path' &&
        pathSegments.at(-2) === 'payloadFile' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('scenes')
    ) {
        return value.replace(uuidSubstringPattern, (uuid) => tokenFor(maps.uuid, uuid.toLowerCase(), 'uuid'))
    }
    if (fieldName === 'path' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('assets')) {
        return value.replace(uuidSubstringPattern, (uuid) => tokenFor(maps.uuid, uuid.toLowerCase(), 'uuid'))
    }
    if (fieldName === 'path' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('generatedArtifacts')) {
        return value.replace(uuidSubstringPattern, (uuid) => tokenFor(maps.uuid, uuid.toLowerCase(), 'uuid'))
    }
    if (
        fieldName === 'editorDocumentKey' &&
        pathSegments.at(-2) === 'metadata' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('assets')
    ) {
        return value.replace(uuidSubstringPattern, (uuid) => tokenFor(maps.uuid, uuid.toLowerCase(), 'uuid'))
    }
    if (fieldName === 'stableAssetId' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('assets')) {
        if (generatedEditorAssetIdPattern.test(value)) return '<editor-asset-id>'
    }
    if (fieldName && volatileTimestampFields.has(fieldName) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
        return '<timestamp>'
    }
    if (fieldName && volatileUuidFields.has(fieldName) && uuidTextPattern.test(value)) {
        return tokenFor(maps.uuid, value.toLowerCase(), 'uuid')
    }
    if (fieldName === 'instanceKey' && pathSegments.includes('layoutZoneWidgets') && uuidTextPattern.test(value)) {
        return tokenFor(maps.uuid, value.toLowerCase(), 'uuid')
    }
    if (fieldName === 'tableName') {
        const tableNameMatch = physicalTableNamePattern.exec(value)
        if (tableNameMatch) {
            const [, prefix, compactUuid] = tableNameMatch
            return `${prefix.toLowerCase()}_${tokenFor(maps.uuid, expandCompactUuid(compactUuid.toLowerCase()), 'uuid')}`
        }
    }
    return value
}

const normalizeForUuidMapOrdering = (value: unknown, pathSegments: string[] = []): unknown => {
    const fieldName = [...pathSegments].reverse().find((segment) => !/^\d+$/u.test(segment))
    const pathEndsWith = (...segments: string[]): boolean =>
        segments.every((segment, index) => pathSegments.at(index - segments.length) === segment)
    if (typeof value === 'string') {
        if (uuidTextPattern.test(value)) return '<uuid>'
        if (fieldName === 'snapshotHash' && /^[0-9a-f]{64}$/iu.test(value)) return '<snapshot-hash>'
        if (pathEndsWith('sourceStorage', 'lastCompileAt') && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
            return '<timestamp>'
        }
        if (pathEndsWith('runtimeManifest', 'checksum') && /^[0-9a-f]{64}$/iu.test(value)) return '<runtime-manifest-checksum>'
        if (
            fieldName === 'checksum' &&
            pathSegments.at(-3) === 'runtimeManifests' &&
            pathSegments.includes('playcanvasProjects') &&
            /^[0-9a-f]{64}$/iu.test(value)
        ) {
            return '<playcanvas-runtime-manifest-checksum>'
        }
        if (
            fieldName === 'sourceProjectChecksum' &&
            pathSegments.at(-2) === 'metadata' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('runtimeManifests') &&
            /^[0-9a-f]{64}$/iu.test(value)
        ) {
            return '<playcanvas-source-project-checksum>'
        }
        if (
            (fieldName === 'id' || fieldName === 'name') &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('runtimeManifests') &&
            pathSegments.includes('assets') &&
            generatedSceneAssetIdPattern.test(value)
        ) {
            return 'scene:<uuid>'
        }
        if (
            fieldName === 'id' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('runtimeManifests') &&
            pathSegments.includes('assets') &&
            generatedEditorAssetIdPattern.test(value)
        ) {
            return '<editor-asset-id>'
        }
        if (
            fieldName === 'sceneEntityStableId' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('runtimeManifests') &&
            pathSegments.includes('scripts') &&
            uuidTextPattern.test(value)
        ) {
            return '<uuid>'
        }
        if (
            fieldName === 'sceneEntityStableId' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('sceneScriptBindings') &&
            uuidTextPattern.test(value)
        ) {
            return '<uuid>'
        }
        if (
            fieldName === 'checksum' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('scenes') &&
            /^[0-9a-f]{64}$/iu.test(value)
        ) {
            return '<playcanvas-scene-checksum>'
        }
        if (
            fieldName === 'hash' &&
            pathSegments.at(-2) === 'payloadFile' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('scenes') &&
            /^[0-9a-f]{64}$/iu.test(value)
        ) {
            return '<playcanvas-scene-payload-hash>'
        }
        if (
            fieldName === 'snapshotContentBase64' &&
            pathSegments.at(-2) === 'payloadFile' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('scenes')
        ) {
            return '<playcanvas-scene-payload-base64>'
        }
        if (
            fieldName === 'path' &&
            pathSegments.at(-2) === 'payloadFile' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('scenes')
        ) {
            return value.replace(uuidSubstringPattern, '<uuid>')
        }
        if (fieldName === 'path' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('assets')) {
            return value.replace(uuidSubstringPattern, '<uuid>')
        }
        if (fieldName === 'path' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('generatedArtifacts')) {
            return value.replace(uuidSubstringPattern, '<uuid>')
        }
        if (
            fieldName === 'editorDocumentKey' &&
            pathSegments.at(-2) === 'metadata' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('assets')
        ) {
            return value.replace(uuidSubstringPattern, '<uuid>')
        }
        if (fieldName === 'stableAssetId' && pathSegments.includes('playcanvasProjects') && pathSegments.includes('assets')) {
            if (generatedEditorAssetIdPattern.test(value)) return '<editor-asset-id>'
        }
        if (fieldName && volatileTimestampFields.has(fieldName) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
            return '<timestamp>'
        }
        if (fieldName === 'tableName') {
            const tableNameMatch = physicalTableNamePattern.exec(value)
            if (tableNameMatch) return `${tableNameMatch[1].toLowerCase()}_<uuid>`
        }
        return value
    }
    if (
        typeof value === 'number' &&
        pathSegments.at(-2) === 'metadata' &&
        pathSegments.at(-1) === 'editorDocumentId' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('assets')
    ) {
        return '<editor-document-id>'
    }
    if (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1_700_000_000_000 &&
        ((fieldName !== undefined && volatileTimestampFields.has(fieldName)) ||
            (pathSegments.at(-3) === 'blockContent' && pathSegments.at(-2) === 'data' && pathSegments.at(-1) === 'time'))
    ) {
        return '<numeric-timestamp>'
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeForUuidMapOrdering(item, [...pathSegments, String(index)]))
    }
    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>)
            .map(([key, item]) => [
                uuidTextPattern.test(key) ? '<uuid-key>' : key,
                normalizeForUuidMapOrdering(item, [...pathSegments, key])
            ])
            .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
                const keyOrder = String(leftKey).localeCompare(String(rightKey))
                if (keyOrder !== 0) return keyOrder
                return JSON.stringify(leftValue).localeCompare(JSON.stringify(rightValue))
            })
    }
    return value
}

const uuidMapEntrySortKey = (value: unknown): string => JSON.stringify(normalizeForUuidMapOrdering(value))

/** Normalize only known transport-volatile identifiers and timestamps. */
export const normalizeSnapshotFixtureVolatileValues = (
    value: unknown,
    maps = createNormalizerMaps(),
    pathSegments: string[] = []
): unknown => {
    const fieldName = [...pathSegments].reverse().find((segment) => !/^\d+$/u.test(segment))
    if (
        typeof value === 'number' &&
        pathSegments.at(-2) === 'metadata' &&
        pathSegments.at(-1) === 'editorDocumentId' &&
        pathSegments.includes('playcanvasProjects') &&
        pathSegments.includes('assets')
    ) {
        return '<editor-document-id>'
    }
    if (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1_700_000_000_000 &&
        ((fieldName !== undefined && volatileTimestampFields.has(fieldName)) ||
            (pathSegments.at(-3) === 'blockContent' && pathSegments.at(-2) === 'data' && pathSegments.at(-1) === 'time'))
    ) {
        return '<numeric-timestamp>'
    }
    if (typeof value === 'string') return normalizeString(value, maps, pathSegments)
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeSnapshotFixtureVolatileValues(item, maps, [...pathSegments, String(index)]))
    }
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>
        if (
            record.type === 'scene' &&
            pathSegments.at(-2) === 'assets' &&
            pathSegments.includes('playcanvasProjects') &&
            pathSegments.includes('runtimeManifests')
        ) {
            return Object.fromEntries(
                Object.entries(record)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([key, item]) => {
                        if (key === 'hash' && typeof item === 'string' && /^[0-9a-f]{64}$/iu.test(item)) {
                            return [key, '<playcanvas-runtime-scene-hash>']
                        }
                        if (key === 'url' && typeof item === 'string' && item.startsWith('data:application/json;base64,')) {
                            return [key, '<playcanvas-runtime-scene-url>']
                        }
                        return [key, normalizeSnapshotFixtureVolatileValues(item, maps, [...pathSegments, key])]
                    })
            )
        }
        const entries = Object.entries(value as Record<string, unknown>)
        if (entries.length > 0 && entries.every(([key]) => uuidTextPattern.test(key))) {
            return Object.fromEntries(
                entries
                    .map(([key, item], index) => ({ key, item, index, sortKey: uuidMapEntrySortKey(item) }))
                    .sort((left, right) => left.sortKey.localeCompare(right.sortKey) || left.index - right.index)
                    .map(({ key, item }, index) => [
                        `<uuid-key:${index + 1}>`,
                        normalizeSnapshotFixtureVolatileValues(item, maps, [...pathSegments, key])
                    ])
            )
        }
        return Object.fromEntries(
            entries
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, normalizeSnapshotFixtureVolatileValues(item, maps, [...pathSegments, key])])
        )
    }
    return value
}

export const stableSnapshotFixtureStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(stableSnapshotFixtureStringify).join(',')}]`
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSnapshotFixtureStringify(record[key])}`)
        .join(',')}}`
}

const summarize = (value: unknown): string => {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? 'undefined' : serialized.slice(0, 240)
}

export const findFirstSnapshotFixtureDifference = (tracked: unknown, generated: unknown, pathLabel = '$'): string | null => {
    if (Object.is(tracked, generated)) return null
    if (typeof tracked !== typeof generated || tracked === null || generated === null || typeof tracked !== 'object') {
        if (tracked === generated) return null
        return `${pathLabel}\nTracked: ${summarize(tracked)}\nGenerated: ${summarize(generated)}`
    }
    if (Array.isArray(tracked) || Array.isArray(generated)) {
        if (!Array.isArray(tracked) || !Array.isArray(generated)) {
            return `${pathLabel}\nTracked: ${summarize(tracked)}\nGenerated: ${summarize(generated)}`
        }
        if (tracked.length !== generated.length) {
            return `${pathLabel}.length\nTracked: ${tracked.length}\nGenerated: ${generated.length}`
        }
        for (const [index, value] of tracked.entries()) {
            const difference = findFirstSnapshotFixtureDifference(value, generated[index], `${pathLabel}[${index}]`)
            if (difference) return difference
        }
        return null
    }

    const trackedRecord = tracked as Record<string, unknown>
    const generatedRecord = generated as Record<string, unknown>
    const keys = [...new Set([...Object.keys(trackedRecord), ...Object.keys(generatedRecord)])].sort()
    for (const key of keys) {
        if (!(key in trackedRecord) || !(key in generatedRecord)) {
            return `${pathLabel}.${key}\nTracked: ${summarize(trackedRecord[key])}\nGenerated: ${summarize(generatedRecord[key])}`
        }
        const difference = findFirstSnapshotFixtureDifference(trackedRecord[key], generatedRecord[key], `${pathLabel}.${key}`)
        if (difference) return difference
    }
    return null
}
