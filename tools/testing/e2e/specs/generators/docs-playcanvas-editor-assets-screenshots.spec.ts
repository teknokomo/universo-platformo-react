/**
 * Generates the localized PlayCanvas Editor asset and merged Modules-tab
 * screenshots referenced by the GitBook asset guide.
 *
 * The captures are produced from the real hosted Editor and Resources page,
 * not from mocked DOM fixtures. Run through the generators Playwright project
 * against the minimal local Supabase stack.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectNoVisibleTextPatterns } from '../../support/browser/runtimeUx'
import { expectMmoommScriptAssetsVisibleInEditor } from '../../support/mmoommScriptAssetsProof'
import { expectPlayCanvasEditorFullscreenHost, expectPlayCanvasEditorIframeLoaded } from '../../support/playcanvasEditorAuthoring'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'

type Locale = 'en' | 'ru'

const DOCS_VIEWPORT = { width: 1920, height: 1080 } as const
const EDITOR_FRAME_SELECTOR = 'iframe[data-testid="playcanvas-editor-frame"]'
const CAPTURE_ROOTS: Record<Locale, string> = {
    en: 'docs/en/.gitbook/assets/platform',
    ru: 'docs/ru/.gitbook/assets/platform'
}

const localizedCopy: Record<Locale, { resources: string; modules: string; metahubModules: string; sharedModules: string }> = {
    en: {
        resources: 'Resources',
        modules: 'Modules',
        metahubModules: 'Metahub modules',
        sharedModules: 'Shared modules'
    },
    ru: {
        resources: 'Ресурсы',
        modules: 'Модули',
        metahubModules: 'Модули метахаба',
        sharedModules: 'Общие модули'
    }
}

const ensureCaptureDirectories = async (): Promise<void> => {
    await Promise.all(Object.values(CAPTURE_ROOTS).map((relativePath) => fs.mkdir(path.join(repoRoot, relativePath), { recursive: true })))
}

const assertNonBlankPng = (screenshot: Buffer, label: string, minimumWidth = 200): void => {
    const png = PNG.sync.read(screenshot)
    expect(png.width, `${label} screenshot must have a usable width`).toBeGreaterThan(minimumWidth)
    expect(png.height, `${label} screenshot must have a positive height`).toBeGreaterThan(120)

    const sampledColors = new Set<string>()
    const stepX = Math.max(1, Math.floor(png.width / 24))
    const stepY = Math.max(1, Math.floor(png.height / 24))
    for (let y = 0; y < png.height; y += stepY) {
        for (let x = 0; x < png.width; x += stepX) {
            const offset = (y * png.width + x) * 4
            if ((png.data[offset + 3] ?? 0) === 0) continue
            sampledColors.add(`${png.data[offset] ?? 0}:${png.data[offset + 1] ?? 0}:${png.data[offset + 2] ?? 0}`)
        }
    }
    expect(sampledColors.size, `${label} screenshot must contain visible UI content`).toBeGreaterThan(2)
}

const captureElement = async (page: Page, element: Locator, locale: Locale, filename: string, minimumWidth = 200): Promise<void> => {
    const box = await element.boundingBox()
    expect(box, `${filename} target must have a visible bounding box`).not.toBeNull()
    if (!box) return

    const outputPath = path.join(repoRoot, CAPTURE_ROOTS[locale], filename)
    const screenshot = await page.screenshot({
        path: outputPath,
        clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.max(1, box.width),
            height: Math.max(1, box.height)
        }
    })
    assertNonBlankPng(screenshot, filename, minimumWidth)
    const stat = await fs.stat(outputPath)
    expect(stat.size, `${filename} must contain a non-empty PNG`).toBeGreaterThan(128)
}

const captureResourcesModules = async (page: Page, locale: Locale, metahubId: string): Promise<void> => {
    const copy = localizedCopy[locale]
    await page.goto(`/metahub/${encodeURIComponent(metahubId)}/resources`)
    await expect(page.getByRole('heading', { name: copy.resources })).toBeVisible({ timeout: 30_000 })

    const resourcesTabs = page.getByTestId('metahub-shared-resources-tabs')
    const modulesTab = resourcesTabs.getByRole('tab', { name: copy.modules, exact: true })
    await expect(modulesTab).toBeVisible({ timeout: 30_000 })
    await modulesTab.click()

    const modulesSurface = page.getByTestId('metahub-shared-resources-content')
    await expect(modulesSurface.getByRole('tab', { name: copy.metahubModules, exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(modulesSurface.getByRole('tab', { name: copy.sharedModules, exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(modulesSurface.getByRole('tab', { name: copy.metahubModules, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(modulesSurface).not.toContainText(/loading|загрузка|no modules|нет модулей/i)
    await expectNoPageHorizontalOverflow(page, `${locale} Resources Modules documentation surface`)
    await expectNoTechnicalLeakage(modulesSurface, {
        label: `${locale} Resources Modules documentation surface`,
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(modulesSurface, [/\[object Object\]/], {
        label: `${locale} Resources Modules documentation surface`
    })
    await page.evaluate(() => document.fonts.ready)
    await captureElement(page, modulesSurface, locale, 'playcanvas-modules-scope-switcher.png')
}

const resolveAuthoringProjectId = async (page: Page, metahubId: string): Promise<string> => {
    const response = await page.request.get(`/api/v1/metahub/${encodeURIComponent(metahubId)}/playcanvas/projects`)
    expect(response.status()).toBe(200)
    const payload = (await response.json()) as { items?: Array<{ id?: unknown; displayName?: unknown }> }
    const project = payload.items?.find((item) =>
        JSON.stringify(item.displayName ?? {})
            .toLowerCase()
            .includes('mmoomm authoring')
    )
    expect(project?.id).toEqual(expect.any(String))
    return String(project?.id)
}

const captureEditorAssets = async (page: Page, locale: Locale, metahubId: string): Promise<void> => {
    const projectId = await resolveAuthoringProjectId(page, metahubId)
    await page.goto(
        `/metahub/${encodeURIComponent(metahubId)}/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${encodeURIComponent(
            projectId
        )}`
    )
    await expectPlayCanvasEditorIframeLoaded(page, locale, { readyTimeoutMs: 150_000 })
    await expectPlayCanvasEditorFullscreenHost(page)

    const editorFrame = page.frameLocator(EDITOR_FRAME_SELECTOR)
    const assetsPanel = editorFrame.locator('#layout-assets')
    await expect(assetsPanel).toBeVisible()
    // Do not capture an empty/loading panel as documentation evidence. The
    // imported fixture contains real MMOOMM ESM assets; wait for the Editor
    // registry and user-facing grid to expose their parsed script metadata.
    await expectMmoommScriptAssetsVisibleInEditor(
        page,
        ['flight-control.mjs', 'follow-camera.mjs', 'remote-ships.mjs'],
        `${locale} PlayCanvas Editor documentation assets`
    )
    await expectNoPageHorizontalOverflow(page, `${locale} PlayCanvas Editor documentation surface`)
    await expectNoTechnicalLeakage(assetsPanel, {
        label: `${locale} PlayCanvas Editor assets documentation surface`,
        checkUuidSubstrings: true
    })
    await expectNoVisibleTextPatterns(assetsPanel, [/\[object Object\]/], {
        label: `${locale} PlayCanvas Editor assets documentation surface`
    })
    await expect(assetsPanel.locator('.pcui-asset-panel-folders .pcui-treeview-item').first()).toContainText('/')
    await captureElement(page, assetsPanel, locale, 'playcanvas-assets-panel.png')

    const addAssetButton = assetsPanel.locator('.pcui-asset-panel-controls .pcui-asset-panel-btn-small').first()
    await expect(addAssetButton).toBeEnabled()
    await addAssetButton.click()
    const createMenu = editorFrame.locator('.pcui-menu:visible').last()
    await expect(createMenu).toBeVisible()
    await expect(
        createMenu
            .locator('.pcui-menu-item')
            .filter({ hasText: /^Script$/ })
            .last()
    ).toBeVisible()
    await expectNoTechnicalLeakage(createMenu, {
        label: `${locale} PlayCanvas Editor create-script menu`,
        checkUuidSubstrings: true
    })
    const menuItems = createMenu.locator('.pcui-menu-items').first()
    await expect(menuItems, `${locale} PlayCanvas Editor create-script menu content must be visible`).toBeVisible()
    // The upstream menu is intentionally compact (about 158px wide), while
    // still exposing every asset type and remaining fully readable.
    await captureElement(page, menuItems, locale, 'playcanvas-assets-create-script-menu.png', 120)
    await page.keyboard.press('Escape')
}

test('@generator capture PlayCanvas Editor asset and Modules screenshots for EN and RU', async ({ page }) => {
    test.setTimeout(600_000)
    await ensureCaptureDirectories()
    await page.setViewportSize(DOCS_VIEWPORT)

    const imported = await importMmoommAppSnapshotThroughUi(page)
    await recordCreatedMetahub({ id: imported.metahubId, name: imported.metahubName, codename: 'UniversoMmoomm' })
    await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId, schemaName: null })

    for (const locale of ['en', 'ru'] as const) {
        await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
        await captureEditorAssets(page, locale, imported.metahubId)
        await captureResourcesModules(page, locale, imported.metahubId)
    }

    // Keep the generated evidence tied to this run without exposing user ids
    // or transient backend paths in the documentation assets.
    await page.goto('about:blank')
})
