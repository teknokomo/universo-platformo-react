import { randomUUID } from 'node:crypto'

import { createLocalizedContent } from '@universo-react/utils'
import type { Locator, Page, Request, Route } from '@playwright/test'
import { PNG } from 'pngjs'

import { expect, test } from '../../fixtures/test'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getAssignableRoles
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext } from '../../support/backend/personas.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocatorHasNoInlineOverflow,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    expectRuntimeUxViewportMatrix,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'

const resolveUserRoleIds = (roles: Array<{ id?: string; codename?: string }>): string[] => {
    const userRole = roles.find((role) => String(role.codename ?? '').toLowerCase() === 'user') ?? roles[0]
    return userRole?.id ? [userRole.id] : []
}

const rawPackageTextPatterns = [/@universo-react\//, /@colyseus\//, /\bcolyseus\.js\b/i]
const playCanvasEditorSaveShortcut = process.platform === 'darwin' ? 'Meta+S' : 'Control+S'
type PlayCanvasEditorUiMode = 'upstream-toolbar'
const escapeXPathText = (value: string) => value.replace(/"/g, '\\"')
const playCanvasEditorMenuItemXPath = (label: string) =>
    `xpath=.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu-item ")][.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-label ") and normalize-space(.)="${escapeXPathText(
        label
    )}"]]`
const playCanvasEditorVisibleMenuItemXPath = (label: string) =>
    `xpath=//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu ") and not(contains(concat(" ", normalize-space(@class), " "), " pcui-hidden "))]//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu-item ")][.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-label ") and normalize-space(.)="${escapeXPathText(
        label
    )}"]]`
const expectNumericCompatibleId = (value: unknown, label: string) => {
    if (typeof value === 'number') {
        expect(Number.isInteger(value) && value > 0, `${label} must be a positive integer`).toBe(true)
        return
    }
    if (typeof value === 'string') {
        expect(value, `${label} must be a positive integer string after upstream scene load`).toMatch(/^[1-9]\d*$/)
        return
    }
    expect(value, `${label} must be numeric-compatible`).toEqual(expect.any(Number))
}

const expectPngScreenshotNonBlank = (screenshot: Buffer, label: string) => {
    const png = PNG.sync.read(screenshot)
    const buckets = new Set<string>()
    let sampledOpaquePixels = 0
    const { data, height, width } = png
    const sampleStepX = Math.max(1, Math.floor(width / 24))
    const sampleStepY = Math.max(1, Math.floor(height / 24))
    for (let y = 0; y < height; y += sampleStepY) {
        for (let x = 0; x < width; x += sampleStepX) {
            const index = (y * width + x) * 4
            const alpha = data[index + 3] ?? 0
            if (alpha === 0) continue
            sampledOpaquePixels += 1
            const red = Math.floor((data[index] ?? 0) / 32)
            const green = Math.floor((data[index + 1] ?? 0) / 32)
            const blue = Math.floor((data[index + 2] ?? 0) / 32)
            buckets.add(`${red}:${green}:${blue}`)
        }
    }
    for (let index = 0; index < data.length && buckets.size <= 1; index += 4 * 97) {
        const alpha = data[index + 3] ?? 0
        if (alpha === 0) continue
        sampledOpaquePixels += 1
        const red = Math.floor((data[index] ?? 0) / 32)
        const green = Math.floor((data[index + 1] ?? 0) / 32)
        const blue = Math.floor((data[index + 2] ?? 0) / 32)
        buckets.add(`${red}:${green}:${blue}`)
    }
    expect(sampledOpaquePixels, `${label} must contain painted opaque pixels`).toBeGreaterThan(20)
    expect(buckets.size, `${label} must contain more than one sampled color bucket`).toBeGreaterThan(1)
    expect(new Set(screenshot).size, `${label} PNG bytes must not be uniform`).toBeGreaterThan(16)
}

const expectPlayCanvasEditorCanvas3dPainted = async (page: Page, label = 'PlayCanvas Editor 3D canvas') => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const viewport = editorFrame.locator('#layout-viewport')
    const canvasHost = editorFrame.locator('#canvas-3d')
    await expect(viewport, `${label} viewport must be visible`).toBeVisible()
    await expect(canvasHost, `${label} host must be visible`).toBeVisible()
    await expect(canvasHost, `${label} host must be unique`).toHaveCount(1)
    const viewportBox = await viewport.boundingBox()
    const canvasBox = await canvasHost.boundingBox()
    expect(viewportBox, `${label} viewport must have a bounding box`).toBeTruthy()
    expect(canvasBox, `${label} host must have a bounding box`).toBeTruthy()
    if (!viewportBox || !canvasBox) return
    const minimumCanvasWidth = Math.min(200, Math.max(80, viewportBox.width * 0.75))
    const minimumCanvasHeight = Math.min(120, Math.max(80, viewportBox.height * 0.5))
    expect(canvasBox.width, `${label} width`).toBeGreaterThan(minimumCanvasWidth)
    expect(canvasBox.height, `${label} height`).toBeGreaterThan(minimumCanvasHeight)
    expect(canvasBox.x, `${label} must start inside viewport`).toBeGreaterThanOrEqual(viewportBox.x - 2)
    expect(canvasBox.y, `${label} must start inside viewport`).toBeGreaterThanOrEqual(viewportBox.y - 2)
    expect(canvasBox.x + canvasBox.width, `${label} must end inside viewport`).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 2)
    expect(canvasBox.y + canvasBox.height, `${label} must end inside viewport`).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 2)
    expect(canvasBox.width * canvasBox.height, `${label} must occupy most of the viewport`).toBeGreaterThan(
        viewportBox.width * viewportBox.height * 0.6
    )
    const canvasMetrics = await canvasHost.evaluate((element) => {
        const host = element as HTMLElement
        const directCanvas = host instanceof HTMLCanvasElement ? host : null
        const nestedCanvas = host.querySelector('canvas') as HTMLCanvasElement | null
        const viewportCanvas = document.querySelector('#layout-viewport canvas') as HTMLCanvasElement | null
        const canvas = directCanvas ?? nestedCanvas ?? viewportCanvas
        return {
            clientWidth: host.clientWidth,
            clientHeight: host.clientHeight,
            hasCanvas: Boolean(canvas),
            backingWidth: canvas?.width ?? 0,
            backingHeight: canvas?.height ?? 0
        }
    })
    expect(canvasMetrics.clientWidth, `${label} client width`).toBeGreaterThan(minimumCanvasWidth)
    expect(canvasMetrics.clientHeight, `${label} client height`).toBeGreaterThan(minimumCanvasHeight)
    expect(canvasMetrics.hasCanvas, `${label} must expose a PlayCanvas canvas element`).toBe(true)
    expect(canvasMetrics.backingWidth, `${label} backing width`).toBeGreaterThan(0)
    expect(canvasMetrics.backingHeight, `${label} backing height`).toBeGreaterThan(0)
    expectPngScreenshotNonBlank(await canvasHost.screenshot(), label)
}
type PlayCanvasEditorCompatibilityConfig = {
    mode?: unknown
    projectId?: unknown
    defaultSceneId?: unknown
    permissions?: { admin?: unknown; write?: unknown }
    auth?: {
        scheme?: unknown
        headerName?: string
        accessToken?: string
        expiresAt?: unknown
    }
    csrf?: { tokenUrl?: string; headerName?: string }
    endpoints?: { scenes?: string; assets?: string; settings?: string; cloudOnly?: string }
}
type PlayCanvasEditorRuntimeConfig = {
    projectId: string
    sceneId: string
    accessToken?: string
    restBaseUrl?: string
    compatibilityConfig?: PlayCanvasEditorCompatibilityConfig
    restCompatibilityConfig?: PlayCanvasEditorCompatibilityConfig
}

const isTransientFrameNavigationError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return /Execution context was destroyed|Frame was detached|Target closed|Cannot find context with specified id/i.test(message)
}

const projectCardByName = (projectsPanel: Locator, projectName: string) =>
    projectsPanel.getByRole('heading', { name: projectName }).locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')

const expectImageLoaded = async (image: Locator, label: string) => {
    await expect(image, `${label} must be visible`).toBeVisible()
    const imageState = await image.evaluate((node) => {
        const element = node as HTMLImageElement
        return {
            alt: element.alt,
            src: element.getAttribute('src') ?? '',
            complete: element.complete,
            naturalWidth: element.naturalWidth,
            naturalHeight: element.naturalHeight
        }
    })

    expect(imageState.alt, `${label} must have useful alt text`).toBeTruthy()
    expect(imageState.src, `${label} must have a non-empty source`).toBeTruthy()
    expect(imageState.complete, `${label} must finish loading`).toBeTruthy()
    expect(imageState.naturalWidth, `${label} must have loaded pixels`).toBeGreaterThan(0)
    expect(imageState.naturalHeight, `${label} must have loaded pixels`).toBeGreaterThan(0)
}

const tamperTokenizedArtifactUrl = (artifactUrl: string, baseUrl: string): string => {
    const url = new URL(artifactUrl, baseUrl)
    const pathParts = url.pathname.split('/')
    const tokenIndex = pathParts.findIndex((part) => part === 'editor-artifact-token') + 1
    expect(tokenIndex, 'artifact URL must contain a token segment').toBeGreaterThan(0)
    const token = pathParts[tokenIndex] ?? ''
    const replacement = token.endsWith('a') ? 'b' : 'a'
    pathParts[tokenIndex] = `${token.slice(0, -1)}${replacement}`
    url.pathname = pathParts.join('/')
    return url.toString()
}

const openPlayCanvasEditorSettingsDialog = async (page: Page) => {
    const editorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
    await editorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
    await page.getByRole('menuitem', { name: 'Settings' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    const dialog = page.getByRole('dialog', { name: 'Package display settings' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
    await waitForLayoutFrame(page)
    return dialog
}

const scrollPackagesTableActionsIntoViewByGesture = async (page: Page) => {
    const table = page.getByRole('table', { name: /Packages|Пакеты/ })
    const container = table.locator('xpath=./ancestor::*[contains(@class, "MuiTableContainer-root")][1]')
    await expect(container).toBeVisible()
    await container.hover()
    await page.mouse.wheel(1200, 0)

    await expect.poll(() => container.evaluate((element) => (element as HTMLElement).scrollLeft)).toBeGreaterThan(0)
}

const expectPlayCanvasEditorIframeLoaded = async (page: Page, locale: 'en' | 'ru' = 'en'): Promise<PlayCanvasEditorUiMode> => {
    const editorIframe = page.locator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect(editorIframe).toBeVisible()
    await expect(editorIframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
    await expect(editorIframe).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect(editorIframe).toHaveAttribute('allow', '')
    await expect(editorIframe).toHaveAttribute('tabindex', '0')
    await expect(editorIframe).toHaveAttribute('src', new RegExp(`[?&]locale=${locale}(?:&|$)`))

    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect(editorFrame.locator('body')).toHaveAttribute('data-universo-playcanvas-editor-hosted', 'true')
    await expect(editorFrame.locator('body')).not.toContainText('Artifact Unavailable')
    await expect(editorFrame.locator('body')).not.toContainText('artifact-only integration surface')
    await expectNoVisibleTextPatterns(
        editorFrame.locator('body'),
        [
            /editor-artifact-token\/[^/]+/i,
            /playcanvas-projects\//i,
            /sessionToken/i,
            /artifactToken/i,
            /bootstrapRequestId/i,
            /\[object Object\]/
        ],
        { label: 'PlayCanvas Editor iframe body' }
    )
    await expectNoTechnicalLeakage(editorFrame.locator('body'), {
        label: 'PlayCanvas Editor iframe body',
        checkUuidSubstrings: true
    })

    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(() => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                ready?: boolean
                                initialized?: boolean
                                bootstrapRequestId?: unknown
                                securityRejectedMessages?: unknown
                                lastRejectedMessageReason?: unknown
                                trustedParentOrigin?: unknown
                                storageError?: { message?: unknown }
                                serializeError?: { message?: unknown }
                                saveError?: { message?: unknown }
                                compatibilityProtocol?: { data?: { protocol?: { mode?: unknown; endpoints?: unknown } } }
                                compatibilityConfig?: { mode?: unknown }
                                fullBootMode?: boolean
                                hostedEntityAdapterInstalled?: boolean
                                lastWebSocketUrl?: unknown
                                lastWebSocketOpenUrl?: unknown
                                lastWebSocketClose?: unknown
                                lastWebSocketErrorUrl?: unknown
                                webSocketEvents?: unknown
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const config = (window as unknown as { config?: { mode?: unknown; url?: unknown } }).config
                    const realtime = (
                        window as unknown as {
                            editor?: {
                                api?: {
                                    globals?: {
                                        realtime?: {
                                            connection?: {
                                                connected?: unknown
                                                authenticated?: unknown
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ).editor?.api?.globals?.realtime
                    const websocketEvents = Array.isArray(bridge?.webSocketEvents) ? bridge.webSocketEvents : []
                    const openedWebSocketUrls = websocketEvents
                        .filter((event): event is { type?: unknown; url?: unknown } => Boolean(event && typeof event === 'object'))
                        .filter((event) => event.type === 'open' && typeof event.url === 'string')
                        .map((event) => String(event.url))
                    const connectionOverlayText = document.querySelector('.connection-overlay')?.textContent?.trim() ?? ''
                    return {
                        ready: bridge?.ready === true,
                        initialized: bridge?.initialized === true,
                        hasBootstrapRequestId: typeof bridge?.bootstrapRequestId === 'string',
                        securityRejectedMessages: bridge?.securityRejectedMessages,
                        lastRejectedMessageReason: bridge?.lastRejectedMessageReason,
                        hasTrustedParentOrigin: typeof bridge?.trustedParentOrigin === 'string' && bridge.trustedParentOrigin.length > 0,
                        storageError: typeof bridge?.storageError?.message === 'string' ? bridge.storageError.message.slice(0, 120) : null,
                        serializeError:
                            typeof bridge?.serializeError?.message === 'string' ? bridge.serializeError.message.slice(0, 120) : null,
                        saveError: typeof bridge?.saveError?.message === 'string' ? bridge.saveError.message.slice(0, 120) : null,
                        fullBootMode: bridge?.fullBootMode === true,
                        hostedEntityAdapterInstalled: bridge?.hostedEntityAdapterInstalled === true,
                        compatibilityConfigMode: bridge?.compatibilityConfig?.mode,
                        configMode: config?.mode,
                        usesDisabledEndpoint: JSON.stringify(config?.url ?? {}).includes('/disabled'),
                        realtimeConnected: realtime?.connection?.connected === true,
                        realtimeAuthenticated: realtime?.connection?.authenticated === true,
                        lastWebSocketOpenUrl: bridge?.lastWebSocketOpenUrl,
                        lastWebSocketErrorUrl: bridge?.lastWebSocketErrorUrl,
                        hasRealtimeWebSocketOpen: openedWebSocketUrls.some((url) => url.includes('/realtime')),
                        hasDisabledWebSocketOpen: openedWebSocketUrls.some((url) => url.includes('/disabled')),
                        connectionOverlayText
                    }
                }),
            { timeout: 60_000 }
        )
        .toEqual(
            expect.objectContaining({
                ready: true,
                initialized: true,
                hasBootstrapRequestId: true,
                fullBootMode: true,
                hostedEntityAdapterInstalled: false,
                compatibilityConfigMode: 'universo-full-upstream-ui',
                configMode: 'universo-full-upstream-ui',
                usesDisabledEndpoint: false,
                realtimeConnected: true,
                realtimeAuthenticated: true,
                lastWebSocketErrorUrl: undefined,
                hasRealtimeWebSocketOpen: true,
                hasDisabledWebSocketOpen: false,
                connectionOverlayText: ''
            })
        )
    const hostedConfig = await editorFrame.locator('body').evaluate(() => {
        const config = (
            window as unknown as {
                config?: {
                    project?: { id?: unknown }
                    scene?: { id?: unknown }
                }
            }
        ).config
        return {
            projectId: config?.project?.id,
            sceneId: config?.scene?.id
        }
    })
    expectNumericCompatibleId(hostedConfig.projectId, 'PlayCanvas full-boot project id')
    expectNumericCompatibleId(hostedConfig.sceneId, 'PlayCanvas full-boot scene id')

    const editorBox = await editorIframe.boundingBox()
    expect(editorBox?.width ?? 0).toBeGreaterThan(200)
    expect(editorBox?.height ?? 0).toBeGreaterThan(100)

    const uiMode = await getPlayCanvasEditorUiMode(page)
    await expect(editorFrame.locator('#layout-root')).toBeVisible()
    await expect(editorFrame.locator('#layout-toolbar')).toBeVisible()
    await expect(editorFrame.locator('#layout-hierarchy')).toBeVisible()
    await expect(editorFrame.locator('#layout-viewport')).toBeVisible()
    await expect(editorFrame.locator('#canvas-3d')).toBeVisible()
    await expectPlayCanvasEditorCanvas3dPainted(page)
    await expect(editorFrame.locator('#layout-assets')).toBeVisible()
    await expect(editorFrame.locator('#layout-attributes')).toBeVisible()
    await expect(editorFrame.locator('[data-universo-playcanvas-editor-hosted-entities]')).toHaveCount(0)
    await expect(page.getByText(locale === 'ru' ? 'Несохранённые изменения' : 'Unsaved changes')).toHaveCount(0)
    await expect(
        page.getByText(locale === 'ru' ? 'Редактор сообщает о несохранённых изменениях.' : 'The editor reports unsaved changes.')
    ).toHaveCount(0)
    return uiMode
}

const expectPlayCanvasEditorFullscreenHost = async (page: Page) => {
    await expect(page.getByTestId('playcanvas-editor-fullscreen-host')).toBeVisible()
    await expect(page.getByTestId('playcanvas-editor-fullscreen-chrome')).toHaveCount(0)
    await expect(page.getByTestId('playcanvas-editor-host-chrome')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /back to packages/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0)
    await expect(page.getByText('PlayCanvas Editor')).toHaveCount(0)
    await expect(page.getByTestId('metahub-packages-tab')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Resources' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /Packages|Пакеты/ })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)

    const viewport = page.viewportSize()
    const iframeBox = await page.locator('iframe[data-testid="playcanvas-editor-frame"]').boundingBox()
    expect(iframeBox, 'fullscreen PlayCanvas Editor iframe must have layout bounds').toBeTruthy()
    if (viewport && iframeBox) {
        expect(iframeBox.width, 'fullscreen PlayCanvas Editor iframe must fill most of the viewport width').toBeGreaterThan(
            viewport.width * 0.95
        )
        expect(iframeBox.height, 'fullscreen PlayCanvas Editor iframe must fill most of the viewport height').toBeGreaterThan(
            viewport.height * 0.95
        )
    }
}

const expectPlayCanvasEditorEmbeddedHostUx = async (page: Page) => {
    await expect(page.getByTestId('playcanvas-editor-host')).toBeVisible()
    await expect(page.getByTestId('playcanvas-editor-host-status-alert')).toHaveCount(1)
    await expect(page.getByText('Editor is ready.')).toHaveCount(1)

    const host = page.getByTestId('playcanvas-editor-host')
    const iframe = page.locator('iframe[data-testid="playcanvas-editor-frame"]')
    const hostBox = await host.boundingBox()
    const iframeBox = await iframe.boundingBox()
    expect(hostBox, 'embedded PlayCanvas Editor host must have layout bounds').toBeTruthy()
    expect(iframeBox, 'embedded PlayCanvas Editor iframe must have layout bounds').toBeTruthy()
    if (!hostBox || !iframeBox) return

    const hostPadding = await host.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
            left: Number.parseFloat(styles.paddingLeft) || 0,
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    const leftGap = iframeBox.x - hostBox.x
    const rightGap = hostBox.x + hostBox.width - (iframeBox.x + iframeBox.width)
    const bottomGap = hostBox.y + hostBox.height - (iframeBox.y + iframeBox.height)
    const sideGap = Math.max(hostPadding.left, hostPadding.right, leftGap, rightGap)

    expect(leftGap, 'embedded PlayCanvas Editor left gap must match host padding').toBeGreaterThanOrEqual(hostPadding.left - 2)
    expect(rightGap, 'embedded PlayCanvas Editor right gap must match host padding').toBeGreaterThanOrEqual(hostPadding.right - 2)
    expect(bottomGap, 'embedded PlayCanvas Editor bottom gap must not exceed side padding').toBeLessThanOrEqual(sideGap + 4)
    expect(bottomGap, 'embedded PlayCanvas Editor bottom gap must preserve host padding').toBeGreaterThanOrEqual(hostPadding.bottom - 2)
}

const readSerializedPlayCanvasEditorScene = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    serializeCurrentScene?: () => {
                        entities?: Array<{ id?: unknown; name?: unknown }>
                        metadata?: Record<string, unknown>
                    }
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        if (!bridge?.serializeCurrentScene) {
            throw new Error('PlayCanvas Editor bridge scene serializer is not available')
        }
        return bridge.serializeCurrentScene()
    })
}

const expectPlayCanvasEditorEntityVisibleAndInspectable = async (page: Page, entity: { id: string; name: string }) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const hierarchy = editorFrame.locator('#layout-hierarchy .entities-treeview')
    await expect(hierarchy).toBeVisible()
    const entityRow = hierarchy
        .locator('.pcui-treeview-item', { has: editorFrame.locator('.pcui-treeview-item-text', { hasText: entity.name }) })
        .last()
    const entityRowContents = entityRow.locator('> .pcui-treeview-item-contents')
    await expect(entityRowContents).toBeVisible()
    const attributesPanel = editorFrame.locator('#layout-attributes')
    await expect(attributesPanel).toBeVisible()

    const readInspectorState = async () =>
        attributesPanel.evaluate((panel, expectedName) => {
            const inputValues = Array.from(panel.querySelectorAll('input')).map((input) => input.value)
            const labels = Array.from(panel.querySelectorAll('.pcui-label')).map((label) => label.textContent?.trim() ?? '')
            const text = panel.textContent ?? ''
            return {
                hasAddComponentButton: text.includes('ADD COMPONENT') || text.includes('Add Component'),
                hasNameLabel: labels.includes('Name'),
                hasCreatedEntityNameInput: inputValues.includes(String(expectedName))
            }
        }, entity.name)
    const expectInspectorState = async (timeout: number) => {
        await expect.poll(readInspectorState, { timeout }).toEqual({
            hasAddComponentButton: true,
            hasNameLabel: true,
            hasCreatedEntityNameInput: true
        })
    }

    try {
        await expectInspectorState(5_000)
    } catch {
        const isAlreadySelected = await entityRowContents.evaluate((element) => element.classList.contains('pcui-treeview-item-selected'))
        if (!isAlreadySelected) {
            await entityRowContents.click()
        }
        await expectInspectorState(10_000)
    }
    await expect(editorFrame.locator('body')).toContainText(entity.name)
}

const readPlayCanvasEditorEntityVisibilityDiagnostics = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    serializeCurrentScene?: () => {
                        entities?: Array<{ id?: unknown; name?: unknown }>
                    }
                    lastLoadedScene?: unknown
                    lastSerializedEntityIds?: unknown
                    lastSerializedEntityCount?: unknown
                    lastRawEntityObserverCount?: unknown
                    lastObservedEntityObserverCount?: unknown
                    lastEntitySerializationErrors?: unknown
                }
                editor?: {
                    api?: {
                        globals?: {
                            realtime?: { scenes?: { current?: { _loaded?: unknown; data?: unknown } } }
                            entities?: { raw?: { array?: () => unknown[] } }
                        }
                    }
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        const serialized = bridge?.serializeCurrentScene?.()
        const hierarchyText = document.querySelector('#layout-hierarchy .entities-treeview')?.textContent?.trim() ?? ''
        return {
            hierarchyText,
            serializedEntities: serialized?.entities ?? [],
            lastLoadedScene: bridge?.lastLoadedScene,
            lastSerializedEntityIds: bridge?.lastSerializedEntityIds,
            lastSerializedEntityCount: bridge?.lastSerializedEntityCount,
            lastRawEntityObserverCount: bridge?.lastRawEntityObserverCount,
            lastObservedEntityObserverCount: bridge?.lastObservedEntityObserverCount,
            lastEntitySerializationErrors: bridge?.lastEntitySerializationErrors,
            realtimeSceneLoaded: window.editor?.api?.globals?.realtime?.scenes?.current?._loaded ?? null,
            realtimeSceneData: window.editor?.api?.globals?.realtime?.scenes?.current?.data ?? null,
            rawEntityObserverCount: window.editor?.api?.globals?.entities?.raw?.array?.().length ?? null
        }
    })
}

const readPlayCanvasEditorBridgeDiagnostics = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: Record<string, unknown>
                editor?: {
                    call?: (method: string) => unknown
                    api?: {
                        globals?: {
                            entities?: { raw?: { array?: () => unknown[] } }
                            realtime?: {
                                _connected?: boolean
                                scenes?: { current?: { _loaded?: boolean; loaded?: boolean; data?: unknown } }
                            }
                        }
                    }
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        const editor = (
            window as unknown as {
                editor?: {
                    call?: (method: string) => unknown
                    api?: {
                        globals?: {
                            entities?: { raw?: { array?: () => unknown[] } }
                            realtime?: {
                                _connected?: boolean
                                scenes?: { current?: { _loaded?: boolean; loaded?: boolean; data?: unknown } }
                            }
                        }
                    }
                }
            }
        ).editor
        let entitiesListLength: number | null = null
        let rootId: unknown = null
        try {
            const entities = typeof editor?.call === 'function' ? editor.call('entities:list') : null
            entitiesListLength = Array.isArray(entities) ? entities.length : null
        } catch {
            entitiesListLength = null
        }
        try {
            const root = typeof editor?.call === 'function' ? editor.call('entities:root') : null
            rootId =
                root && typeof (root as { get?: (path: string) => unknown }).get === 'function'
                    ? (root as { get: (path: string) => unknown }).get('resource_id')
                    : null
        } catch {
            rootId = null
        }
        return {
            dirty: bridge?.dirty,
            editorCallWrapped: bridge?.editorCallWrapped,
            editorSaveAdapterInstalled: bridge?.editorSaveAdapterInstalled,
            fullBootMode: bridge?.fullBootMode,
            hostedEntityAdapterInstalled: bridge?.hostedEntityAdapterInstalled,
            lastSerializedEntityIds: bridge?.lastSerializedEntityIds,
            lastSerializedEntityCount: bridge?.lastSerializedEntityCount,
            lastRawEntityObserverCount: bridge?.lastRawEntityObserverCount,
            lastObservedEntityObserverCount: bridge?.lastObservedEntityObserverCount,
            lastRejectedEntityObserverInputs: bridge?.lastRejectedEntityObserverInputs,
            lastEntitySerializationErrors: bridge?.lastEntitySerializationErrors,
            lastWebSocketUrl: bridge?.lastWebSocketUrl,
            lastWebSocketOpenUrl: bridge?.lastWebSocketOpenUrl,
            lastWebSocketClose: bridge?.lastWebSocketClose,
            lastWebSocketErrorUrl: bridge?.lastWebSocketErrorUrl,
            webSocketEvents: bridge?.webSocketEvents,
            serializeError:
                bridge?.serializeError instanceof Error
                    ? bridge.serializeError.message
                    : typeof bridge?.serializeError === 'string'
                    ? bridge.serializeError
                    : '',
            entitiesListLength,
            rootId,
            realtimeLoaded: editor?.api?.globals?.realtime?.scenes?.current?._loaded ?? null,
            realtimeConnected: editor?.api?.globals?.realtime?._connected ?? null,
            rawEntityObserverCount: editor?.api?.globals?.entities?.raw?.array?.().length ?? null,
            connectionOverlayText: document.querySelector('.connection-overlay')?.textContent?.trim() ?? ''
        }
    })
}

const createPlayCanvasCompatibilityAuthHeaders = (page: Page, config: PlayCanvasEditorCompatibilityConfig) => {
    expect(config.auth).toMatchObject({
        scheme: 'signed-header',
        headerName: 'X-PlayCanvas-Editor-Token',
        accessToken: expect.any(String),
        expiresAt: expect.any(String)
    })
    const pageUrl = new URL(page.url())
    return {
        Origin: pageUrl.origin,
        Referer: page.url(),
        [String(config.auth?.headerName)]: String(config.auth?.accessToken)
    }
}

const createPlayCanvasCompatibilityWriteHeaders = async (page: Page, config: PlayCanvasEditorCompatibilityConfig) => {
    const csrfResponse = await page.request.get(new URL(config.csrf?.tokenUrl ?? '', page.url()).toString())
    expect(csrfResponse.status()).toBe(200)
    const csrfBody = (await csrfResponse.json()) as { token?: string; csrfToken?: string; item?: { token?: string } }
    const csrfToken = csrfBody.token ?? csrfBody.csrfToken ?? csrfBody.item?.token
    expect(csrfToken).toEqual(expect.any(String))
    return {
        ...createPlayCanvasCompatibilityAuthHeaders(page, config),
        [String(config.csrf?.headerName)]: String(csrfToken)
    }
}

const readPlayCanvasEditorRuntimeConfig = async (page: Page): Promise<PlayCanvasEditorRuntimeConfig> => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const readHostedConfig = () =>
        editorFrame.locator('body').evaluate(() => {
            const config = (
                window as unknown as {
                    config?: {
                        accessToken?: unknown
                        url?: { api?: unknown }
                        universoBridge?: { compatibilityRestBaseUrl?: unknown }
                        project?: { id?: unknown }
                        scene?: { id?: unknown }
                        universoCompatibilityConfig?: PlayCanvasEditorCompatibilityConfig
                    }
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        restCompatibilityConfig?: PlayCanvasEditorCompatibilityConfig
                    }
                }
            ).config
            const bridge = (
                window as unknown as {
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                        restCompatibilityConfig?: PlayCanvasEditorCompatibilityConfig
                    }
                }
            ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            return {
                projectId: config?.project?.id,
                sceneId: config?.scene?.id,
                accessToken: config?.accessToken,
                apiRoot: config?.url?.api,
                restBaseUrl: config?.universoBridge?.compatibilityRestBaseUrl ?? config?.url?.api,
                compatibilityConfig: config?.universoCompatibilityConfig,
                restCompatibilityConfig: bridge?.restCompatibilityConfig
            }
        })
    await expect
        .poll(() => readHostedConfig(), { timeout: 10_000 })
        .toMatchObject({
            projectId: expect.anything(),
            sceneId: expect.anything()
        })
    const hostedConfig = await readHostedConfig()
    expectNumericCompatibleId(hostedConfig.projectId, 'PlayCanvas runtime project id')
    expectNumericCompatibleId(hostedConfig.sceneId, 'PlayCanvas runtime scene id')
    if (hostedConfig.restCompatibilityConfig) {
        expect(hostedConfig.restCompatibilityConfig).toMatchObject({ mode: 'universo-compatibility-rest-minimal' })
    }
    if (hostedConfig.compatibilityConfig?.mode === 'universo-compatibility-rest-minimal') {
        expect(hostedConfig.compatibilityConfig).toMatchObject({ mode: 'universo-compatibility-rest-minimal' })
    } else {
        expect(hostedConfig.accessToken).toEqual(expect.any(String))
        expect(hostedConfig.apiRoot).toEqual(expect.stringContaining('/api'))
        expect(hostedConfig.restBaseUrl).toEqual(expect.stringContaining('/playcanvas/editor-compatible/projects/'))
    }
    return {
        projectId: String(hostedConfig.projectId),
        sceneId: String(hostedConfig.sceneId),
        accessToken: typeof hostedConfig.accessToken === 'string' ? hostedConfig.accessToken : undefined,
        restBaseUrl: typeof hostedConfig.restBaseUrl === 'string' ? hostedConfig.restBaseUrl : undefined,
        compatibilityConfig:
            hostedConfig.compatibilityConfig?.mode === 'universo-compatibility-rest-minimal'
                ? (hostedConfig.compatibilityConfig as PlayCanvasEditorCompatibilityConfig)
                : undefined,
        restCompatibilityConfig: hostedConfig.restCompatibilityConfig as PlayCanvasEditorCompatibilityConfig | undefined
    }
}

const fetchPlayCanvasEditorCompatibilityConfig = async (page: Page, metahubId: string, runtimeConfig: PlayCanvasEditorRuntimeConfig) => {
    const urlFor = (path: string) => new URL(path, page.url()).toString()
    const configPath =
        runtimeConfig.restBaseUrl && runtimeConfig.restBaseUrl.includes('/playcanvas/editor-compatible/projects/')
            ? `${runtimeConfig.restBaseUrl}/config`
            : `/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/editor-compatible/projects/${
                  runtimeConfig.restCompatibilityConfig?.projectId ??
                  runtimeConfig.compatibilityConfig?.projectId ??
                  runtimeConfig.projectId
              }/config`
    const configResponse = await page.request.get(urlFor(configPath))
    expect(configResponse.status()).toBe(200)
    expect(configResponse.headers()['cache-control']).toBe('no-store')
    const configBody = (await configResponse.json()) as {
        item?: PlayCanvasEditorCompatibilityConfig
    }
    expect(configBody.item).toMatchObject({
        mode: 'universo-compatibility-rest-minimal',
        permissions: { write: true, admin: false }
    })
    return configBody.item ?? {}
}

const waitForPlayCanvasCompatibilitySceneSave = (page: Page, metahubId: string, options: { status?: number } = {}) =>
    page.waitForResponse((response) => {
        const url = new URL(response.url())
        const request = response.request()
        return (
            request.method() === 'PUT' &&
            url.pathname.startsWith(`/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/`) &&
            /\/scenes\/[0-9a-f-]+$/i.test(url.pathname) &&
            response.status() === (options.status ?? 200)
        )
    })

const expectPlayCanvasEditorCompatibilityRestStatus = async (page: Page, metahubId: string) => {
    const runtimeConfig = await readPlayCanvasEditorRuntimeConfig(page)
    const urlFor = (path: string) => new URL(path, page.url()).toString()
    const config = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId, runtimeConfig)
    const projectId = String(config.projectId)
    const sceneId = String(config.defaultSceneId)
    const compatibilityHeaders = createPlayCanvasCompatibilityAuthHeaders(page, config)

    const scenesResponse = await page.request.get(urlFor(config.endpoints?.scenes ?? ''), { headers: compatibilityHeaders })
    expect(scenesResponse.status()).toBe(200)
    await expect(scenesResponse.json()).resolves.toMatchObject({ items: [expect.objectContaining({ id: sceneId })] })

    const sceneResponse = await page.request.get(urlFor(`${config.endpoints?.scenes ?? ''}/${sceneId}`), {
        headers: compatibilityHeaders
    })
    expect(sceneResponse.status()).toBe(200)
    await expect(sceneResponse.json()).resolves.toMatchObject({
        item: {
            scene: expect.objectContaining({ id: sceneId, projectId }),
            payload: expect.anything()
        }
    })

    const assetsResponse = await page.request.get(urlFor(config.endpoints?.assets ?? ''), { headers: compatibilityHeaders })
    expect(assetsResponse.status()).toBe(200)
    await expect(assetsResponse.json()).resolves.toMatchObject({ items: expect.any(Array) })

    const settingsResponse = await page.request.get(urlFor(`${config.endpoints?.settings ?? ''}/projectUser`), {
        headers: compatibilityHeaders
    })
    expect(settingsResponse.status()).toBe(200)
    await expect(settingsResponse.json()).resolves.toMatchObject({
        item: { kind: 'projectUser', documentId: expect.any(String), data: expect.any(Object), revision: expect.any(String) }
    })
    const settingsBody = (await settingsResponse.json()) as { item?: { revision?: string } }
    const settingsWriteResponse = await page.request.put(urlFor(`${config.endpoints?.settings ?? ''}/projectUser`), {
        data: {
            requestId: randomUUID(),
            data: { e2eCompatibilityRestStatus: true },
            expectedRevision: settingsBody.item?.revision
        },
        headers: await createPlayCanvasCompatibilityWriteHeaders(page, config)
    })
    expect(settingsWriteResponse.status()).toBe(200)
    await expect(settingsWriteResponse.json()).resolves.toMatchObject({
        ok: true,
        item: { kind: 'projectUser', revision: expect.any(String) }
    })

    const cloudOnlyResponse = await page.request.get(urlFor(`${config.endpoints?.cloudOnly ?? ''}/jobs`), {
        headers: compatibilityHeaders
    })
    expect(cloudOnlyResponse.status()).toBe(200)
    await expect(cloudOnlyResponse.json()).resolves.toEqual({
        ok: true,
        surface: 'jobs',
        status: 'stubbed',
        reason: 'cloudOnlySurfaceOutsideFirstSlice'
    })
}

const getPlayCanvasEditorUiMode = async (page: Page): Promise<PlayCanvasEditorUiMode> => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect(editorFrame.locator('#layout-toolbar .pcui-button.logo')).toBeVisible()
    await expect(editorFrame.locator('[data-universo-playcanvas-editor-hosted-entities]')).toHaveCount(0)
    return 'upstream-toolbar'
}

const installPlayCanvasEditorShareDbProbe = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await editorFrame.locator('body').evaluate(() => {
        const marker = (window as unknown as { __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: Record<string, unknown> })
            .__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        if (!marker) return
        marker.shareDbSubmittedOps = []
        if (marker.shareDbSubmitProbeInstalled === true) return
        marker.shareDbSubmitProbeInstalled = true
        const editor = (
            window as unknown as {
                editor?: {
                    api?: {
                        globals?: {
                            realtime?: {
                                scenes?: {
                                    current?: {
                                        submitOp?: (...args: unknown[]) => unknown
                                        _document?: { submitOp?: (...args: unknown[]) => unknown }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ).editor
        const current = editor?.api?.globals?.realtime?.scenes?.current
        const wrapSubmitOp = (target: { submitOp?: (...args: unknown[]) => unknown } | undefined, label: string) => {
            if (!target || typeof target.submitOp !== 'function') return
            const original = target.submitOp.bind(target)
            target.submitOp = (...args: unknown[]) => {
                ;(marker.shareDbSubmittedOps as Array<unknown>).push({ label, op: args[0] })
                return original(...args)
            }
        }
        wrapSubmitOp(current, 'scene')
        wrapSubmitOp(current?._document, 'document')
    })
}

const expectPlayCanvasEditorShareDbEntitySubmitted = async (page: Page, createdEntity: { id: string; name: string }) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((expectedEntity) => {
                    const marker = (window as unknown as { __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: { shareDbSubmittedOps?: unknown[] } })
                        .__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const ops = marker?.shareDbSubmittedOps ?? []
                    return ops.some((entry) => {
                        const serialized = JSON.stringify(entry)
                        return (
                            serialized.includes('"entities"') &&
                            (serialized.includes(expectedEntity.id) || serialized.includes(expectedEntity.name))
                        )
                    })
                }, createdEntity),
            { timeout: 20_000 }
        )
        .toBe(true)
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate(async () => {
                    const current = (
                        window as unknown as {
                            editor?: {
                                api?: {
                                    globals?: {
                                        realtime?: {
                                            scenes?: {
                                                current?: {
                                                    _loaded?: boolean
                                                    loaded?: boolean
                                                    _document?: {
                                                        data?: { entities?: Record<string, unknown> }
                                                        hasPending?: () => boolean
                                                        whenNothingPending?: (callback: () => void) => void
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    ).editor?.api?.globals?.realtime?.scenes?.current
                    const doc = current?._document
                    const hasPending = typeof doc?.hasPending === 'function' ? doc.hasPending() : false
                    if (hasPending && typeof doc?.whenNothingPending === 'function') {
                        await Promise.race([
                            new Promise<void>((resolve) => doc.whenNothingPending?.(resolve)),
                            new Promise<void>((resolve) => setTimeout(resolve, 500))
                        ])
                    }
                    return {
                        loaded: current?._loaded === true || current?.loaded === true,
                        pending: typeof doc?.hasPending === 'function' ? doc.hasPending() : false,
                        entityCount: Object.keys(doc?.data?.entities ?? {}).length
                    }
                }),
            { timeout: 20_000 }
        )
        .toEqual(expect.objectContaining({ loaded: true, pending: false }))
}

const createSerializablePlayCanvasEditorEntity = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect
        .poll(
            async () => {
                try {
                    return await editorFrame.locator('body').evaluate(() => {
                        const marker = (
                            window as unknown as {
                                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                    editorSaveAdapterInstalled?: boolean
                                    serializeCurrentScene?: () => { entities?: Array<unknown> }
                                }
                            }
                        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                        const editor = (
                            window as unknown as {
                                editor?: {
                                    call?: (method: string) => unknown
                                    api?: {
                                        globals?: {
                                            realtime?: {
                                                scenes?: { current?: { _loaded?: boolean; loaded?: boolean } }
                                            }
                                        }
                                    }
                                }
                            }
                        ).editor
                        if (typeof editor?.call !== 'function') {
                            return { adapterReady: false, entitiesReady: false }
                        }
                        try {
                            const entities = editor.call('entities:list')
                            const root =
                                typeof editor.call === 'function'
                                    ? (editor.call('entities:root') as { get?: (path: string) => unknown } | null)
                                    : null
                            const rootId = root && typeof root.get === 'function' ? root.get('resource_id') : null
                            const realtimeLoaded =
                                editor.api?.globals?.realtime?.scenes?.current?._loaded === true ||
                                editor.api?.globals?.realtime?.scenes?.current?.loaded === true
                            const serializedEntityCount =
                                typeof marker?.serializeCurrentScene === 'function'
                                    ? marker.serializeCurrentScene().entities?.length ?? 0
                                    : 0
                            return {
                                adapterReady: marker?.editorSaveAdapterInstalled === true,
                                entitiesReady:
                                    ((Array.isArray(entities) &&
                                        entities.length > 0 &&
                                        (typeof rootId === 'string' || typeof rootId === 'number')) ||
                                        serializedEntityCount > 0) &&
                                    realtimeLoaded === true
                            }
                        } catch {
                            return { adapterReady: marker?.editorSaveAdapterInstalled === true, entitiesReady: false }
                        }
                    })
                } catch (error) {
                    if (isTransientFrameNavigationError(error)) {
                        return { adapterReady: false, entitiesReady: false }
                    }
                    throw error
                }
            },
            { timeout: 30_000 }
        )
        .toEqual({
            adapterReady: true,
            entitiesReady: true
        })
        .catch(async (error) => {
            const diagnostics = await readPlayCanvasEditorBridgeDiagnostics(page).catch((diagnosticsError) => ({
                diagnosticsError: diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
            }))
            throw new Error(
                `PlayCanvas Editor realtime scene did not become ready for entity creation. Diagnostics: ${JSON.stringify(diagnostics)}. ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        })
    const before = await readSerializedPlayCanvasEditorScene(page)
    const beforeIds = new Set((before.entities ?? []).map((entity) => String(entity.id ?? '')).filter(Boolean))
    await getPlayCanvasEditorUiMode(page)
    await installPlayCanvasEditorShareDbProbe(page)

    const hierarchy = editorFrame.locator('#layout-hierarchy .entities-treeview')
    await expect(hierarchy).toBeVisible()
    const rootRow = hierarchy.locator('> .pcui-treeview-item > .pcui-treeview-item-contents').first()
    await expect(rootRow).toBeVisible()
    await rootRow.click()
    await rootRow.click({ button: 'right' })

    const visibleMenu = editorFrame.locator('.pcui-menu:visible').last()
    const newEntityMenuItem = visibleMenu.locator(playCanvasEditorMenuItemXPath('New Entity')).first()
    const contextMenuOpened = await newEntityMenuItem
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    if (contextMenuOpened) {
        await newEntityMenuItem.hover()
    } else {
        const addEntityButton = editorFrame.locator('#layout-hierarchy .hierarchy-controls .pcui-button').first()
        await expect(addEntityButton).toBeVisible()
        await addEntityButton.click()
    }
    const entityMenuItem = editorFrame.locator(playCanvasEditorVisibleMenuItemXPath('Entity')).last()
    await expect(entityMenuItem).toBeVisible()
    await entityMenuItem.click()

    await expect
        .poll(
            async () => {
                const current = await readSerializedPlayCanvasEditorScene(page)
                const next = (current.entities ?? []).find((entity) => {
                    const id = String(entity.id ?? '')
                    return id && !beforeIds.has(id)
                })
                return next ? String(next.id ?? '') : ''
            },
            { timeout: 20_000 }
        )
        .toBeTruthy()
        .catch(async (error) => {
            const diagnostics = await readPlayCanvasEditorBridgeDiagnostics(page).catch((diagnosticsError) => ({
                diagnosticsError: diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
            }))
            throw new Error(
                `PlayCanvas Editor entity did not become serializable. Diagnostics: ${JSON.stringify(diagnostics)}. ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        })
    const current = await readSerializedPlayCanvasEditorScene(page)
    const created = (current.entities ?? []).find((entity) => {
        const id = String(entity.id ?? '')
        return id && !beforeIds.has(id)
    })
    if (!created) {
        throw new Error('PlayCanvas Editor upstream Add Entity interaction did not create a serializable entity')
    }
    const createdEntity = {
        id: String(created.id ?? ''),
        name: typeof created.name === 'string' && created.name ? created.name : 'New Entity'
    }
    await expectPlayCanvasEditorShareDbEntitySubmitted(page, createdEntity)
    await expectPlayCanvasEditorEntityVisibleAndInspectable(page, createdEntity).catch(async (error) => {
        const diagnostics = await readPlayCanvasEditorBridgeDiagnostics(page).catch((diagnosticsError) => ({
            diagnosticsError: diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
        }))
        throw new Error(
            `PlayCanvas Editor entity was not inspectable after user selection. Diagnostics: ${JSON.stringify(diagnostics)}. ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    })
    return createdEntity
}

const savePlayCanvasEditorSceneAndExpectReload = async (page: Page, metahubId: string, options: { expectHostChrome?: boolean } = {}) => {
    const expectHostChrome = options.expectHostChrome ?? true
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const runtimeConfig = await readPlayCanvasEditorRuntimeConfig(page)
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId, runtimeConfig)
    const sceneId = String(compatibilityConfig.defaultSceneId)
    const createdEntity = await createSerializablePlayCanvasEditorEntity(page)
    const sceneBeforeSaveResponse = await page.request.get(
        new URL(`${compatibilityConfig.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(),
        {
            headers: createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig)
        }
    )
    expect(sceneBeforeSaveResponse.status()).toBe(200)
    await sceneBeforeSaveResponse.json()
    await page.locator('iframe[data-testid="playcanvas-editor-frame"]').click({ position: { x: 100, y: 100 } })
    const saveResponsePromise = waitForPlayCanvasCompatibilitySceneSave(page, metahubId)
    await page.keyboard.press(playCanvasEditorSaveShortcut)
    const saveResponse = await saveResponsePromise
    const saveResponseBody = await saveResponse.json()
    expect(saveResponse.status(), JSON.stringify(saveResponseBody)).toBe(200)
    const savePayload = saveResponse.request().postDataJSON() as {
        requestId?: unknown
        expectedCurrentChecksum?: unknown
        payload?: { entities?: Array<{ id?: unknown; name?: unknown }> }
    }
    expect(savePayload).toMatchObject({
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
    expect(
        typeof savePayload.expectedCurrentChecksum === 'string' || savePayload.expectedCurrentChecksum === null,
        'PlayCanvas Editor save must include an explicit current checksum precondition'
    ).toBe(true)
    expect(savePayload.payload?.entities).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                id: createdEntity.id,
                name: createdEntity.name
            })
        ])
    )
    const saveHeaders = saveResponse.request().headers()
    expect(saveHeaders['x-playcanvas-editor-token']).toEqual(expect.any(String))
    expect(saveHeaders['x-csrf-token']).toEqual(expect.any(String))
    const duplicateSaveResponse = await page.request.put(saveResponse.url(), {
        data: savePayload,
        headers: await createPlayCanvasCompatibilityWriteHeaders(page, compatibilityConfig)
    })
    const duplicateSaveBody = await duplicateSaveResponse.json().catch(async () => duplicateSaveResponse.text().catch(() => null))
    expect(duplicateSaveResponse.ok(), JSON.stringify(duplicateSaveBody)).toBeTruthy()
    expect(duplicateSaveBody).toEqual(saveResponseBody)
    if (expectHostChrome) {
        await expect(page.getByTestId('playcanvas-editor-host-chrome').getByText(/^(Scene saved\.|Ready)$/)).toBeVisible()
    } else {
        await expect(page.getByTestId('playcanvas-editor-host-chrome')).toHaveCount(0)
        await expect(page.getByTestId('playcanvas-editor-fullscreen-chrome')).toHaveCount(0)
    }
    await expect(page.getByText('Unsaved changes')).toHaveCount(0)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    if (!expectHostChrome) {
        await expectPlayCanvasEditorFullscreenHost(page)
    }
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_element, expectedEntity) => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => {
                                    entities?: Array<{ id?: unknown; name?: unknown }>
                                }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const serialized = bridge?.serializeCurrentScene?.()
                    return {
                        hasEntity: Boolean(
                            serialized?.entities?.some((entity) => entity.id === expectedEntity.id && entity.name === expectedEntity.name)
                        )
                    }
                }, createdEntity),
            { timeout: 20_000 }
        )
        .toEqual(
            expect.objectContaining({
                hasEntity: true
            })
        )
    await expectPlayCanvasEditorEntityVisibleAndInspectable(page, createdEntity).catch(async (error) => {
        const diagnostics = await readPlayCanvasEditorEntityVisibilityDiagnostics(page).catch((diagnosticsError) => ({
            diagnosticsError: diagnosticsError instanceof Error ? diagnosticsError.message : String(diagnosticsError)
        }))
        throw new Error(
            `PlayCanvas Editor persisted entity is not visible and inspectable after reload. Diagnostics: ${JSON.stringify(diagnostics)}. ${
                error instanceof Error ? error.message : String(error)
            }`
        )
    })
    const sceneAfterReloadResponse = await page.request.get(
        new URL(`${compatibilityConfig.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(),
        {
            headers: createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig)
        }
    )
    expect(sceneAfterReloadResponse.status()).toBe(200)
    const sceneAfterReload = (await sceneAfterReloadResponse.json()) as { item?: { scene?: { checksum?: unknown } } }
    expect(sceneAfterReload.item?.scene?.checksum).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/i))
}

const expectPlayCanvasEditorShareDbPersistenceWithoutBridgeSave = async (page: Page, metahubId: string) => {
    const runtimeConfig = await readPlayCanvasEditorRuntimeConfig(page)
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId, runtimeConfig)
    const sceneId = String(compatibilityConfig.defaultSceneId)
    const bridgeSaveRequests: string[] = []
    const onRequest = (request: Request) => {
        const url = new URL(request.url())
        if (
            request.method() === 'PUT' &&
            url.pathname.startsWith(`/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/`) &&
            /\/scenes\/[0-9a-f-]+$/i.test(url.pathname)
        ) {
            bridgeSaveRequests.push(request.url())
        }
    }
    page.on('request', onRequest)
    try {
        const createdEntity = await createSerializablePlayCanvasEditorEntity(page)
        const sceneResponse = await page.request.get(
            new URL(`${compatibilityConfig.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(),
            {
                headers: createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig)
            }
        )
        expect(sceneResponse.status()).toBe(200)
        const sceneBody = (await sceneResponse.json()) as { item?: { payload?: { entities?: Array<{ id?: unknown; name?: unknown }> } } }
        expect(sceneBody.item?.payload?.entities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: createdEntity.id,
                    name: createdEntity.name
                })
            ])
        )
        expect(bridgeSaveRequests).toEqual([])
    } finally {
        page.off('request', onRequest)
    }
}

const savePlayCanvasEditorSceneExpectingConflict = async (page: Page, metahubId: string, marker: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const conflictResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
            response.request().method() === 'PUT' &&
            url.pathname.startsWith(`/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/`) &&
            /\/scenes\/[0-9a-f-]+$/i.test(url.pathname) &&
            response.status() === 409
        )
    })
    const saveResult = await editorFrame.locator('body').evaluate(async (_element, e2eMarker) => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    saveCurrentScene?: (payload: unknown) => Promise<unknown>
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        if (!bridge?.saveCurrentScene) {
            throw new Error('PlayCanvas Editor bridge save adapter is not available')
        }
        try {
            await bridge.saveCurrentScene({
                schemaVersion: '1',
                entities: [],
                metadata: {
                    e2eMarker,
                    source: 'playwright-platform-bridge-conflict'
                }
            })
            return { ok: true }
        } catch (error) {
            const envelope = error as { ok?: unknown; code?: unknown; status?: unknown }
            return {
                ok: envelope.ok,
                code: envelope.code,
                status: envelope.status
            }
        }
    }, marker)
    await conflictResponsePromise
    expect(saveResult).toEqual(
        expect.objectContaining({
            ok: false,
            code: 'saveConflict',
            status: 409
        })
    )
    await expect(page.getByText('Editor could not start.')).toHaveCount(0)
    const bridgeStateAfterConflict = await editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    saveError?: unknown
                    storageError?: unknown
                    serializeError?: unknown
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        return {
            hasSaveError: Boolean(bridge?.saveError),
            hasStorageError: Boolean(bridge?.storageError),
            hasSerializeError: Boolean(bridge?.serializeError)
        }
    })
    expect(bridgeStateAfterConflict).toEqual({
        hasSaveError: false,
        hasStorageError: false,
        hasSerializeError: false
    })
}

const expectPlayCanvasEditorRejectsUnauthenticatedFrameMessage = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    let rejectedSaveReachedBridgeApi = false
    const bridgeCommandsPattern = /\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-bridge\/commands$/
    const rejectedSaveRouteHandler = async (route: Route) => {
        rejectedSaveReachedBridgeApi = true
        await route.fallback()
    }
    await page.route(bridgeCommandsPattern, rejectedSaveRouteHandler)
    try {
        const dirtyBanner = page.getByText('Unsaved changes')
        const dirtyBannerCountBefore = await dirtyBanner.count()
        await editorFrame.locator('body').evaluate(() => {
            window.parent.postMessage(
                {
                    type: 'bridge.dirtyState',
                    source: 'universo-playcanvas-editor-artifact',
                    sessionId: 'wrong-session',
                    nonce: 'wrong-nonce',
                    dirty: true
                },
                '*'
            )
            window.parent.postMessage(
                {
                    type: 'scene.save',
                    source: 'universo-playcanvas-editor-artifact',
                    requestId: '019e0000-0000-7000-8000-000000000001',
                    sessionId: 'wrong-session',
                    nonce: 'wrong-nonce',
                    bridgeVersion: '1',
                    payload: {
                        schemaVersion: '1',
                        entities: [],
                        metadata: {
                            source: 'unauthenticated-frame-message'
                        }
                    }
                },
                '*'
            )
        })
        await expect(dirtyBanner).toHaveCount(dirtyBannerCountBefore)
        await expect(page.getByText('Saving scene...')).toHaveCount(0)
        await expect.poll(() => rejectedSaveReachedBridgeApi, { timeout: 1_000 }).toBe(false)
    } finally {
        await page.unroute(bridgeCommandsPattern, rejectedSaveRouteHandler)
    }
}

const expectPlayCanvasEditorHostKeyboardLoop = async (page: Page, locale: 'en' | 'ru' = 'en') => {
    const backLinkName = locale === 'ru' ? 'Назад к пакетам' : 'Back to packages'
    const backLink = page.getByRole('link', { name: backLinkName })
    const editorIframe = page.locator('iframe[data-testid="playcanvas-editor-frame"]')

    await expect(backLink).toBeVisible()
    await editorIframe.focus()
    await expect(editorIframe).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(backLink).toBeFocused()
}

const expectPlayCanvasEditorIframeSaveShortcutPrevented = async (page: Page, metahubId: string, shortcut: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const iframeShortcutSaveCommand = waitForPlayCanvasCompatibilitySceneSave(page, metahubId)
    const iframePrevented = await editorFrame.locator('body').evaluate((_, saveShortcut) => {
        const event = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: saveShortcut.includes('Control'),
            metaKey: saveShortcut.includes('Meta'),
            bubbles: true,
            cancelable: true
        })
        return !window.dispatchEvent(event) || event.defaultPrevented
    }, shortcut)
    expect(iframePrevented).toBe(true)
    await iframeShortcutSaveCommand
}

const expectPlayCanvasEditorHostSaveShortcutPrevented = async (page: Page, metahubId: string, shortcut: string) => {
    await expect(page).toHaveURL(/\/playcanvas-editor\/editor/)
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const saveButton = page.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled({ timeout: 20_000 })
    const previousSaveRequestId = await editorFrame.locator('body').evaluate(() => {
        const bridge = (
            window as unknown as {
                __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                    lastCompatibilityRestSave?: { requestId?: unknown }
                    lastBridgeSave?: { requestId?: unknown }
                }
            }
        ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        const requestId = bridge?.lastCompatibilityRestSave?.requestId ?? bridge?.lastBridgeSave?.requestId
        return typeof requestId === 'string' ? requestId : null
    })
    const hostShortcutSaveCommand = waitForPlayCanvasCompatibilitySceneSave(page, metahubId)
    await saveButton.focus()
    await expect(saveButton).toBeFocused()
    await page.keyboard.press(shortcut)
    await hostShortcutSaveCommand
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((previous) => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                lastCompatibilityRestSave?: { requestId?: unknown }
                                lastBridgeSave?: { requestId?: unknown }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const requestId = bridge?.lastCompatibilityRestSave?.requestId ?? bridge?.lastBridgeSave?.requestId
                    return typeof requestId === 'string' && requestId !== previous ? requestId : ''
                }, previousSaveRequestId),
            { timeout: 20_000 }
        )
        .toBeTruthy()
}

const expectPlayCanvasEditorHostWarning = async (page: Page, message: string, label: string) => {
    await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
    await expect(page.getByText(message)).toBeVisible()
    await expect(page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
    await expectNoTechnicalLeakage(page.locator('body'), {
        label,
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(
        page.locator('body'),
        [/editor-artifact\/index\.html/i, /artifactStatus/i, /\bblocked\b/i, /\bmisconfigured\b/i, /\bERR_[A-Z_]+\b/i],
        { label }
    )
    await expectNoPageHorizontalOverflow(page, label)
}

test('@flow @packages metahub resources packages tab is usable and localized', async ({ browser, page, runManifest }, testInfo) => {
    test.setTimeout(420_000)

    const metahubName = `E2E ${runManifest.runId} packages resources`
    const metahubCodename = `${runManifest.runId}-packages-resources`
    const memberEmail = `e2e+${runManifest.runId}-packages-reader@example.test`
    const memberPassword = 'ChangeMe_E2E-123456!'

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
    let memberContext: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        bootstrapApi = await createBootstrapApiContext()
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const memberUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: resolveUserRoleIds(assignableRoles),
            comment: `Playwright package read-only member ${runManifest.runId}`
        })
        await recordCreatedGlobalUser({
            userId: memberUser.userId,
            email: memberUser.email ?? memberEmail
        })

        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for packages resources coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })
        await addMetahubMember(api, metahub.id, { email: memberUser.email ?? memberEmail, role: 'member' })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto('/metahubs')
        const metahubEntry = page.getByText(metahubName, { exact: true }).first()
        await expect(metahubEntry).toBeVisible({ timeout: 30_000 })
        const metahubLink = metahubEntry
            .locator('xpath=ancestor::*[.//a[starts-with(@href, "/metahub/")]][1]//a[starts-with(@href, "/metahub/")]')
            .first()
        await expect(metahubLink).toBeVisible()
        await metahubLink.click()
        await page.getByRole('link', { name: 'Resources' }).click()
        await page.waitForURL('**/resources')
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Packages', selected: true })).toBeVisible()

        const packagesTab = page.getByTestId('metahub-packages-tab')
        await expect(packagesTab).toBeVisible()
        await expect(page.getByRole('table', { name: 'Packages' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Engine' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Server' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Client' })).toBeVisible()
        await expectNoTechnicalLeakage(packagesTab, {
            label: 'Metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(packagesTab, rawPackageTextPatterns, { label: 'Metahub packages tab' })
        await expectNoPageHorizontalOverflow(page, 'Metahub packages resources page desktop')
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-en.png'), fullPage: true })

        await page.getByRole('button', { name: 'Connect Colyseus Client' }).focus()
        await page.keyboard.press('Enter')
        const keyboardAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(keyboardAttachDialog).toBeVisible()
        await expect(keyboardAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await keyboardAttachDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(keyboardAttachDialog).toHaveCount(0)

        await page.getByRole('button', { name: 'Connect PlayCanvas Editor' }).click()
        const editorAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(editorAttachDialog).toBeVisible()
        await expect(editorAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await editorAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(editorAttachDialog).toHaveCount(0)
        const editorRow = packagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(editorRow.getByText('Connected')).toBeVisible()
        const projectsPanel = packagesTab.getByText('PlayCanvas projects').locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(projectsPanel.getByText('No PlayCanvas projects yet')).toBeVisible()
        await expectImageLoaded(projectsPanel.getByRole('img', { name: 'No PlayCanvas projects' }), 'PlayCanvas projects empty state image')
        await projectsPanel.getByRole('button', { name: 'Create project' }).click()
        const createProjectDialog = page.getByRole('dialog', { name: 'Create PlayCanvas project' })
        await expect(createProjectDialog).toBeVisible()
        await expect(createProjectDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(createProjectDialog.getByLabel(/Codename|Кодовое имя/)).toHaveCount(0)
        await expect(createProjectDialog.getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(createProjectDialog.getByRole('button', { name: 'Create project' })).toHaveCount(0)
        await createProjectDialog.getByLabel('Project name').focus()
        await expectLocatorHasNoInlineOverflow(
            createProjectDialog.locator('label', { hasText: 'Project name' }),
            'PlayCanvas create project label'
        )
        await expectLocatorHasNoInlineOverflow(
            createProjectDialog.getByRole('button', { name: 'Create' }),
            'PlayCanvas create project button'
        )
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-create-dialog-en.png'), fullPage: true })
        await createProjectDialog.getByRole('button', { name: 'Create' }).click()
        await expect(createProjectDialog.getByText('Enter a project name.')).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-create-validation-en.png'), fullPage: true })
        await createProjectDialog.getByLabel('Project name').fill('Flight Authoring')
        const createProjectRequest = page.waitForRequest((request) => {
            return request.method() === 'POST' && /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects$/.test(request.url())
        })
        await createProjectDialog.getByLabel('Project name').press('Enter')
        const createProjectPayload = await (await createProjectRequest).postDataJSON()
        expect(createProjectPayload.displayName).toBeTruthy()
        expect(createProjectPayload.codename).toBeUndefined()
        await expect(createProjectDialog).toHaveCount(0)
        const authoringProjectCard = projectCardByName(projectsPanel, 'Flight Authoring')
        await expect(authoringProjectCard).toBeVisible()
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText('Ready', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText(/1 scenes, 0 assets, 0 scripts, 0 generated artifacts/)).toBeVisible()
        await projectsPanel.getByRole('button', { name: 'Create project' }).click()
        const createSecondProjectDialog = page.getByRole('dialog', { name: 'Create PlayCanvas project' })
        await expect(createSecondProjectDialog).toBeVisible()
        await createSecondProjectDialog.getByLabel('Project name').fill('Flight Backup')
        const createSecondProjectRequest = page.waitForRequest((request) => {
            return request.method() === 'POST' && /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects$/.test(request.url())
        })
        await createSecondProjectDialog.getByRole('button', { name: 'Create' }).click()
        await createSecondProjectRequest
        await expect(createSecondProjectDialog).toHaveCount(0)
        const backupProjectCard = projectCardByName(projectsPanel, 'Flight Backup')
        await expect(backupProjectCard).toBeVisible()
        await expect(backupProjectCard.getByText('Default', { exact: true })).toHaveCount(0)
        const defaultProjectSelect = projectsPanel.getByLabel('Default project')
        await expect(defaultProjectSelect).toContainText('Flight Authoring')
        const configEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/package\/[^/]+\/config$/
        const waitForDefaultSave = () =>
            page.waitForResponse(
                (response) =>
                    response.request().method() === 'PATCH' && configEndpointPattern.test(new URL(response.url()).pathname) && response.ok()
            )
        const backupDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        await backupDefaultSave
        await expect(defaultProjectSelect).toContainText('Flight Backup')
        await expect(backupProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toHaveCount(0)
        const resetDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'No default project' }).click()
        await resetDefaultSave
        await expect(defaultProjectSelect).toContainText('No default project')
        await expect(projectsPanel.getByText('Default', { exact: true })).toHaveCount(0)
        const authoringDefaultSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Authoring' }).click()
        await authoringDefaultSave
        await expect(defaultProjectSelect).toContainText('Flight Authoring')
        await expect(authoringProjectCard.getByText('Default', { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(projectsPanel, {
            label: 'PlayCanvas projects panel',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(projectsPanel, [/^\{.*\}$/m, /\[object Object\]/, /playcanvas-projects\//], {
            label: 'PlayCanvas projects panel'
        })
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel desktop')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-en.png'), fullPage: true })
        await page.setViewportSize({ width: 768, height: 1024 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const tabletProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(tabletProjectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toBeVisible()
        await expect(tabletProjectsPanel.getByRole('heading', { name: 'Flight Backup' })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel tablet')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const mobileProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(mobileProjectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toBeVisible()
        await expect(mobileProjectsPanel.getByRole('heading', { name: 'Flight Backup' })).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas projects panel mobile')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-mobile.png'), fullPage: true })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await projectsPanel.getByRole('button', { name: 'Delete Flight Authoring' }).focus()
        await page.keyboard.press('Enter')
        const deleteProjectDialog = page.getByRole('dialog', { name: 'Delete PlayCanvas project' })
        await expect(deleteProjectDialog).toBeVisible()
        await expect(deleteProjectDialog.getByRole('button', { name: 'Delete' })).toBeVisible()
        await expect(deleteProjectDialog.getByRole('button', { name: 'Delete project' })).toHaveCount(0)
        await expectLocatorHasNoInlineOverflow(
            deleteProjectDialog.getByRole('button', { name: 'Delete' }),
            'PlayCanvas delete project button'
        )
        await page.screenshot({ path: testInfo.outputPath('playcanvas-project-delete-dialog-en.png'), fullPage: true })
        await deleteProjectDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(authoringProjectCard).toBeVisible()
        await projectsPanel.getByRole('button', { name: 'Delete Flight Authoring' }).click()
        const confirmDeleteProjectDialog = page.getByRole('dialog', { name: 'Delete PlayCanvas project' })
        await expect(confirmDeleteProjectDialog).toBeVisible()
        const deleteProjectResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                /\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects\/[^/]+$/.test(new URL(response.url()).pathname) &&
                response.ok()
        )
        await confirmDeleteProjectDialog.getByRole('button', { name: 'Delete' }).click()
        await deleteProjectResponse
        await expect(confirmDeleteProjectDialog).toHaveCount(0)
        await expect(projectsPanel.getByRole('heading', { name: 'Flight Authoring' })).toHaveCount(0)
        await expect(backupProjectCard).toBeVisible()
        const backupDefaultAfterDeleteSave = waitForDefaultSave()
        await defaultProjectSelect.click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        await backupDefaultAfterDeleteSave
        await expect(defaultProjectSelect).toContainText('Flight Backup')

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        const ruProjectsPanel = page
            .getByTestId('metahub-packages-tab')
            .getByText('Проекты PlayCanvas')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(ruProjectsPanel.getByLabel('Проект по умолчанию')).toBeVisible()
        await ruProjectsPanel.getByLabel('Проект по умолчанию').click()
        await expect(page.getByRole('option', { name: 'Без проекта по умолчанию' })).toBeVisible()
        await expect(page.getByRole('option', { name: 'Flight Backup' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(ruProjectsPanel.getByRole('button', { name: 'Создать проект' })).toBeVisible()
        await expect(ruProjectsPanel.getByRole('button', { name: 'Удалить Flight Backup' })).toBeVisible()
        await ruProjectsPanel.getByRole('button', { name: 'Создать проект' }).click()
        const ruCreateProjectDialog = page.getByRole('dialog', { name: 'Создать проект PlayCanvas' })
        await expect(ruCreateProjectDialog).toBeVisible()
        await expect(ruCreateProjectDialog.getByLabel('Название проекта')).toBeVisible()
        await ruCreateProjectDialog.getByLabel('Название проекта').focus()
        await expectLocatorHasNoInlineOverflow(
            ruCreateProjectDialog.locator('label', { hasText: 'Название проекта' }),
            'PlayCanvas create project label ru'
        )
        await expect(ruCreateProjectDialog.getByRole('button', { name: 'Создать' })).toBeVisible()
        await expect(ruCreateProjectDialog.getByRole('button', { name: 'Создать проект' })).toHaveCount(0)
        await ruCreateProjectDialog.getByRole('button', { name: 'Отмена' }).click()
        await expect(ruCreateProjectDialog).toHaveCount(0)
        await ruProjectsPanel.getByRole('button', { name: 'Удалить Flight Backup' }).click()
        const ruDeleteProjectDialog = page.getByRole('dialog', { name: 'Удалить проект PlayCanvas' })
        await expect(ruDeleteProjectDialog).toBeVisible()
        await expect(ruDeleteProjectDialog.getByText('Удалить Flight Backup и файлы этого проекта PlayCanvas.')).toBeVisible()
        await expect(ruDeleteProjectDialog.getByRole('button', { name: 'Удалить' })).toBeVisible()
        await expect(ruDeleteProjectDialog.getByRole('button', { name: 'Удалить проект' })).toHaveCount(0)
        await expectLocatorHasNoInlineOverflow(
            ruDeleteProjectDialog.getByRole('button', { name: 'Удалить' }),
            'PlayCanvas delete project button ru'
        )
        await ruDeleteProjectDialog.getByRole('button', { name: 'Отмена' }).click()
        await expect(ruDeleteProjectDialog).toHaveCount(0)
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Metahub packages PlayCanvas projects panel ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(page.getByTestId('metahub-packages-tab'), rawPackageTextPatterns, {
            label: 'Metahub packages PlayCanvas projects panel ru'
        })
        await page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-ru.png'), fullPage: true })
        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()

        const authoringHostEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/packages\/playcanvas-editor\/authoring-host$/

        const editorRowForSettings = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowForSettings.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).focus()
        await page.keyboard.press('Enter')
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        await expect(page.getByRole('menu')).toHaveCount(0)
        const editorSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(editorSettingsDialog).toBeVisible()
        await expect(editorSettingsDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor settings dialog desktop')
        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-en.png'), fullPage: true })
        await expect(editorSettingsDialog.getByLabel('Display mode')).toContainText('Embedded')
        const settingsDefaultProjectSelect = editorSettingsDialog.getByLabel('Default project')
        await expect(settingsDefaultProjectSelect).toBeVisible()
        await expect(settingsDefaultProjectSelect).toContainText('Flight Backup')
        await expectNoTechnicalLeakage(editorSettingsDialog, {
            label: 'PlayCanvas Editor settings dialog',
            checkUuidSubstrings: true
        })
        await settingsDefaultProjectSelect.click()
        await expect(page.getByRole('option', { name: 'No default project' })).toBeVisible()
        await expect(page.getByRole('option', { name: 'Flight Backup' })).toBeVisible()
        await page.keyboard.press('Escape')
        await editorSettingsDialog.getByLabel('Display mode').press('Tab')
        await expect(settingsDefaultProjectSelect).toBeFocused()
        await settingsDefaultProjectSelect.press('Tab')
        await expect(editorSettingsDialog.getByRole('switch', { name: 'Show artifact status notice' })).toBeFocused()
        await expect(editorSettingsDialog.getByText('Development URL mode is disabled on this server.')).toBeVisible()
        await editorSettingsDialog.getByLabel('Display mode').click()
        await expect(page.getByRole('option', { name: 'Development URL' })).toHaveCount(0)
        await page.keyboard.press('Escape')
        await editorSettingsDialog.getByRole('button', { name: 'Reset to defaults' }).click()
        await expect(editorSettingsDialog.getByLabel('Display mode')).toContainText('Embedded')
        const settingsSaveButton = editorSettingsDialog.getByRole('button', { name: /^Save$/ })
        await expect(settingsSaveButton).toBeEnabled()
        await expect(editorSettingsDialog.getByRole('button', { name: /Save settings/i })).toHaveCount(0)
        await expectLocatorHasNoInlineOverflow(settingsSaveButton, 'PlayCanvas Editor settings Save button en')
        await settingsDefaultProjectSelect.click()
        await page.getByRole('option', { name: 'No default project' }).click()
        const clearDefaultProjectSave = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' && configEndpointPattern.test(new URL(response.url()).pathname) && response.ok()
        )
        await settingsSaveButton.click()
        const clearDefaultProjectResponse = await clearDefaultProjectSave
        const clearDefaultProjectPayload = clearDefaultProjectResponse.request().postDataJSON() as {
            config?: { playcanvasProject?: { defaultProjectId?: unknown } }
        }
        expect(clearDefaultProjectPayload.config?.playcanvasProject?.defaultProjectId).toBeNull()
        await expect(editorSettingsDialog).toHaveCount(0)

        const restoreDefaultProjectDialog = await openPlayCanvasEditorSettingsDialog(page)
        await restoreDefaultProjectDialog.getByLabel('Default project').click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        const restoreDefaultProjectSave = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' && configEndpointPattern.test(new URL(response.url()).pathname) && response.ok()
        )
        await restoreDefaultProjectDialog.getByRole('button', { name: /^Save$/ }).click()
        const restoreDefaultProjectResponse = await restoreDefaultProjectSave
        const restoreDefaultProjectPayload = restoreDefaultProjectResponse.request().postDataJSON() as {
            config?: { playcanvasProject?: { defaultProjectId?: unknown } }
        }
        expect(restoreDefaultProjectPayload.config?.playcanvasProject?.defaultProjectId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )
        await expect(restoreDefaultProjectDialog).toHaveCount(0)

        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl']
                })
            })
        })
        await page.route(configEndpointPattern, async (route) => {
            if (route.request().method() === 'PATCH') {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Development URL is not allowed' })
                })
                return
            }
            await route.continue()
        })
        const devUrlDialog = await openPlayCanvasEditorSettingsDialog(page)
        await devUrlDialog.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Development URL' }).click()
        await devUrlDialog.getByLabel('Development URL').fill('not-a-url')
        await expect(devUrlDialog.getByText('Enter a valid http or https URL.')).toBeVisible()
        await expect(devUrlDialog.getByRole('button', { name: 'Save' })).toBeDisabled()
        await devUrlDialog.getByLabel('Development URL').fill('http://127.0.0.1:5999/editor')
        await expect(devUrlDialog.getByRole('button', { name: 'Save' })).toBeEnabled()
        const rejectedDevUrlSave = page.waitForResponse(
            (response) =>
                response.request().method() === 'PATCH' &&
                configEndpointPattern.test(new URL(response.url()).pathname) &&
                response.status() === 400
        )
        await devUrlDialog.getByRole('button', { name: 'Save' }).click()
        await rejectedDevUrlSave
        await expect(page.getByText('Package operation failed. Please refresh and try again.')).toBeVisible()
        await devUrlDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(devUrlDialog).toHaveCount(0)
        await page.unroute(configEndpointPattern)
        await page.unroute(authoringHostEndpointPattern)

        await expectRuntimeUxViewportMatrix(page, 'PlayCanvas Editor settings dialog', {
            beforeEachViewport: async (viewport) => {
                await page.goto(`/metahub/${metahub.id}/resources`)
                await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
                const dialog = await openPlayCanvasEditorSettingsDialog(page)
                await expect(dialog.getByLabel('Display mode')).toBeVisible()
                await expect(dialog.getByLabel('Default project')).toBeVisible()
                await expect(dialog.getByLabel('Default project')).toContainText('Flight Backup')
                await expect(dialog.getByRole('button', { name: 'Reset to defaults' })).toBeVisible()
                const saveButton = dialog.getByRole('button', { name: /^Save$/ })
                await expect(saveButton).toBeVisible()
                await expect(dialog.getByRole('button', { name: /Save settings/i })).toHaveCount(0)
                await expectLocatorHasNoInlineOverflow(saveButton, `PlayCanvas Editor settings Save button ${viewport.name}`)
                await page.screenshot({ path: testInfo.outputPath(`playcanvas-editor-settings-${viewport.name}.png`), fullPage: true })
            }
        })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const editorRowAfterSettingsMatrix = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowAfterSettingsMatrix.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        await expect(page.getByRole('menu')).toHaveCount(0)
        const editorSettingsDialogAfterMatrix = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(editorSettingsDialogAfterMatrix).toBeVisible()
        await editorSettingsDialogAfterMatrix.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Open separately' }).click()
        await editorSettingsDialogAfterMatrix.getByRole('button', { name: 'Save' }).click()
        await expect(editorSettingsDialogAfterMatrix).toHaveCount(0)

        const editorRowForSeparateMode = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowForSeparateMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const separateHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const separateHostPage = await separateHostPopupPromise
        await separateHostPage.waitForLoadState('domcontentloaded')
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))
        await applyBrowserPreferences(separateHostPage, { language: 'en' })
        await expect(separateHostPage).toHaveURL(
            new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor/fullscreen$`)
        )
        await expect(separateHostPage.getByText('This editor is configured to open separately.')).toHaveCount(0)
        await expect(separateHostPage.getByRole('link', { name: 'Open editor' })).toHaveCount(0)
        const separateUiMode = await expectPlayCanvasEditorIframeLoaded(separateHostPage)
        await expectPlayCanvasEditorFullscreenHost(separateHostPage)
        testInfo.annotations.push({ type: 'playcanvas-editor-ui-mode', description: `open-separately:${separateUiMode}` })
        await expectPlayCanvasEditorCompatibilityRestStatus(separateHostPage, metahub.id)
        await expectPlayCanvasEditorShareDbPersistenceWithoutBridgeSave(separateHostPage, metahub.id)
        await savePlayCanvasEditorSceneAndExpectReload(separateHostPage, metahub.id, { expectHostChrome: false })
        await expectNoPageHorizontalOverflow(separateHostPage, 'PlayCanvas Editor separate host page')
        await separateHostPage.screenshot({
            path: testInfo.outputPath('playcanvas-editor-open-separately-fullscreen.png'),
            fullPage: true
        })
        await separateHostPage.close()

        await page.goto(`/metahub/${metahub.id}/resources`)
        const editorRowForEmbeddedMode = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowForEmbeddedMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        const embeddedSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(page.getByRole('menu')).toHaveCount(0)
        await embeddedSettingsDialog.getByLabel('Display mode').click()
        await page.getByRole('option', { name: 'Embedded' }).click()
        await embeddedSettingsDialog.getByRole('button', { name: 'Save' }).click()
        await expect(embeddedSettingsDialog).toHaveCount(0)

        const editorArtifactIndexPattern =
            /\/api\/v1\/metahub\/[^/]+\/packages\/playcanvas-editor\/editor-artifact-token\/[^/]+\/index\.html(?:\?.*)?$/
        let delayedArtifactIndex = false
        const delayedArtifactRouteHandler = async (route: Route) => {
            if (!delayedArtifactIndex) {
                delayedArtifactIndex = true
                await new Promise((resolve) => setTimeout(resolve, 1500))
            }
            const response = await route.fetch()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                body: await response.body()
            })
        }
        await page.context().route(editorArtifactIndexPattern, delayedArtifactRouteHandler)
        await editorRowForEmbeddedMode.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const embeddedHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const embeddedHostPage = await embeddedHostPopupPromise
        await embeddedHostPage.waitForLoadState('domcontentloaded')
        await applyBrowserPreferences(embeddedHostPage, { language: 'en' })
        await expect(embeddedHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor$`))
        await expect(embeddedHostPage.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        const hostResponse = await embeddedHostPage.request.get(embeddedHostPage.url())
        expect(hostResponse.ok()).toBeTruthy()
        expect(hostResponse.headers()['content-security-policy']).toContain("frame-src 'self'")
        expect(hostResponse.headers()['content-security-policy']).toContain("child-src 'self'")
        const embeddedUiMode = await expectPlayCanvasEditorIframeLoaded(embeddedHostPage)
        await expectPlayCanvasEditorEmbeddedHostUx(embeddedHostPage)
        testInfo.annotations.push({ type: 'playcanvas-editor-ui-mode', description: `embedded:${embeddedUiMode}` })
        await expectPlayCanvasEditorCompatibilityRestStatus(embeddedHostPage, metahub.id)
        await expectPlayCanvasEditorRejectsUnauthenticatedFrameMessage(embeddedHostPage)
        await expectPlayCanvasEditorShareDbPersistenceWithoutBridgeSave(embeddedHostPage, metahub.id)
        await savePlayCanvasEditorSceneAndExpectReload(embeddedHostPage, metahub.id)
        await embeddedHostPage.screenshot({
            path: testInfo.outputPath('playcanvas-editor-save-reopen-success.png'),
            fullPage: true
        })
        const editorFrameSrc = await embeddedHostPage.locator('iframe[data-testid="playcanvas-editor-frame"]').getAttribute('src')
        expect(editorFrameSrc).toBeTruthy()
        const anonymousArtifactContext = await browser.newContext()
        try {
            const artifactUrl = new URL(editorFrameSrc ?? '', embeddedHostPage.url()).toString()
            const anonymousArtifactResponse = await anonymousArtifactContext.request.get(artifactUrl)
            expect(anonymousArtifactResponse.ok()).toBeTruthy()
            const tamperedArtifactResponse = await anonymousArtifactContext.request.get(
                tamperTokenizedArtifactUrl(artifactUrl, embeddedHostPage.url())
            )
            expect(tamperedArtifactResponse.status()).toBe(404)
        } finally {
            await anonymousArtifactContext.close()
        }
        await page.context().unroute(editorArtifactIndexPattern, delayedArtifactRouteHandler)
        await expectPlayCanvasEditorHostKeyboardLoop(embeddedHostPage)
        await createSerializablePlayCanvasEditorEntity(embeddedHostPage)
        await expectPlayCanvasEditorIframeSaveShortcutPrevented(embeddedHostPage, metahub.id, playCanvasEditorSaveShortcut)
        await expect(embeddedHostPage.getByTestId('playcanvas-editor-host-chrome').getByText(/^(Scene saved\.|Ready)$/)).toBeVisible()
        await expect(embeddedHostPage.getByText('Unsaved changes')).toHaveCount(0)
        await createSerializablePlayCanvasEditorEntity(embeddedHostPage)
        await expectPlayCanvasEditorHostSaveShortcutPrevented(embeddedHostPage, metahub.id, playCanvasEditorSaveShortcut)
        await expect(embeddedHostPage.getByTestId('playcanvas-editor-host-chrome').getByText(/^(Scene saved\.|Ready)$/)).toBeVisible()
        await expect(embeddedHostPage.getByText('Unsaved changes')).toHaveCount(0)
        let conflictRouteUsed = false
        await embeddedHostPage.route(
            /\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/scenes\/[^/]+$/,
            async (route) => {
                const request = route.request()
                const requestBody = request.postDataJSON() as { requestId?: unknown } | null
                if (!conflictRouteUsed && request.method() === 'PUT') {
                    conflictRouteUsed = true
                    await route.fulfill({
                        status: 409,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            ok: false,
                            requestId: requestBody?.requestId,
                            code: 'saveConflict',
                            status: 409
                        })
                    })
                    return
                }
                await route.fallback()
            }
        )
        await savePlayCanvasEditorSceneExpectingConflict(embeddedHostPage, metahub.id, `conflict-${runManifest.runId}`)
        const saveConflictDialog = embeddedHostPage.getByRole('dialog', { name: 'Save conflict' })
        await expect(saveConflictDialog).toBeVisible()
        await expect(saveConflictDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(saveConflictDialog.getByText('Another save changed this scene.')).toBeVisible()
        await expect(saveConflictDialog.getByRole('button', { name: 'Keep editing' })).toBeVisible()
        await expect(saveConflictDialog.getByRole('button', { name: 'Reload latest' })).toBeVisible()
        await expectNoTechnicalLeakage(saveConflictDialog, {
            label: 'PlayCanvas Editor save conflict dialog',
            checkUuidSubstrings: true
        })
        await embeddedHostPage.screenshot({
            path: testInfo.outputPath('playcanvas-editor-host-save-conflict.png'),
            fullPage: true
        })
        await embeddedHostPage.screenshot({
            path: testInfo.outputPath('playcanvas-editor-save-conflict.png'),
            fullPage: true
        })
        await saveConflictDialog.getByRole('button', { name: 'Keep editing' }).click()
        await expect(saveConflictDialog).toHaveCount(0)
        await embeddedHostPage.unroute(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/scenes\/[^/]+$/)

        await embeddedHostPage.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expectPlayCanvasEditorIframeLoaded(embeddedHostPage)
        await createSerializablePlayCanvasEditorEntity(embeddedHostPage)
        await expect(embeddedHostPage.getByText('Unsaved changes')).toBeVisible()
        const hostUrlBeforeDirtyBack = embeddedHostPage.url()
        await embeddedHostPage.getByRole('link', { name: 'Back to packages' }).click()
        await expect(embeddedHostPage).toHaveURL(hostUrlBeforeDirtyBack)
        const dirtyDialog = embeddedHostPage.getByRole('dialog', { name: 'Unsaved changes' })
        await expect(dirtyDialog).toBeVisible()
        await expect(dirtyDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(dirtyDialog.getByRole('button', { name: 'Leave page' })).toBeVisible()
        await expect(dirtyDialog.getByRole('button', { name: 'Keep editing' })).toBeVisible()
        await expectNoTechnicalLeakage(dirtyDialog, {
            label: 'PlayCanvas Editor unsaved changes dialog',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(embeddedHostPage, 'PlayCanvas Editor unsaved changes dialog')
        await embeddedHostPage.screenshot({
            path: testInfo.outputPath('playcanvas-editor-unsaved-changes-dialog.png'),
            fullPage: true
        })
        await dirtyDialog.getByRole('button', { name: 'Keep editing' }).click()
        await expect(dirtyDialog).toHaveCount(0)
        await embeddedHostPage.getByRole('link', { name: 'Back to packages' }).click()
        await embeddedHostPage.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Leave page' }).click()
        await expect(embeddedHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))
        await embeddedHostPage.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expectPlayCanvasEditorIframeLoaded(embeddedHostPage)
        await expectNoTechnicalLeakage(embeddedHostPage.locator('body'), {
            label: 'PlayCanvas Editor host page',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(embeddedHostPage, 'PlayCanvas Editor host page desktop')
        await embeddedHostPage.screenshot({ path: testInfo.outputPath('playcanvas-editor-host.png'), fullPage: true })
        await embeddedHostPage.close()

        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    artifactStatus: 'missing',
                    artifactUrl: null
                })
            })
        })
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(page.getByText('The editor files are not available yet.')).toBeVisible()
        await expect(page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor missing artifact host page')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-missing-artifact.png'), fullPage: true })
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-artifact-unavailable.png'), fullPage: true })
        await page.unroute(authoringHostEndpointPattern)

        for (const artifactStatus of ['blocked', 'misconfigured'] as const) {
            await page.route(authoringHostEndpointPattern, async (route) => {
                const response = await route.fetch()
                const descriptor = await response.json()
                await route.fulfill({
                    status: response.status(),
                    headers: response.headers(),
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ...descriptor,
                        artifactStatus,
                        artifactUrl: null
                    })
                })
            })
            await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
            await expectPlayCanvasEditorHostWarning(
                page,
                'Editor display settings are incomplete.',
                `PlayCanvas Editor ${artifactStatus} host state`
            )
            await page.unroute(authoringHostEndpointPattern)
        }

        await page.route(editorArtifactIndexPattern, async (route) => {
            await route.fulfill({
                status: 503,
                contentType: 'text/html; charset=utf-8',
                body: '<!doctype html><title>Service unavailable</title>'
            })
        })
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(page.getByText('The editor could not be loaded.')).toBeVisible()
        await expect(page.getByText('Editor is ready.')).toHaveCount(0)
        await expect(page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'PlayCanvas Editor iframe failure state',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(
            page.locator('body'),
            [/editor-artifact-token\/[^/]+\/index\.html/i, /Service unavailable/i, /\b503\b/, /\bERR_[A-Z_]+\b/i],
            { label: 'PlayCanvas Editor iframe failure state' }
        )
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor iframe failure state')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-iframe-failure.png'), fullPage: true })
        await page.unroute(editorArtifactIndexPattern)

        await expectRuntimeUxViewportMatrix(page, 'PlayCanvas Editor host page', {
            beforeEachViewport: async (viewport) => {
                await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
                await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
                if (viewport.name === 'mobile-390') {
                    await expectPlayCanvasEditorHostWarning(
                        page,
                        'PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.',
                        'PlayCanvas Editor host page mobile unsupported state'
                    )
                    await expect(page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
                    await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-real-loaded-mobile.png'), fullPage: true })
                    return
                }
                await expectPlayCanvasEditorIframeLoaded(page)
                await page.screenshot({ path: testInfo.outputPath(`playcanvas-editor-host-${viewport.name}.png`), fullPage: true })
                if (viewport.name === 'desktop-1920') {
                    await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-real-loaded-desktop.png'), fullPage: true })
                }
            }
        })

        memberContext = await createLoggedInBrowserContext(
            browser,
            {
                email: memberUser.email ?? memberEmail,
                password: memberPassword
            },
            { basePathAfterLogin: `/metahub/${metahub.id}/resources` }
        )
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        const readOnlyProjectRequests: string[] = []
        await memberContext.page.route(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects(?:\/.*)?$/, async (route) => {
            readOnlyProjectRequests.push(route.request().url())
            await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'forbidden' })
            })
        })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources`, { waitUntil: 'networkidle' })
        await expect(memberContext.page.getByTestId('metahub-packages-tab')).toBeVisible()
        const readOnlyEditorProjectsPanel = memberContext.page
            .getByTestId('metahub-packages-tab')
            .getByText('PlayCanvas projects')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        await expect(
            readOnlyEditorProjectsPanel.getByText(
                'Project storage is available to metahub managers. You can view connected packages, but cannot change PlayCanvas projects.'
            )
        ).toBeVisible()
        await expect(readOnlyEditorProjectsPanel.getByRole('button', { name: 'Create project' })).toHaveCount(0)
        expect(readOnlyProjectRequests).toEqual([])
        await expectNoPageHorizontalOverflow(memberContext.page, 'Read-only PlayCanvas projects panel')
        await memberContext.page.screenshot({ path: testInfo.outputPath('playcanvas-projects-panel-readonly-member.png'), fullPage: true })
        await memberContext.page.unroute(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/projects(?:\/.*)?$/)
        await memberContext.context.close()
        memberContext = null

        memberContext = await createLoggedInBrowserContext(browser, { email: memberUser.email ?? memberEmail, password: memberPassword })
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(memberContext.page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(memberContext.page.getByRole('link', { name: 'Back to packages' })).toBeVisible()
        await expect(memberContext.page.getByText('You do not have permission to open this editor.')).toBeVisible()
        await expect(memberContext.page.getByText('Failed to load editor settings.')).toHaveCount(0)
        await expect(memberContext.page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
        await expectNoTechnicalLeakage(memberContext.page.locator('body'), {
            label: 'PlayCanvas Editor permission blocked state',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(memberContext.page, 'PlayCanvas Editor permission blocked state')
        await memberContext.page.screenshot({ path: testInfo.outputPath('playcanvas-editor-permission-blocked.png'), fullPage: true })
        await memberContext.context.close()
        memberContext = null

        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        const editorRowAfterHost = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await editorRowAfterHost.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Disconnect package' }).click()
        const editorDetachDialog = page.getByRole('dialog', { name: 'Disconnect package' })
        await expect(editorDetachDialog).toBeVisible()
        await editorDetachDialog.getByRole('button', { name: 'Disconnect package' }).click()
        await expect(editorDetachDialog).toHaveCount(0)
        await expect(editorRowAfterHost.getByText('Available')).toBeVisible()

        await page.getByRole('button', { name: 'Connect PlayCanvas Engine' }).click()
        const attachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(attachDialog).toBeVisible()
        await expect(attachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(attachDialog).toContainText('Connect PlayCanvas Engine version 0.1.0')
        await attachDialog.getByRole('button', { name: 'Connect package' }).click()
        const playCanvasRow = packagesTab.getByRole('row', { name: /PlayCanvas Engine/ })
        await expect(playCanvasRow.getByText('Connected')).toBeVisible()

        await page.getByRole('button', { name: 'Disconnect PlayCanvas Engine' }).click()
        const detachDialog = page.getByRole('dialog', { name: 'Disconnect package' })
        await expect(detachDialog).toBeVisible()
        await expect(detachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(detachDialog).toContainText('Modules that expect it')
        await detachDialog.getByRole('button', { name: 'Disconnect package' }).click()
        await expect(detachDialog).toHaveCount(0)
        await expect(playCanvasRow.getByText('Available')).toBeVisible()
        await expect(playCanvasRow.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeEnabled()

        const colyseusClientRow = packagesTab.getByRole('row', { name: /Colyseus Client/ })
        await colyseusClientRow.getByRole('button', { name: 'Connect Colyseus Client' }).click()
        const colyseusAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(colyseusAttachDialog).toBeVisible()
        await colyseusAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(colyseusAttachDialog).toHaveCount(0)
        await expect(colyseusClientRow.getByText('Connected')).toBeVisible()

        if (!memberContext) {
            memberContext = await createLoggedInBrowserContext(browser, {
                email: memberUser.email ?? memberEmail,
                password: memberPassword
            })
        }
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources`)
        await expect(memberContext.page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(memberContext.page.getByText('You can view connected packages, but cannot change them.')).toBeVisible()
        await expect(memberContext.page.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeDisabled()
        const readOnlyPackagesTab = memberContext.page.getByTestId('metahub-packages-tab')
        const readOnlyColyseusClientRow = readOnlyPackagesTab.getByRole('row', { name: /Colyseus Client/ })
        await expect(readOnlyColyseusClientRow.getByRole('button', { name: 'Disconnect Colyseus Client' })).toBeDisabled()
        const readOnlyEditorRow = readOnlyPackagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(readOnlyEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' })).toBeDisabled()
        await expect(readOnlyColyseusClientRow.locator('[aria-label="Package version for Colyseus Client"]')).toHaveClass(/Mui-disabled/)
        await expectNoTechnicalLeakage(readOnlyPackagesTab, {
            label: 'Read-only metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(readOnlyPackagesTab, rawPackageTextPatterns, { label: 'Read-only metahub packages tab' })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Пакеты', selected: true })).toBeVisible()
        await expect(page.getByRole('table', { name: 'Пакеты' })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Подключить PlayCanvas Engine' })).toBeVisible()
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Metahub packages tab ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(page.getByTestId('metahub-packages-tab'), rawPackageTextPatterns, {
            label: 'Metahub packages tab ru'
        })
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-ru.png'), fullPage: true })

        const packagesEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/packages$/
        await page.route(packagesEndpointPattern, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Package from metahub snapshot is not registered' })
                })
                return
            }
            await route.continue()
        })
        await page.getByRole('button', { name: 'Подключить PlayCanvas Engine' }).click()
        const failedAttachDialog = page.getByRole('dialog', { name: 'Подключить пакет' })
        await expect(failedAttachDialog).toBeVisible()
        await expect(failedAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        const failedAttachResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                packagesEndpointPattern.test(new URL(response.url()).pathname) &&
                response.status() === 500
        )
        await failedAttachDialog.getByRole('button', { name: 'Подключить пакет' }).click()
        await failedAttachResponse
        await expect(page.getByText('Не удалось выполнить операцию с пакетом. Обновите страницу и попробуйте ещё раз.')).toBeVisible()
        await failedAttachDialog.getByRole('button', { name: 'Отмена' }).click()
        await page.unroute(packagesEndpointPattern)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const mobilePackagesTab = page.getByTestId('metahub-packages-tab')
        await expect(mobilePackagesTab).toBeVisible()
        await expect(page.getByRole('table', { name: 'Packages' })).toBeVisible()
        await scrollPackagesTableActionsIntoViewByGesture(page)
        const mobileEditorRow = mobilePackagesTab.getByRole('row', { name: /PlayCanvas Editor/ })
        await expect(mobileEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' })).toBeVisible()
        await mobileEditorRow.getByRole('button', { name: 'Connect PlayCanvas Editor' }).click()
        const mobileEditorAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(mobileEditorAttachDialog).toBeVisible()
        await mobileEditorAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(mobileEditorAttachDialog).toHaveCount(0)
        await scrollPackagesTableActionsIntoViewByGesture(page)
        await expect(mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' })).toBeVisible()
        await mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()
        await expect(page.getByRole('menuitem', { name: 'Open editor' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        const mobileSettingsDialog = page.getByRole('dialog', { name: 'Package display settings' })
        await expect(mobileSettingsDialog).toBeVisible()
        await expect(mobileSettingsDialog.getByLabel('Display mode')).toBeVisible()
        await expect(mobileSettingsDialog.getByLabel('Default project')).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor mobile settings action path')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-mobile-action-path.png'), fullPage: true })
        const mobileSettingsSaveButton = mobileSettingsDialog.getByRole('button', { name: /^Save$/ })
        await expectLocatorHasNoInlineOverflow(mobileSettingsSaveButton, 'PlayCanvas Editor mobile settings Save button')
        await mobileSettingsSaveButton.click()
        await expect(mobileSettingsDialog).toHaveCount(0)
        await scrollPackagesTableActionsIntoViewByGesture(page)
        await mobileEditorRow.getByRole('button', { name: 'Actions for PlayCanvas Editor' }).click()
        const mobileHostPopupPromise = page.waitForEvent('popup')
        await page.getByRole('menuitem', { name: 'Open editor' }).click()
        const mobileHostPage = await mobileHostPopupPromise
        await mobileHostPage.waitForLoadState('domcontentloaded')
        await applyBrowserPreferences(mobileHostPage, { language: 'en' })
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))
        await expect(mobileHostPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor$`))
        await expectPlayCanvasEditorHostWarning(
            mobileHostPage,
            'Select a default PlayCanvas project before opening the editor.',
            'PlayCanvas Editor mobile host action path'
        )
        await mobileHostPage.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-mobile-action-path.png'), fullPage: true })
        await mobileHostPage.close()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        const ruProjectsPanelAfterReconnect = page
            .getByTestId('metahub-packages-tab')
            .getByText('Проекты PlayCanvas')
            .locator('xpath=ancestor::*[contains(@class, "MuiBox-root")][1]')
        const restoreRuDefaultSave = waitForDefaultSave()
        await ruProjectsPanelAfterReconnect.getByLabel('Проект по умолчанию').click()
        await page.getByRole('option', { name: 'Flight Backup' }).click()
        await restoreRuDefaultSave
        await expect(ruProjectsPanelAfterReconnect.getByLabel('Проект по умолчанию')).toContainText('Flight Backup')
        await page.route(authoringHostEndpointPattern, async (route) => {
            const response = await route.fetch()
            const descriptor = await response.json()
            await route.fulfill({
                status: response.status(),
                headers: response.headers(),
                contentType: 'application/json',
                body: JSON.stringify({
                    ...descriptor,
                    allowedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl']
                })
            })
        })
        const ruEditorRow = page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })
        await ruEditorRow.getByRole('button', { name: 'Действия для PlayCanvas Editor' }).click()
        await page.getByRole('menuitem', { name: 'Настройки' }).click()
        const ruSettingsDialog = page.getByRole('dialog', { name: 'Настройки отображения пакета' })
        await expect(ruSettingsDialog).toBeVisible()
        await expect(ruSettingsDialog.getByLabel('Режим отображения')).toBeVisible()
        await expect(ruSettingsDialog.getByRole('button', { name: 'Сохранить' })).toBeVisible()
        await ruSettingsDialog.getByLabel('Режим отображения').click()
        await page.getByRole('option', { name: 'Адрес разработки' }).click()
        await ruSettingsDialog.getByLabel('Адрес разработки').fill('не-url')
        await expect(ruSettingsDialog.getByText('Введите корректный адрес с http или https.')).toBeVisible()
        await expect(ruSettingsDialog.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor settings dialog ru')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-settings-ru.png'), fullPage: true })
        await page.keyboard.press('Escape')
        await page.unroute(authoringHostEndpointPattern)
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expectPlayCanvasEditorIframeLoaded(page, 'ru')
        await expectPlayCanvasEditorHostKeyboardLoop(page, 'ru')
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor host page ru')
        await page.screenshot({ path: testInfo.outputPath('playcanvas-editor-host-ru.png'), fullPage: true })
        const ruShortcutSaveCommand = waitForPlayCanvasCompatibilitySceneSave(page, metahub.id)
        await createSerializablePlayCanvasEditorEntity(page)
        await page.locator('iframe[data-testid="playcanvas-editor-frame"]').click({ position: { x: 80, y: 80 } })
        await page.keyboard.press(playCanvasEditorSaveShortcut)
        await ruShortcutSaveCommand
        await expect(page.getByText('Сцена сохранена.')).toBeVisible()

        let ruConflictRouteUsed = false
        await page.route(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/scenes\/[^/]+$/, async (route) => {
            const request = route.request()
            const requestBody = request.postDataJSON() as { requestId?: unknown } | null
            if (!ruConflictRouteUsed && request.method() === 'PUT') {
                ruConflictRouteUsed = true
                await route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: false,
                        requestId: requestBody?.requestId,
                        code: 'saveConflict',
                        status: 409
                    })
                })
                return
            }
            await route.fallback()
        })
        await savePlayCanvasEditorSceneExpectingConflict(page, metahub.id, `ru-conflict-${runManifest.runId}`)
        const ruSaveConflictDialog = page.getByRole('dialog', { name: 'Конфликт сохранения' })
        await expect(ruSaveConflictDialog).toBeVisible()
        await expect(
            page
                .getByTestId('playcanvas-editor-save-conflict-alert')
                .getByText('Сцена была изменена в другом месте. Загрузите последнюю версию перед повторным сохранением.')
        ).toBeVisible()
        await expect(ruSaveConflictDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(ruSaveConflictDialog.getByText('Другое сохранение изменило эту сцену.')).toBeVisible()
        await expect(ruSaveConflictDialog.getByRole('button', { name: 'Продолжить редактирование' })).toBeVisible()
        await expect(ruSaveConflictDialog.getByRole('button', { name: 'Загрузить последнюю' })).toBeVisible()
        await expectNoTechnicalLeakage(ruSaveConflictDialog, {
            label: 'PlayCanvas Editor save conflict dialog ru',
            checkUuidSubstrings: true
        })
        await ruSaveConflictDialog.getByRole('button', { name: 'Продолжить редактирование' }).click()
        await expect(ruSaveConflictDialog).toHaveCount(0)
        await page.unroute(/\/api\/v1\/metahub\/[^/]+\/playcanvas\/editor-compatible\/projects\/[^/]+\/scenes\/[^/]+$/)

        await createSerializablePlayCanvasEditorEntity(page)
        await expect(page.getByText('Несохранённые изменения')).toBeVisible()
        const ruHostUrlBeforeDirtyBack = page.url()
        await page.getByRole('link', { name: 'Назад к пакетам' }).click()
        await expect(page).toHaveURL(ruHostUrlBeforeDirtyBack)
        const ruDirtyDialog = page.getByRole('dialog', { name: 'Несохранённые изменения' })
        await expect(ruDirtyDialog).toBeVisible()
        await expect(ruDirtyDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(ruDirtyDialog.getByText('Сохраните изменения в редакторе перед уходом со страницы.')).toBeVisible()
        await expect(ruDirtyDialog.getByRole('button', { name: 'Уйти со страницы' })).toBeVisible()
        await expect(ruDirtyDialog.getByRole('button', { name: 'Продолжить редактирование' })).toBeVisible()
        await expectNoTechnicalLeakage(ruDirtyDialog, {
            label: 'PlayCanvas Editor unsaved changes dialog ru',
            checkUuidSubstrings: true
        })
        await ruDirtyDialog.getByRole('button', { name: 'Уйти со страницы' }).click()
        await expect(page).toHaveURL(new RegExp(`/metahub/${metahub.id}/resources$`))

        await page.route(editorArtifactIndexPattern, async (route) => {
            await route.fulfill({
                status: 503,
                contentType: 'text/html; charset=utf-8',
                body: '<!doctype html><title>Service unavailable</title>'
            })
        })
        await page.goto(`/metahub/${metahub.id}/resources/packages/playcanvas-editor/editor`)
        await expect(page.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Назад к пакетам' })).toBeVisible()
        await expect(page.getByText('Не удалось загрузить редактор.')).toBeVisible()
        await expect(page.locator('iframe[data-testid="playcanvas-editor-frame"]')).toHaveCount(0)
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'PlayCanvas Editor iframe failure state ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(
            page.locator('body'),
            [/editor-artifact-token\/[^/]+\/index\.html/i, /Service unavailable/i, /\b503\b/, /\bERR_[A-Z_]+\b/i],
            { label: 'PlayCanvas Editor iframe failure state ru' }
        )
        await page.unroute(editorArtifactIndexPattern)

        await expectRuntimeUxViewportMatrix(page, 'Metahub packages resources page', {
            beforeEachViewport: async () => {
                await page.goto(`/metahub/${metahub.id}/resources`)
                await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
                await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
            }
        })
        await page.setViewportSize({ width: 768, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
        await expect(page.getByRole('table', { name: /Packages|Пакеты/ })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-mobile.png'), fullPage: true })
    } finally {
        if (memberContext) {
            await memberContext.context.close()
        }
        if (bootstrapApi) {
            await disposeApiContext(bootstrapApi)
        }
        await disposeApiContext(api)
    }
})
