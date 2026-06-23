import { readFile } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { PNG } from 'pngjs'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { expect } from '../fixtures/test'
import { expectNoPageHorizontalOverflow } from './browser/runtimeUx'
import {
    createPlayCanvasCompatibilityAuthHeaders,
    createSerializablePlayCanvasEditorEntity,
    expectPlayCanvasEditorCanvasPainted,
    expectPlayCanvasEditorFullscreenHost,
    expectPlayCanvasEditorIframeLoaded,
    fetchPlayCanvasEditorCompatibilityConfig,
    playCanvasEditorVisibleMenuItemXPath,
    readSerializedPlayCanvasEditorScene,
    saveSerializedPlayCanvasEditorSceneThroughCompatibilityRest,
    type PlayCanvasEditorAuthoredEntity
} from './playcanvasEditorAuthoring'

type PlayCanvasEditorMmoommAuthoredScene = {
    shipId: string
    stationId: string
}

type MmoommEditorRenderableEvidence = {
    exists: boolean
    enabled: boolean
    renderEnabled: boolean
    renderType: string | null
    meshInstances: number
    hasMeshInstances: boolean
    position: { x: number; y: number; z: number } | null
    diffuse: { r: number; g: number; b: number } | null
}

type MmoommEditorVisualMaterialEvidence = {
    exists: boolean
    meshInstances: number
    materialAppliedCount: number
    opacity: number | null
    blendType: number | string | null
    depthWrite: boolean | null
    useFog: boolean | null
    diffuse: { r: number; g: number; b: number } | null
    emissive: { r: number; g: number; b: number } | null
    emissiveIntensity: number | null
}

type MmoommEditorMaterialAssetRegistryEvidence = {
    id: number
    exists: boolean
    name: string | null
    type: string | null
    preload: boolean | null
    hasData: boolean
    diffuse: unknown
    opacity: number | null
    blendType: number | string | null
    depthWrite: boolean | null
    useFog: boolean | null
    metadataBlendType: string | null
}

type MmoommEditorMaterialAssetRegistrySummary = {
    materialCount: number
    hostedAssetAdapterInstalled: boolean
    hostedAssetObserverCount: number
    persistedAssetsLoadEmitted: boolean
    representativeAssets: MmoommEditorMaterialAssetRegistryEvidence[]
}

type MmoommEditorProjectionEvidence = {
    width: number
    height: number
    x: number
    y: number
    z: number
    visible: boolean
    bounds?: {
        minX: number
        minY: number
        maxX: number
        maxY: number
        visibleCornerCount: number
    }
}

type MmoommEditorMeshPixelEvidence = {
    pngWidth: number
    pngHeight: number
    sampleCount: number
    lightPixelCount: number
    foregroundPixelCount: number
    colorBuckets: number
    bounds: NonNullable<MmoommEditorProjectionEvidence['bounds']>
}

const MMOOMM_EDITOR_ENTITY_NAMES = ['MMOOMM Ship', 'MMOOMM Station'] as const
const MMOOMM_EDITOR_LIGHT_NAME = 'MMOOMM Key Light'
const MMOOMM_VISUAL_LINKUP_EDITOR_REPRESENTATIVE_ENTITY_NAMES = [
    ...Array.from({ length: 16 }, (_, index) => {
        const prefix = `Linkup Lab ${String(index + 1).padStart(2, '0')}`
        return [`${prefix} ship Core`, `${prefix} ship Glow`, `${prefix} station Core`, `${prefix} station Glow`]
    }).flat()
] as string[]
export const MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME = 'MMOOMM Visual Linkup Lab'
export const MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY = 'visualLab'

type LinkupObjectType = 'ship' | 'station' | 'rockAsteroid' | 'iceAsteroid'
type LinkupVariantFamily = 'softWhiteLinkup' | 'typeGlow' | 'lowPolyRetrowave' | 'channelDegradation'

type LinkupVariantConfig = {
    slug: string
    title: string
    family: LinkupVariantFamily
    fogDensity: number
    coreOpacity: number
    glowOpacity: number
    shellScale: number
    lowPolyBands?: number
}

type VisualLinkupMaterialEvidence = {
    role: 'core' | 'glow' | 'variantMarker'
    materialAssetId: number
    materialAssetName: string
    diffuse: [number, number, number]
    opacity: number
    emissive?: [number, number, number]
    emissiveIntensity?: number
    blendType: 'normal' | 'additive'
    depthWrite: boolean
    useFog: boolean
}

export const LINKUP_OBJECT_GLOW: Record<LinkupObjectType, [number, number, number]> = {
    ship: [0.15, 0.85, 1],
    station: [0.9, 0.25, 1],
    rockAsteroid: [1, 0.58, 0.18],
    iceAsteroid: [0.45, 0.8, 1]
}

const LINKUP_FAMILY_OBJECT_GLOW: Record<LinkupVariantFamily, Record<LinkupObjectType, [number, number, number]>> = {
    softWhiteLinkup: {
        ship: [0.82, 0.92, 1],
        station: [0.94, 0.88, 1],
        rockAsteroid: [1, 0.95, 0.82],
        iceAsteroid: [0.78, 0.9, 1]
    },
    typeGlow: {
        ship: [0, 0.95, 1],
        station: [1, 0.05, 0.9],
        rockAsteroid: [1, 0.75, 0.05],
        iceAsteroid: [0.2, 0.45, 1]
    },
    lowPolyRetrowave: {
        ship: [0.1, 1, 0.7],
        station: [1, 0.15, 0.85],
        rockAsteroid: [1, 0.36, 0.06],
        iceAsteroid: [0.45, 0.15, 1]
    },
    channelDegradation: {
        ship: [0.45, 1, 0.22],
        station: [1, 0.18, 0.12],
        rockAsteroid: [0.95, 0.8, 0.18],
        iceAsteroid: [0.25, 0.6, 0.45]
    }
}

const LINKUP_SCENE_FOG = { type: 'exp2', color: [0.045, 0.055, 0.08], density: 0.014 } as const
const LINKUP_EDITOR_CAMERA_CLEAR_COLOR = [0.026, 0.034, 0.052, 1] as const
const LINKUP_GLOBAL_AMBIENT = [0.46, 0.48, 0.56] as const
const LINKUP_EDITOR_MATERIAL_BASE_ID = 920_000_000

const LINKUP_OBJECT_GEOMETRY: Record<LinkupObjectType, { primitive: 'box' | 'sphere'; scale: [number, number, number] }> = {
    ship: { primitive: 'box', scale: [5, 1.5, 1.2] },
    station: { primitive: 'box', scale: [3.6, 3.6, 2.8] },
    rockAsteroid: { primitive: 'sphere', scale: [2.2, 1.7, 2] },
    iceAsteroid: { primitive: 'sphere', scale: [1.8, 1.8, 1.8] }
}

export const LINKUP_VARIANTS = [
    {
        slug: 'white-link-halo',
        title: 'White Link Halo',
        family: 'softWhiteLinkup',
        fogDensity: 0.018,
        coreOpacity: 0.68,
        glowOpacity: 0.12,
        shellScale: 1.06
    },
    {
        slug: 'mist-core',
        title: 'Dense Mist',
        family: 'softWhiteLinkup',
        fogDensity: 0.026,
        coreOpacity: 0.54,
        glowOpacity: 0.1,
        shellScale: 1.08
    },
    {
        slug: 'soft-station-read',
        title: 'Soft Station Read',
        family: 'softWhiteLinkup',
        fogDensity: 0.022,
        coreOpacity: 0.6,
        glowOpacity: 0.14,
        shellScale: 1.07
    },
    {
        slug: 'near-white-core',
        title: 'Near White',
        family: 'softWhiteLinkup',
        fogDensity: 0.03,
        coreOpacity: 0.48,
        glowOpacity: 0.1,
        shellScale: 1.05
    },
    {
        slug: 'cyan-magenta',
        title: 'Cyan Magenta',
        family: 'typeGlow',
        fogDensity: 0.018,
        coreOpacity: 0.62,
        glowOpacity: 0.2,
        shellScale: 1.1
    },
    { slug: 'amber-ice', title: 'Amber Ice', family: 'typeGlow', fogDensity: 0.02, coreOpacity: 0.58, glowOpacity: 0.18, shellScale: 1.12 },
    {
        slug: 'classification-minimal',
        title: 'Classification Minimal',
        family: 'typeGlow',
        fogDensity: 0.024,
        coreOpacity: 0.66,
        glowOpacity: 0.12,
        shellScale: 1.06
    },
    {
        slug: 'classification-strong',
        title: 'Classification Strong',
        family: 'typeGlow',
        fogDensity: 0.022,
        coreOpacity: 0.62,
        glowOpacity: 0.24,
        shellScale: 1.14
    },
    {
        slug: 'lowpoly-clean',
        title: 'Lowpoly Clean',
        family: 'lowPolyRetrowave',
        fogDensity: 0.016,
        coreOpacity: 0.7,
        glowOpacity: 0.12,
        shellScale: 1.05,
        lowPolyBands: 10
    },
    {
        slug: 'lowpoly-radar',
        title: 'Lowpoly Radar',
        family: 'lowPolyRetrowave',
        fogDensity: 0.02,
        coreOpacity: 0.65,
        glowOpacity: 0.16,
        shellScale: 1.07,
        lowPolyBands: 8
    },
    {
        slug: 'retrowave-soft',
        title: 'Retrowave Soft',
        family: 'lowPolyRetrowave',
        fogDensity: 0.022,
        coreOpacity: 0.6,
        glowOpacity: 0.2,
        shellScale: 1.09,
        lowPolyBands: 8
    },
    {
        slug: 'retrowave-aggressive',
        title: 'Retrowave Aggressive',
        family: 'lowPolyRetrowave',
        fogDensity: 0.018,
        coreOpacity: 0.58,
        glowOpacity: 0.28,
        shellScale: 1.16,
        lowPolyBands: 6
    },
    {
        slug: 'linkup-boot',
        title: 'Linkup Boot',
        family: 'channelDegradation',
        fogDensity: 0.028,
        coreOpacity: 0.5,
        glowOpacity: 0.11,
        shellScale: 1.08
    },
    {
        slug: 'sensor-dropout',
        title: 'Sensor Dropout',
        family: 'channelDegradation',
        fogDensity: 0.034,
        coreOpacity: 0.45,
        glowOpacity: 0.14,
        shellScale: 1.1
    },
    {
        slug: 'dense-fog-relay',
        title: 'Dense Fog Relay',
        family: 'channelDegradation',
        fogDensity: 0.042,
        coreOpacity: 0.42,
        glowOpacity: 0.18,
        shellScale: 1.12
    },
    {
        slug: 'near-whiteout',
        title: 'Near Whiteout',
        family: 'channelDegradation',
        fogDensity: 0.052,
        coreOpacity: 0.36,
        glowOpacity: 0.22,
        shellScale: 1.15
    }
] satisfies readonly LinkupVariantConfig[]

export const LINKUP_OBJECT_TYPES = Object.keys(LINKUP_OBJECT_GLOW) as LinkupObjectType[]

type PlayCanvasEditorSerializedEntity = {
    id?: unknown
    name?: unknown
    components?: unknown
    children?: unknown
}

const isEmptyDefaultPlayCanvasEditorEntity = (entity: PlayCanvasEditorSerializedEntity | null | undefined): boolean => {
    if (!entity) return false
    const components =
        entity.components && typeof entity.components === 'object' && !Array.isArray(entity.components)
            ? (entity.components as Record<string, unknown>)
            : {}
    const children = Array.isArray(entity.children) ? entity.children : []
    return entity.id !== 'root' && entity.name === 'New Entity' && Object.keys(components).length === 0 && children.length === 0
}

const toPngCoordinate = (value: number, sourceSize: number, targetSize: number) => {
    if (sourceSize <= 0 || targetSize <= 0) return 0
    return Math.max(0, Math.min(targetSize - 1, Math.round((value / sourceSize) * (targetSize - 1))))
}

const readMeshPixelsFromCanvasScreenshot = (
    screenshot: Buffer,
    projection: MmoommEditorProjectionEvidence,
    label: string
): MmoommEditorMeshPixelEvidence => {
    if (!projection.bounds) {
        throw new Error(`${label} projection bounds are not available`)
    }

    const png = PNG.sync.read(screenshot)
    const x1 = toPngCoordinate(projection.bounds.minX, projection.width, png.width)
    const x2 = toPngCoordinate(projection.bounds.maxX, projection.width, png.width)
    const y1 = toPngCoordinate(projection.bounds.minY, projection.height, png.height)
    const y2 = toPngCoordinate(projection.bounds.maxY, projection.height, png.height)
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)
    const width = Math.max(1, maxX - minX + 1)
    const height = Math.max(1, maxY - minY + 1)
    const sampleStepX = Math.max(1, Math.floor(width / 18))
    const sampleStepY = Math.max(1, Math.floor(height / 18))
    const buckets = new Set<string>()
    let sampleCount = 0
    let lightPixelCount = 0
    let foregroundPixelCount = 0

    for (let y = minY; y <= maxY; y += sampleStepY) {
        for (let x = minX; x <= maxX; x += sampleStepX) {
            const index = (y * png.width + x) * 4
            const alpha = png.data[index + 3] ?? 0
            if (alpha < 16) continue
            const red = png.data[index] ?? 0
            const green = png.data[index + 1] ?? 0
            const blue = png.data[index + 2] ?? 0
            const maxChannel = Math.max(red, green, blue)
            const minChannel = Math.min(red, green, blue)
            const chroma = maxChannel - minChannel
            sampleCount += 1
            buckets.add(`${Math.floor(red / 24)}:${Math.floor(green / 24)}:${Math.floor(blue / 24)}`)
            if (red >= 105 && green >= 105 && blue >= 105) {
                lightPixelCount += 1
            }
            if ((red >= 90 && green >= 90 && blue >= 90) || (maxChannel >= 68 && chroma >= 22)) {
                foregroundPixelCount += 1
            }
        }
    }

    return {
        pngWidth: png.width,
        pngHeight: png.height,
        sampleCount,
        lightPixelCount,
        foregroundPixelCount,
        colorBuckets: buckets.size,
        bounds: projection.bounds
    }
}

const expectMmoommEditorEntityInspectable = async (page: Page, entityName: string, label: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const hierarchy = editorFrame.locator('#layout-hierarchy .entities-treeview')
    const entityRow = hierarchy
        .locator('.pcui-treeview-item', { has: editorFrame.locator('.pcui-treeview-item-text', { hasText: entityName }) })
        .last()
    const entityRowContents = entityRow.locator('> .pcui-treeview-item-contents')
    const attributesPanel = editorFrame.locator('#layout-attributes')

    await expect(entityRowContents, `${label} hierarchy row must be visible`).toBeVisible()
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_, expectedName) => {
                    const editor = (
                        window as unknown as {
                            editor?: {
                                call?: (method: string, ...args: unknown[]) => unknown
                            }
                        }
                    ).editor
                    const toObserverArray = (value: unknown): Array<{ get?: (path: string) => unknown }> => {
                        if (Array.isArray(value)) return value as Array<{ get?: (path: string) => unknown }>
                        const list = value as { array?: () => unknown[] } | null | undefined
                        if (typeof list?.array !== 'function') return []
                        const items = list.array()
                        return Array.isArray(items) ? (items as Array<{ get?: (path: string) => unknown }>) : []
                    }
                    const observers = [
                        ...toObserverArray(editor?.call?.('entities:list')),
                        ...toObserverArray(editor?.call?.('entities:raw'))
                    ]
                    const observer = observers.find((candidate) => candidate?.get?.('name') === expectedName)
                    const app = editor?.call?.('viewport:app') as
                        | {
                              root?: {
                                  findByName?: (name: string) => {
                                      render?: { type?: string; meshInstances?: unknown[] }
                                  } | null
                              }
                          }
                        | null
                        | undefined
                    const entity = app?.root?.findByName?.(String(expectedName))
                    return {
                        hasObserverRender: observer?.get?.('components.render.type') === 'box',
                        hasEngineRender:
                            entity?.render?.type === 'box' &&
                            Array.isArray(entity.render.meshInstances) &&
                            entity.render.meshInstances.length > 0
                    }
                }, entityName),
            { timeout: 20_000 }
        )
        .toEqual({ hasObserverRender: true, hasEngineRender: true })
    await entityRowContents.click()
    await expect(attributesPanel, `${label} attributes panel must be visible`).toBeVisible()
    await expect
        .poll(
            () =>
                attributesPanel.evaluate((panel, expectedName) => {
                    const inputValues = Array.from(panel.querySelectorAll('input')).map((input) => input.value)
                    const text = panel.textContent ?? ''
                    const hasBoxInput = inputValues.some((value) => /\bbox\b/i.test(value))
                    const editor = (
                        window as unknown as {
                            editor?: { call?: (method: string, ...args: unknown[]) => unknown }
                        }
                    ).editor
                    const toObserverArray = (value: unknown): Array<{ get?: (path: string) => unknown }> => {
                        if (Array.isArray(value)) return value as Array<{ get?: (path: string) => unknown }>
                        const list = value as { array?: () => unknown[] } | null | undefined
                        if (typeof list?.array !== 'function') return []
                        const items = list.array()
                        return Array.isArray(items) ? (items as Array<{ get?: (path: string) => unknown }>) : []
                    }
                    const observer = [
                        ...toObserverArray(editor?.call?.('entities:list')),
                        ...toObserverArray(editor?.call?.('entities:raw'))
                    ].find((candidate) => candidate?.get?.('name') === expectedName)
                    const hasObserverRender = observer?.get?.('components.render.type') === 'box'
                    return {
                        hasEntityName: inputValues.includes(String(expectedName)),
                        hasRender: /\bRender\b/i.test(text) || hasBoxInput || hasObserverRender,
                        hasBox: /\bBox\b/i.test(text) || hasBoxInput || hasObserverRender
                    }
                }, entityName),
            { timeout: 20_000 }
        )
        .toEqual({
            hasEntityName: true,
            hasRender: true,
            hasBox: true
        })
}

const readMmoommEditorRenderableEvidence = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate((_, entityNames) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const app = editor?.call?.('viewport:app') as
            | {
                  root?: {
                      findByName?: (name: string) => {
                          enabled?: boolean
                          getPosition?: () => { x?: number; y?: number; z?: number }
                          render?: { enabled?: boolean; meshInstances?: unknown[]; type?: string }
                      } | null
                  }
              }
            | null
            | undefined
        const readRenderable = (name: string): MmoommEditorRenderableEvidence => {
            const entity = app?.root?.findByName?.(name)
            const meshInstances = Array.isArray(entity?.render?.meshInstances) ? entity.render.meshInstances.length : 0
            const firstMaterial = Array.isArray(entity?.render?.meshInstances)
                ? (entity.render.meshInstances[0] as { material?: { diffuse?: { r?: number; g?: number; b?: number } } } | undefined)
                      ?.material
                : undefined
            const diffuse = firstMaterial?.diffuse
            const position = entity?.getPosition?.()
            return {
                exists: Boolean(entity),
                enabled: entity?.enabled !== false,
                renderEnabled: entity?.render?.enabled !== false,
                renderType: entity?.render?.type ?? null,
                meshInstances,
                hasMeshInstances: meshInstances > 0,
                position:
                    position && [position.x, position.y, position.z].every(Number.isFinite)
                        ? { x: Number(position.x), y: Number(position.y), z: Number(position.z) }
                        : null,
                diffuse:
                    diffuse && [diffuse.r, diffuse.g, diffuse.b].every(Number.isFinite)
                        ? { r: Number(diffuse.r), g: Number(diffuse.g), b: Number(diffuse.b) }
                        : null
            }
        }
        editor?.call?.('viewport:render')
        return Object.fromEntries(entityNames.map((name) => [name, readRenderable(name)]))
    }, MMOOMM_EDITOR_ENTITY_NAMES)
}

const readMmoommVisualLabMaterialEvidence = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const representativeNames = [
        'Linkup Lab 01 ship Core',
        'Linkup Lab 01 ship Glow',
        'Linkup Lab 06 station Glow',
        'Linkup Lab 16 rockAsteroid Core'
    ]
    return editorFrame.locator('body').evaluate((_, entityNames) => {
        const editor = (window as unknown as { editor?: { call?: (method: string, ...args: unknown[]) => unknown } }).editor
        const app = editor?.call?.('viewport:app') as
            | {
                  root?: {
                      findByName?: (name: string) => {
                          render?: { meshInstances?: unknown[] }
                      } | null
                  }
              }
            | null
            | undefined
        const readColor = (value: unknown): { r: number; g: number; b: number } | null => {
            const color = value as { r?: unknown; g?: unknown; b?: unknown } | null | undefined
            if (!color) return null
            const r = Number(color.r)
            const g = Number(color.g)
            const b = Number(color.b)
            return [r, g, b].every(Number.isFinite) ? { r, g, b } : null
        }
        const hasLiveVisualMaterial = (material: Record<string, unknown> | undefined): boolean =>
            Boolean(
                material &&
                    Number.isFinite(Number(material.opacity)) &&
                    typeof material.depthWrite === 'boolean' &&
                    typeof material.useFog === 'boolean' &&
                    readColor(material.diffuse) &&
                    (Number(material.opacity) < 1 ||
                        typeof material.blendType === 'number' ||
                        typeof material.blendType === 'string' ||
                        readColor(material.emissive))
            )
        const readMaterial = (name: string): MmoommEditorVisualMaterialEvidence => {
            const entity = app?.root?.findByName?.(name)
            const meshInstances = Array.isArray(entity?.render?.meshInstances) ? entity.render.meshInstances : []
            const material = (meshInstances[0] as { material?: Record<string, unknown> } | undefined)?.material
            return {
                exists: Boolean(entity),
                meshInstances: meshInstances.length,
                materialAppliedCount: meshInstances.filter((meshInstance) =>
                    hasLiveVisualMaterial((meshInstance as { material?: Record<string, unknown> } | undefined)?.material)
                ).length,
                opacity: Number.isFinite(Number(material?.opacity)) ? Number(material?.opacity) : null,
                blendType:
                    typeof material?.blendType === 'string' || typeof material?.blendType === 'number'
                        ? (material.blendType as string | number)
                        : null,
                depthWrite: typeof material?.depthWrite === 'boolean' ? material.depthWrite : null,
                useFog: typeof material?.useFog === 'boolean' ? material.useFog : null,
                diffuse: readColor(material?.diffuse),
                emissive: readColor(material?.emissive),
                emissiveIntensity: Number.isFinite(Number(material?.emissiveIntensity)) ? Number(material?.emissiveIntensity) : null
            }
        }
        editor?.call?.('viewport:render')
        return Object.fromEntries(entityNames.map((name) => [name, readMaterial(name)]))
    }, representativeNames)
}

const expectMmoommVisualLabLiveMaterialsApplied = async (page: Page, label: string) => {
    const evidence = await readMmoommVisualLabMaterialEvidence(page)
    const entries = Object.entries(evidence)
    expect(entries.length, `${label} must inspect representative live materials`).toBeGreaterThanOrEqual(4)
    for (const [name, material] of entries) {
        expect(material.exists, `${label} ${name} must exist in the live Editor viewport`).toBe(true)
        expect(material.meshInstances, `${label} ${name} must have live mesh instances`).toBeGreaterThan(0)
        expect(material.opacity, `${label} ${name} must expose a live material opacity`).toEqual(expect.any(Number))
        expect(material.depthWrite, `${label} ${name} translucent material must disable depth writes`).toBe(false)
        expect(material.useFog, `${label} ${name} material must use scene fog`).toBe(true)
        expect(material.diffuse, `${label} ${name} material must expose diffuse color`).toEqual(expect.any(Object))
    }
    expect(
        entries.reduce((total, [, material]) => total + material.materialAppliedCount, 0),
        `${label} must apply MMOOMM visual materials to live Editor mesh instances`
    ).toBeGreaterThanOrEqual(entries.length)
    const opacityValues = entries.map(([, material]) => material.opacity).filter((value): value is number => typeof value === 'number')
    expect(
        Math.max(...opacityValues) - Math.min(...opacityValues),
        `${label} live material opacities must remain distinct`
    ).toBeGreaterThan(0.2)
    const glowMaterials = entries.filter(([name]) => name.endsWith('Glow')).map(([, material]) => material)
    expect(
        glowMaterials.some((material) => material.blendType === 1 || material.blendType === 'additive'),
        `${label} glow shells must use additive blending`
    ).toBe(true)
    expect(
        glowMaterials.some((material) => (material.emissiveIntensity ?? 0) >= 2),
        `${label} glow shells must retain high emissive intensity`
    ).toBe(true)
}

const readMmoommVisualLabMaterialAssetRegistryEvidence = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const representativeAssetIds = [
        LINKUP_EDITOR_MATERIAL_BASE_ID + 1,
        LINKUP_EDITOR_MATERIAL_BASE_ID + 2,
        LINKUP_EDITOR_MATERIAL_BASE_ID + 3,
        LINKUP_EDITOR_MATERIAL_BASE_ID + 503,
        LINKUP_EDITOR_MATERIAL_BASE_ID + 1_503
    ]
    return editorFrame.locator('body').evaluate((_, assetIds) => {
        const windowWithBridge = window as unknown as {
            editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                hostedAssetAdapterInstalled?: boolean
                hostedAssetObserverCount?: number
                persistedAssetsLoadEmitted?: boolean
            }
        }
        const editor = windowWithBridge.editor
        const toArray = (value: unknown): unknown[] => {
            if (Array.isArray(value)) return value
            const candidate = value as { array?: unknown; data?: unknown } | null
            if (Array.isArray(candidate?.data)) return candidate.data
            if (typeof candidate?.array === 'function') {
                try {
                    const array = candidate.array()
                    return Array.isArray(array) ? array : []
                } catch {
                    return []
                }
            }
            return []
        }
        const readJson = (asset: unknown): Record<string, unknown> => {
            if (typeof (asset as { json?: unknown } | null)?.json === 'function') {
                return (asset as { json: () => Record<string, unknown> }).json() ?? {}
            }
            return (asset as Record<string, unknown> | null) ?? {}
        }
        const readAsset = (id: number): MmoommEditorMaterialAssetRegistryEvidence => {
            const asset = editor?.call?.('assets:get', id) ?? editor?.call?.('assets:get', String(id))
            const get =
                typeof (asset as { get?: unknown } | null)?.get === 'function'
                    ? (path: string) => (asset as { get: (path: string) => unknown }).get(path)
                    : null
            const json = readJson(asset)
            const data = (json.data && typeof json.data === 'object' ? json.data : get?.('data')) as Record<string, unknown> | undefined
            const metadata = (json.metadata && typeof json.metadata === 'object' ? json.metadata : get?.('metadata')) as
                | Record<string, unknown>
                | undefined
            const mmoomm = metadata?.mmoomm as { visualMaterial?: { blendType?: unknown } } | undefined
            const readDataField = (field: string): unknown => get?.(`data.${field}`) ?? data?.[field]
            return {
                id,
                exists: Boolean(asset),
                name: typeof (get?.('name') ?? json.name) === 'string' ? String(get?.('name') ?? json.name) : null,
                type: typeof (get?.('type') ?? json.type) === 'string' ? String(get?.('type') ?? json.type) : null,
                preload: typeof (get?.('preload') ?? json.preload) === 'boolean' ? Boolean(get?.('preload') ?? json.preload) : null,
                hasData: Boolean(data && typeof data === 'object'),
                diffuse: readDataField('diffuse') ?? null,
                opacity: Number.isFinite(Number(readDataField('opacity'))) ? Number(readDataField('opacity')) : null,
                blendType:
                    typeof readDataField('blendType') === 'number' || typeof readDataField('blendType') === 'string'
                        ? (readDataField('blendType') as number | string)
                        : null,
                depthWrite: typeof readDataField('depthWrite') === 'boolean' ? (readDataField('depthWrite') as boolean) : null,
                useFog: typeof readDataField('useFog') === 'boolean' ? (readDataField('useFog') as boolean) : null,
                metadataBlendType: typeof mmoomm?.visualMaterial?.blendType === 'string' ? mmoomm.visualMaterial.blendType : null
            }
        }
        const registryAssets = [...toArray(editor?.call?.('assets:list')), ...toArray(editor?.call?.('assets:raw'))]
        const materialIds = new Set<string>()
        for (const asset of registryAssets) {
            const json = readJson(asset)
            const get =
                typeof (asset as { get?: unknown } | null)?.get === 'function'
                    ? (path: string) => (asset as { get: (path: string) => unknown }).get(path)
                    : null
            const type = get?.('type') ?? json.type
            const id = get?.('id') ?? json.id
            const data = get?.('data') ?? json.data
            const metadata = get?.('metadata') ?? json.metadata
            if (type !== 'material') continue
            if (typeof id !== 'string' && typeof id !== 'number') continue
            if (!data || typeof data !== 'object') continue
            if (!metadata || typeof metadata !== 'object') continue
            materialIds.add(String(id))
        }
        const bridge = windowWithBridge.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        return {
            materialCount: materialIds.size,
            hostedAssetAdapterInstalled: bridge?.hostedAssetAdapterInstalled === true,
            hostedAssetObserverCount: Number(bridge?.hostedAssetObserverCount ?? 0),
            persistedAssetsLoadEmitted: bridge?.persistedAssetsLoadEmitted === true,
            representativeAssets: assetIds.map(readAsset)
        } satisfies MmoommEditorMaterialAssetRegistrySummary
    }, representativeAssetIds)
}

const expectMmoommVisualLabMaterialAssetsAvailableInEditor = async (page: Page, label: string) => {
    const evidence = await readMmoommVisualLabMaterialAssetRegistryEvidence(page)
    const expectedMaterialAssetCount = LINKUP_VARIANTS.length * (1 + LINKUP_OBJECT_TYPES.length * 2)
    expect(
        evidence.hostedAssetAdapterInstalled,
        `${label} must install the hosted Editor asset adapter for scene-local material assets`
    ).toBe(true)
    expect(
        evidence.hostedAssetObserverCount,
        `${label} must expose all scene-local material assets through the hosted Editor asset adapter`
    ).toBeGreaterThanOrEqual(expectedMaterialAssetCount)
    expect(evidence.persistedAssetsLoadEmitted, `${label} must emit Editor asset load events after scene-local asset hydration`).toBe(true)
    expect(
        evidence.materialCount,
        `${label} must register all scene-local material assets in real Editor assets:list/assets:raw`
    ).toBeGreaterThanOrEqual(expectedMaterialAssetCount)
    expect(evidence.representativeAssets.length, `${label} must inspect representative material assets`).toBeGreaterThanOrEqual(5)
    for (const asset of evidence.representativeAssets) {
        expect(asset.exists, `${label} material asset ${asset.id} must be registered in Editor assets`).toBe(true)
        expect(asset.name, `${label} material asset ${asset.id} must expose a readable name`).toEqual(expect.any(String))
        expect(asset.type, `${label} material asset ${asset.id} must be a material`).toBe('material')
        expect(asset.hasData, `${label} material asset ${asset.id} must carry material data for the inspector`).toBe(true)
        expect(Array.isArray(asset.diffuse), `${label} material asset ${asset.id} must expose diffuse color data`).toBe(true)
        expect(asset.opacity, `${label} material asset ${asset.id} must expose numeric opacity data`).toEqual(expect.any(Number))
        expect(typeof asset.blendType, `${label} material asset ${asset.id} must use numeric PlayCanvas blendType data`).toBe('number')
        expect(asset.depthWrite, `${label} material asset ${asset.id} translucent material must disable depth writes`).toBe(false)
        expect(asset.useFog, `${label} material asset ${asset.id} must use scene fog`).toBe(true)
        expect(asset.metadataBlendType, `${label} material asset ${asset.id} must keep readable MMOOMM blend metadata`).toMatch(
            /^(normal|additive)$/
        )
    }
    expect(
        evidence.representativeAssets.some((asset) => asset.blendType === 1 && asset.metadataBlendType === 'additive'),
        `${label} must expose additive glow material assets in the Editor registry`
    ).toBe(true)
    expect(
        evidence.representativeAssets.some((asset) => asset.blendType === 2 && asset.metadataBlendType === 'normal'),
        `${label} must expose normal core/marker material assets in the Editor registry`
    ).toBe(true)
}

const readMmoommEditorLightingEvidence = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate((_, lightName) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const app = editor?.call?.('viewport:app') as
            | {
                  root?: {
                      findByName?: (name: string) => {
                          enabled?: boolean
                          light?: { enabled?: boolean; type?: string; intensity?: number; color?: { r?: number; g?: number; b?: number } }
                      } | null
                  }
              }
            | null
            | undefined
        const light = app?.root?.findByName?.(String(lightName))
        return {
            exists: Boolean(light),
            enabled: light?.enabled !== false,
            lightEnabled: light?.light?.enabled !== false,
            type: light?.light?.type ?? null,
            intensity: Number(light?.light?.intensity ?? 0),
            color:
                light?.light?.color &&
                [light.light.color.r, light.light.color.g, light.light.color.b].every((value) => Number.isFinite(value))
                    ? {
                          r: Number(light.light.color.r),
                          g: Number(light.light.color.g),
                          b: Number(light.light.color.b)
                      }
                    : null
        }
    }, MMOOMM_EDITOR_LIGHT_NAME)
}

const readMmoommEditorProjectionEvidence = async (page: Page, entityNames: readonly string[] = MMOOMM_EDITOR_ENTITY_NAMES) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate((_, entityNames) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const app = editor?.call?.('viewport:app') as
            | {
                  graphicsDevice?: { width?: number; height?: number }
                  root?: {
                      findByName?: (name: string) => {
                          getPosition?: () => { x?: number; y?: number; z?: number }
                          getLocalScale?: () => { x?: number; y?: number; z?: number }
                      } | null
                  }
              }
            | null
            | undefined
        const cameraEntity = editor?.call?.('camera:current') as
            | { camera?: { worldToScreen?: (position: unknown) => { x?: number; y?: number; z?: number } } }
            | null
            | undefined
        const width = Number(app?.graphicsDevice?.width ?? 0)
        const height = Number(app?.graphicsDevice?.height ?? 0)
        const readProjection = (name: string): MmoommEditorProjectionEvidence => {
            const entity = app?.root?.findByName?.(name)
            const position = entity?.getPosition?.()
            const scale = entity?.getLocalScale?.()
            const projected = position ? cameraEntity?.camera?.worldToScreen?.(position) : null
            const x = Number(projected?.x ?? Number.NaN)
            const y = Number(projected?.y ?? Number.NaN)
            const z = Number(projected?.z ?? Number.NaN)
            const corners =
                position && scale
                    ? [-0.5, 0.5].flatMap((dx) =>
                          [-0.5, 0.5].flatMap((dy) =>
                              [-0.5, 0.5].map((dz) => ({
                                  x: Number(position.x ?? 0) + Number(scale.x ?? 1) * dx,
                                  y: Number(position.y ?? 0) + Number(scale.y ?? 1) * dy,
                                  z: Number(position.z ?? 0) + Number(scale.z ?? 1) * dz
                              }))
                          )
                      )
                    : []
            const projectedCorners = corners
                .map((corner) => cameraEntity?.camera?.worldToScreen?.(corner))
                .map((corner) => ({
                    x: Number(corner?.x ?? Number.NaN),
                    y: Number(corner?.y ?? Number.NaN),
                    z: Number(corner?.z ?? Number.NaN)
                }))
                .filter((corner) => Number.isFinite(corner.x) && Number.isFinite(corner.y) && Number.isFinite(corner.z))
            const visibleCornerCount = projectedCorners.filter(
                (corner) => corner.x >= 0 && corner.x <= width && corner.y >= 0 && corner.y <= height
            ).length
            const rawBounds =
                projectedCorners.length > 0
                    ? {
                          minX: Math.min(...projectedCorners.map((corner) => corner.x)),
                          minY: Math.min(...projectedCorners.map((corner) => corner.y)),
                          maxX: Math.max(...projectedCorners.map((corner) => corner.x)),
                          maxY: Math.max(...projectedCorners.map((corner) => corner.y))
                      }
                    : undefined
            const intersectsViewport =
                rawBounds !== undefined &&
                width > 0 &&
                height > 0 &&
                rawBounds.maxX >= 0 &&
                rawBounds.minX <= width &&
                rawBounds.maxY >= 0 &&
                rawBounds.minY <= height
            const bounds =
                rawBounds !== undefined && intersectsViewport
                    ? {
                          minX: Math.max(0, rawBounds.minX),
                          minY: Math.max(0, rawBounds.minY),
                          maxX: Math.min(width, rawBounds.maxX),
                          maxY: Math.min(height, rawBounds.maxY),
                          visibleCornerCount
                      }
                    : undefined
            return {
                width,
                height,
                x,
                y,
                z,
                ...(bounds ? { bounds } : {}),
                visible:
                    width > 0 &&
                    height > 0 &&
                    Number.isFinite(x) &&
                    Number.isFinite(y) &&
                    Number.isFinite(z) &&
                    z > 0 &&
                    x >= 0 &&
                    x <= width &&
                    y >= 0 &&
                    y <= height
            }
        }
        editor?.call?.('viewport:render')
        return Object.fromEntries(entityNames.map((name) => [name, readProjection(name)]))
    }, entityNames)
}

const expectMmoommEditorInitialViewportVisible = async (page: Page, label: string) => {
    await expect
        .poll(
            async () => {
                const projections = await readMmoommEditorProjectionEvidence(page)
                return MMOOMM_EDITOR_ENTITY_NAMES.filter((name) => {
                    const bounds = projections[name].bounds
                    return bounds !== undefined && bounds.maxX > bounds.minX + 4 && bounds.maxY > bounds.minY + 4
                }).length
            },
            { timeout: 20_000 }
        )
        .toBeGreaterThan(0)

    const projections = await readMmoommEditorProjectionEvidence(page)
    const canvasHost = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]').locator('#canvas-3d')
    const screenshot = await canvasHost.screenshot()
    const visiblePixelEvidence: MmoommEditorMeshPixelEvidence[] = []
    for (const entityName of MMOOMM_EDITOR_ENTITY_NAMES) {
        const projection = projections[entityName]
        expect(projection.width, `${label} ${entityName} viewport width must be positive`).toBeGreaterThan(0)
        expect(projection.height, `${label} ${entityName} viewport height must be positive`).toBeGreaterThan(0)
        expect(Number.isFinite(projection.x), `${label} ${entityName} initial x projection must be finite`).toBe(true)
        expect(Number.isFinite(projection.y), `${label} ${entityName} initial y projection must be finite`).toBe(true)
        expect(Number.isFinite(projection.z), `${label} ${entityName} initial z projection must be finite`).toBe(true)
        if (!projection.bounds) continue
        const pixelEvidence = readMeshPixelsFromCanvasScreenshot(screenshot, projection, `${label} ${entityName}`)
        expect(pixelEvidence.sampleCount, `${label} ${entityName} mesh bounds must contain sampled pixels`).toBeGreaterThan(8)
        if (pixelEvidence.lightPixelCount > Math.max(3, Math.floor(pixelEvidence.sampleCount * 0.08)) && pixelEvidence.colorBuckets > 1) {
            visiblePixelEvidence.push(pixelEvidence)
        }
    }
    expect(visiblePixelEvidence.length, `${label} must paint at least one MMOOMM mesh before camera focus`).toBeGreaterThan(0)
    return { projections, screenshot }
}

const expectMmoommVisualLinkupEditorViewportReadable = async (page: Page, label: string) => {
    await expect
        .poll(
            async () => {
                const projections = await readMmoommEditorProjectionEvidence(page, MMOOMM_VISUAL_LINKUP_EDITOR_REPRESENTATIVE_ENTITY_NAMES)
                return MMOOMM_VISUAL_LINKUP_EDITOR_REPRESENTATIVE_ENTITY_NAMES.filter((name) => {
                    const bounds = projections[name].bounds
                    return bounds !== undefined && bounds.maxX > bounds.minX + 6 && bounds.maxY > bounds.minY + 6
                }).length
            },
            { timeout: 20_000 }
        )
        .toBeGreaterThanOrEqual(8)

    const projections = await readMmoommEditorProjectionEvidence(page, MMOOMM_VISUAL_LINKUP_EDITOR_REPRESENTATIVE_ENTITY_NAMES)
    const canvasHost = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]').locator('#canvas-3d')
    const screenshot = await canvasHost.screenshot()
    const visiblePixelEvidence: MmoommEditorMeshPixelEvidence[] = []
    for (const entityName of MMOOMM_VISUAL_LINKUP_EDITOR_REPRESENTATIVE_ENTITY_NAMES) {
        const projection = projections[entityName]
        expect(projection.width, `${label} ${entityName} viewport width must be positive`).toBeGreaterThan(0)
        expect(projection.height, `${label} ${entityName} viewport height must be positive`).toBeGreaterThan(0)
        expect(Number.isFinite(projection.x), `${label} ${entityName} x projection must be finite`).toBe(true)
        expect(Number.isFinite(projection.y), `${label} ${entityName} y projection must be finite`).toBe(true)
        expect(Number.isFinite(projection.z), `${label} ${entityName} z projection must be finite`).toBe(true)
        if (!projection.bounds) continue
        const pixelEvidence = readMeshPixelsFromCanvasScreenshot(screenshot, projection, `${label} ${entityName}`)
        expect(pixelEvidence.sampleCount, `${label} ${entityName} projected mesh bounds must contain sampled pixels`).toBeGreaterThan(8)
        if (
            pixelEvidence.foregroundPixelCount >= Math.max(2, Math.floor(pixelEvidence.sampleCount * 0.04)) &&
            pixelEvidence.colorBuckets > 1
        ) {
            visiblePixelEvidence.push(pixelEvidence)
        }
    }
    expect(
        visiblePixelEvidence.length,
        `${label} must paint readable Visual Linkup Lab meshes in the Editor viewport`
    ).toBeGreaterThanOrEqual(6)
}

const expectMmoommEditorObjectFramed = async (page: Page, entityName: string, label: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await editorFrame.locator('body').evaluate((_, expectedName) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const app = editor?.call?.('viewport:app') as
            | {
                  root?: {
                      findByName?: (name: string) => {
                          getPosition?: () => unknown
                          getLocalScale?: () => { x?: number; y?: number; z?: number }
                      } | null
                  }
              }
            | null
            | undefined
        const entity = app?.root?.findByName?.(String(expectedName))
        const position = entity?.getPosition?.()
        const scale = entity?.getLocalScale?.()
        const largestScale = Math.max(Number(scale?.x ?? 1), Number(scale?.y ?? 1), Number(scale?.z ?? 1))
        if (!position) {
            throw new Error(`PlayCanvas Editor viewport entity ${String(expectedName)} is not available for framing`)
        }
        editor?.call?.('camera:focus', position, Math.max(8, largestScale * 2.5))
        editor?.call?.('viewport:render')
    }, entityName)

    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_, expectedName) => {
                    const editor = (
                        window as unknown as {
                            editor?: { call?: (method: string, ...args: unknown[]) => unknown }
                        }
                    ).editor
                    const app = editor?.call?.('viewport:app') as
                        | {
                              graphicsDevice?: { width?: number; height?: number }
                              root?: {
                                  findByName?: (name: string) => {
                                      getPosition?: () => unknown
                                  } | null
                              }
                          }
                        | null
                        | undefined
                    const cameraEntity = editor?.call?.('camera:current') as
                        | { camera?: { worldToScreen?: (position: unknown) => { x?: number; y?: number; z?: number } } }
                        | null
                        | undefined
                    const entity = app?.root?.findByName?.(String(expectedName))
                    const position = entity?.getPosition?.()
                    const projected = position ? cameraEntity?.camera?.worldToScreen?.(position) : null
                    return {
                        width: Number(app?.graphicsDevice?.width ?? 0),
                        height: Number(app?.graphicsDevice?.height ?? 0),
                        x: Number(projected?.x ?? Number.NaN),
                        y: Number(projected?.y ?? Number.NaN),
                        z: Number(projected?.z ?? Number.NaN),
                        framed:
                            Number(app?.graphicsDevice?.width ?? 0) > 0 &&
                            Number(app?.graphicsDevice?.height ?? 0) > 0 &&
                            Number.isFinite(projected?.x) &&
                            Number.isFinite(projected?.y) &&
                            Number.isFinite(projected?.z) &&
                            Number(projected?.x) > Number(app?.graphicsDevice?.width ?? 0) * 0.2 &&
                            Number(projected?.x) < Number(app?.graphicsDevice?.width ?? 0) * 0.8 &&
                            Number(projected?.y) > Number(app?.graphicsDevice?.height ?? 0) * 0.2 &&
                            Number(projected?.y) < Number(app?.graphicsDevice?.height ?? 0) * 0.8
                    }
                }, entityName),
            { timeout: 10_000 }
        )
        .toEqual(expect.objectContaining({ framed: true }))

    const projection = await editorFrame.locator('body').evaluate((_, expectedName) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const app = editor?.call?.('viewport:app') as {
            graphicsDevice?: { width?: number; height?: number }
            root?: { findByName?: (name: string) => { getPosition?: () => unknown } | null }
        }
        const cameraEntity = editor?.call?.('camera:current') as {
            camera?: { worldToScreen?: (position: unknown) => { x?: number; y?: number; z?: number } }
        }
        const entity = app?.root?.findByName?.(String(expectedName))
        const projected = entity?.getPosition ? cameraEntity?.camera?.worldToScreen?.(entity.getPosition()) : null
        return {
            width: Number(app?.graphicsDevice?.width ?? 0),
            height: Number(app?.graphicsDevice?.height ?? 0),
            x: Number(projected?.x ?? Number.NaN),
            y: Number(projected?.y ?? Number.NaN),
            z: Number(projected?.z ?? Number.NaN)
        }
    }, entityName)
    expect(projection.width, `${label} viewport width must be positive`).toBeGreaterThan(0)
    expect(projection.height, `${label} viewport height must be positive`).toBeGreaterThan(0)
    expect(Number.isFinite(projection.x), `${label} x projection must be finite`).toBe(true)
    expect(Number.isFinite(projection.y), `${label} y projection must be finite`).toBe(true)
    expect(Number.isFinite(projection.z), `${label} z projection must be finite`).toBe(true)
    expect(projection.x, `${label} must be framed horizontally`).toBeGreaterThan(projection.width * 0.2)
    expect(projection.x, `${label} must be framed horizontally`).toBeLessThan(projection.width * 0.8)
    expect(projection.y, `${label} must be framed vertically`).toBeGreaterThan(projection.height * 0.2)
    expect(projection.y, `${label} must be framed vertically`).toBeLessThan(projection.height * 0.8)
    return projection
}

export const expectMmoommEditorEntitiesVisible = async (
    page: Page,
    label: string,
    options: { preFocusScreenshotAttachmentName?: string; testInfo?: TestInfo } = {}
) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const hierarchy = editorFrame.locator('#layout-hierarchy')

    await expect(hierarchy, `${label} hierarchy must be visible`).toBeVisible()
    await expect(hierarchy, `${label} hierarchy must list the authored ship`).toContainText('MMOOMM Ship')
    await expect(hierarchy, `${label} hierarchy must list the authored station`).toContainText('MMOOMM Station')
    await expect(hierarchy, `${label} hierarchy must list the authored key light`).toContainText(MMOOMM_EDITOR_LIGHT_NAME)
    await expectPlayCanvasEditorCanvasPainted(page, `${label} viewport`)
    for (const entityName of MMOOMM_EDITOR_ENTITY_NAMES) {
        await expectMmoommEditorEntityInspectable(page, entityName, `${label} ${entityName}`)
    }
    await expect
        .poll(() => readMmoommEditorRenderableEvidence(page), { timeout: 20_000 })
        .toEqual({
            'MMOOMM Ship': expect.objectContaining({
                exists: true,
                enabled: true,
                renderEnabled: true,
                renderType: 'box',
                hasMeshInstances: true
            }),
            'MMOOMM Station': expect.objectContaining({
                exists: true,
                enabled: true,
                renderEnabled: true,
                renderType: 'box',
                hasMeshInstances: true
            })
        })
    await expect
        .poll(() => readMmoommEditorLightingEvidence(page), { timeout: 20_000 })
        .toEqual(
            expect.objectContaining({
                exists: true,
                enabled: true,
                lightEnabled: true,
                type: 'directional',
                intensity: expect.any(Number),
                color: expect.objectContaining({ r: 1, g: 1, b: 1 })
            })
        )
    const lightingEvidence = await readMmoommEditorLightingEvidence(page)
    expect(lightingEvidence.intensity ?? 0, `${label} key light intensity must keep authored objects readable`).toBeGreaterThan(0)
    const renderEvidence = await readMmoommEditorRenderableEvidence(page)
    expect(
        renderEvidence['MMOOMM Ship'].meshInstances,
        `${label} ship must have render mesh instances in the editor viewport`
    ).toBeGreaterThan(0)
    expect(
        renderEvidence['MMOOMM Station'].meshInstances,
        `${label} station must have render mesh instances in the editor viewport`
    ).toBeGreaterThan(0)
    expect(renderEvidence['MMOOMM Ship'].position, `${label} ship must expose a finite world position`).not.toBeNull()
    expect(renderEvidence['MMOOMM Station'].position, `${label} station must expose a finite world position`).not.toBeNull()
    expect(renderEvidence['MMOOMM Ship'].diffuse, `${label} ship must use a readable white default material`).toEqual(
        expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) })
    )
    expect(renderEvidence['MMOOMM Station'].diffuse, `${label} station must use a readable white default material`).toEqual(
        expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) })
    )
    for (const entityName of MMOOMM_EDITOR_ENTITY_NAMES) {
        const diffuse = renderEvidence[entityName].diffuse
        expect(diffuse?.r ?? 0, `${label} ${entityName} material red channel must be light`).toBeGreaterThan(0.6)
        expect(diffuse?.g ?? 0, `${label} ${entityName} material green channel must be light`).toBeGreaterThan(0.6)
        expect(diffuse?.b ?? 0, `${label} ${entityName} material blue channel must be light`).toBeGreaterThan(0.6)
    }
    expect(renderEvidence['MMOOMM Ship'].position, `${label} ship and station must be distinct viewport objects`).not.toEqual(
        renderEvidence['MMOOMM Station'].position
    )

    const initialProjectionEvidence = await expectMmoommEditorInitialViewportVisible(page, `${label} initial viewport`)
    if (options.preFocusScreenshotAttachmentName && options.testInfo) {
        await options.testInfo.attach(options.preFocusScreenshotAttachmentName, {
            body: initialProjectionEvidence.screenshot,
            contentType: 'image/png'
        })
    }
    const shipProjection = await expectMmoommEditorObjectFramed(page, 'MMOOMM Ship', `${label} ship projection`)
    const stationProjection = await expectMmoommEditorObjectFramed(page, 'MMOOMM Station', `${label} station projection`)
    await expectPlayCanvasEditorCanvasPainted(page, `${label} framed viewport`)
    return { renderEvidence, initialProjectionEvidence, shipProjection, stationProjection }
}

export const expectImportedMmoommSceneThroughFullscreenEditor = async (
    page: Page,
    metahubId: string,
    testInfo: TestInfo,
    options: { projectId?: string; label?: string } = {}
) => {
    const projectQuery = options.projectId ? `?projectId=${encodeURIComponent(options.projectId)}` : ''
    const label = options.label ?? 'Imported MMOOMM fullscreen PlayCanvas Editor'
    await page.goto(`/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen${projectQuery}`)
    await expect(page).toHaveURL(
        new RegExp(
            `/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen${options.projectId ? '\\?projectId=' : '$'}`
        )
    )
    await expectPlayCanvasEditorIframeLoaded(page)
    await expectPlayCanvasEditorFullscreenHost(page)
    await expectNoPageHorizontalOverflow(page, label)
    await expectMmoommEditorEntitiesVisible(page, 'Imported MMOOMM scene before save', {
        preFocusScreenshotAttachmentName: 'imported-mmoomm-playcanvas-editor-initial-prefocus.png',
        testInfo
    })

    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const savedShipPosition = await editorFrame.locator('body').evaluate(() => {
        const editor = (
            window as unknown as {
                editor?: {
                    api?: {
                        globals?: {
                            entities?: {
                                raw?: {
                                    array?: () => Array<{
                                        get?: (path: string) => unknown
                                        set?: (path: string, value: unknown) => void
                                    }>
                                }
                            }
                        }
                    }
                }
            }
        ).editor
        const ship = editor?.api?.globals?.entities?.raw?.array?.().find((entity) => entity.get?.('name') === 'MMOOMM Ship')
        const current = ship?.get?.('position')
        if (!ship?.set || !Array.isArray(current) || current.length !== 3) {
            throw new Error('Imported MMOOMM Ship observer position is not available for save/reload proof')
        }
        const next = [Number(current[0]) + 1, Number(current[1]), Number(current[2])]
        ship.set('position', next)
        return next
    })

    const savePayload = (await readSerializedPlayCanvasEditorScene(page)) as {
        entities?: Array<{ name?: unknown; position?: unknown }>
    } & Record<string, unknown>
    await saveSerializedPlayCanvasEditorSceneThroughCompatibilityRest(page, metahubId, savePayload)
    expect(savePayload.entities).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ name: 'MMOOMM Ship', position: savedShipPosition }),
            expect.objectContaining({ name: 'MMOOMM Station' })
        ])
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    await expectPlayCanvasEditorFullscreenHost(page)
    await expectMmoommEditorEntitiesVisible(page, 'Imported MMOOMM scene after save and reload')
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(() => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => { entities?: Array<{ name?: unknown; position?: unknown }> }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    return bridge?.serializeCurrentScene?.().entities?.find((entity) => entity.name === 'MMOOMM Ship')?.position ?? null
                }),
            { timeout: 20_000 }
        )
        .toEqual(savedShipPosition)

    await testInfo.attach('imported-mmoomm-playcanvas-editor-fullscreen.png', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
    })
}

export const expectImportedMmoommVisualLinkupLabThroughFullscreenEditor = async (
    page: Page,
    metahubId: string,
    projectId: string,
    testInfo: TestInfo
) => {
    await page.goto(
        `/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${encodeURIComponent(projectId)}`
    )
    await expect(page).toHaveURL(
        new RegExp(`/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen\\?projectId=${projectId}`)
    )
    await expectPlayCanvasEditorIframeLoaded(page)
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId)
    expect(compatibilityConfig.projectId, 'Imported MMOOMM Visual Linkup Lab config must target the requested project').toBe(projectId)
    await expectPlayCanvasEditorFullscreenHost(page)
    await expectNoPageHorizontalOverflow(page, 'Imported MMOOMM Visual Linkup Lab fullscreen PlayCanvas Editor')

    const scene = await expectMmoommVisualLinkupLabScene(page, 'Imported MMOOMM Visual Linkup Lab scene')
    expect(scene.entities?.length ?? 0, 'Imported MMOOMM Visual Linkup Lab Editor scene must not be empty').toBeGreaterThanOrEqual(100)
    expect(
        scene.assets?.length ?? 0,
        'Imported MMOOMM Visual Linkup Lab Editor scene must keep scene-local materials'
    ).toBeGreaterThanOrEqual(100)

    await testInfo.attach('imported-mmoomm-visual-linkup-lab-playcanvas-editor-fullscreen.png', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
    })
}

const expectPlayCanvasEditorHierarchyContextMenuResponsive = async (page: Page, label: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const hierarchyRow = editorFrame.locator('#layout-hierarchy .pcui-treeview-item-contents').first()
    await expect(hierarchyRow, `${label} hierarchy row must be visible before context menu proof`).toBeVisible()
    await hierarchyRow.click({ button: 'right' })
    await expect(
        editorFrame.locator(playCanvasEditorVisibleMenuItemXPath('New Entity')).first(),
        `${label} hierarchy context menu must expose New Entity`
    )
        .toBeVisible()
        .catch(async (error) => {
            const diagnostics = await editorFrame
                .locator('body')
                .evaluate(() => {
                    const editor = (
                        window as unknown as {
                            editor?: {
                                call?: (method: string, ...args: unknown[]) => unknown
                                api?: { globals?: { entities?: { raw?: { array?: () => unknown[] } } } }
                            }
                        }
                    ).editor
                    const readEntity = (value: unknown) => {
                        const observer = value as { get?: (path: string) => unknown; json?: () => Record<string, unknown> }
                        const json = typeof observer?.json === 'function' ? observer.json() : null
                        return {
                            id: typeof observer?.get === 'function' ? observer.get('resource_id') : json?.resource_id,
                            name: typeof observer?.get === 'function' ? observer.get('name') : json?.name,
                            parent: typeof observer?.get === 'function' ? observer.get('parent') : json?.parent
                        }
                    }
                    let directOpen: unknown = null
                    let rawEntities: unknown[] = []
                    let listEntities: unknown[] = []
                    try {
                        rawEntities = ((editor?.call?.('entities:raw') as { array?: () => unknown[] })?.array?.() ?? []) as unknown[]
                    } catch {
                        rawEntities = []
                    }
                    try {
                        const list = editor?.call?.('entities:list')
                        listEntities = Array.isArray(list) ? list : []
                    } catch {
                        listEntities = []
                    }
                    try {
                        directOpen = editor?.call?.('entities:contextmenu:open', rawEntities[0], 24, 24, true) ?? null
                    } catch (directError) {
                        directOpen = directError instanceof Error ? directError.message : String(directError)
                    }
                    return {
                        rows: Array.from(document.querySelectorAll('#layout-hierarchy .pcui-treeview-item-contents')).map((row) =>
                            row.textContent?.trim()
                        ),
                        visibleMenus: Array.from(document.querySelectorAll('.pcui-menu:not(.pcui-hidden)')).map((menu) =>
                            menu.textContent?.trim()
                        ),
                        rawEntities: rawEntities.map(readEntity),
                        listEntities: listEntities.map(readEntity),
                        apiRawCount: editor?.api?.globals?.entities?.raw?.array?.().length ?? null,
                        directOpen
                    }
                })
                .catch((diagnosticsError) => ({
                    diagnosticsError: diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
                }))
            throw new Error(
                `${label} hierarchy context menu must expose New Entity. Diagnostics: ${JSON.stringify(diagnostics)}. ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        })
    await page.keyboard.press('Escape')
}

const readEmptyDefaultPlayCanvasEditorEntityIds = async (page: Page): Promise<string[]> => {
    const scene = (await readSerializedPlayCanvasEditorScene(page)) as { entities?: PlayCanvasEditorSerializedEntity[] }
    return (scene.entities ?? [])
        .filter(isEmptyDefaultPlayCanvasEditorEntity)
        .map((entity) => (typeof entity.id === 'string' || typeof entity.id === 'number' ? String(entity.id) : ''))
        .filter(Boolean)
}

const removeEmptyDefaultPlayCanvasEditorEntities = async (page: Page, label: string): Promise<string[]> => {
    const ids = await readEmptyDefaultPlayCanvasEditorEntityIds(page)
    if (ids.length === 0) {
        return []
    }
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const deletedIds = await editorFrame.locator('body').evaluate((_element, targetIds) => {
        type EditorEntityObserver = {
            apiEntity?: { delete?: (options?: unknown) => void }
            get?: (path: string) => unknown
            json?: () => Record<string, unknown>
        }
        const editor = (
            window as unknown as {
                editor?: {
                    call?: (method: string, ...args: unknown[]) => unknown
                    api?: { globals?: { entities?: { get?: (id: string) => unknown; raw?: { array?: () => unknown[] } } } }
                }
            }
        ).editor
        const toObserverArray = (value: unknown): EditorEntityObserver[] => {
            if (Array.isArray(value)) {
                return value as EditorEntityObserver[]
            }
            const list = value as { array?: () => unknown[] } | null | undefined
            if (typeof list?.array !== 'function') return []
            const items = list.array()
            return Array.isArray(items) ? (items as EditorEntityObserver[]) : []
        }
        const readObserverId = (observer: EditorEntityObserver): string => {
            const json = typeof observer.json === 'function' ? observer.json() : null
            const id = observer.get?.('resource_id') ?? json?.resource_id ?? json?.id
            return typeof id === 'string' || typeof id === 'number' ? String(id) : ''
        }
        const observers = [
            ...toObserverArray(editor?.call?.('entities:list')),
            ...toObserverArray(editor?.call?.('entities:raw')),
            ...toObserverArray(editor?.api?.globals?.entities?.raw)
        ].filter((observer): observer is EditorEntityObserver => Boolean(observer && typeof observer === 'object'))
        const targetSet = new Set(targetIds)
        const targets = observers.filter((observer) => targetSet.has(readObserverId(observer)))
        const deleted: string[] = []
        for (const observer of targets) {
            const id = readObserverId(observer)
            const apiEntity =
                (editor?.api?.globals?.entities?.get?.(id) as { apiEntity?: { delete?: (options?: unknown) => void } } | null | undefined)
                    ?.apiEntity ?? observer.apiEntity
            if (typeof apiEntity?.delete === 'function') {
                apiEntity.delete({ history: true, preserveEntityReferences: true })
                deleted.push(id)
            }
        }
        const remaining = targets.filter((observer) => !deleted.includes(readObserverId(observer)))
        if (remaining.length > 0 && typeof editor?.call === 'function') {
            editor.call('entities:delete', remaining)
            deleted.push(...remaining.map(readObserverId).filter(Boolean))
        }
        return Array.from(new Set(deleted))
    }, ids)
    await expect
        .poll(() => readEmptyDefaultPlayCanvasEditorEntityIds(page), { timeout: 20_000 })
        .toEqual([])
        .catch(async (error) => {
            const scene = await readSerializedPlayCanvasEditorScene(page).catch((sceneError) => ({
                sceneError: sceneError instanceof Error ? sceneError.message : String(sceneError)
            }))
            throw new Error(
                `${label} must not leave empty default PlayCanvas New Entity artifacts in the exportable scene. Deleted: ${JSON.stringify(
                    deletedIds
                )}. Scene: ${JSON.stringify(scene)}. ${error instanceof Error ? error.message : String(error)}`
            )
        })
    return deletedIds
}

const configureMmoommSceneFromUserCreatedEntities = async (
    page: Page,
    input: { shipEntity: PlayCanvasEditorAuthoredEntity; stationEntity: PlayCanvasEditorAuthoredEntity }
): Promise<PlayCanvasEditorMmoommAuthoredScene> => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate((_element, { shipEntity, stationEntity }) => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        if (typeof editor?.call !== 'function') {
            throw new Error('PlayCanvas Editor API is not available for authored MMOOMM scene configuration')
        }

        const createRenderComponent = (type = 'box') => {
            let render: Record<string, unknown> | null = null
            try {
                const candidate = editor.call?.('components:getDefault', 'render')
                render = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? { ...candidate } : null
            } catch {
                render = null
            }
            return {
                ...(render ?? { enabled: true }),
                type,
                materialAssets: Array.isArray(render?.materialAssets) ? render.materialAssets : [null]
            }
        }

        const ensureKeyLight = () => {
            const lightName = 'MMOOMM Key Light'
            const app = editor.call?.('viewport:app') as
                | {
                      root?: { findByName?: (name: string) => unknown }
                  }
                | null
                | undefined
            if (app?.root?.findByName?.(lightName)) {
                return
            }
            let light: Record<string, unknown> | null = null
            try {
                const candidate = editor.call?.('components:getDefault', 'light')
                light = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? { ...candidate } : null
            } catch {
                light = null
            }
            editor.call?.('entities:new', {
                name: lightName,
                parent: editor.call?.('entities:root'),
                enabled: true,
                position: [0, 32, 0],
                rotation: [45, 45, 0],
                scale: [1, 1, 1],
                components: {
                    light: {
                        ...(light ?? { enabled: true }),
                        enabled: true,
                        type: 'directional',
                        color: [1, 1, 1],
                        intensity: 2,
                        castShadows: false
                    }
                }
            })
        }

        const updateEntity = (
            id: string,
            values: {
                name: string
                position: [number, number, number]
                rotation: [number, number, number]
                scale: [number, number, number]
            }
        ) => {
            const toObserverArray = (
                value: unknown
            ): Array<{ get?: (path: string) => unknown; set?: (path: string, value: unknown) => void }> => {
                if (Array.isArray(value)) {
                    return value as Array<{ get?: (path: string) => unknown; set?: (path: string, value: unknown) => void }>
                }
                const list = value as { array?: () => unknown[] } | null | undefined
                if (typeof list?.array !== 'function') return []
                const items = list.array()
                return Array.isArray(items)
                    ? (items as Array<{ get?: (path: string) => unknown; set?: (path: string, value: unknown) => void }>)
                    : []
            }
            const observers = [...toObserverArray(editor.call?.('entities:list')), ...toObserverArray(editor.call?.('entities:raw'))]
            const observer = observers.find((candidate) => String(candidate?.get?.('resource_id') ?? '') === id)
            if (typeof observer?.set !== 'function') {
                throw new Error(`PlayCanvas Editor entity observer is not available for ${values.name}`)
            }
            const renderComponent = createRenderComponent('box')
            editor.call?.('entities:addComponent', [observer], 'render', renderComponent)
            for (const [path, value] of Object.entries({
                name: values.name,
                enabled: true,
                position: values.position,
                rotation: values.rotation,
                scale: values.scale,
                'components.render.type': 'box',
                'components.render.materialAssets': Array.isArray(renderComponent.materialAssets) ? renderComponent.materialAssets : [null]
            })) {
                observer.set(path, value)
            }
        }

        const ship = {
            name: 'MMOOMM Ship',
            position: [0, 0, 0] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
            scale: [12, 4, 4] as [number, number, number]
        }
        const station = {
            name: 'MMOOMM Station',
            position: [72, 0, -48] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
            scale: [48, 16, 16] as [number, number, number]
        }
        ensureKeyLight()
        updateEntity(shipEntity.id, ship)
        updateEntity(stationEntity.id, station)
        return { shipId: shipEntity.id, stationId: stationEntity.id }
    }, input)
}

const configureMmoommVisualLinkupLabScene = async (page: Page): Promise<void> => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await editorFrame.locator('body').evaluate(
        (
            _element,
            {
                variants,
                objectTypes,
                objectGlow,
                familyObjectGlow,
                objectGeometry,
                sceneFog,
                cameraClearColor,
                globalAmbient,
                materialBaseId
            }
        ) => {
            type EditorEntityObserver = {
                get?: (path: string) => unknown
                set?: (path: string, value: unknown) => void
                json?: () => Record<string, unknown>
            }
            const editor = (
                window as unknown as {
                    editor?: {
                        call?: (method: string, ...args: unknown[]) => unknown
                        method?: (method: string, handler: (...args: unknown[]) => unknown) => void
                        methodRemove?: (method: string) => void
                        emit?: (event: string, ...args: unknown[]) => void
                    }
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        dirty?: boolean
                        mmoommVisualLinkupLabMetadata?: unknown
                        mmoommVisualLinkupMaterialAssets?: unknown[]
                        mmoommVisualLinkupEntityMetadataByName?: Record<
                            string,
                            { mmoomm: { visualMaterial: VisualLinkupMaterialEvidence; lowPolyBands?: number } }
                        >
                    }
                }
            ).editor
            if (typeof editor?.call !== 'function') {
                throw new Error('PlayCanvas Editor API is not available for visual linkup lab authoring')
            }

            const toObserverArray = (value: unknown): EditorEntityObserver[] => {
                if (Array.isArray(value)) return value as EditorEntityObserver[]
                const list = value as { array?: () => unknown[] } | null | undefined
                if (typeof list?.array !== 'function') return []
                const items = list.array()
                return Array.isArray(items) ? (items as EditorEntityObserver[]) : []
            }
            const observers = () => [...toObserverArray(editor.call?.('entities:list')), ...toObserverArray(editor.call?.('entities:raw'))]
            const findObserver = (name: string) => observers().find((candidate) => candidate?.get?.('name') === name)
            const readObserverId = (observer: EditorEntityObserver | undefined): string => {
                const json = typeof observer?.json === 'function' ? observer.json() : null
                const value = observer?.get?.('resource_id') ?? json?.resource_id ?? json?.id
                return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
            }
            const createRenderComponent = (primitive: 'box' | 'sphere', materialAssetId: number) => {
                let render: Record<string, unknown> | null = null
                try {
                    const candidate = editor.call?.('components:getDefault', 'render')
                    render = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? { ...candidate } : null
                } catch {
                    render = null
                }
                return {
                    ...(render ?? { enabled: true }),
                    enabled: true,
                    type: primitive,
                    materialAssets: [materialAssetId]
                }
            }
            const createMaterialEvidence = (
                role: 'core' | 'glow' | 'variantMarker',
                materialAssetId: number,
                materialAssetName: string,
                opacity: number,
                glow?: [number, number, number]
            ) =>
                ({
                    role,
                    materialAssetId,
                    materialAssetName,
                    diffuse: [1, 1, 1] as [number, number, number],
                    opacity,
                    ...(glow ? { emissive: glow, emissiveIntensity: role === 'glow' ? 2.4 : 0.45 } : {}),
                    blendType: role === 'glow' ? 'additive' : 'normal',
                    depthWrite: false,
                    useFog: true
                } satisfies VisualLinkupMaterialEvidence)
            const createMaterialData = (material: VisualLinkupMaterialEvidence) => ({
                diffuse: material.diffuse,
                opacity: material.opacity,
                emissive: material.emissive ?? [0, 0, 0],
                emissiveIntensity: material.emissiveIntensity ?? 0,
                blendType: material.blendType === 'additive' ? 1 : 2,
                alphaTest: 0,
                depthTest: true,
                depthWrite: material.depthWrite,
                useFog: material.useFog,
                useLighting: true,
                useSkybox: false,
                shader: 'blinn'
            })
            const createMaterialAsset = (material: VisualLinkupMaterialEvidence) => {
                const data = createMaterialData(material)
                return {
                    id: String(material.materialAssetId),
                    name: material.materialAssetName,
                    type: 'material',
                    stableAssetId: `mmoomm-visual-linkup-${material.materialAssetId}`,
                    data,
                    metadata: {
                        mmoomm: {
                            visualMaterial: material
                        },
                        data,
                        editorDocument: {
                            data,
                            tags: ['mmoomm', 'visual-linkup-lab'],
                            preload: true,
                            source: false
                        }
                    }
                }
            }
            const entityMetadataByName: Record<
                string,
                { mmoomm: { visualMaterial: VisualLinkupMaterialEvidence; lowPolyBands?: number } }
            > = {}
            const materialAssetsById = new Map<number, ReturnType<typeof createMaterialAsset>>()
            const stageMaterialAsset = (material: VisualLinkupMaterialEvidence) => {
                materialAssetsById.set(material.materialAssetId, createMaterialAsset(material))
            }
            const ensureEntity = (input: {
                name: string
                primitive: 'box' | 'sphere'
                position: [number, number, number]
                rotation?: [number, number, number]
                scale: [number, number, number]
                visualMaterial: VisualLinkupMaterialEvidence
                lowPolyBands?: number | null
            }) => {
                stageMaterialAsset(input.visualMaterial)
                const existing = findObserver(input.name)
                const observer =
                    existing ??
                    (editor.call?.('entities:new', {
                        name: input.name,
                        parent: editor.call?.('entities:root'),
                        enabled: true,
                        position: input.position,
                        rotation: input.rotation ?? [0, 0, 0],
                        scale: input.scale,
                        components: { render: createRenderComponent(input.primitive, input.visualMaterial.materialAssetId) }
                    }) as EditorEntityObserver | undefined)
                if (!observer || typeof observer.set !== 'function') {
                    throw new Error(`Visual linkup lab entity ${input.name} observer is not available`)
                }
                const render = createRenderComponent(input.primitive, input.visualMaterial.materialAssetId)
                try {
                    editor.call?.('entities:addComponent', [observer], 'render', render)
                } catch {
                    // Existing render components are updated through observer paths below.
                }
                for (const [path, value] of Object.entries({
                    name: input.name,
                    enabled: true,
                    position: input.position,
                    rotation: input.rotation ?? [0, 0, 0],
                    scale: input.scale,
                    'components.render.enabled': true,
                    'components.render.type': input.primitive,
                    'components.render.materialAssets': [input.visualMaterial.materialAssetId]
                })) {
                    observer.set(path, value)
                }
                observer.set('metadata.mmoomm.visualMaterial', input.visualMaterial)
                if (Number.isFinite(input.lowPolyBands)) {
                    observer.set('metadata.mmoomm.lowPolyBands', input.lowPolyBands)
                }
                entityMetadataByName[input.name] = {
                    mmoomm: {
                        visualMaterial: input.visualMaterial,
                        ...(Number.isFinite(input.lowPolyBands) ? { lowPolyBands: Number(input.lowPolyBands) } : {})
                    }
                }
                return observer
            }
            const ensureLight = (name: string, position: [number, number, number], intensity: number) => {
                let light: Record<string, unknown> | null = null
                try {
                    const candidate = editor.call?.('components:getDefault', 'light')
                    light = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? { ...candidate } : null
                } catch {
                    light = null
                }
                const observer =
                    findObserver(name) ??
                    (editor.call?.('entities:new', {
                        name,
                        parent: editor.call?.('entities:root'),
                        enabled: true,
                        position,
                        rotation: [45, 45, 0],
                        scale: [1, 1, 1],
                        components: {
                            light: {
                                ...(light ?? { enabled: true }),
                                enabled: true,
                                type: 'directional',
                                color: [1, 1, 1],
                                intensity,
                                castShadows: false
                            }
                        }
                    }) as EditorEntityObserver | undefined)
                observer?.set?.('components.light.type', 'directional')
                observer?.set?.('components.light.color', [1, 1, 1])
                observer?.set?.('components.light.intensity', intensity)
            }
            const ensureCamera = (name: string, position: [number, number, number], rotation: [number, number, number]) => {
                let camera: Record<string, unknown> | null = null
                try {
                    const candidate = editor.call?.('components:getDefault', 'camera')
                    camera = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? { ...candidate } : null
                } catch {
                    camera = null
                }
                const observer =
                    findObserver(name) ??
                    (editor.call?.('entities:new', {
                        name,
                        parent: editor.call?.('entities:root'),
                        enabled: true,
                        position,
                        rotation,
                        scale: [1, 1, 1],
                        components: {
                            camera: {
                                ...(camera ?? { enabled: true }),
                                enabled: true,
                                clearColor: cameraClearColor,
                                clearColorBuffer: true,
                                clearDepthBuffer: true,
                                nearClip: 0.1,
                                farClip: 520,
                                fov: 58,
                                projection: 0,
                                priority: 0,
                                rect: [0, 0, 1, 1]
                            }
                        }
                    }) as EditorEntityObserver | undefined)
                if (!observer || typeof observer.set !== 'function') {
                    throw new Error(`Visual linkup lab camera ${name} observer is not available`)
                }
                try {
                    editor.call?.('entities:addComponent', [observer], 'camera', camera ?? { enabled: true })
                } catch {
                    // Existing camera components are updated through observer paths below.
                }
                for (const [path, value] of Object.entries({
                    name,
                    enabled: true,
                    position,
                    rotation,
                    scale: [1, 1, 1],
                    'components.camera.enabled': true,
                    'components.camera.clearColor': cameraClearColor,
                    'components.camera.clearColorBuffer': true,
                    'components.camera.clearDepthBuffer': true,
                    'components.camera.nearClip': 0.1,
                    'components.camera.farClip': 520,
                    'components.camera.fov': 58,
                    'components.camera.projection': 0,
                    'components.camera.priority': 0,
                    'components.camera.rect': [0, 0, 1, 1]
                })) {
                    observer.set(path, value)
                }
                if (observer.has?.('components.render')) {
                    try {
                        editor.call?.('entities:removeComponent', [observer], 'render')
                    } catch {
                        observer.unset?.('components.render')
                    }
                }
            }

            const objects: Array<Record<string, unknown>> = []
            const cellX = 32
            const cellZ = 24
            const applySceneVisualSettings = () => {
                const sceneSettings = editor.call?.('sceneSettings') as { set?: (path: string, value: unknown) => void } | null | undefined
                sceneSettings?.set?.('render.fog', sceneFog.type)
                sceneSettings?.set?.('render.fog_color', sceneFog.color)
                sceneSettings?.set?.('render.fog_density', sceneFog.density)
                sceneSettings?.set?.('render.global_ambient', globalAmbient)
                const projectUserSettings = editor.call?.('settings:projectUser') as
                    | { set?: (path: string, value: unknown) => void }
                    | null
                    | undefined
                projectUserSettings?.set?.('editor.cameraClearColor', cameraClearColor)
                projectUserSettings?.set?.('editor.showFog', true)
            }
            applySceneVisualSettings()
            variants.forEach((variant, index) => {
                const row = Math.floor(index / 4)
                const col = index % 4
                const baseX = (col - 1.5) * cellX
                const baseZ = (row - 1.5) * cellZ
                const variantName = `Linkup Lab ${String(index + 1).padStart(2, '0')} ${variant.title}`
                const variantMaterialId = materialBaseId + index * 100 + 1
                ensureEntity({
                    name: variantName,
                    primitive: 'box',
                    position: [baseX, -4, baseZ],
                    scale: [12, 0.25, 0.25],
                    visualMaterial: createMaterialEvidence('variantMarker', variantMaterialId, `${variantName} Material`, 0.22)
                })
                objectTypes.forEach((objectType, objectIndex) => {
                    const geometry = objectGeometry[objectType]
                    const glow = familyObjectGlow[variant.family]?.[objectType] ?? objectGlow[objectType]
                    const offsetX = (objectIndex - 1.5) * 6
                    const y = objectType.includes('Asteroid') ? 2.5 : 0
                    const position: [number, number, number] = [baseX + offsetX, y, baseZ]
                    const coreName = `Linkup Lab ${String(index + 1).padStart(2, '0')} ${objectType} Core`
                    const glowName = `Linkup Lab ${String(index + 1).padStart(2, '0')} ${objectType} Glow`
                    const coreMaterial = createMaterialEvidence(
                        'core',
                        materialBaseId + index * 100 + objectIndex * 10 + 2,
                        `${coreName} Material`,
                        variant.coreOpacity,
                        glow
                    )
                    const glowMaterial = createMaterialEvidence(
                        'glow',
                        materialBaseId + index * 100 + objectIndex * 10 + 3,
                        `${glowName} Material`,
                        variant.glowOpacity,
                        glow
                    )
                    const core = ensureEntity({
                        name: coreName,
                        primitive: geometry.primitive,
                        position,
                        scale: geometry.scale,
                        visualMaterial: coreMaterial,
                        lowPolyBands: variant.lowPolyBands ?? null
                    })
                    ensureEntity({
                        name: glowName,
                        primitive: geometry.primitive,
                        position,
                        scale: geometry.scale.map((value: number) => Number((value * variant.shellScale).toFixed(3))) as [
                            number,
                            number,
                            number
                        ],
                        visualMaterial: glowMaterial,
                        lowPolyBands: variant.lowPolyBands ?? null
                    })
                    objects.push({
                        id: readObserverId(core) || coreName,
                        name: coreName,
                        variant: variant.slug,
                        family: variant.family,
                        objectType,
                        primitive: geometry.primitive,
                        position: { x: position[0], y: position[1], z: position[2] },
                        scale: { x: geometry.scale[0], y: geometry.scale[1], z: geometry.scale[2] },
                        coreOpacity: variant.coreOpacity,
                        glowColor: { r: glow[0], g: glow[1], b: glow[2] },
                        glowOpacity: variant.glowOpacity,
                        shellScale: variant.shellScale,
                        lowPolyBands: variant.lowPolyBands ?? null,
                        material: {
                            core: coreMaterial,
                            glow: glowMaterial
                        }
                    })
                })
            })
            ensureCamera('MMOOMM Linkup Lab Camera', [0, 32, 135], [-14, 0, 0])
            ensureLight('MMOOMM Linkup Lab Key Light', [0, 52, 44], 5.8)
            ensureLight('MMOOMM Linkup Lab Fill Light', [-42, 34, 88], 2.4)

            const labMetadata = {
                version: 1,
                projectRole: 'visual-linkup-lab',
                variantCount: variants.length,
                objectTypes,
                variants: variants.map((variant, index) => ({ ...variant, index: index + 1 })),
                sceneFog,
                objects
            }
            const bridge = (
                window as unknown as {
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        dirty?: boolean
                        mmoommVisualLinkupLabMetadata?: typeof labMetadata
                        mmoommVisualLinkupMaterialAssets?: ReturnType<typeof createMaterialAsset>[]
                        mmoommVisualLinkupEntityMetadataByName?: typeof entityMetadataByName
                        hostedAssetAdapterInstalled?: boolean
                        hostedAssetObserverCount?: number
                        persistedAssetsLoadEmitted?: boolean
                    }
                }
            ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            if (bridge) {
                const materialAssets = Array.from(materialAssetsById.values())
                bridge.mmoommVisualLinkupLabMetadata = labMetadata
                bridge.mmoommVisualLinkupMaterialAssets = materialAssets
                bridge.mmoommVisualLinkupEntityMetadataByName = entityMetadataByName
                const assetObservers = materialAssets.map((asset) => ({
                    data: asset,
                    get: (path: string) =>
                        path
                            .split('.')
                            .filter(Boolean)
                            .reduce<unknown>(
                                (current, key) =>
                                    current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined,
                                asset
                            ),
                    json: () => ({ ...asset }),
                    toJSON: () => ({ ...asset }),
                    on: () => undefined,
                    once: () => undefined,
                    off: () => undefined
                }))
                for (const methodName of ['assets:list', 'assets:raw', 'assets:get', 'assets:loaded']) {
                    try {
                        editor.methodRemove?.(methodName)
                    } catch {
                        // The upstream Editor throws when a method is absent; replacing
                        // the test-local asset registry must stay idempotent.
                    }
                }
                editor.method?.('assets:list', () => assetObservers)
                editor.method?.('assets:raw', () => ({ data: assetObservers, array: () => assetObservers }))
                editor.method?.(
                    'assets:get',
                    (id: string | number) => assetObservers.find((observer) => String(observer.get('id')) === String(id)) ?? null
                )
                editor.method?.('assets:loaded', () => true)
                editor.emit?.('assets:load')
                editor.emit?.('assets:load:all')
                bridge.hostedAssetAdapterInstalled = true
                bridge.hostedAssetObserverCount = assetObservers.length
                bridge.persistedAssetsLoadEmitted = true
                bridge.dirty = true
            }
            editor.call?.('viewport:render')
            return labMetadata
        },
        {
            variants: LINKUP_VARIANTS,
            objectTypes: LINKUP_OBJECT_TYPES,
            objectGlow: LINKUP_OBJECT_GLOW,
            familyObjectGlow: LINKUP_FAMILY_OBJECT_GLOW,
            objectGeometry: LINKUP_OBJECT_GEOMETRY,
            metadataKey: MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY,
            sceneFog: LINKUP_SCENE_FOG,
            cameraClearColor: LINKUP_EDITOR_CAMERA_CLEAR_COLOR,
            globalAmbient: LINKUP_GLOBAL_AMBIENT,
            materialBaseId: LINKUP_EDITOR_MATERIAL_BASE_ID
        }
    )
}

export const expectMmoommVisualLinkupLabScene = async (page: Page, label: string) => {
    const expectedMaterialAssetCount = LINKUP_VARIANTS.length * (1 + LINKUP_OBJECT_TYPES.length * 2)
    let scene = (await readSerializedPlayCanvasEditorScene(page)) as {
        settings?: { render?: Record<string, unknown> }
        assets?: Array<{ id?: unknown; type?: unknown; data?: unknown; metadata?: Record<string, unknown> }>
        entities?: Array<{ name?: unknown; position?: unknown; scale?: unknown; components?: Record<string, unknown> }>
        metadata?: { mmoomm?: Record<string, unknown> }
    }
    const bridgeEvidence = await page
        .frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
        .locator('body')
        .evaluate(() => {
            const bridge = (
                window as unknown as {
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        mmoommVisualLinkupLabMetadata?: unknown
                        mmoommVisualLinkupMaterialAssets?: unknown[]
                    }
                }
            ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            const stagedMaterialAssets = Array.isArray(bridge?.mmoommVisualLinkupMaterialAssets)
                ? bridge.mmoommVisualLinkupMaterialAssets.filter((asset) => asset && typeof asset === 'object')
                : []
            return {
                metadata: bridge?.mmoommVisualLinkupLabMetadata ?? null,
                stagedMaterialAssets
            }
        })
    const entities = scene.entities ?? []
    const names = entities.map((entity) => entity.name)
    expect(names, `${label} must include the lab camera`).toContain('MMOOMM Linkup Lab Camera')
    expect(names, `${label} must include the lab key light`).toContain('MMOOMM Linkup Lab Key Light')
    const labCamera = entities.find((entity) => entity.name === 'MMOOMM Linkup Lab Camera')
    expect(labCamera?.components?.camera, `${label} camera must persist a PlayCanvas camera component`).toEqual(
        expect.objectContaining({ enabled: true })
    )
    expect(labCamera?.components?.render, `${label} camera must not be serialized as a render placeholder`).toBeUndefined()
    for (const [index, variant] of LINKUP_VARIANTS.entries()) {
        const prefix = `Linkup Lab ${String(index + 1).padStart(2, '0')}`
        expect(names, `${label} must include variant ${variant.title}`).toContain(`${prefix} ${variant.title}`)
        for (const objectType of LINKUP_OBJECT_TYPES) {
            expect(names, `${label} must include ${variant.slug} ${objectType} core`).toContain(`${prefix} ${objectType} Core`)
            expect(names, `${label} must include ${variant.slug} ${objectType} glow`).toContain(`${prefix} ${objectType} Glow`)
            const core = entities.find((entity) => entity.name === `${prefix} ${objectType} Core`)
            const glow = entities.find((entity) => entity.name === `${prefix} ${objectType} Glow`)
            for (const entity of [core, glow]) {
                const render = entity?.components?.render as { materialAssets?: unknown[] } | undefined
                expect(render?.materialAssets, `${label} ${String(entity?.name)} must reference a material asset`).toEqual([
                    expect.any(Number)
                ])
                expect(render?.materialAssets?.[0], `${label} ${String(entity?.name)} material asset id must be positive`).toBeGreaterThan(
                    0
                )
            }
        }
    }
    const referencedMaterialIds = new Set(
        entities
            .flatMap((entity) => {
                const render = entity.components?.render as { materialAssets?: unknown[] } | undefined
                return Array.isArray(render?.materialAssets) ? render.materialAssets : []
            })
            .filter((value): value is number => Number.isInteger(value) && Number(value) > 0)
            .map(String)
    )
    const readMaterialAssetsById = (payload: typeof scene) => {
        const materialAssetsById = new Map<string, { id?: unknown; type?: unknown; data?: unknown; metadata?: Record<string, unknown> }>()
        for (const asset of [...(payload.assets ?? []), ...bridgeEvidence.stagedMaterialAssets]) {
            const candidate = asset as { id?: unknown; type?: unknown; data?: unknown; metadata?: Record<string, unknown> }
            if (candidate.type !== 'material') continue
            if (typeof candidate.id !== 'string' && typeof candidate.id !== 'number') continue
            materialAssetsById.set(String(candidate.id), candidate)
        }
        return materialAssetsById
    }
    await expect
        .poll(
            async () => {
                const candidate = (await readSerializedPlayCanvasEditorScene(page)) as {
                    assets?: Array<{ id?: unknown; type?: unknown; data?: unknown; metadata?: Record<string, unknown> }>
                }
                return Array.from(readMaterialAssetsById(candidate as typeof scene).values()).filter((asset) => {
                    const metadataData = asset.metadata?.data
                    return Boolean(
                        asset.data &&
                            typeof asset.data === 'object' &&
                            metadataData &&
                            typeof metadataData === 'object' &&
                            asset.metadata?.mmoomm
                    )
                }).length
            },
            {
                message: `${label} must load scene-local material assets into the Editor asset registry`,
                timeout: 45_000,
                intervals: [500, 1_000, 2_000]
            }
        )
        .toBeGreaterThanOrEqual(expectedMaterialAssetCount)
    scene = (await readSerializedPlayCanvasEditorScene(page)) as typeof scene
    const materialAssetsById = readMaterialAssetsById(scene)
    const materialAssets = Array.from(materialAssetsById.values())
    expect(
        materialAssets.length,
        `${label} must persist material assets for variant markers, cores, and glow shells`
    ).toBeGreaterThanOrEqual(expectedMaterialAssetCount)
    for (const materialId of referencedMaterialIds) {
        const asset = materialAssetsById.get(materialId)
        expect(asset, `${label} referenced material ${materialId} must be present in scene assets`).toBeTruthy()
        expect(asset?.data, `${label} material ${materialId} must carry PlayCanvas material data`).toEqual(
            expect.objectContaining({ diffuse: expect.any(Array), opacity: expect.any(Number), useFog: true })
        )
        expect(asset?.metadata?.data, `${label} material ${materialId} metadata must mirror PlayCanvas material data`).toEqual(
            expect.objectContaining({ diffuse: expect.any(Array), opacity: expect.any(Number), useFog: true })
        )
        expect(asset?.metadata?.mmoomm, `${label} material ${materialId} must carry MMOOMM visual material metadata`).toEqual(
            expect.objectContaining({ visualMaterial: expect.any(Object) })
        )
    }
    const visualLab = (scene.metadata?.mmoomm?.[MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY] ?? bridgeEvidence.metadata) as
        | { variantCount?: unknown; objectTypes?: unknown; objects?: unknown; sceneFog?: unknown }
        | undefined
    expect(visualLab?.variantCount, `${label} metadata must record variant count`).toBe(LINKUP_VARIANTS.length)
    expect(visualLab?.objectTypes, `${label} metadata must record object type coverage`).toEqual(LINKUP_OBJECT_TYPES)
    expect(Array.isArray(visualLab?.objects) ? visualLab.objects.length : 0, `${label} metadata must record object evidence`).toBe(
        LINKUP_VARIANTS.length * LINKUP_OBJECT_TYPES.length
    )
    expect(visualLab?.sceneFog, `${label} metadata must record fog evidence`).toEqual(expect.objectContaining(LINKUP_SCENE_FOG))
    expect(scene.settings?.render, `${label} must persist real PlayCanvas scene fog settings`).toEqual(
        expect.objectContaining({
            fog: LINKUP_SCENE_FOG.type,
            fog_color: LINKUP_SCENE_FOG.color,
            fog_density: LINKUP_SCENE_FOG.density
        })
    )
    await expectMmoommVisualLabMaterialAssetsAvailableInEditor(page, label)
    await expectMmoommVisualLabLiveMaterialsApplied(page, label)
    await expectMmoommVisualLinkupEditorViewportReadable(page, `${label} viewport readability`)
    await expectPlayCanvasEditorCanvasPainted(page, `${label} viewport`)
    return scene
}

export const authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload = async (page: Page, metahubId: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await configureMmoommVisualLinkupLabScene(page)
    await expectMmoommVisualLinkupLabScene(page, 'MMOOMM visual linkup lab after authoring')
    await removeEmptyDefaultPlayCanvasEditorEntities(page, 'MMOOMM visual linkup lab cleanup')

    const visualLabSavePayload = await editorFrame.locator('body').evaluate(
        (_, { metadataKey, sceneFog, globalAmbient }) => {
            const bridge = (
                window as unknown as {
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        serializeCurrentScene?: () => Record<string, unknown>
                        mmoommVisualLinkupLabMetadata?: unknown
                        mmoommVisualLinkupMaterialAssets?: unknown[]
                        mmoommVisualLinkupEntityMetadataByName?: Record<
                            string,
                            { mmoomm?: { visualMaterial?: unknown; lowPolyBands?: unknown } }
                        >
                    }
                }
            ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            if (typeof bridge?.serializeCurrentScene !== 'function') {
                throw new Error('PlayCanvas Editor bridge serializer is not available for visual linkup lab save')
            }
            const serialized = bridge.serializeCurrentScene()
            const existingMetadata = serialized.metadata && typeof serialized.metadata === 'object' ? serialized.metadata : {}
            const existingMmoomm =
                (existingMetadata as { mmoomm?: unknown }).mmoomm && typeof (existingMetadata as { mmoomm?: unknown }).mmoomm === 'object'
                    ? ((existingMetadata as { mmoomm?: unknown }).mmoomm as Record<string, unknown>)
                    : {}
            const labMetadata = bridge.mmoommVisualLinkupLabMetadata
            if (!labMetadata || typeof labMetadata !== 'object') {
                throw new Error('Visual linkup lab metadata was not staged on the PlayCanvas Editor bridge')
            }
            const stagedMaterialAssets = Array.isArray(bridge.mmoommVisualLinkupMaterialAssets)
                ? bridge.mmoommVisualLinkupMaterialAssets.filter((asset) => asset && typeof asset === 'object')
                : []
            const entityMetadataByName =
                bridge.mmoommVisualLinkupEntityMetadataByName && typeof bridge.mmoommVisualLinkupEntityMetadataByName === 'object'
                    ? bridge.mmoommVisualLinkupEntityMetadataByName
                    : {}
            const entities = Array.isArray(serialized.entities)
                ? serialized.entities.map((entity) => {
                      if (!entity || typeof entity !== 'object' || Array.isArray(entity)) return entity
                      const name =
                          typeof (entity as { name?: unknown }).name === 'string' ? String((entity as { name?: unknown }).name) : ''
                      const mmoommMetadata = name ? entityMetadataByName[name]?.mmoomm : null
                      if (!mmoommMetadata || typeof mmoommMetadata !== 'object') return entity
                      const existingEntityMetadata =
                          (entity as { metadata?: unknown }).metadata &&
                          typeof (entity as { metadata?: unknown }).metadata === 'object' &&
                          !Array.isArray((entity as { metadata?: unknown }).metadata)
                              ? ((entity as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>)
                              : {}
                      const existingEntityMmoomm =
                          existingEntityMetadata.mmoomm &&
                          typeof existingEntityMetadata.mmoomm === 'object' &&
                          !Array.isArray(existingEntityMetadata.mmoomm)
                              ? (existingEntityMetadata.mmoomm as Record<string, unknown>)
                              : {}
                      return {
                          ...entity,
                          metadata: {
                              ...existingEntityMetadata,
                              mmoomm: {
                                  ...existingEntityMmoomm,
                                  ...mmoommMetadata
                              }
                          }
                      }
                  })
                : serialized.entities
            const assetsById = new Map<string, unknown>()
            if (Array.isArray(serialized.assets)) {
                for (const asset of serialized.assets) {
                    if (!asset || typeof asset !== 'object') continue
                    const id = (asset as { id?: unknown }).id
                    if (typeof id === 'string' || typeof id === 'number') assetsById.set(String(id), asset)
                }
            }
            for (const asset of stagedMaterialAssets) {
                const id = (asset as { id?: unknown }).id
                if (typeof id === 'string' || typeof id === 'number') assetsById.set(String(id), asset)
            }
            return {
                ...serialized,
                settings: {
                    ...((serialized.settings && typeof serialized.settings === 'object' ? serialized.settings : {}) as Record<
                        string,
                        unknown
                    >),
                    render: {
                        ...(((serialized.settings as { render?: unknown } | undefined)?.render &&
                        typeof (serialized.settings as { render?: unknown }).render === 'object'
                            ? ((serialized.settings as { render?: Record<string, unknown> }).render as Record<string, unknown>)
                            : {}) as Record<string, unknown>),
                        global_ambient: globalAmbient,
                        fog: sceneFog.type,
                        fog_color: sceneFog.color,
                        fog_density: sceneFog.density
                    }
                },
                entities,
                assets: Array.from(assetsById.values()),
                metadata: {
                    ...existingMetadata,
                    mmoomm: {
                        ...existingMmoomm,
                        [String(metadataKey)]: labMetadata
                    }
                }
            }
        },
        { metadataKey: MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY, sceneFog: LINKUP_SCENE_FOG, globalAmbient: LINKUP_GLOBAL_AMBIENT }
    )
    await saveSerializedPlayCanvasEditorSceneThroughCompatibilityRest(page, metahubId, visualLabSavePayload)
    const savePayload = visualLabSavePayload as {
        entities?: Array<{ name?: unknown }>
        metadata?: { mmoomm?: Record<string, unknown> }
    }
    expect(savePayload?.entities).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'MMOOMM Linkup Lab Key Light' })]))
    expect(savePayload?.metadata?.mmoomm?.[MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY]).toEqual(
        expect.objectContaining({ variantCount: LINKUP_VARIANTS.length })
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_, metadataKey) => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => {
                                    entities?: Array<{ name?: unknown }>
                                    metadata?: { mmoomm?: Record<string, unknown> }
                                }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const payload = bridge?.serializeCurrentScene?.()
                    return {
                        hasLabLight: payload?.entities?.some((entity) => entity.name === 'MMOOMM Linkup Lab Key Light') === true,
                        variantCount: (payload?.metadata?.mmoomm?.[metadataKey] as { variantCount?: unknown } | undefined)?.variantCount
                    }
                }, MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY),
            { timeout: 20_000 }
        )
        .toEqual({ hasLabLight: true, variantCount: LINKUP_VARIANTS.length })
    await expectMmoommVisualLinkupLabScene(page, 'MMOOMM visual linkup lab after editor reload')
}

export const authorMmoommSceneThroughPlayCanvasEditorAndExpectReload = async (page: Page, metahubId: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId)
    const sceneId = String(compatibilityConfig.defaultSceneId)
    const shipEntity = await createSerializablePlayCanvasEditorEntity(page)
    const stationEntity = await createSerializablePlayCanvasEditorEntity(page)
    const authoredScene = await configureMmoommSceneFromUserCreatedEntities(page, { shipEntity, stationEntity })
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(() => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                dirty?: boolean
                                serializeCurrentScene?: () => { entities?: Array<{ name?: unknown }> }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const payload = bridge?.serializeCurrentScene?.()
                    return {
                        dirty: bridge?.dirty === true,
                        entityNames: (payload?.entities ?? []).map((entity) => entity.name)
                    }
                }),
            { timeout: 10_000 }
        )
        .toEqual(
            expect.objectContaining({
                dirty: true,
                entityNames: expect.arrayContaining(['MMOOMM Ship', 'MMOOMM Station'])
            })
        )
    expect(authoredScene).toEqual({ shipId: shipEntity.id, stationId: stationEntity.id })
    await expectMmoommEditorEntitiesVisible(page, 'MMOOMM scene after native editor authoring')
    await removeEmptyDefaultPlayCanvasEditorEntities(page, 'MMOOMM scene after native editor authoring cleanup')

    const savePayload = (await readSerializedPlayCanvasEditorScene(page)) as {
        entities?: Array<{ id?: unknown; name?: unknown }>
    } & Record<string, unknown>
    const { requestId: saveRequestId } = await saveSerializedPlayCanvasEditorSceneThroughCompatibilityRest(page, metahubId, savePayload)
    expect(saveRequestId).toEqual(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
    expect(savePayload?.entities).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'MMOOMM Ship' }), expect.objectContaining({ name: 'MMOOMM Station' })])
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(() => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => { entities?: Array<{ name?: unknown }> }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const payload = bridge?.serializeCurrentScene?.()
                    return { entityNames: (payload?.entities ?? []).map((entity) => entity.name) }
                }),
            { timeout: 20_000 }
        )
        .toEqual(
            expect.objectContaining({
                entityNames: expect.arrayContaining(['MMOOMM Ship', 'MMOOMM Station'])
            })
        )
    await expectMmoommEditorEntitiesVisible(page, 'MMOOMM scene after editor reload')
    const realtimeSceneErrorDiagnostics = await editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    lastRealtimeSceneError?: unknown
                    lastRealtimeSceneErrorSceneId?: unknown
                    lastRealtimeSceneErrorEntityOps?: unknown
                    lastRealtimeSceneErrorEntityOpPath?: unknown
                    recentRealtimeEntityOps?: unknown
                    lastRealtimeEntityOpPath?: unknown
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        return {
            lastRealtimeSceneError: bridge?.lastRealtimeSceneError,
            lastRealtimeSceneErrorSceneId: bridge?.lastRealtimeSceneErrorSceneId,
            lastRealtimeSceneErrorEntityOps: bridge?.lastRealtimeSceneErrorEntityOps,
            lastRealtimeSceneErrorEntityOpPath: bridge?.lastRealtimeSceneErrorEntityOpPath,
            recentRealtimeEntityOps: bridge?.recentRealtimeEntityOps,
            lastRealtimeEntityOpPath: bridge?.lastRealtimeEntityOpPath
        }
    })
    expect(
        realtimeSceneErrorDiagnostics.lastRealtimeSceneError,
        `PlayCanvas Editor realtime scene must not emit ShareDB errors. Diagnostics: ${JSON.stringify(realtimeSceneErrorDiagnostics)}`
    ).toBeUndefined()
    await expectPlayCanvasEditorHierarchyContextMenuResponsive(page, 'MMOOMM scene after editor reload')

    const shipId = shipEntity.id
    await editorFrame.locator('body').evaluate((_element, expectedShipId: string) => {
        const editor = (
            window as unknown as {
                editor?: {
                    api?: {
                        globals?: { entities?: { get?: (id: string) => { observer?: { set?: (path: string, value: unknown) => void } } } }
                    }
                }
            }
        ).editor
        const observer = editor?.api?.globals?.entities?.get?.(expectedShipId)?.observer
        if (!observer || typeof observer.set !== 'function') {
            throw new Error('MMOOMM Ship observer was not available for transform persistence proof')
        }
        observer.set('position', [18, 3, -9])
    }, shipId)

    await saveSerializedPlayCanvasEditorSceneThroughCompatibilityRest(
        page,
        metahubId,
        (await readSerializedPlayCanvasEditorScene(page)) as Record<string, unknown>
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(() => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => {
                                    entities?: Array<{ id?: unknown; name?: unknown; position?: unknown }>
                                }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const payload = bridge?.serializeCurrentScene?.()
                    const ship = payload?.entities?.find((entity) => entity.name === 'MMOOMM Ship')
                    return { shipPosition: ship?.position }
                }),
            { timeout: 20_000 }
        )
        .toEqual({ shipPosition: [18, 3, -9] })

    const sceneAfterReloadResponse = await page.request.get(
        new URL(`${compatibilityConfig.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(),
        { headers: createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig) }
    )
    expect(sceneAfterReloadResponse.status()).toBe(200)
    const sceneAfterReload = (await sceneAfterReloadResponse.json()) as {
        item?: {
            scene?: { checksum?: unknown }
            payload?: { entities?: Array<{ name?: unknown }> }
        }
    }
    expect(sceneAfterReload.item?.scene?.checksum).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/i))
    expect(sceneAfterReload.item?.payload?.entities).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'MMOOMM Ship' }), expect.objectContaining({ name: 'MMOOMM Station' })])
    )
}

/**
 * Download the metahub snapshot envelope through the user-facing MetahubList
 * card action and return its parsed JSON. The download is intercepted via the
 * Playwright download event, written to disk for debugging, and re-parsed so
 * the rest of the generator can assert on the envelope shape.
 */
export const exportMetahubSnapshotThroughBrowser = async (page: Page, metahubId: string, downloadPath: string) => {
    await page.goto('/metahubs')
    const menuTrigger = page.getByTestId(`entity-menu-trigger-metahub-${metahubId}`)
    await expect(menuTrigger, 'MetahubList menu trigger for the generated metahub must be visible').toBeVisible()
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
    await menuTrigger.click()
    await page.getByTestId(`entity-menu-item-metahub-exportRuntime-${metahubId}`).click()
    const download = await downloadPromise
    expect(download.suggestedFilename(), 'Metahub snapshot download must be a JSON file').toMatch(/\.json$/i)
    await download.saveAs(downloadPath)
    const fileContent = await readFile(downloadPath, 'utf8')
    return validateSnapshotEnvelope(JSON.parse(fileContent) as Record<string, unknown>)
}
