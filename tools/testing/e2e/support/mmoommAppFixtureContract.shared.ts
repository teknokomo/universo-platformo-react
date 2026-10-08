import { createHash } from 'node:crypto'

export const MMOOMM_APP_FIXTURE_FILENAME = 'metahubs-mmoomm-app-snapshot.json'

export const MMOOMM_APP_CANONICAL_METAHUB = {
    name: {
        en: 'Universo MMOOMM',
        ru: 'Universo MMOOMM'
    },
    description: {
        en: 'Browser-authored MMOOMM metahub with PlayCanvas Editor authoring data and Colyseus runtime.',
        ru: 'Созданный через браузер метахаб MMOOMM с данными PlayCanvas Editor и runtime Colyseus.'
    },
    codename: {
        en: 'UniversoMmoomm',
        ru: 'UniversoMmoomm'
    }
} as const

export const MMOOMM_APP_PACKAGES = [
    {
        packageName: '@universo-react/playcanvas-editor-frontend',
        version: '0.1.0',
        target: null,
        upstreamVersion: 'v2.30.4-vendor'
    },
    { packageName: '@universo-react/playcanvas-engine', version: '0.1.0', target: 'client', upstreamVersion: '2.21.4' },
    { packageName: '@universo-react/colyseus-client', version: '0.1.0', target: 'client', upstreamVersion: '0.17.43' },
    { packageName: '@universo-react/colyseus-server', version: '0.1.0', target: 'server', upstreamVersion: '0.17.50' }
] as const

export const MMOOMM_AUTHORING_PROJECT_NAME = 'MMOOMM Authoring'

export const MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME = 'MMOOMM Visual Linkup Lab'

export const MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY = 'visualLab'

export const MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT = 16

export const MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES = ['ship', 'station', 'rockAsteroid', 'iceAsteroid'] as const

export const MMOOMM_VISUAL_LINKUP_LAB_FOG_COLOR = [0.045, 0.055, 0.08] as const

export const MMOOMM_VISUAL_LINKUP_LAB_FOG_DENSITY = 0.014

export const MMOOMM_SPACE_SECTION_CODENAME = 'FlightWorld'

export const MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME = 'VisualLinkupLab'

export type SnapshotEnvelope = Record<string, unknown> & {
    metahub?: { name?: unknown; description?: unknown; codename?: unknown }
    snapshot?: {
        packages?: unknown[]
        entities?: Record<string, { kind?: unknown; codename?: unknown; presentation?: { name?: unknown }; config?: unknown }>
        fixedValues?: Record<string, Array<{ codename?: unknown; dataType?: unknown; value?: unknown }>>
        optionValues?: Record<string, Array<{ codename?: unknown; isDefault?: unknown }>>
        modules?: unknown[]
        layouts?: unknown[]
        scopedLayouts?: unknown[]
        layoutZoneWidgets?: unknown[]
        defaultLayoutId?: unknown
        layoutConfig?: Record<string, unknown>
    } & Record<string, unknown>
    snapshotHash?: string
}

export type PlayCanvasProjectSnapshot = {
    projects?: Array<{ id?: unknown; displayName?: unknown; codename?: unknown; defaultSceneId?: unknown }>
    scenes?: Array<{
        id?: unknown
        projectId?: unknown
        payload?: {
            settings?: {
                render?: Record<string, unknown>
            }
            assets?: Array<{
                id?: unknown
                type?: unknown
                metadata?: Record<string, unknown>
            }>
            entities?: Array<{
                id?: unknown
                name?: unknown
                children?: unknown
                position?: unknown
                rotation?: unknown
                scale?: unknown
                components?: unknown
            }>
            metadata?: Record<string, unknown>
        }
        payloadFile?: {
            snapshotContentBase64?: unknown
        }
    }>
    sourceFiles?: unknown[]
    assets?: Array<{ id?: unknown; projectId?: unknown; type?: unknown; name?: unknown }>
    generatedArtifacts?: unknown[]
    scriptAssets?: unknown[]
    sceneScriptBindings?: unknown[]
    runtimeManifests?: Array<{
        projectId?: unknown
        sceneId?: unknown
        checksum?: unknown
        metadata?: Record<string, unknown>
        scripts?: Array<Record<string, unknown>>
    }>
}

export type PlayCanvasSceneEntitySnapshot = NonNullable<NonNullable<PlayCanvasProjectSnapshot['scenes']>[number]['payload']> extends {
    entities?: Array<infer Entity>
}
    ? Entity
    : never

export const readCodenameText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = record._primary ?? 'en'
    const content = record.locales?.[primary]?.content
    return typeof content === 'string' ? content : ''
}

export const readLocalizedText = (value: unknown, locale: 'en' | 'ru'): string => {
    if (typeof value === 'string') return locale === 'en' ? value : ''
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    const directValue = record[locale]
    if (typeof directValue === 'string') return directValue.trim()
    const locales = record.locales
    if (!locales || typeof locales !== 'object' || Array.isArray(locales)) return ''
    const localizedValue = (locales as Record<string, unknown>)[locale]
    if (!localizedValue || typeof localizedValue !== 'object' || Array.isArray(localizedValue)) return ''
    const content = (localizedValue as Record<string, unknown>).content
    return typeof content === 'string' ? content.trim() : ''
}

export const readPrimaryText = (value: unknown): string => readLocalizedText(value, 'en') || readCodenameText(value)

export const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`
    }
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`
}

export const readScenePayloadFilePayload = (
    scene: NonNullable<PlayCanvasProjectSnapshot['scenes']>[number],
    projectName: string
): Record<string, unknown> | null => {
    const encoded = scene.payloadFile?.snapshotContentBase64
    if (typeof encoded !== 'string' || encoded.length === 0) {
        return null
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as unknown
    } catch {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} must include valid bundled scene payload JSON`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} bundled scene payload must be an object`)
    }
    return parsed as Record<string, unknown>
}

export const isVector3Tuple = (value: unknown): value is [number, number, number] =>
    Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))

export const isUuidV4 = (value: unknown): boolean =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const assertUniqueStrings = (values: unknown[], label: string): void => {
    const strings = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    const seen = new Set<string>()
    for (const value of strings) {
        if (seen.has(value)) {
            throw new Error(`MMOOMM app fixture ${label} must be unique: ${value}`)
        }
        seen.add(value)
    }
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i

const STRICT_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export const requireNonEmptyString = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
        throw new Error(`MMOOMM app fixture ${label} must be a non-empty trimmed string`)
    }
    return value
}

export const requireSha256 = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
        throw new Error(`MMOOMM app fixture ${label} must carry a sha-256 hash`)
    }
    return value.toLowerCase()
}

export const decodeBase64 = (value: unknown, label: string): Buffer => {
    if (typeof value !== 'string' || value.length === 0 || !STRICT_BASE64_PATTERN.test(value)) {
        throw new Error(`MMOOMM app fixture ${label} must carry valid base64 content`)
    }
    const decoded = Buffer.from(value, 'base64')
    if (decoded.length === 0 || decoded.toString('base64') !== value) {
        throw new Error(`MMOOMM app fixture ${label} must carry canonical non-empty base64 content`)
    }
    return decoded
}

export const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex')

export const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`MMOOMM app fixture ${label} must be an object`)
    }
    return value as Record<string, unknown>
}

export const readVector3 = (value: unknown): { x: number; y: number; z: number } | null => {
    if (isVector3Tuple(value)) {
        return { x: value[0], y: value[1], z: value[2] }
    }
    if (!value || typeof value !== 'object') {
        return null
    }
    const candidate = value as { x?: unknown; y?: unknown; z?: unknown }
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)
        ? { x: candidate.x as number, y: candidate.y as number, z: candidate.z as number }
        : null
}

export const vectorDistance = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
