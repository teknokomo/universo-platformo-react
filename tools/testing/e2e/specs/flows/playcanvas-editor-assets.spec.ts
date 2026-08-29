import type { APIResponse, Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectNoVisibleTextPatterns } from '../../support/browser/runtimeUx'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import {
    expectMmoommScriptAssetsVisibleInEditor,
    expectPlayCanvasEditorFrameNoHorizontalOverflow
} from '../../support/mmoommScriptAssetsProof'
import {
    createPlayCanvasCompatibilityAuthHeaders,
    expectPlayCanvasEditorFullscreenHost,
    expectPlayCanvasEditorIframeLoaded,
    fetchPlayCanvasEditorCompatibilityConfig
} from '../../support/playcanvasEditorAuthoring'

type EditorAssetEvidence = {
    id: string | number
    name: string
    filename: string
    type: string
    scriptNames: string[]
    path: Array<string | number>
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type EditorAssetLike = {
    get?: (path: string) => unknown
    json?: () => Record<string, unknown>
}

const editorFrameSelector = 'iframe[data-testid="playcanvas-editor-frame"]'

const readEditorAssetByFilename = async (page: Page, expectedFilename: string): Promise<EditorAssetEvidence | null> => {
    const editorFrame = page.frameLocator(editorFrameSelector)
    return editorFrame.locator('body').evaluate((_, filename) => {
        const readAssetValue = (asset: EditorAssetLike, path: string): unknown => {
            if (typeof asset.get === 'function') {
                return asset.get(path)
            }
            const json = typeof asset.json === 'function' ? asset.json() : {}
            return path.split('.').reduce<unknown>((current, part) => {
                if (!current || typeof current !== 'object') return undefined
                return (current as Record<string, unknown>)[part]
            }, json)
        }
        const observerArray = (value: unknown): EditorAssetLike[] => {
            if (Array.isArray(value)) return value as EditorAssetLike[]
            if (!value || typeof value !== 'object') return []
            const candidate = value as { array?: () => unknown[]; data?: unknown }
            if (typeof candidate.array === 'function') {
                try {
                    const items = candidate.array()
                    return Array.isArray(items) ? (items as EditorAssetLike[]) : []
                } catch {
                    return []
                }
            }
            return Array.isArray(candidate.data) ? (candidate.data as EditorAssetLike[]) : []
        }
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const assets = observerArray(editor?.call?.('assets:list') ?? editor?.call?.('assets:raw'))
        const asset = assets.find((candidate) => {
            const name = String(readAssetValue(candidate, 'name') ?? '')
            const candidateFilename = String(readAssetValue(candidate, 'file.filename') ?? readAssetValue(candidate, 'filename') ?? '')
            return name === filename || candidateFilename === filename
        })
        if (!asset) return null

        const id = readAssetValue(asset, 'id')
        const name = String(readAssetValue(asset, 'name') ?? '')
        const assetFilename = String(readAssetValue(asset, 'file.filename') ?? readAssetValue(asset, 'filename') ?? '')
        const type = String(readAssetValue(asset, 'type') ?? '')
        const scriptData = readAssetValue(asset, 'data.scripts')
        const scriptNames = scriptData && typeof scriptData === 'object' && !Array.isArray(scriptData) ? Object.keys(scriptData) : []
        const pathValue = readAssetValue(asset, 'path')
        const assetPath = Array.isArray(pathValue) ? pathValue.filter((part) => typeof part === 'string' || typeof part === 'number') : []
        if ((typeof id !== 'string' && typeof id !== 'number') || !name || !assetFilename || !type) {
            return null
        }
        return { id, name, filename: assetFilename, type, scriptNames, path: assetPath }
    }, expectedFilename)
}

const readEditorAssetById = async (
    page: Page,
    expectedId: string | number
): Promise<{ id: string | number; name: string; type: string; path: Array<string | number> } | null> => {
    const editorFrame = page.frameLocator(editorFrameSelector)
    return editorFrame.locator('body').evaluate((_, idValue) => {
        const readAssetValue = (asset: EditorAssetLike, path: string): unknown => {
            if (typeof asset.get === 'function') return asset.get(path)
            const json = typeof asset.json === 'function' ? asset.json() : {}
            return path.split('.').reduce<unknown>((current, part) => {
                if (!current || typeof current !== 'object') return undefined
                return (current as Record<string, unknown>)[part]
            }, json)
        }
        const observerArray = (value: unknown): EditorAssetLike[] => {
            if (Array.isArray(value)) return value as EditorAssetLike[]
            if (!value || typeof value !== 'object') return []
            const candidate = value as { array?: () => unknown[]; data?: unknown }
            if (typeof candidate.array === 'function') {
                try {
                    const items = candidate.array()
                    return Array.isArray(items) ? (items as EditorAssetLike[]) : []
                } catch {
                    return []
                }
            }
            return Array.isArray(candidate.data) ? (candidate.data as EditorAssetLike[]) : []
        }
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const asset = observerArray(editor?.call?.('assets:list') ?? editor?.call?.('assets:raw')).find(
            (candidate) => String(readAssetValue(candidate, 'id') ?? '') === String(idValue)
        )
        if (!asset) return null
        const id = readAssetValue(asset, 'id')
        const name = String(readAssetValue(asset, 'name') ?? '')
        const type = String(readAssetValue(asset, 'type') ?? '')
        const pathValue = readAssetValue(asset, 'path')
        const assetPath = Array.isArray(pathValue) ? pathValue.filter((part) => typeof part === 'string' || typeof part === 'number') : []
        if ((typeof id !== 'string' && typeof id !== 'number') || !name || !type) return null
        return { id, name, type, path: assetPath }
    }, expectedId)
}

const readEditorAssetCountByType = async (page: Page, expectedType: string): Promise<number> => {
    const editorFrame = page.frameLocator(editorFrameSelector)
    return editorFrame.locator('body').evaluate((_, type) => {
        const readAssetValue = (asset: EditorAssetLike, path: string): unknown => {
            if (typeof asset.get === 'function') return asset.get(path)
            const json = typeof asset.json === 'function' ? asset.json() : {}
            return path.split('.').reduce<unknown>((current, part) => {
                if (!current || typeof current !== 'object') return undefined
                return (current as Record<string, unknown>)[part]
            }, json)
        }
        const observerArray = (value: unknown): EditorAssetLike[] => {
            if (Array.isArray(value)) return value as EditorAssetLike[]
            if (!value || typeof value !== 'object') return []
            const candidate = value as { array?: () => unknown[]; data?: unknown }
            if (typeof candidate.array === 'function') {
                try {
                    const items = candidate.array()
                    return Array.isArray(items) ? (items as EditorAssetLike[]) : []
                } catch {
                    return []
                }
            }
            return Array.isArray(candidate.data) ? (candidate.data as EditorAssetLike[]) : []
        }
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        return observerArray(editor?.call?.('assets:list') ?? editor?.call?.('assets:raw')).filter(
            (asset) => String(readAssetValue(asset, 'type') ?? '') === type
        ).length
    }, expectedType)
}

const readCurrentEditorFolderId = async (page: Page): Promise<string | null> => {
    const editorFrame = page.frameLocator(editorFrameSelector)
    return editorFrame.locator('body').evaluate(() => {
        const editor = (
            window as unknown as {
                editor?: { call?: (method: string, ...args: unknown[]) => unknown }
            }
        ).editor
        const folder = editor?.call?.('assets:panel:currentFolder') as EditorAssetLike | null | undefined
        if (!folder || typeof folder.get !== 'function') return null
        const id = folder.get('id')
        return typeof id === 'string' || typeof id === 'number' ? String(id) : null
    })
}

const selectEditorFolder = async (
    folderItem: import('@playwright/test').Locator,
    page: Page,
    expectedId: string | number,
    label: string
): Promise<void> => {
    const contents = folderItem.locator(':scope > .pcui-treeview-item-contents')
    await expect(contents, `${label} must expose a selectable tree item`).toBeVisible()

    // Creating a folder selects it as an asset, while the panel still remains
    // in the parent folder. PCUI toggles an already selected tree item on the
    // first click, so clear that transient selection before the navigation
    // click that establishes the current-folder context.
    if (await contents.evaluate((element) => element.classList.contains('pcui-treeview-item-selected'))) {
        await contents.click()
        await expect(contents, `${label} selection must be cleared before navigation`).not.toHaveClass(/pcui-treeview-item-selected/)
    }
    await contents.click()
    await expect
        .poll(() => readCurrentEditorFolderId(page), {
            timeout: 15_000,
            message: `${label} must update the Editor current-folder context`
        })
        .toBe(String(expectedId))
}

const expandEditorFolderTreeItem = async (folderItem: import('@playwright/test').Locator, page: Page, label: string): Promise<void> => {
    if (await folderItem.evaluate((element) => element.classList.contains('pcui-treeview-item-open'))) return

    const contents = folderItem.locator(':scope > .pcui-treeview-item-contents')
    const box = await contents.boundingBox()
    expect(box, `${label} must expose a visible tree expander`).not.toBeNull()
    if (!box) return

    // TreeViewItem keeps the expander pseudo-element in the 16px gutter just
    // left of the contents row. Click that gutter with real pointer input so
    // the test exercises the same interaction as a user opening the folder.
    await page.mouse.click(Math.max(0, box.x - 16), box.y + box.height / 2)
    await expect(folderItem, `${label} must open before a nested folder can be selected`).toHaveClass(/pcui-treeview-item-open/)
}

const waitForEditorAsset = async (page: Page, expectedFilename: string): Promise<EditorAssetEvidence> => {
    await expect
        .poll(() => readEditorAssetByFilename(page, expectedFilename), {
            timeout: 60_000,
            message: `PlayCanvas Editor must expose ${expectedFilename} in its asset registry`
        })
        .not.toBeNull()
    const asset = await readEditorAssetByFilename(page, expectedFilename)
    expect(asset, `PlayCanvas Editor asset ${expectedFilename} must be readable`).not.toBeNull()
    if (!asset) {
        throw new Error(`PlayCanvas Editor asset ${expectedFilename} was not available after the registry wait`)
    }
    return asset
}

const attachElementScreenshot = async (page: Page, element: import('@playwright/test').Locator, testInfo: TestInfo, filename: string) => {
    const box = await element.boundingBox()
    expect(box, `${filename} screenshot target must have a bounding box`).not.toBeNull()
    if (!box) return
    const screenshotPath = testInfo.outputPath(filename)
    const screenshot = await page.screenshot({
        path: screenshotPath,
        clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.max(1, box.width),
            height: Math.max(1, box.height)
        }
    })
    await testInfo.attach(filename, { path: screenshotPath, contentType: 'image/png' })
    expect(screenshot.length, `${filename} screenshot must not be empty`).toBeGreaterThan(0)
}

const resolveAuthoringProjectId = async (page: Page, metahubId: string): Promise<string> => {
    const response = await page.request.get(`/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/projects`)
    expect(response.status(), 'MMOOMM PlayCanvas projects list must be available after snapshot import').toBe(200)
    const payload = (await response.json()) as { items?: Array<{ id?: unknown; displayName?: unknown }> }
    const project = payload.items?.find((item) =>
        JSON.stringify(item.displayName ?? {})
            .toLowerCase()
            .includes('mmoomm authoring')
    )
    expect(project?.id, 'MMOOMM Authoring project id must be present in the imported project list').toEqual(expect.any(String))
    return String(project?.id)
}

const openAuthoringEditorFromResources = async (page: Page, metahubName: string): Promise<void> => {
    await page.goto('/metahubs')
    const metahubEntry = page.getByText(metahubName, { exact: true }).first()
    await expect(metahubEntry, 'Imported MMOOMM metahub must be reachable from the metahubs list').toBeVisible({ timeout: 30_000 })
    const metahubLink = metahubEntry
        .locator('xpath=ancestor::*[.//a[starts-with(@href, "/metahub/")]][1]//a[starts-with(@href, "/metahub/")]')
        .first()
    await expect(metahubLink, 'Imported MMOOMM metahub must expose a user-facing navigation link').toBeVisible()
    await metahubLink.click()
    await page.getByRole('link', { name: 'Resources' }).click()
    await page.waitForURL('**/resources')
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
    const packagesTab = page.getByTestId('metahub-packages-tab')
    await expect(packagesTab).toBeVisible()
    await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Editor' })).toBeVisible()
    await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor Resources navigation')
    await expectNoTechnicalLeakage(packagesTab, {
        label: 'PlayCanvas Editor Resources navigation',
        checkUuidSubstrings: true
    })
}

const openAuthoringEditor = async (page: Page, metahubId: string): Promise<void> => {
    const projectId = await resolveAuthoringProjectId(page, metahubId)
    await page.goto(
        `/metahub/${encodeURIComponent(metahubId)}/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${encodeURIComponent(
            projectId
        )}`
    )
    await expectPlayCanvasEditorIframeLoaded(page, 'en', { readyTimeoutMs: 150_000 })
    await expectPlayCanvasEditorFullscreenHost(page)
}

const ensureAssetGridView = async (editorFrame: ReturnType<Page['frameLocator']>): Promise<void> => {
    const assetsPanel = editorFrame.locator('#layout-assets')
    const gridView = assetsPanel.locator('.pcui-gridview').first()
    const readPanelState = () =>
        editorFrame.locator('body').evaluate(() => {
            const editor = (
                window as unknown as {
                    editor?: { call?: (method: string, ...args: unknown[]) => unknown }
                }
            ).editor
            const panel = editor?.call?.('layout.assets') as
                | {
                      assets?: { array?: () => unknown[] }
                      progressBar?: { value?: number }
                      gridView?: { hidden?: unknown }
                      detailsView?: { hidden?: unknown }
                  }
                | undefined
            const assetCount = panel?.assets && typeof panel.assets.array === 'function' ? panel.assets.array().length : 0
            return {
                assetCount,
                progress: Number(panel?.progressBar?.value ?? 0),
                gridHidden: panel?.gridView?.hidden === true,
                detailsHidden: panel?.detailsView?.hidden === true
            }
        })

    await expect
        .poll(async () => (await readPanelState()).assetCount, {
            timeout: 45_000,
            message: 'PlayCanvas Editor assets must be available before selecting a view'
        })
        .toBeGreaterThan(0)

    // Do not mutate the vendored Editor state from a test.  If the registry
    // reports loaded assets while its progress observer is still incomplete,
    // that is a real user-visible boot defect and the flow must fail with the
    // diagnostic state instead of repairing it behind the user's back.
    try {
        await expect
            .poll(async () => (await readPanelState()).progress, {
                timeout: 45_000,
                message: 'PlayCanvas Editor assets progress must reach 100% before a user can select an asset view'
            })
            .toBeGreaterThanOrEqual(100)
    } catch (error) {
        const diagnostics = await editorFrame.locator('body').evaluate(() => {
            const bridge = (window as unknown as { __UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__?: Record<string, unknown> })
                .__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__
            return {
                fullBootMode: bridge?.fullBootMode,
                editorCallWrapped: bridge?.editorCallWrapped,
                editorSaveAdapterInstalled: bridge?.editorSaveAdapterInstalled,
                fullBootAssetLoadRequests: bridge?.fullBootAssetLoadRequests,
                fullBootAssetLoadResolved: bridge?.fullBootAssetLoadResolved,
                fullBootAssetDocumentsResolved: bridge?.fullBootAssetDocumentsResolved,
                fullBootAssetDocumentCount: bridge?.fullBootAssetDocumentCount,
                fullBootAssetDocumentIds: bridge?.fullBootAssetDocumentIds,
                lastFullBootAssetLoadMiss: bridge?.lastFullBootAssetLoadMiss,
                lastFullBootAssetLoadError: bridge?.lastFullBootAssetLoadError,
                fullBootAssetOrigin: bridge?.fullBootAssetOrigin,
                fullBootAssetCount: bridge?.fullBootAssetCount,
                fullBootStorageAssetCount: bridge?.fullBootStorageAssetCount,
                fullBootAssetLoadState: bridge?.fullBootAssetLoadState,
                fullBootAssetProgressCompleted: bridge?.fullBootAssetProgressCompleted,
                fullBootAssetProgressCompletedAt: bridge?.fullBootAssetProgressCompletedAt,
                lastFullBootAssetProgressError: bridge?.lastFullBootAssetProgressError,
                hostedAssetAdapterInstalled: bridge?.hostedAssetAdapterInstalled,
                hostedAssetObserverCount: bridge?.hostedAssetObserverCount
            }
        })
        throw new Error(`${error instanceof Error ? error.message : String(error)}; bridge diagnostics=${JSON.stringify(diagnostics)}`)
    }

    if (await gridView.evaluate((element) => element.classList.contains('pcui-hidden'))) {
        // The three view controls are grouped in their own container after
        // Add/Delete/Back. Target that container instead of relying on the
        // global button order, which can change when the Editor adds controls.
        const viewButtons = assetsPanel.locator('.pcui-asset-panel-btn-container .pcui-asset-panel-btn-small')
        await expect(viewButtons, 'PlayCanvas Editor must expose user-facing asset view controls').toHaveCount(3)
        // Large Icons is the first control created by the upstream AssetPanel.
        // Clicking it is the only supported way for this flow to request the
        // grid; a persisted hidden state must not be repaired through
        // editor.call() or direct property assignment.
        await viewButtons.first().click()
    }
    await expect(gridView, 'PlayCanvas Editor assets panel must show the active grid view').not.toHaveClass(/pcui-hidden/)
}

const readResponseJson = async (response: { json: () => Promise<unknown> }): Promise<Record<string, unknown>> => {
    const body = await response.json()
    expect(body && typeof body === 'object' && !Array.isArray(body), 'Compatibility API errors must be JSON objects').toBe(true)
    return (body ?? {}) as Record<string, unknown>
}

const resolveGlobalRoleIds = (roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]): string[] => {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    return roleCodenames.map((codename) => {
        const roleId = roleMap.get(codename.toLowerCase())
        if (!roleId) {
            throw new Error(`Assignable global role ${codename} was not found`)
        }
        return roleId
    })
}

const waitForCreatedUser = async (credentials: { email: string; password: string }): Promise<void> => {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

const expectPlayCanvasAccessDenied = async (
    page: Page,
    requestPath: string,
    knownAsset: { id: string; name: string },
    label: string
): Promise<void> => {
    const response = await page.request.get(requestPath)
    expect([403, 404], `${label} must not grant PlayCanvas access`).toContain(response.status())
    expect(response.headers()['content-type'] ?? '', `${label} denial must be a JSON response`).toMatch(/json/i)
    const body = await response.text()
    expect(body, `${label} denial must not disclose the protected asset id`).not.toContain(knownAsset.id)
    expect(body, `${label} denial must not disclose the protected asset name`).not.toContain(knownAsset.name)
}

const expectPlayCanvasRequestDenied = async (
    request: Promise<APIResponse>,
    knownAsset: { id: string; name: string },
    label: string
): Promise<void> => {
    const response = await request
    expect([401, 403, 404], `${label} must not grant PlayCanvas access`).toContain(response.status())
    expect(response.headers()['content-type'] ?? '', `${label} denial must be a JSON response`).toMatch(/json/i)
    const body = await response.text()
    expect(body, `${label} denial must not disclose the protected asset id`).not.toContain(knownAsset.id)
    expect(body, `${label} denial must not disclose the protected asset name`).not.toContain(knownAsset.name)
}

type BrowserMutationMethod = 'POST' | 'PUT' | 'DELETE'

const requestWithCsrf = async (
    page: Page,
    method: BrowserMutationMethod,
    requestPath: string,
    data: Record<string, unknown>
): Promise<APIResponse> => {
    const csrfResponse = await page.request.get('/api/v1/auth/csrf')
    expect(csrfResponse.status(), 'Authenticated browser sessions must obtain a CSRF token').toBe(200)
    const csrfBody = (await csrfResponse.json()) as { csrfToken?: unknown; token?: unknown; item?: { token?: unknown } }
    const csrfToken = csrfBody.csrfToken ?? csrfBody.token ?? csrfBody.item?.token
    expect(csrfToken, 'CSRF endpoint must return a token for browser mutations').toEqual(expect.any(String))

    return page.request.fetch(requestPath, {
        method,
        data,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-Token': String(csrfToken)
        }
    })
}

const expectUnauthorizedShareDbMutation = async (page: Page, requestPath: string, label: string): Promise<void> => {
    const result = await page.evaluate(async (path) => {
        const websocketUrl = new URL(path, window.location.href)
        websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'

        return new Promise<{ code: number; reason: string }>((resolve) => {
            const socket = new WebSocket(websocketUrl.toString())
            let settled = false
            const finish = (value: { code: number; reason: string }) => {
                if (settled) return
                settled = true
                window.clearTimeout(timeout)
                resolve(value)
            }
            const timeout = window.setTimeout(() => {
                socket.close()
                finish({ code: 0, reason: 'timeout' })
            }, 15_000)

            socket.addEventListener('open', () => {
                // Send a real ShareDB submit frame before authentication. The
                // server must reject it at the wire boundary and must never
                // treat the browser session cookie as a realtime write grant.
                socket.send(
                    JSON.stringify({
                        a: 's',
                        c: 'settings',
                        d: 'project-private-unauthorized-browser-test',
                        v: 0,
                        op: [{ p: ['unauthorized'], oi: true }]
                    })
                )
            })
            socket.addEventListener('close', (event) => finish({ code: event.code, reason: event.reason }))
            socket.addEventListener('error', () => undefined)
        })
    }, requestPath)

    expect(result.code, `${label} must reject a ShareDB mutation before authentication`).toBe(4401)
    expect(result.reason, `${label} must identify the rejected realtime authentication`).toMatch(
        /invalidRealtimeAuth|invalidToken|authTimeout/
    )
}

test.describe('PlayCanvas Editor assets panel', () => {
    test('@flow @slow creates, renames, opens, and deletes an ESM script through the assets panel', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(420_000)

        const imported = await importMmoommAppSnapshotThroughUi(page)
        await recordCreatedMetahub({
            id: imported.metahubId,
            name: imported.metahubName,
            codename: 'UniversoMmoomm'
        })
        await recordCreatedPublication({
            id: imported.publicationId,
            metahubId: imported.metahubId,
            schemaName: null
        })

        await openAuthoringEditorFromResources(page, imported.metahubName)
        await openAuthoringEditor(page, imported.metahubId)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor assets panel')
        await expectPlayCanvasEditorFrameNoHorizontalOverflow(page, 'PlayCanvas Editor assets panel')

        const editorFrame = page.frameLocator(editorFrameSelector)
        const assetsPanel = editorFrame.locator('#layout-assets')
        const folderTree = assetsPanel.locator('.pcui-asset-panel-folders')
        await expect(folderTree, 'PlayCanvas Editor assets folder tree must be visible').toBeVisible()
        await expect(folderTree.locator('.pcui-treeview-item').first(), 'PlayCanvas Editor root folder must be visible').toContainText('/')
        await expectMmoommScriptAssetsVisibleInEditor(
            page,
            ['flight-control.mjs', 'follow-camera.mjs', 'remote-ships.mjs'],
            'Imported MMOOMM Editor asset registry'
        )
        await ensureAssetGridView(editorFrame)
        await expectNoTechnicalLeakage(assetsPanel, {
            label: 'PlayCanvas Editor assets panel',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(assetsPanel, [/\[object Object\]/], {
            label: 'PlayCanvas Editor assets panel'
        })
        await attachElementScreenshot(page, assetsPanel, testInfo, 'playcanvas-assets-panel-baseline.png')

        const addAssetButton = assetsPanel.locator('.pcui-asset-panel-controls .pcui-asset-panel-btn-small').first()
        await expect(addAssetButton, 'PlayCanvas Editor assets panel must expose the Add Asset control').toBeVisible()
        await expect(addAssetButton, 'PlayCanvas Editor Add Asset control must be enabled for the owner').toBeEnabled()
        await addAssetButton.click()

        const createMenu = editorFrame.locator('.pcui-menu:visible').last()
        await expect(createMenu, 'PlayCanvas Editor Add Asset menu must be visible').toBeVisible()
        for (const assetType of ['Folder', 'CSS', 'CubeMap', 'HTML', 'JSON', 'Material', 'Script', 'Shader', 'Text']) {
            await expect(
                createMenu
                    .locator('.pcui-menu-item')
                    .filter({ hasText: new RegExp(`^${assetType}$`) })
                    .last(),
                `Add Asset menu must expose ${assetType}`
            ).toBeVisible()
        }
        await expectNoTechnicalLeakage(createMenu, {
            label: 'PlayCanvas Editor Add Asset menu',
            checkUuidSubstrings: true
        })
        await expect(
            createMenu
                .locator('.pcui-menu-item')
                .filter({ hasText: /^Script$/ })
                .last(),
            'Add Asset menu must expose Script'
        ).toBeVisible()
        await attachElementScreenshot(page, createMenu, testInfo, 'playcanvas-assets-panel-create-menu.png')
        await page.keyboard.press('Escape')
        await expect(createMenu, 'PlayCanvas Editor Add Asset menu must close before the folder flow').toBeHidden()

        const createDataAssetThroughMenu = async (menuLabel: string, expectedType: string): Promise<void> => {
            const countBefore = await readEditorAssetCountByType(page, expectedType)
            const responsePromise = page.waitForResponse(
                (response) => {
                    const url = new URL(response.url())
                    return (
                        response.request().method() === 'POST' &&
                        /\/playcanvas\/editor-compatible\/projects\/[^/]+\/assets$/.test(url.pathname)
                    )
                },
                { timeout: 60_000 }
            )
            await addAssetButton.click()
            const menu = editorFrame.locator('.pcui-menu:visible').last()
            await expect(menu, `${menuLabel} creation menu must be visible`).toBeVisible()
            await menu
                .locator('.pcui-menu-item')
                .filter({ hasText: new RegExp(`^${escapeRegExp(menuLabel)}$`) })
                .last()
                .click()

            const response = await responsePromise
            expect(response.status(), `${menuLabel} creation must return an upstream-compatible response`).toBe(201)
            const payload = await readResponseJson(response)
            expect(payload.id, `${menuLabel} creation response must contain an id`).toEqual(expect.anything())

            await expect
                .poll(() => readEditorAssetCountByType(page, expectedType), {
                    timeout: 60_000,
                    message: `${menuLabel} creation must publish an asset.new update to the Editor registry`
                })
                .toBeGreaterThan(countBefore)
            const created = await readEditorAssetById(page, payload.id as string | number)
            expect(created, `${menuLabel} creation must be readable from the Editor registry`).not.toBeNull()
            expect(created?.type, `${menuLabel} creation must preserve the requested asset type`).toBe(expectedType)
            expect(created?.name, `${menuLabel} creation must provide a user-facing asset name`).toEqual(expect.any(String))
        }

        // Exercise every supported text/data menu entry through the same
        // pointer path a user takes. Folder and Script receive their richer
        // nested/cascade coverage immediately below; these seven entries are
        // intentionally created here to catch MIME/extension/type mismatches
        // at the multipart compatibility boundary.
        for (const assetType of [
            ['CSS', 'css'],
            ['CubeMap', 'cubemap'],
            ['HTML', 'html'],
            ['JSON', 'json'],
            ['Material', 'material'],
            ['Shader', 'shader'],
            ['Text', 'text']
        ] as const) {
            await createDataAssetThroughMenu(assetType[0], assetType[1])
        }
        await expectNoTechnicalLeakage(assetsPanel, {
            label: 'PlayCanvas Editor asset-type matrix',
            checkUuidSubstrings: true
        })

        const createFolderThroughMenu = async () => {
            const folderResponsePromise = page.waitForResponse(
                (response) => {
                    const url = new URL(response.url())
                    return (
                        response.request().method() === 'POST' &&
                        /\/playcanvas\/editor-compatible\/projects\/[^/]+\/assets$/.test(url.pathname)
                    )
                },
                { timeout: 60_000 }
            )
            await addAssetButton.click()
            const folderMenu = editorFrame.locator('.pcui-menu:visible').last()
            await expect(folderMenu, 'Folder creation menu must be visible').toBeVisible()
            await folderMenu
                .locator('.pcui-menu-item')
                .filter({ hasText: /^Folder$/ })
                .last()
                .click()
            const folderResponse = await folderResponsePromise
            expect(folderResponse.status(), 'Folder creation must return an upstream-compatible response').toBe(201)
            const folderPayload = await readResponseJson(folderResponse)
            expect(folderPayload.id, 'Folder creation response must contain an id').toEqual(expect.anything())
            await expect
                .poll(() => readEditorAssetById(page, folderPayload.id as string | number), {
                    timeout: 60_000,
                    message: 'Created folder must be published to the Editor asset registry'
                })
                .not.toBeNull()
            const folder = await readEditorAssetById(page, folderPayload.id as string | number)
            expect(folder, 'Created folder must be readable from the Editor asset registry').not.toBeNull()
            if (!folder) {
                throw new Error('Created folder was not available after the asset.new registry update')
            }
            expect(folder.type).toBe('folder')
            return folder
        }

        const rootFolder = await createFolderThroughMenu()
        expect(rootFolder.path).toEqual([])
        const rootFolderItem = folderTree
            .locator('.pcui-treeview-item')
            .filter({ hasText: new RegExp(`^${escapeRegExp(rootFolder.name)}$`) })
            .last()
        await expect(rootFolderItem, 'Created root folder must be visible in the folder tree').toBeVisible()
        await selectEditorFolder(rootFolderItem, page, rootFolder.id, 'Selecting the root folder')

        const nestedFolder = await createFolderThroughMenu()
        expect(nestedFolder.path.map(String)).toEqual([String(rootFolder.id)])
        const nestedFolderItem = folderTree
            .locator('.pcui-treeview-item')
            .filter({ hasText: new RegExp(`^${escapeRegExp(nestedFolder.name)}$`) })
            .last()
        await expect(nestedFolderItem, 'Created nested folder must be visible in the folder tree').toBeVisible()
        await selectEditorFolder(nestedFolderItem, page, nestedFolder.id, 'Selecting the nested folder')

        await addAssetButton.click()
        const scriptCreateMenu = editorFrame.locator('.pcui-menu:visible').last()
        await expect(scriptCreateMenu, 'Script creation menu must be visible in the nested folder').toBeVisible()

        const scriptFilename = `e2e-assets-${runManifest.runId}.mjs`
        const createResponsePromise = page.waitForResponse(
            (response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'POST' && /\/playcanvas\/editor-compatible\/projects\/[^/]+\/assets$/.test(url.pathname)
                )
            },
            { timeout: 60_000 }
        )
        await scriptCreateMenu
            .locator('.pcui-menu-item')
            .filter({ hasText: /^Script$/ })
            .last()
            .click()
        const scriptPicker = editorFrame.locator('.picker-script-create')
        await expect(scriptPicker, 'Script creation picker must be visible').toBeVisible()
        const filenameInput = scriptPicker.locator('input').first()
        await expect(filenameInput, 'Script creation picker must expose a filename input').toBeVisible()
        await filenameInput.fill(scriptFilename)
        await filenameInput.press('Enter')

        const createResponse = await createResponsePromise
        expect(createResponse.status(), 'Script creation must return the upstream-compatible asset id response').toBe(201)
        const createPayload = await readResponseJson(createResponse)
        expect(createPayload.id, 'Script creation response must contain a numeric-compatible asset id').toEqual(expect.anything())

        const createdAsset = await waitForEditorAsset(page, scriptFilename)
        expect(createdAsset.type, 'Created asset must be a script').toBe('script')
        expect(createdAsset.filename).toBe(scriptFilename)
        expect(createdAsset.path.map(String), 'Created script must retain its nested folder path').toEqual([
            String(rootFolder.id),
            String(nestedFolder.id)
        ])
        await expectMmoommScriptAssetsVisibleInEditor(page, [scriptFilename], 'Created PlayCanvas Editor script asset')
        await attachElementScreenshot(page, assetsPanel, testInfo, 'playcanvas-assets-panel-created.png')

        const createdAssetItem = assetsPanel.locator('.pcui-asset-grid-view-item').filter({ hasText: scriptFilename }).first()
        await expect(createdAssetItem, 'Created script must be visible in the user-facing asset grid').toBeVisible()

        const compatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(page, imported.metahubId)
        const authHeaders = createPlayCanvasCompatibilityAuthHeaders(page, compatibilityConfig)
        const assetsEndpoint = compatibilityConfig.endpoints?.assets
        expect(assetsEndpoint, 'Compatibility config must expose an assets endpoint').toEqual(expect.any(String))
        if (!assetsEndpoint) {
            throw new Error('Compatibility config did not provide an assets endpoint')
        }

        const compatibilityAssetsPattern = /\/playcanvas\/editor-compatible\/projects\/[^/]+\/assets(?:\/[^/?]+)?(?:\?.*)?$/
        const rewrittenFetchRequests: Array<{ method: string; body: string; contractHeader: string }> = []
        await page.route(compatibilityAssetsPattern, async (route) => {
            const request = route.request()
            const contractHeader = request.headers()['x-p8-fetch-contract'] ?? ''
            if (!['POST', 'PUT', 'DELETE'].includes(request.method()) || contractHeader !== 'preserve-request') {
                await route.continue()
                return
            }
            rewrittenFetchRequests.push({
                method: request.method(),
                body: request.postData() ?? '',
                contractHeader
            })
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
        })
        try {
            const fetchContractResult = await editorFrame.locator('body').evaluate(async () => {
                const send = async (url: string, method: string, body: string, signal?: AbortSignal) => {
                    const response = await fetch(url, {
                        method,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-P8-Fetch-Contract': 'preserve-request'
                        },
                        body,
                        signal
                    })
                    return { ok: response.ok, status: response.status }
                }

                const results = []
                results.push(await send('/api/assets', 'POST', '{"operation":"create"}'))
                results.push(await send('/api/assets/42', 'PUT', '{"operation":"update"}'))
                results.push(await send('/api/assets', 'DELETE', '{"operation":"delete"}'))

                const controller = new AbortController()
                controller.abort()
                let aborted: { ok: boolean; name?: string } = { ok: false }
                try {
                    await send('/api/assets', 'POST', '{"operation":"aborted"}', controller.signal)
                    aborted = { ok: true }
                } catch (error) {
                    aborted = { ok: false, name: error instanceof DOMException ? error.name : String(error) }
                }
                return { results, aborted }
            })
            expect(fetchContractResult.results).toEqual([
                { ok: true, status: 200 },
                { ok: true, status: 200 },
                { ok: true, status: 200 }
            ])
            expect(fetchContractResult.aborted).toEqual({ ok: false, name: 'AbortError' })
            expect(rewrittenFetchRequests).toEqual([
                { method: 'POST', body: '{"operation":"create"}', contractHeader: 'preserve-request' },
                { method: 'PUT', body: '{"operation":"update"}', contractHeader: 'preserve-request' },
                { method: 'DELETE', body: '{"operation":"delete"}', contractHeader: 'preserve-request' }
            ])
        } finally {
            await page.unroute(compatibilityAssetsPattern)
        }

        const metadataUrl = new URL(
            `${assetsEndpoint.replace(/\/$/, '')}/${encodeURIComponent(String(createdAsset.id))}`,
            page.url()
        ).toString()
        const metadataResponse = await page.request.get(metadataUrl, { headers: authHeaders })
        expect(metadataResponse.status(), 'Created script metadata must be readable through the compatibility endpoint').toBe(200)
        const metadata = await readResponseJson(metadataResponse)
        expect(metadata).toEqual(
            expect.objectContaining({
                id: createdAsset.id,
                type: 'script'
            })
        )

        const fileUrl = new URL(
            `${assetsEndpoint.replace(/\/$/, '')}/${encodeURIComponent(String(createdAsset.id))}/file/${encodeURIComponent(
                scriptFilename
            )}`,
            page.url()
        ).toString()
        const fileResponse = await page.request.get(fileUrl, { headers: authHeaders })
        expect(fileResponse.status(), 'Created script source must be readable through the compatibility file endpoint').toBe(200)
        expect(fileResponse.headers()['content-type'] ?? '').toMatch(/javascript|text\/plain/i)
        const fileBody = await fileResponse.text()
        expect(fileBody, 'Created .mjs asset must contain the PlayCanvas ESM boilerplate').toMatch(/from ['"]playcanvas['"];/)
        expect(fileBody).toContain('export class')

        await createdAssetItem.dblclick()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expectPlayCanvasEditorIframeLoaded(page, 'en', { readyTimeoutMs: 150_000 })
        await expectPlayCanvasEditorFullscreenHost(page)
        await expectNoPageHorizontalOverflow(page, 'PlayCanvas Editor assets panel after code-editor reload')
        await expectPlayCanvasEditorFrameNoHorizontalOverflow(page, 'PlayCanvas Editor assets panel after code-editor reload')
        await ensureAssetGridView(editorFrame)
        // Both folders intentionally use the Editor's default `folder` name.
        // After reload the tree is collapsed, so resolve the top-level item by
        // document order, expand it through its visible gutter, and then use
        // the nested item for the user-facing asset view.
        // `hasText` includes descendants, so a parent folder containing a
        // same-named child no longer matches an exact text locator. Use the
        // TreeView's direct-child structure to identify the two levels.
        const reloadedRootFolderItem = folderTree.locator('.pcui-treeview > .pcui-treeview-item > .pcui-treeview-item').first()
        await expect(
            reloadedRootFolderItem.locator('.pcui-treeview-item-text').first(),
            'Reloaded root folder must retain its direct label'
        ).toHaveText(rootFolder.name)
        const reloadedNestedFolderItem = reloadedRootFolderItem.locator('.pcui-treeview-item').first()
        await expandEditorFolderTreeItem(reloadedRootFolderItem, page, 'Root folder after code-editor reload')
        await expect(reloadedNestedFolderItem, 'Nested folder must be reachable after code-editor reload').toBeVisible()
        await selectEditorFolder(reloadedNestedFolderItem, page, nestedFolder.id, 'Selecting the nested folder after code-editor reload')
        await expectMmoommScriptAssetsVisibleInEditor(page, [scriptFilename], 'Created script after code-editor open and reload')

        const renamedFilename = `e2e-assets-${runManifest.runId}-renamed.mjs`
        const renamedAssetItem = assetsPanel.locator('.pcui-asset-grid-view-item').filter({ hasText: scriptFilename }).first()
        await expect(renamedAssetItem, 'Created script must remain visible after code-editor reload').toBeVisible()
        await renamedAssetItem.click()
        await page.keyboard.press('F2')
        // The vendored PCUI inspector renders the field title as a sibling
        // label (without an aria association), so use the first inspector
        // input after F2 has opened the editable asset attributes.
        const nameField = editorFrame.locator('#layout-attributes input').first()
        await expect(nameField, 'Selected asset inspector must expose the Name field').toBeVisible()
        await expect(nameField).toHaveValue(scriptFilename)

        await nameField.fill(renamedFilename)
        await nameField.press('Tab')
        await waitForEditorAsset(page, renamedFilename)
        await expect
            .poll(() => readEditorAssetByFilename(page, scriptFilename), {
                timeout: 30_000,
                message: 'Renaming a script must remove the old filename from the live Editor registry'
            })
            .toBeNull()

        await waitForEditorAsset(page, renamedFilename)
        await expectMmoommScriptAssetsVisibleInEditor(page, [renamedFilename], 'Renamed PlayCanvas Editor script asset')
        const renamedMetadataResponse = await page.request.get(metadataUrl, { headers: authHeaders })
        expect(renamedMetadataResponse.status(), 'Renamed script metadata must remain readable').toBe(200)
        const renamedMetadata = await readResponseJson(renamedMetadataResponse)
        expect(renamedMetadata).toEqual(expect.objectContaining({ id: createdAsset.id, name: renamedFilename, type: 'script' }))
        const renamedAssetItemAfterRename = assetsPanel.locator('.pcui-asset-grid-view-item').filter({ hasText: renamedFilename }).first()
        await expect(renamedAssetItemAfterRename, 'Renamed script must be visible in the user-facing asset grid').toBeVisible()

        await renamedAssetItemAfterRename.click({ button: 'right' })
        const assetContextMenu = editorFrame.locator('.pcui-menu:visible').last()
        await expect(assetContextMenu, 'Asset context menu must be visible after right-click').toBeVisible()
        const deleteMenuItem = assetContextMenu
            .locator('.pcui-menu-item')
            // PCUI renders the Delete shortcut as a sibling text node, so the
            // item's accessible text is `DeleteDelete` rather than an exact
            // `Delete` label.
            .filter({ hasText: /^Delete/ })
            .last()
        await expect(deleteMenuItem, 'Asset context menu must expose Delete').toBeVisible()
        await deleteMenuItem.click()

        const deleteDialog = editorFrame
            .locator('.pcui-overlay:visible')
            .filter({ hasText: /Permanently delete asset/i })
            .last()
        await expect(deleteDialog, 'Asset deletion must require an explicit confirmation').toBeVisible()
        await expect(deleteDialog).toContainText(renamedFilename)
        await deleteDialog
            .locator('.pcui-button')
            .filter({ hasText: /^Delete$/ })
            .last()
            .click()

        await expect
            .poll(() => readEditorAssetByFilename(page, renamedFilename), {
                timeout: 60_000,
                message: 'Deleted script must disappear from the live Editor registry'
            })
            .toBeNull()
        await expect(assetsPanel.locator('.pcui-asset-grid-view-item').filter({ hasText: renamedFilename })).toHaveCount(0)
        const deletedMetadataResponse = await page.request.get(metadataUrl, { headers: authHeaders })
        expect(deletedMetadataResponse.status(), 'Deleted script metadata must fail closed with a non-success response').toBe(404)
        expect(await deletedMetadataResponse.text()).not.toMatch(/<!doctype html/i)

        // The full Editor asset panel sends folder deletes through its
        // authenticated realtime `fs` frame (the compatibility DELETE route is
        // reserved for REST callers). The user-facing contract is therefore
        // the durable list/registry transition, not an HTTP response that the
        // vendored panel never issues.
        await expect(
            editorFrame.locator('.connection-overlay'),
            'Deleting an asset must keep the authenticated Editor connection usable'
        ).toBeHidden()
        // Right-click the root row itself, not the container whose bounding
        // box also includes the expanded nested row.  Clicking the container
        // can dispatch the context menu against the nested child and leave
        // the parent behind even though the visible label appears correct.
        await reloadedRootFolderItem.locator(':scope > .pcui-treeview-item-contents').click({ button: 'right' })
        const folderContextMenu = editorFrame.locator('.pcui-menu:visible').last()
        await expect(folderContextMenu, 'Folder context menu must be visible after right-click').toBeVisible()
        const deleteFolderMenuItem = folderContextMenu
            .locator('.pcui-menu-item')
            .filter({ hasText: /^Delete/ })
            .last()
        await expect(deleteFolderMenuItem, 'Folder context menu must expose Delete').toBeVisible()
        await deleteFolderMenuItem.click()

        const deleteFolderDialog = editorFrame
            .locator('.pcui-overlay:visible')
            .filter({ hasText: /Permanently delete folder/i })
            .last()
        await expect(deleteFolderDialog, 'Folder deletion must require an explicit confirmation').toBeVisible()
        await expect(deleteFolderDialog).toContainText(rootFolder.name)
        await deleteFolderDialog
            .locator('.pcui-button')
            .filter({ hasText: /^Delete$/ })
            .last()
            .click()

        await expect
            .poll(() => readEditorAssetById(page, rootFolder.id), {
                timeout: 60_000,
                message: 'Deleted parent folder must disappear from the Editor asset registry'
            })
            .toBeNull()
        await expect
            .poll(() => readEditorAssetById(page, nestedFolder.id), {
                timeout: 60_000,
                message: 'Deleting a parent folder must cascade to its nested folder'
            })
            .toBeNull()
        await expect
            .poll(
                async () => {
                    const response = await page.request.get(assetsEndpoint, { headers: authHeaders })
                    if (response.status() !== 200) return false
                    const payload = await readResponseJson(response)
                    const items = Array.isArray(payload.items) ? payload.items : []
                    return !items.some((item) => {
                        const candidate = item && typeof item === 'object' ? (item as { editorDocumentId?: unknown }) : null
                        return [rootFolder.id, nestedFolder.id].some((id) => String(candidate?.editorDocumentId ?? '') === String(id))
                    })
                },
                {
                    timeout: 60_000,
                    message: 'Deleting a parent folder must remove its descendants from durable compatibility storage'
                }
            )
            .toBe(true)
        await expect(
            editorFrame.locator('.connection-overlay'),
            'Deleting a folder must not replace the working Editor with a connection error overlay'
        ).toBeHidden()
    })

    test('@flow @permission @security PlayCanvas asset authorization isolates owner, admin, editor, member, and non-member access', async ({
        browser,
        page,
        runManifest
    }) => {
        test.setTimeout(360_000)

        const bootstrapApi = await createBootstrapApiContext()
        const ownerApi = await createLoggedInApiContext(runManifest.testUser)
        const sessions: Array<Awaited<ReturnType<typeof createLoggedInBrowserContext>>> = []

        try {
            const imported = await importMmoommAppSnapshotThroughUi(page)
            await recordCreatedMetahub({
                id: imported.metahubId,
                name: imported.metahubName,
                codename: 'UniversoMmoomm'
            })
            await recordCreatedPublication({
                id: imported.publicationId,
                metahubId: imported.metahubId,
                schemaName: null
            })

            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)
            const password = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const emailDomain = process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            const personaDefinitions = [
                { key: 'admin', role: 'admin' },
                { key: 'editor', role: 'editor' },
                { key: 'member', role: 'member' },
                { key: 'nonmember', role: null }
            ] as const
            const personas = new Map<
                (typeof personaDefinitions)[number]['key'],
                { email: string; password: string; role: (typeof personaDefinitions)[number]['role'] }
            >()

            for (const definition of personaDefinitions) {
                const email = `e2e+${runManifest.runId}.playcanvas-${definition.key}@${emailDomain}`
                const created = await createAdminUser(bootstrapApi, {
                    email,
                    password,
                    roleIds: defaultRoleIds,
                    comment: `PlayCanvas authorization ${definition.key}`
                })
                if (!created?.userId) {
                    throw new Error(`PlayCanvas authorization user ${email} was not created`)
                }
                await recordCreatedGlobalUser({ userId: created.userId, email })
                await waitForCreatedUser({ email, password })
                personas.set(definition.key, { email, password, role: definition.role })
            }

            for (const definition of personaDefinitions) {
                if (!definition.role) continue
                const persona = personas.get(definition.key)
                if (!persona) throw new Error(`PlayCanvas authorization persona ${definition.key} is missing`)
                await addMetahubMember(ownerApi, imported.metahubId, {
                    email: persona.email,
                    role: definition.role
                })
            }

            const projectsPath = `/api/v1/metahub/${encodeURIComponent(imported.metahubId)}/playcanvas/projects`
            const projectsResponse = await page.request.get(projectsPath)
            expect(projectsResponse.status(), 'Owner must list imported PlayCanvas projects').toBe(200)
            const projectsPayload = (await projectsResponse.json()) as {
                items?: Array<{ id?: unknown; displayName?: unknown }>
            }
            const projects = projectsPayload.items ?? []
            const authoringProject = projects.find((project) =>
                JSON.stringify(project.displayName ?? {})
                    .toLowerCase()
                    .includes('mmoomm authoring')
            )
            const visualProject = projects.find((project) =>
                JSON.stringify(project.displayName ?? {})
                    .toLowerCase()
                    .includes('visual linkup lab')
            )
            expect(authoringProject?.id, 'Imported authoring project id must be available to the owner').toEqual(expect.any(String))
            expect(visualProject?.id, 'Imported visual project id must be available to the owner').toEqual(expect.any(String))
            const authoringProjectId = String(authoringProject?.id)
            const visualProjectId = String(visualProject?.id)

            const authoringAssetsPath = `${projectsPath}/${encodeURIComponent(authoringProjectId)}/assets`
            const authoringAssetsResponse = await page.request.get(authoringAssetsPath)
            expect(authoringAssetsResponse.status(), 'Owner must list assets in the authoring project').toBe(200)
            const authoringAssetsPayload = (await authoringAssetsResponse.json()) as {
                items?: Array<{ id?: unknown; name?: unknown; type?: unknown }>
            }
            const authoringAssets = authoringAssetsPayload.items ?? []
            const protectedAsset = authoringAssets.find((asset) => asset.name === 'flight-control.mjs') ?? authoringAssets[0]
            expect(protectedAsset?.id, 'Owner asset listing must contain a stable asset id').toEqual(expect.any(String))
            expect(protectedAsset?.name, 'Owner asset listing must contain a protected asset name').toEqual(expect.any(String))
            const knownAsset = {
                id: String(protectedAsset?.id),
                name: String(protectedAsset?.name)
            }
            expect(authoringAssets.some((asset) => asset.id === knownAsset.id)).toBe(true)
            const authoringAssetIdsBeforeDeniedWrites = authoringAssets.map((asset) => String(asset.id)).sort()

            const compatibilityProjectPath = `${projectsPath.replace('/projects', '/editor-compatible/projects')}/${encodeURIComponent(
                authoringProjectId
            )}`
            const authoringConfigPath = `${compatibilityProjectPath}/config`
            const compatibilityAssetsPath = `${compatibilityProjectPath}/assets`
            const compatibilityAssetPath = `${compatibilityAssetsPath}/${encodeURIComponent(knownAsset.id)}`
            const compatibilityAssetFilePath = `${compatibilityAssetPath}/file/${encodeURIComponent(knownAsset.name)}`
            const realtimePath = `${compatibilityProjectPath}/realtime`
            const directAssetFilePath = `${authoringAssetsPath}/${encodeURIComponent(knownAsset.id)}/file?sourcePath=${encodeURIComponent(
                'playcanvas-projects/unauthorized-browser-test.mjs'
            )}`
            const ownerAuthoringConfigResponse = await page.request.get(authoringConfigPath)
            expect(ownerAuthoringConfigResponse.status(), 'Owner must access the PlayCanvas authoring config').toBe(200)
            expect(await ownerAuthoringConfigResponse.json()).toEqual(expect.any(Object))

            const adminPersona = personas.get('admin')
            if (!adminPersona) throw new Error('PlayCanvas admin persona is missing')
            const adminSession = await createLoggedInBrowserContext(browser, adminPersona)
            sessions.push(adminSession)
            const adminAssetsResponse = await adminSession.page.request.get(authoringAssetsPath)
            expect(adminAssetsResponse.status(), 'Metahub admin must list authoring assets').toBe(200)
            const adminAssetsPayload = (await adminAssetsResponse.json()) as {
                items?: Array<{ id?: unknown }>
            }
            expect(adminAssetsPayload.items?.some((asset) => String(asset.id) === knownAsset.id)).toBe(true)
            const adminAuthoringConfigResponse = await adminSession.page.request.get(authoringConfigPath)
            expect(adminAuthoringConfigResponse.status(), 'Metahub admin must access the authoring config').toBe(200)

            for (const key of ['editor', 'member', 'nonmember'] as const) {
                const persona = personas.get(key)
                if (!persona) throw new Error(`PlayCanvas ${key} persona is missing`)
                const session = await createLoggedInBrowserContext(browser, persona)
                sessions.push(session)
                await expectPlayCanvasAccessDenied(session.page, authoringAssetsPath, knownAsset, `${key} asset listing`)
                await expectPlayCanvasAccessDenied(session.page, authoringConfigPath, knownAsset, `${key} authoring config`)
                await expectPlayCanvasRequestDenied(
                    session.page.request.get(`${authoringAssetsPath}/${encodeURIComponent(knownAsset.id)}`),
                    knownAsset,
                    `${key} asset metadata read`
                )
                await expectPlayCanvasRequestDenied(
                    session.page.request.get(directAssetFilePath),
                    knownAsset,
                    `${key} direct asset file read`
                )
                await expectPlayCanvasRequestDenied(
                    session.page.request.get(compatibilityAssetPath),
                    knownAsset,
                    `${key} compatibility asset metadata read`
                )
                await expectPlayCanvasRequestDenied(
                    session.page.request.get(compatibilityAssetFilePath),
                    knownAsset,
                    `${key} compatibility asset file read`
                )
                await expectPlayCanvasRequestDenied(
                    requestWithCsrf(session.page, 'POST', compatibilityAssetsPath, {
                        name: `unauthorized-${key}.mjs`,
                        type: 'script'
                    }),
                    knownAsset,
                    `${key} compatibility asset create`
                )
                await expectPlayCanvasRequestDenied(
                    requestWithCsrf(session.page, 'PUT', compatibilityAssetPath, {
                        name: `unauthorized-${key}.mjs`
                    }),
                    knownAsset,
                    `${key} compatibility asset rename`
                )
                await expectPlayCanvasRequestDenied(
                    requestWithCsrf(session.page, 'DELETE', compatibilityAssetsPath, {
                        assets: [knownAsset.id]
                    }),
                    knownAsset,
                    `${key} compatibility asset delete`
                )
                await expectPlayCanvasRequestDenied(
                    requestWithCsrf(session.page, 'PUT', directAssetFilePath, {
                        sourcePath: 'playcanvas-projects/unauthorized-browser-test.mjs',
                        contentBase64: 'dW5hdXRob3JpemVk',
                        expectedCurrentChecksum: '0'.repeat(64),
                        mime: 'text/javascript'
                    }),
                    knownAsset,
                    `${key} direct asset file write`
                )
                await expectUnauthorizedShareDbMutation(session.page, realtimePath, `${key} realtime mutation`)
            }

            const assetsAfterDeniedWritesResponse = await page.request.get(authoringAssetsPath)
            expect(assetsAfterDeniedWritesResponse.status(), 'Denied asset mutations must not break owner asset listing').toBe(200)
            const assetsAfterDeniedWritesPayload = (await assetsAfterDeniedWritesResponse.json()) as {
                items?: Array<{ id?: unknown; name?: unknown }>
            }
            const assetsAfterDeniedWrites = assetsAfterDeniedWritesPayload.items ?? []
            expect(assetsAfterDeniedWrites.map((asset) => String(asset.id)).sort()).toEqual(authoringAssetIdsBeforeDeniedWrites)
            expect(assetsAfterDeniedWrites.find((asset) => String(asset.id) === knownAsset.id)?.name).toBe(knownAsset.name)

            const crossProjectAssetPath = `${projectsPath}/${encodeURIComponent(visualProjectId)}/assets/${encodeURIComponent(
                knownAsset.id
            )}`
            const crossProjectResponse = await page.request.get(crossProjectAssetPath)
            expect(crossProjectResponse.status(), 'Cross-project asset lookup must fail closed').toBe(404)
            expect(crossProjectResponse.headers()['content-type'] ?? '').toMatch(/json/i)
            const crossProjectBody = await crossProjectResponse.text()
            expect(crossProjectBody).not.toContain(knownAsset.id)
            expect(crossProjectBody).not.toContain(knownAsset.name)
        } finally {
            for (const session of sessions.reverse()) {
                await session.context.close().catch(() => undefined)
            }
            await disposeApiContext(ownerApi)
            await disposeBootstrapApiContext(bootstrapApi)
        }
    })
})
