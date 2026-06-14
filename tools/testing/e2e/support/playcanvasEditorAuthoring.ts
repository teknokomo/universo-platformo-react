import type { Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { expect } from '../fixtures/test'
import { expectNoTechnicalLeakage, expectNoVisibleTextPatterns } from './browser/runtimeUx'

export const playCanvasEditorSaveShortcut = process.platform === 'darwin' ? 'Meta+S' : 'Control+S'

const escapeXPathText = (value: string) => value.replace(/"/g, '\\"')

const playCanvasEditorMenuItemXPath = (label: string) =>
    `xpath=.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu-item ")][.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-label ") and normalize-space(.)="${escapeXPathText(
        label
    )}"]]`

export const playCanvasEditorVisibleMenuItemXPath = (label: string) =>
    `xpath=//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu ") and not(contains(concat(" ", normalize-space(@class), " "), " pcui-hidden "))]//*[contains(concat(" ", normalize-space(@class), " "), " pcui-menu-item ")][.//*[contains(concat(" ", normalize-space(@class), " "), " pcui-label ") and normalize-space(.)="${escapeXPathText(
        label
    )}"]]`

export type PlayCanvasEditorCompatibilityConfig = {
    mode?: unknown
    projectId?: unknown
    defaultSceneId?: unknown
    auth?: {
        scheme?: unknown
        headerName?: string
        accessToken?: string
        expiresAt?: unknown
    }
    csrf?: { tokenUrl?: string; headerName?: string }
    endpoints?: { scenes?: string; settings?: string; assets?: string; cloudOnly?: string }
}

type PlayCanvasEditorRuntimeConfig = {
    projectId: string
    sceneId: string
    restBaseUrl?: string
    compatibilityConfig?: PlayCanvasEditorCompatibilityConfig
    restCompatibilityConfig?: PlayCanvasEditorCompatibilityConfig
}

export type PlayCanvasEditorAuthoredEntity = {
    id: string
    name: string
}

const isTransientFrameNavigationError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return /Execution context was destroyed|Frame was detached|Target closed|Cannot find context with specified id/i.test(message)
}

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
            buckets.add(
                `${Math.floor((data[index] ?? 0) / 32)}:${Math.floor((data[index + 1] ?? 0) / 32)}:${Math.floor(
                    (data[index + 2] ?? 0) / 32
                )}`
            )
        }
    }

    expect(sampledOpaquePixels, `${label} must contain painted opaque pixels`).toBeGreaterThan(20)
    expect(buckets.size, `${label} must contain more than one sampled color bucket`).toBeGreaterThan(1)
    expect(new Set(screenshot).size, `${label} PNG bytes must not be uniform`).toBeGreaterThan(16)
}

export const expectPlayCanvasEditorCanvasPainted = async (page: Page, label = 'PlayCanvas Editor 3D canvas') => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const viewport = editorFrame.locator('#layout-viewport')
    const canvasHost = editorFrame.locator('#canvas-3d')
    await expect(viewport, `${label} viewport must be visible`).toBeVisible()
    await expect(canvasHost, `${label} host must be visible`).toBeVisible()
    const viewportBox = await viewport.boundingBox()
    const canvasBox = await canvasHost.boundingBox()
    expect(viewportBox, `${label} viewport must have a bounding box`).toBeTruthy()
    expect(canvasBox, `${label} host must have a bounding box`).toBeTruthy()
    if (!viewportBox || !canvasBox) return
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
            hasCanvas: Boolean(canvas),
            backingWidth: canvas?.width ?? 0,
            backingHeight: canvas?.height ?? 0
        }
    })
    expect(canvasMetrics.hasCanvas, `${label} must expose a PlayCanvas canvas element`).toBe(true)
    expect(canvasMetrics.backingWidth, `${label} backing width`).toBeGreaterThan(0)
    expect(canvasMetrics.backingHeight, `${label} backing height`).toBeGreaterThan(0)
    expectPngScreenshotNonBlank(await canvasHost.screenshot(), label)
}

export const expectPlayCanvasEditorIframeLoaded = async (page: Page, locale: 'en' | 'ru' = 'en') => {
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
                                compatibilityConfig?: { mode?: unknown }
                                fullBootMode?: boolean
                                hostedEntityAdapterInstalled?: boolean
                                lastWebSocketErrorUrl?: unknown
                                webSocketEvents?: unknown
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const config = (window as unknown as { config?: { mode?: unknown; url?: unknown } }).config
                    const realtime = (
                        window as unknown as {
                            editor?: {
                                api?: { globals?: { realtime?: { connection?: { connected?: unknown; authenticated?: unknown } } } }
                            }
                        }
                    ).editor?.api?.globals?.realtime
                    const websocketEvents = Array.isArray(bridge?.webSocketEvents) ? bridge.webSocketEvents : []
                    const openedWebSocketUrls = websocketEvents
                        .filter((event): event is { type?: unknown; url?: unknown } => Boolean(event && typeof event === 'object'))
                        .filter((event) => event.type === 'open' && typeof event.url === 'string')
                        .map((event) => String(event.url))
                    return {
                        ready: bridge?.ready === true,
                        initialized: bridge?.initialized === true,
                        hasBootstrapRequestId: typeof bridge?.bootstrapRequestId === 'string',
                        fullBootMode: bridge?.fullBootMode === true,
                        hostedEntityAdapterInstalled: bridge?.hostedEntityAdapterInstalled === true,
                        compatibilityConfigMode: bridge?.compatibilityConfig?.mode,
                        configMode: config?.mode,
                        usesDisabledEndpoint: JSON.stringify(config?.url ?? {}).includes('/disabled'),
                        realtimeConnected: realtime?.connection?.connected === true,
                        realtimeAuthenticated: realtime?.connection?.authenticated === true,
                        lastWebSocketErrorUrl: bridge?.lastWebSocketErrorUrl,
                        hasRealtimeWebSocketOpen: openedWebSocketUrls.some((url) => url.includes('/realtime')),
                        hasDisabledWebSocketOpen: openedWebSocketUrls.some((url) => url.includes('/disabled')),
                        connectionOverlayText: document.querySelector('.connection-overlay')?.textContent?.trim() ?? ''
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
        const config = (window as unknown as { config?: { project?: { id?: unknown }; scene?: { id?: unknown } } }).config
        return { projectId: config?.project?.id, sceneId: config?.scene?.id }
    })
    expectNumericCompatibleId(hostedConfig.projectId, 'PlayCanvas full-boot project id')
    expectNumericCompatibleId(hostedConfig.sceneId, 'PlayCanvas full-boot scene id')
    await expect(editorFrame.locator('#layout-root')).toBeVisible()
    await expect(editorFrame.locator('#layout-toolbar')).toBeVisible()
    await expect(editorFrame.locator('#layout-hierarchy')).toBeVisible()
    await expect(editorFrame.locator('#layout-viewport')).toBeVisible()
    await expect(editorFrame.locator('#canvas-3d')).toBeVisible()
    await expectPlayCanvasEditorCanvasPainted(page)
    await expect(editorFrame.locator('#layout-assets')).toBeVisible()
    await expect(editorFrame.locator('#layout-attributes')).toBeVisible()
}

export const expectPlayCanvasEditorFullscreenHost = async (page: Page) => {
    await expect(page.getByTestId('playcanvas-editor-fullscreen-host')).toBeVisible()
    await expect(page.getByTestId('playcanvas-editor-fullscreen-chrome')).toHaveCount(0)
    await expect(page.getByTestId('playcanvas-editor-host-chrome')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /back to packages/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0)
    const viewport = page.viewportSize()
    const iframeBox = await page.locator('iframe[data-testid="playcanvas-editor-frame"]').boundingBox()
    expect(iframeBox, 'fullscreen PlayCanvas Editor iframe must have layout bounds').toBeTruthy()
    if (viewport && iframeBox) {
        expect(iframeBox.width).toBeGreaterThan(viewport.width * 0.95)
        expect(iframeBox.height).toBeGreaterThan(viewport.height * 0.95)
    }
}

export const readSerializedPlayCanvasEditorScene = async (page: Page) => {
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

const readPlayCanvasEditorBridgeDiagnostics = async (page: Page) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    return editorFrame.locator('body').evaluate(() => {
        const bridge = (window as unknown as { __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: Record<string, unknown> })
            .__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
        const editor = (
            window as unknown as {
                editor?: {
                    call?: (method: string) => unknown
                    api?: { globals?: { entities?: { raw?: { array?: () => unknown[] } }; realtime?: { _connected?: boolean } } }
                }
            }
        ).editor
        let entitiesListLength: number | null = null
        try {
            const entities = typeof editor?.call === 'function' ? editor.call('entities:list') : null
            entitiesListLength = Array.isArray(entities) ? entities.length : null
        } catch {
            entitiesListLength = null
        }
        return {
            dirty: bridge?.dirty,
            editorSaveAdapterInstalled: bridge?.editorSaveAdapterInstalled,
            fullBootMode: bridge?.fullBootMode,
            lastSerializedEntityCount: bridge?.lastSerializedEntityCount,
            lastEntitySerializationErrors: bridge?.lastEntitySerializationErrors,
            lastWebSocketOpenUrl: bridge?.lastWebSocketOpenUrl,
            lastWebSocketErrorUrl: bridge?.lastWebSocketErrorUrl,
            entitiesListLength,
            realtimeConnected: editor?.api?.globals?.realtime?._connected ?? null,
            rawEntityObserverCount: editor?.api?.globals?.entities?.raw?.array?.().length ?? null,
            connectionOverlayText: document.querySelector('.connection-overlay')?.textContent?.trim() ?? ''
        }
    })
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

const expectPlayCanvasEditorShareDbEntitySubmitted = async (page: Page, createdEntity: PlayCanvasEditorAuthoredEntity) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_element, expectedEntity: PlayCanvasEditorAuthoredEntity) => {
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
}

export const createSerializablePlayCanvasEditorEntity = async (page: Page): Promise<PlayCanvasEditorAuthoredEntity> => {
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
                                    api?: { globals?: { realtime?: { scenes?: { current?: { _loaded?: boolean; loaded?: boolean } } } } }
                                }
                            }
                        ).editor
                        if (typeof editor?.call !== 'function') {
                            return { adapterReady: false, entitiesReady: false }
                        }
                        try {
                            const entities = editor.call('entities:list')
                            const root = editor.call('entities:root') as { get?: (path: string) => unknown } | null
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
        .toEqual({ adapterReady: true, entitiesReady: true })
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
    return createdEntity
}

export const createPlayCanvasCompatibilityAuthHeaders = (page: Page, config: PlayCanvasEditorCompatibilityConfig) => {
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

export const createPlayCanvasCompatibilityWriteHeaders = async (page: Page, config: PlayCanvasEditorCompatibilityConfig) => {
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
            type Config = PlayCanvasEditorCompatibilityConfig
            const config = (
                window as unknown as {
                    config?: {
                        accessToken?: unknown
                        url?: { api?: unknown }
                        universoBridge?: { compatibilityRestBaseUrl?: unknown }
                        project?: { id?: unknown }
                        scene?: { id?: unknown }
                        universoCompatibilityConfig?: Config
                    }
                    __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: { restCompatibilityConfig?: Config }
                }
            ).config
            const bridge = (window as unknown as { __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: { restCompatibilityConfig?: Config } })
                .__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            return {
                projectId: config?.project?.id,
                sceneId: config?.scene?.id,
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
    return {
        projectId: String(hostedConfig.projectId),
        sceneId: String(hostedConfig.sceneId),
        restBaseUrl: typeof hostedConfig.restBaseUrl === 'string' ? hostedConfig.restBaseUrl : undefined,
        compatibilityConfig:
            hostedConfig.compatibilityConfig?.mode === 'universo-compatibility-rest-minimal'
                ? (hostedConfig.compatibilityConfig as PlayCanvasEditorCompatibilityConfig)
                : undefined,
        restCompatibilityConfig: hostedConfig.restCompatibilityConfig as PlayCanvasEditorCompatibilityConfig | undefined
    }
}

export const fetchPlayCanvasEditorCompatibilityConfig = async (page: Page, metahubId: string) => {
    const runtimeConfig = await readPlayCanvasEditorRuntimeConfig(page)
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
    const configBody = (await configResponse.json()) as { item?: PlayCanvasEditorCompatibilityConfig }
    expect(configBody.item).toMatchObject({
        mode: 'universo-compatibility-rest-minimal'
    })
    return configBody.item ?? {}
}

export const readPlayCanvasEditorCompatibilityScene = async (
    page: Page,
    config: PlayCanvasEditorCompatibilityConfig,
    sceneId = String(config.defaultSceneId)
) => {
    const response = await page.request.get(new URL(`${config.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(), {
        headers: createPlayCanvasCompatibilityAuthHeaders(page, config)
    })
    expect(response.status()).toBe(200)
    return response.json()
}

export const writePlayCanvasEditorCompatibilityScene = async (
    page: Page,
    config: PlayCanvasEditorCompatibilityConfig,
    payload: Record<string, unknown>,
    options: { sceneId?: string; expectedCurrentChecksum?: string | null; requestId: string }
) => {
    const sceneId = options.sceneId ?? String(config.defaultSceneId)
    const response = await page.request.put(new URL(`${config.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(), {
        data: {
            requestId: options.requestId,
            payload,
            expectedCurrentChecksum: options.expectedCurrentChecksum ?? null
        },
        headers: await createPlayCanvasCompatibilityWriteHeaders(page, config)
    })
    expect(response.status()).toBe(200)
    return response.json()
}

export const waitForPlayCanvasCompatibilitySceneSave = (page: Page, metahubId: string) =>
    page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
            response.request().method() === 'PUT' &&
            url.pathname.startsWith(`/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/`) &&
            /\/scenes\/[0-9a-f-]+$/i.test(url.pathname) &&
            response.status() === 200
        )
    })

export const waitForPlayCanvasEditorSceneSave = (page: Page, metahubId: string) =>
    page.waitForResponse((response) => {
        const url = new URL(response.url())
        const request = response.request()
        if (response.status() !== 200) return false
        if (
            request.method() === 'PUT' &&
            url.pathname.startsWith(`/api/v1/metahub/${metahubId}/playcanvas/editor-compatible/projects/`) &&
            /\/scenes\/[0-9a-f-]+$/i.test(url.pathname)
        ) {
            return true
        }
        if (request.method() !== 'POST' || url.pathname !== `/api/v1/metahub/${metahubId}/playcanvas/editor-bridge/commands`) {
            return false
        }
        const body = request.postDataJSON() as { command?: { type?: unknown } } | null
        return body?.command?.type === 'scene.save'
    })

export const readPlayCanvasEditorSceneSavePayload = (response: Awaited<ReturnType<typeof waitForPlayCanvasEditorSceneSave>>) => {
    const body = response.request().postDataJSON() as { payload?: unknown; command?: { payload?: unknown } }
    return body.payload ?? body.command?.payload ?? null
}

export const savePlayCanvasEditorSceneAndExpectReload = async (page: Page, metahubId: string) => {
    const editorFrame = page.frameLocator('iframe[data-testid="playcanvas-editor-frame"]')
    const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, metahubId)
    const sceneId = String(compatibilityConfig.defaultSceneId)
    const createdEntity = await createSerializablePlayCanvasEditorEntity(page)
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
    expect(savePayload.payload?.entities).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: createdEntity.id, name: createdEntity.name })])
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectPlayCanvasEditorIframeLoaded(page)
    await expect
        .poll(
            () =>
                editorFrame.locator('body').evaluate((_element, expectedEntity) => {
                    const bridge = (
                        window as unknown as {
                            __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: {
                                serializeCurrentScene?: () => { entities?: Array<{ id?: unknown; name?: unknown }> }
                            }
                        }
                    ).__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
                    const serialized = bridge?.serializeCurrentScene?.()
                    return Boolean(
                        serialized?.entities?.some((entity) => entity.id === expectedEntity.id && entity.name === expectedEntity.name)
                    )
                }, createdEntity),
            { timeout: 20_000 }
        )
        .toBe(true)

    const sceneAfterReloadResponse = await page.request.get(
        new URL(`${compatibilityConfig.endpoints?.scenes ?? ''}/${sceneId}`, page.url()).toString(),
        { headers: createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig) }
    )
    expect(sceneAfterReloadResponse.status()).toBe(200)
    const sceneAfterReload = (await sceneAfterReloadResponse.json()) as { item?: { scene?: { checksum?: unknown } } }
    expect(sceneAfterReload.item?.scene?.checksum).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/i))
    return createdEntity
}
