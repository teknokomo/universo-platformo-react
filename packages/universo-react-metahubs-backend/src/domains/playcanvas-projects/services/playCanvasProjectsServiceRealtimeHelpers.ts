import { createHash } from 'node:crypto'
import type {
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilitySourceFileDocument,
    PlayCanvasEditorScenePayload,
    PlayCanvasProjectSummary,
    PlayCanvasScene
} from '@universo-react/types'
import { playCanvasEditorCompatibilitySettingsDocumentSchema } from '@universo-react/types'

import stableStringify from 'json-stable-stringify'
import { MetahubValidationError } from '../../shared/domainErrors'

import { normalizeEditorEntityComponents, readPlayCanvasEditorVector3Tuple } from './playCanvasProjectsServiceSceneHelpers'
import { STRICT_BASE64_PATTERN } from './playCanvasProjectsServiceCommon'
import type { CompatibilitySettingsKind } from './playCanvasProjectsServiceAssetHelpers'

export const createRealtimeRootEntity = (children: string[] = []): Record<string, unknown> => ({
    resource_id: 'root',
    name: 'Root',
    parent: null,
    enabled: true,
    components: {},
    children
})

export const normalizeRealtimeSceneEntities = (
    entities: PlayCanvasEditorScenePayload['entities'] = []
): Record<string, Record<string, unknown>> => {
    const normalized = new Map<string, Record<string, unknown>>()
    let rootId: string | null = null

    for (const entity of entities) {
        const isRoot = entity.id === 'root'
        if (isRoot) {
            rootId = entity.id
        }
        const position = readPlayCanvasEditorVector3Tuple(entity.position, isRoot ? [0, 0, 0] : undefined)
        const rotation = readPlayCanvasEditorVector3Tuple(entity.rotation, isRoot ? [0, 0, 0] : undefined)
        const scale = readPlayCanvasEditorVector3Tuple(entity.scale, isRoot ? [1, 1, 1] : undefined)
        const metadata =
            entity.metadata && typeof entity.metadata === 'object' && !Array.isArray(entity.metadata) ? entity.metadata : undefined
        normalized.set(entity.id, {
            resource_id: entity.id,
            name: entity.name ?? (isRoot ? 'Root' : 'Entity'),
            parent: entity.parentId ?? null,
            enabled: entity.enabled ?? true,
            ...(position ? { position } : {}),
            ...(rotation ? { rotation } : {}),
            ...(scale ? { scale } : {}),
            components: normalizeEditorEntityComponents(entity.components, entity),
            ...(metadata ? { metadata } : {}),
            children: Array.isArray(entity.children) ? entity.children : []
        })
    }

    if (!rootId) {
        rootId = 'root'
        normalized.set(rootId, createRealtimeRootEntity())
    }

    const hasParentCycle = (entityId: string, parentId: string): boolean => {
        const visited = new Set<string>([entityId])
        let current: string | null = parentId
        while (current) {
            if (visited.has(current)) return true
            visited.add(current)
            const parent = normalized.get(current)
            if (!parent) return false
            current = typeof parent.parent === 'string' ? parent.parent : null
        }
        return false
    }

    for (const [id, entity] of normalized) {
        if (id === rootId) {
            entity.parent = null
            continue
        }
        const parentId = typeof entity.parent === 'string' ? entity.parent : null
        if (!parentId || !normalized.has(parentId) || parentId === id || hasParentCycle(id, parentId)) {
            entity.parent = rootId
        }
    }

    const childrenByParent = new Map<string, string[]>()
    const appendChild = (parentId: string, childId: string): void => {
        const children = childrenByParent.get(parentId) ?? []
        if (!children.includes(childId)) {
            children.push(childId)
        }
        childrenByParent.set(parentId, children)
    }

    for (const [id, entity] of normalized) {
        const existingChildren = Array.isArray(entity.children) ? entity.children : []
        for (const childId of existingChildren) {
            if (typeof childId !== 'string' || childId === id || !normalized.has(childId)) continue
            if (normalized.get(childId)?.parent === id) {
                appendChild(id, childId)
            }
        }
    }

    for (const [id, entity] of normalized) {
        if (id === rootId) continue
        const parentId = typeof entity.parent === 'string' ? entity.parent : rootId
        appendChild(parentId, id)
    }

    for (const [id, entity] of normalized) {
        normalized.set(id, {
            ...entity,
            parent: id === rootId ? null : entity.parent,
            children: childrenByParent.get(id) ?? []
        })
    }

    return Object.fromEntries(normalized)
}

export const createDefaultRealtimeProjectSettingsDocument = (input: {
    documentId: string
    numericProjectId: number
}): Record<string, unknown> => ({
    id: input.documentId,
    project: input.numericProjectId,
    scripts: [],
    useLegacyScripts: false,
    engineV2: true,
    width: 1280,
    height: 720
})

export const normalizeRealtimeSettingsDocumentData = (
    documentId: string,
    data: Record<string, unknown>,
    input: { numericProjectId: number; numericUserId: number }
): Record<string, unknown> => {
    if (/^project_\d+$/.test(documentId)) {
        return {
            ...createDefaultRealtimeProjectSettingsDocument({ documentId, numericProjectId: input.numericProjectId }),
            ...data,
            scripts: Array.isArray(data.scripts) ? data.scripts : []
        }
    }

    return {
        id: documentId,
        userId: input.numericUserId,
        projectId: input.numericProjectId,
        ...data
    }
}

export const hashEditorCompatibilityReplayFingerprint = (value: unknown): string =>
    createHash('sha256')
        .update(stableStringify(value) ?? JSON.stringify(value))
        .digest('hex')

export const compatibilitySceneSaveSessionId = (input: { metahubId: string; projectId: string; sceneId: string; userId: string }): string =>
    `compatibility:${input.metahubId}:${input.projectId}:${input.sceneId}:${input.userId}`

export const compatibilitySettingsWriteSessionId = (input: {
    metahubId: string
    projectId: string
    kind: CompatibilitySettingsKind
    userId: string
}): string => `compatibility:${input.metahubId}:${input.projectId}:settings:${input.kind}:${input.userId}`

export const compatibilitySourceFileSessionId = (input: {
    metahubId: string
    projectId: string
    sourceFileId: string
    userId: string
}): string => `compatibility:${input.metahubId}:${input.projectId}:sourcefile:${input.sourceFileId}:${input.userId}`

export const isEditorCompatibilitySceneSaveResult = (
    value: unknown
): value is { scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null } => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    const scene = record.scene as Record<string, unknown> | undefined
    return (
        !!scene &&
        typeof scene === 'object' &&
        typeof scene.id === 'string' &&
        (record.payload === null || typeof record.payload === 'object') &&
        (record.checksum === null || typeof record.checksum === 'string')
    )
}

export const isEditorCompatibilitySettingsWriteResult = (value: unknown): value is PlayCanvasEditorCompatibilitySettingsDocument =>
    playCanvasEditorCompatibilitySettingsDocumentSchema.safeParse(value).success

export const isEditorCompatibilitySourceFileDocument = (value: unknown): value is PlayCanvasEditorCompatibilitySourceFileDocument => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return (
        typeof record.id === 'string' &&
        typeof record.path === 'string' &&
        typeof record.name === 'string' &&
        typeof record.content === 'string' &&
        typeof record.hash === 'string' &&
        typeof record.size === 'number' &&
        typeof record.mime === 'string' &&
        (record.updatedAt === null || typeof record.updatedAt === 'string')
    )
}

export const isEditorCompatibilitySourceFileDeleteResult = (value: unknown): value is { id: string; deleted: true } => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return typeof record.id === 'string' && record.deleted === true
}

export const slugifyProjectName = (value: string): string => {
    const normalized = value
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80)
    return normalized || 'playcanvas_project'
}

export const getPrimaryText = (value: PlayCanvasProjectSummary['displayName']): string => {
    const primary = value._primary
    const primaryValue = value.locales?.[primary]?.content
    if (typeof primaryValue === 'string' && primaryValue.trim()) return primaryValue.trim()
    const first = Object.values(value.locales ?? {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : 'PlayCanvas Project'
}

export const decodeStrictBase64 = (value: string): Buffer => {
    if (!STRICT_BASE64_PATTERN.test(value)) {
        throw new MetahubValidationError('PlayCanvas project file content must be canonical base64', {
            messageCode: 'playcanvas.files.base64.invalid'
        })
    }
    return Buffer.from(value, 'base64')
}
