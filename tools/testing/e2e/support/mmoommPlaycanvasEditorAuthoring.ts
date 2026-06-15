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
    playCanvasEditorSaveShortcut,
    playCanvasEditorVisibleMenuItemXPath,
    readSerializedPlayCanvasEditorScene,
    readPlayCanvasEditorSceneSavePayload,
    waitForPlayCanvasEditorSceneSave,
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
    colorBuckets: number
    bounds: NonNullable<MmoommEditorProjectionEvidence['bounds']>
}

const MMOOMM_EDITOR_ENTITY_NAMES = ['MMOOMM Ship', 'MMOOMM Station'] as const
const MMOOMM_EDITOR_LIGHT_NAME = 'MMOOMM Key Light'

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

    for (let y = minY; y <= maxY; y += sampleStepY) {
        for (let x = minX; x <= maxX; x += sampleStepX) {
            const index = (y * png.width + x) * 4
            const alpha = png.data[index + 3] ?? 0
            if (alpha < 16) continue
            const red = png.data[index] ?? 0
            const green = png.data[index + 1] ?? 0
            const blue = png.data[index + 2] ?? 0
            sampleCount += 1
            buckets.add(`${Math.floor(red / 24)}:${Math.floor(green / 24)}:${Math.floor(blue / 24)}`)
            if (red >= 105 && green >= 105 && blue >= 105) {
                lightPixelCount += 1
            }
        }
    }

    return {
        pngWidth: png.width,
        pngHeight: png.height,
        sampleCount,
        lightPixelCount,
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

const readMmoommEditorProjectionEvidence = async (page: Page) => {
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
    }, MMOOMM_EDITOR_ENTITY_NAMES)
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

export const expectImportedMmoommSceneThroughFullscreenEditor = async (page: Page, metahubId: string, testInfo: TestInfo) => {
    await page.goto(`/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen`)
    await expect(page).toHaveURL(new RegExp(`/metahub/${metahubId}/resources/packages/playcanvas-editor/editor/fullscreen$`))
    await expectPlayCanvasEditorIframeLoaded(page)
    await expectPlayCanvasEditorFullscreenHost(page)
    await expectNoPageHorizontalOverflow(page, 'Imported MMOOMM fullscreen PlayCanvas Editor')
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

    const saveResponsePromise = waitForPlayCanvasEditorSceneSave(page, metahubId)
    await page.locator('iframe[data-testid="playcanvas-editor-frame"]').click({ position: { x: 100, y: 100 } })
    await page.keyboard.press(playCanvasEditorSaveShortcut)
    const saveResponse = await saveResponsePromise
    expect(saveResponse.status()).toBe(200)
    const savePayload = readPlayCanvasEditorSceneSavePayload(saveResponse) as {
        entities?: Array<{ name?: unknown; position?: unknown }>
    }
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

    const saveResponsePromise = waitForPlayCanvasEditorSceneSave(page, metahubId)
    await page.locator('iframe[data-testid="playcanvas-editor-frame"]').click({ position: { x: 100, y: 100 } })
    await page.keyboard.press(playCanvasEditorSaveShortcut)
    const saveResponse = await saveResponsePromise
    expect(saveResponse.status()).toBe(200)
    const saveRequestBody = saveResponse.request().postDataJSON() as {
        requestId?: unknown
        command?: { requestId?: unknown }
    }
    const savePayload = readPlayCanvasEditorSceneSavePayload(saveResponse) as { entities?: Array<{ id?: unknown; name?: unknown }> } | null
    const saveRequestId = saveRequestBody.requestId ?? saveRequestBody.command?.requestId
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

    const transformSaveResponsePromise = waitForPlayCanvasEditorSceneSave(page, metahubId)
    await page.locator('iframe[data-testid="playcanvas-editor-frame"]').click({ position: { x: 100, y: 100 } })
    await page.keyboard.press(playCanvasEditorSaveShortcut)
    const transformSaveResponse = await transformSaveResponsePromise
    expect(transformSaveResponse.status()).toBe(200)

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
