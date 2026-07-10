// Interpretation Network — flow coverage for the imported snapshot runtime.
//
// Verifies:
//   1. The published app opens the Interpretation Network start Page and menu.
//   2. The Structures workspace starts empty after schema sync.
//   3. Browser runtime surfaces do not leak raw UUIDs/JSON and do not
//      throw console/page/API 500 regressions.

import { expect, test } from '../../fixtures/test'
import type { Locator, Page, Response, TestInfo } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext, updateMetahub } from '../../support/backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectDataGridHorizontalScrollConstrained,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import {
    expectNoInterpretationNetworkBrowserRegressionIssues,
    expectInterpretationNetworkRuntimeDataReady,
    watchInterpretationNetworkBrowserRegressionIssues
} from '../../support/interpretationNetworkRuntime'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const createdStructureName = 'E2E created structure'
const createdStructureDescription = 'Created through the Interpretation Network structure browser flow.'
const createdMaterialTitle = 'E2E source note'
const createdMaterialDescription = 'Created through the Interpretation Network material browser flow.'
const updatedMaterialTitle = 'E2E edited source note'
const updatedMaterialDescription = 'Updated Interpretation Network material description.'
const materialBodyText = 'Browser-authored material body'

const codenameVlc = (content: string) => {
    const timestamp = new Date(0).toISOString()
    return {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }
    }
}

const getRuntimeRowsUrl = (response: Response): URL => new URL(response.url())

const matchesRuntimeRowsCreate = (response: Response, applicationId: string, workspaceId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return url.pathname === `/api/v1/applications/${applicationId}/runtime/rows` && url.searchParams.get('workspaceId') === workspaceId
}

const matchesApplicationLayoutWidgetConfigUpdate = (response: Response, applicationId: string): boolean => {
    if (response.request().method() !== 'PATCH') return false
    const url = getRuntimeRowsUrl(response)
    if (url.pathname === `/api/v1/applications/${applicationId}/layouts/zone-widgets/config/batch`) {
        return true
    }
    return (
        url.pathname.startsWith(`/api/v1/applications/${applicationId}/layouts/`) &&
        url.pathname.includes('/zone-widget/') &&
        url.pathname.endsWith('/config')
    )
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getMaterialOpenButton = (surface: Locator, title: string): Locator =>
    surface.getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}(?:\\s|$)`) }).first()

const getMatrixTable = (page: Page): Locator => page.getByTestId('interpretation-network-matrix-table')

const expectMatrixTableHorizontalScrollConstrained = async (page: Page, label: string): Promise<void> => {
    const metrics = await getMatrixTable(page).evaluate((node) => {
        const root = node as HTMLElement
        const rootRect = root.getBoundingClientRect()
        const viewportWidth = document.documentElement.clientWidth
        const pageOverflowPx = Math.max(0, document.documentElement.scrollWidth - viewportWidth)
        const table = root.querySelector('table') as HTMLElement | null

        return {
            visible: rootRect.width > 0 && rootRect.height > 0,
            pageOverflowPx,
            rootLeft: rootRect.left,
            rootRight: rootRect.right,
            viewportWidth,
            internalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
            tableClientWidth: root.clientWidth,
            tableScrollWidth: root.scrollWidth,
            semanticTableVisible: Boolean(table && table.getBoundingClientRect().width > 0 && table.getBoundingClientRect().height > 0)
        }
    })

    expect(metrics.visible, `${label} matrix table scroll region must be visible`).toBe(true)
    expect(metrics.semanticTableVisible, `${label} must contain a visible semantic table`).toBe(true)
    expect(metrics.rootLeft, `${label} matrix table must start inside the viewport`).toBeGreaterThanOrEqual(-1)
    expect(metrics.rootRight, `${label} matrix table must fit inside the viewport`).toBeLessThanOrEqual(metrics.viewportWidth + 1)

    if (metrics.internalOverflowPx > 1) {
        expect(
            metrics.pageOverflowPx,
            `${label} may scroll internally (${metrics.tableClientWidth}/${metrics.tableScrollWidth}) but must not widen the page`
        ).toBeLessThanOrEqual(1)
    }
}

const hasLocalizedPayloadValue = (payload: unknown, expectedText: string, locale = 'en'): boolean => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
    return Object.values(payload as Record<string, unknown>).some((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false
        const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
        return locales?.[locale]?.content === expectedText
    })
}

const expectInterpretationNetworkStartPage = async (page: Page): Promise<void> => {
    const menu = getVisibleRuntimeNavigation(page)
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Start' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Structures' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Workspaces' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText(/interpretation network/i)
    await expect(page.getByRole('main')).toContainText(/structures/i)
    await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
}

const expectEmptyStructuresWorkspace = async (page: Page): Promise<void> => {
    const main = page.getByRole('main')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('heading', { name: 'Structures' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('textbox', { name: 'Filter by title' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Table view' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Card view' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Create' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane')).not.toContainText(
        'Create a structure to start working with the matrix.'
    )
    await expect(page.getByTestId('interpretation-network-details-pane')).toContainText('How to work with structures')
    await expect(page.getByTestId('interpretation-network-details-pane')).toContainText(
        'Create or select a structure on the left. After you open a structure, select a matrix cell to manage its materials here.'
    )
    await expect(page.getByTestId('interpretation-network-details-pane')).not.toContainText('Materials')
    await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Create' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Add page' })).toHaveCount(0)
    await expect(main.getByText('Gravity', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Gravity material', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Attraction between masses', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Basic interpretation matrix', { exact: false })).toHaveCount(0)
}

const expectEqualDesktopPaneWidths = async (page: Page, label: string): Promise<void> => {
    const widths = await page.evaluate(() => {
        const structurePane = document.querySelector('[data-testid="interpretation-network-structure-pane"]')
        const detailsPane = document.querySelector('[data-testid="interpretation-network-details-pane"]')
        const structureRect = structurePane?.getBoundingClientRect()
        const detailsRect = detailsPane?.getBoundingClientRect()
        return {
            structure: structureRect?.width ?? 0,
            details: detailsRect?.width ?? 0
        }
    })

    expect(widths.structure, `${label} structure pane width`).toBeGreaterThan(320)
    expect(widths.details, `${label} details pane width`).toBeGreaterThan(320)
    expect(Math.abs(widths.structure - widths.details), `${label} panes must have equal width`).toBeLessThanOrEqual(2)
}

const getVisibleWorkspaceSwitcher = (page: Page): Locator =>
    page.getByTestId('runtime-workspace-switcher').filter({ visible: true }).first()

const getDockedRuntimeNavigation = (page: Page): Locator =>
    page.getByTestId('runtime-side-menu-docked').locator('nav[aria-label="Interpretation Network"]')

const getOverlayRuntimeNavigation = (page: Page): Locator =>
    page.getByTestId('runtime-side-menu-overlay').locator('nav[aria-label="Interpretation Network"]')

const getVisibleRuntimeNavigation = (page: Page): Locator =>
    page.getByRole('navigation', { name: 'Interpretation Network' }).filter({ visible: true }).first()

const getRuntimeNavigationItem = (navigation: Locator, name: string): Locator =>
    navigation.getByRole('link', { name }).or(navigation.getByRole('button', { name })).first()

const readNavigationDrawerWidth = async (navigation: Locator): Promise<number> =>
    navigation.evaluate((node) => {
        const drawerPaper = node.closest('.MuiDrawer-paper')
        const rect = (drawerPaper ?? node).getBoundingClientRect()
        return Math.round(rect.width)
    })

const parseCssRgba = (value: string): { red: number; green: number; blue: number; alpha: number } | null => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i)
    if (!match) return null
    return {
        red: Number(match[1]),
        green: Number(match[2]),
        blue: Number(match[3]),
        alpha: match[4] === undefined ? 1 : Number(match[4])
    }
}

const expectSameSelectedToggleTheme = (
    first: { color: string; backgroundColor: string },
    second: { color: string; backgroundColor: string },
    label: string
): void => {
    const firstColor = parseCssRgba(first.color)
    const secondColor = parseCssRgba(second.color)
    const firstBackground = parseCssRgba(first.backgroundColor)
    const secondBackground = parseCssRgba(second.backgroundColor)
    expect(firstColor, `${label} first text color`).not.toBeNull()
    expect(secondColor, `${label} second text color`).not.toBeNull()
    expect(firstColor?.red, `${label} text red`).toBe(secondColor?.red)
    expect(firstColor?.green, `${label} text green`).toBe(secondColor?.green)
    expect(firstColor?.blue, `${label} text blue`).toBe(secondColor?.blue)
    expect(Math.abs((firstColor?.alpha ?? 0) - (secondColor?.alpha ?? 0)), `${label} text alpha`).toBeLessThanOrEqual(0.02)
    expect(firstBackground, `${label} first background`).not.toBeNull()
    expect(secondBackground, `${label} second background`).not.toBeNull()
    expect(firstBackground?.red, `${label} background red`).toBe(secondBackground?.red)
    expect(firstBackground?.green, `${label} background green`).toBe(secondBackground?.green)
    expect(firstBackground?.blue, `${label} background blue`).toBe(secondBackground?.blue)
    expect(Math.abs((firstBackground?.alpha ?? 0) - (secondBackground?.alpha ?? 0)), `${label} background alpha`).toBeLessThanOrEqual(0.04)
}

const getColorModeButton = (page: Page): Locator => page.locator('button[data-testid="runtime-color-mode-button"]')

const expectColorModeButtonVisible = async (page: Page, label: string): Promise<void> => {
    await expect(getColorModeButton(page), `${label} visible color-mode button`).toBeVisible({ timeout: 30_000 })
}

const expectToolbarAlignedWithContent = async (page: Page, label: string): Promise<void> => {
    await expectColorModeButtonVisible(page, label)
    const alignment = await page.evaluate(() => {
        const colorModeButton = document.querySelector('button[data-testid="runtime-color-mode-button"]')
        const content =
            document.querySelector('[data-testid="interpretation-network-details-pane"]') ??
            document.querySelector('[data-testid="runtime-main-grid"]')
        if (!colorModeButton || !content) {
            return null
        }

        const colorModeButtonRect = colorModeButton.getBoundingClientRect()
        const contentRect = content.getBoundingClientRect()

        return {
            colorModeButtonRight: Math.round(colorModeButtonRect.right),
            contentRight: Math.round(contentRect.right),
            delta: Math.round(Math.abs(colorModeButtonRect.right - contentRect.right))
        }
    })

    expect(alignment, `${label} toolbar/content alignment`).not.toBeNull()
    expect(alignment?.delta, `${label} visible color-mode button edge must match content edge`).toBeLessThanOrEqual(2)
}

const expectStructuresVisualRails = async (page: Page, label: string, expected: { left: number; rightInset: number }): Promise<void> => {
    await expectColorModeButtonVisible(page, label)
    const geometry = await page.evaluate(() => {
        const structurePane = document.querySelector('[data-testid="interpretation-network-structure-pane"]')
        const detailsPane = document.querySelector('[data-testid="interpretation-network-details-pane"]')
        const colorModeButton = document.querySelector('button[data-testid="runtime-color-mode-button"]')
        if (!structurePane || !detailsPane || !colorModeButton) {
            return null
        }

        const structureRect = structurePane.getBoundingClientRect()
        const detailsRect = detailsPane.getBoundingClientRect()
        const colorModeButtonRect = colorModeButton.getBoundingClientRect()
        return {
            structureLeft: Math.round(structureRect.left),
            detailsRight: Math.round(detailsRect.right),
            colorModeButtonRight: Math.round(colorModeButtonRect.right),
            viewportWidth: window.innerWidth
        }
    })

    expect(geometry, `${label} structures visual rail geometry`).not.toBeNull()
    expect(Math.abs((geometry?.structureLeft ?? 0) - expected.left), `${label} content left rail`).toBeLessThanOrEqual(4)
    expect(
        Math.abs((geometry?.viewportWidth ?? 0) - expected.rightInset - (geometry?.detailsRight ?? 0)),
        `${label} content right rail`
    ).toBeLessThanOrEqual(4)
    expect(
        Math.abs((geometry?.colorModeButtonRight ?? 0) - (geometry?.detailsRight ?? 0)),
        `${label} visible color-mode button right rail`
    ).toBeLessThanOrEqual(2)
}

const expectOverlayContentUsesFullRail = async (page: Page, label: string): Promise<void> => {
    const geometry = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="runtime-main-grid"]')
        const edgeControl = document.querySelector('[data-testid="runtime-overlay-menu-edge-control"]')
        const edgeButton = edgeControl?.querySelector('button')
        if (!grid || !edgeControl) {
            return null
        }

        const gridRect = grid.getBoundingClientRect()
        const edgeRect = edgeControl.getBoundingClientRect()
        const edgeButtonRect = edgeButton?.getBoundingClientRect()
        return {
            gridLeft: Math.round(gridRect.left),
            gridRight: Math.round(gridRect.right),
            viewportWidth: window.innerWidth,
            edgeLeft: Math.round(edgeRect.left),
            edgeButtonLeft: Math.round(edgeButtonRect?.left ?? edgeRect.left)
        }
    })

    expect(geometry, `${label} overlay geometry`).not.toBeNull()
    expect(geometry?.edgeLeft, `${label} overlay opener must stay on the drawer side`).toBeLessThanOrEqual(32)
    expect(geometry?.edgeButtonLeft, `${label} overlay opener button visual inset`).toBeGreaterThanOrEqual(16)
    expect(geometry?.edgeButtonLeft, `${label} overlay opener button visual inset`).toBeLessThanOrEqual(32)
    expect(geometry?.gridLeft, `${label} content left rail`).toBeLessThanOrEqual(32)
    expect(Math.abs((geometry?.viewportWidth ?? 0) - (geometry?.gridRight ?? 0)), `${label} content right rail`).toBeLessThanOrEqual(32)
}

const attachRuntimeScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

const expectAxisDialogStandardSpacing = async (
    dialog: Locator,
    options: {
        fieldName: string | RegExp
        createName: string
        label: string
    }
): Promise<void> => {
    const field = dialog.getByRole('textbox', { name: options.fieldName })
    const createButton = dialog.getByRole('button', { name: options.createName })
    await expect(field, `${options.label} field`).toBeVisible()
    await expect(createButton, `${options.label} create action`).toBeVisible()

    const geometry = await field.evaluate((input, createName) => {
        const inputElement = input as HTMLElement
        const root = inputElement.closest('[role="dialog"]') as HTMLElement | null
        const formControl = inputElement.closest('.MuiFormControl-root') as HTMLElement | null
        const label = formControl?.querySelector('.MuiInputLabel-root') as HTMLElement | null
        const createButton = root
            ? Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === createName)
            : null
        const actions = createButton?.closest('.MuiDialogActions-root') as HTMLElement | null
        const rootRect = root?.getBoundingClientRect()
        const controlRect = formControl?.getBoundingClientRect()
        const labelRect = label?.getBoundingClientRect()
        const createRect = createButton?.getBoundingClientRect()
        const actionsRect = actions?.getBoundingClientRect()

        return rootRect && controlRect && labelRect && createRect && actionsRect
            ? {
                  labelVisible: labelRect.width > 0 && labelRect.height > 0,
                  controlLeft: controlRect.left,
                  controlTop: controlRect.top,
                  controlRight: controlRect.right,
                  labelTop: labelRect.top,
                  labelLeft: labelRect.left,
                  labelRight: labelRect.right,
                  actionsRight: actionsRect.right,
                  actionsBottom: actionsRect.bottom,
                  createRightGap: rootRect.right - createRect.right,
                  createBottomGap: rootRect.bottom - createRect.bottom,
                  createFooterRightGap: actionsRect.right - createRect.right,
                  createFooterBottomGap: actionsRect.bottom - createRect.bottom
              }
            : null
    }, options.createName)

    expect(geometry, `${options.label} dialog geometry`).not.toBeNull()
    expect(geometry?.labelVisible, `${options.label} field label must render with measurable bounds`).toBe(true)
    expect(geometry?.labelTop ?? 0, `${options.label} field label must not be clipped at the top`).toBeGreaterThanOrEqual(
        (geometry?.controlTop ?? 0) - 12
    )
    expect(geometry?.labelLeft ?? 0, `${options.label} field label must stay inside the form control`).toBeGreaterThanOrEqual(
        (geometry?.controlLeft ?? 0) - 1
    )
    expect(geometry?.labelRight ?? 0, `${options.label} field label must stay inside the form control`).toBeLessThanOrEqual(
        (geometry?.controlRight ?? 0) + 1
    )
    expect(geometry?.createFooterRightGap ?? 0, `${options.label} create action footer right spacing`).toBeGreaterThanOrEqual(0)
    expect(geometry?.createFooterBottomGap ?? 0, `${options.label} create action footer bottom spacing`).toBeGreaterThanOrEqual(0)
    expect(geometry?.createRightGap ?? 0, `${options.label} create action right spacing`).toBeGreaterThanOrEqual(20)
    expect(geometry?.createBottomGap ?? 0, `${options.label} create action bottom spacing`).toBeGreaterThanOrEqual(14)
}

const expectRuntimeSideMenuModes = async (page: Page, testInfo: TestInfo): Promise<void> => {
    const viewports = [
        { name: 'desktop-1920', width: 1920, height: 1080 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'mobile-390', width: 390, height: 844 }
    ] as const

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible({ timeout: 30_000 })
        await expectColorModeButtonVisible(page, `Interpretation Network wide side menu ${viewport.name}`)
        if (viewport.width < 900) {
            await expect(getDockedRuntimeNavigation(page)).toBeHidden()
            await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
        } else {
            await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
        }
        await expectNoPageHorizontalOverflow(page, `Interpretation Network wide side menu ${viewport.name}`)
        await attachRuntimeScreenshot(page, testInfo, `side-menu-wide-${viewport.name}`)
    }

    await page.setViewportSize({ width: 1920, height: 1080 })
    const wideNavigation = getDockedRuntimeNavigation(page)
    await expect(getRuntimeNavigationItem(wideNavigation, 'Start')).toBeVisible()
    await expect(getRuntimeNavigationItem(wideNavigation, 'Structures')).toBeVisible()
    await expect(wideNavigation).toContainText('Structures')
    expect(await readNavigationDrawerWidth(wideNavigation), 'wide side menu width').toBeGreaterThanOrEqual(220)
    await expectToolbarAlignedWithContent(page, 'Interpretation Network desktop toolbar 1920')

    await page.getByRole('button', { name: 'Enable compact menu' }).click()
    const compactNavigation = getDockedRuntimeNavigation(page)
    await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible()
    await expect(getRuntimeNavigationItem(compactNavigation, 'Structures')).toBeVisible()
    await expect(compactNavigation).not.toContainText('Structures')
    expect(await readNavigationDrawerWidth(compactNavigation), 'compact side menu width').toBeLessThan(100)
    await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network compact side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-compact-desktop-1280')

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible({ timeout: 30_000 })
        await expectColorModeButtonVisible(page, `Interpretation Network compact side menu ${viewport.name}`)
        if (viewport.width < 900) {
            await expect(getDockedRuntimeNavigation(page)).toBeHidden()
            await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
        } else {
            await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
        }
        await expectNoPageHorizontalOverflow(page, `Interpretation Network compact side menu ${viewport.name}`)
        await attachRuntimeScreenshot(page, testInfo, `side-menu-compact-${viewport.name}`)
    }

    await page.setViewportSize({ width: 1920, height: 1080 })

    await page.getByRole('button', { name: 'Enable wide menu' }).click()
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Use overlay menu' }).click()
    const dockedNavigation = getDockedRuntimeNavigation(page)
    const overlayNavigation = getOverlayRuntimeNavigation(page)
    await expect(dockedNavigation).toBeHidden()
    await expect(overlayNavigation).toBeVisible()
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Structures')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use docked menu' })).toBeVisible()
    expect(await readNavigationDrawerWidth(overlayNavigation), 'overlay side menu width').toBeGreaterThanOrEqual(220)
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network overlay side menu 1920')
    await expectToolbarAlignedWithContent(page, 'Interpretation Network overlay toolbar 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-desktop-1920')
    await page.keyboard.press('Escape')
    await expect(overlayNavigation).toBeHidden()
    await expect(page.getByTestId('runtime-overlay-menu-edge-control')).toBeVisible()
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network closed overlay side menu 1920')
    await expectToolbarAlignedWithContent(page, 'Interpretation Network closed overlay toolbar 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network closed overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-closed-desktop-1920')
    await page.getByTestId('runtime-overlay-menu-edge-control').click()
    await expect(overlayNavigation).toBeVisible()
    await page.getByRole('button', { name: 'Use docked menu' }).click()
    await expect(overlayNavigation).toBeHidden()
    await expect(dockedNavigation).toBeVisible()

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectColorModeButtonVisible(page, `Interpretation Network overlay-mode viewport ${viewport.name}`)
        if (viewport.width < 900) {
            await page.getByRole('button', { name: 'Open menu' }).click()
            const mobileNavigation = getVisibleRuntimeNavigation(page)
            await expect(getRuntimeNavigationItem(mobileNavigation, 'Structures')).toBeVisible({ timeout: 30_000 })
            await expectNoPageHorizontalOverflow(page, `Interpretation Network mobile menu ${viewport.name}`)
            await attachRuntimeScreenshot(page, testInfo, `side-menu-mobile-${viewport.name}`)
            await page.keyboard.press('Escape')
            await expect(mobileNavigation).toBeHidden()
            continue
        }

        await page.getByRole('button', { name: 'Use overlay menu' }).click()
        const viewportOverlayNavigation = getOverlayRuntimeNavigation(page)
        await expect(getDockedRuntimeNavigation(page)).toBeHidden()
        await expect(getRuntimeNavigationItem(viewportOverlayNavigation, 'Structures')).toBeVisible({ timeout: 30_000 })
        await expectNoPageHorizontalOverflow(page, `Interpretation Network overlay side menu ${viewport.name}`)
        await attachRuntimeScreenshot(page, testInfo, `side-menu-overlay-${viewport.name}`)
        await page.getByRole('button', { name: 'Use docked menu' }).click()
        await expect(viewportOverlayNavigation).toBeHidden()
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
}

const expectStructuresOverlayUsesFullRail = async (page: Page, testInfo: TestInfo): Promise<void> => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expectEmptyStructuresWorkspace(page)
    await expectStructuresVisualRails(page, 'Interpretation Network Structures wide side menu 1920', { left: 264, rightInset: 24 })
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Enable compact menu' }).click()
    await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible()
    await expectEmptyStructuresWorkspace(page)
    await expectStructuresVisualRails(page, 'Interpretation Network Structures compact side menu 1920', { left: 96, rightInset: 24 })
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-compact-structures-desktop-1920')
    await page.getByRole('button', { name: 'Enable wide menu' }).click()
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
    await expectEmptyStructuresWorkspace(page)
    await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Use overlay menu' }).click()

    const overlayNavigation = getOverlayRuntimeNavigation(page)
    await expect(getDockedRuntimeNavigation(page)).toBeHidden()
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Structures')).toBeVisible({ timeout: 30_000 })
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network Structures overlay 1920')
    await expectStructuresVisualRails(page, 'Interpretation Network Structures overlay 1920', { left: 24, rightInset: 24 })
    await expectToolbarAlignedWithContent(page, 'Interpretation Network Structures overlay toolbar 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network Structures overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-structures-desktop-1920')

    await page.keyboard.press('Escape')
    await expect(overlayNavigation).toBeHidden()
    await expect(page.getByTestId('runtime-overlay-menu-edge-control')).toBeVisible()
    await expectEmptyStructuresWorkspace(page)
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network Structures closed overlay 1920')
    await expectStructuresVisualRails(page, 'Interpretation Network Structures closed overlay 1920', { left: 24, rightInset: 24 })
    await expectToolbarAlignedWithContent(page, 'Interpretation Network Structures closed overlay toolbar 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network Structures closed overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-structures-closed-desktop-1920')

    await page.getByTestId('runtime-overlay-menu-edge-control').click()
    await expect(overlayNavigation).toBeVisible()
    await page.getByRole('button', { name: 'Use docked menu' }).click()
    await expect(overlayNavigation).toBeHidden()
    await expect(getDockedRuntimeNavigation(page)).toBeVisible()
    await expectEmptyStructuresWorkspace(page)
}

const fillOptionalStructureDialogFields = async (dialog: Locator, values: { name: string; description: string }): Promise<void> => {
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true })
    if ((await nameField.count()) > 0) {
        await nameField.first().fill(values.name)
    }

    const descriptionField = dialog.getByRole('textbox', { name: 'Description', exact: true })
    if ((await descriptionField.count()) > 0) {
        await descriptionField.first().fill(values.description)
    }
}

const readMatrixRowCellTexts = async (page: Page): Promise<string[][]> =>
    page
        .getByTestId('interpretation-network-matrix-row')
        .evaluateAll((rows) =>
            rows.map((row) =>
                Array.from(row.querySelectorAll('[data-testid="interpretation-network-cell"]')).map((cell) =>
                    (cell as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
                )
            )
        )

const expectMatrixTableDefaultRuntime = async (
    page: Page,
    options: {
        locale: 'en' | 'ru' | 'any'
        structureName: string
        rootTitle?: string | RegExp
        verticalTreeAvailable?: boolean
        assertAxisDialogs?: boolean
        assertDefaultCellDialog?: boolean
    }
): Promise<void> => {
    const verticalTreeAvailable = options.verticalTreeAvailable ?? true
    const rootTitle = options.rootTitle ?? (options.locale === 'ru' ? 'Вселенная' : 'Universe')
    const tableToggleName =
        options.locale === 'ru' ? 'Табличный вид' : options.locale === 'en' ? 'Table view' : /^(Table view|Табличный вид)$/
    const horizontalRowsToggleName =
        options.locale === 'ru'
            ? 'Горизонтальные строки'
            : options.locale === 'en'
            ? 'Horizontal rows'
            : /^(Horizontal rows|Горизонтальные строки)$/
    const verticalTreeToggleName =
        options.locale === 'ru'
            ? 'Вертикальное дерево'
            : options.locale === 'en'
            ? 'Vertical tree'
            : /^(Vertical tree|Вертикальное дерево)$/
    const tableName =
        options.locale === 'ru' ? 'Таблица матрицы' : options.locale === 'en' ? 'Matrix table' : /^(Matrix table|Таблица матрицы)$/
    const rowsHeaderName = options.locale === 'ru' ? 'Строки' : options.locale === 'en' ? 'Rows' : /^(Rows|Строки)$/
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })
    await expect(matrixPane.getByRole('button', { name: tableToggleName })).toHaveAttribute('aria-pressed', 'true')
    await expect(matrixPane.getByRole('button', { name: horizontalRowsToggleName })).toBeVisible()
    if (verticalTreeAvailable) {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toBeVisible()
    } else {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toHaveCount(0)
    }

    const tableRegion = getMatrixTable(page)
    await expect(tableRegion).toBeVisible({ timeout: 30_000 })
    await expect(tableRegion).toHaveAttribute('tabindex', '0')
    const table = tableRegion.getByRole('table', { name: tableName })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: rowsHeaderName })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: rootTitle })).toBeVisible()
    await expect(table.getByRole('rowheader', { name: rootTitle })).toBeVisible()
    const escapedRootTitle = rootTitle instanceof RegExp ? '(Universe|Вселенная)' : escapeRegExp(rootTitle)
    const rootCellButton = table.getByRole('button', { name: new RegExp(`^${escapedRootTitle}, ${escapedRootTitle}, 1,`) })
    await expect(rootCellButton).toBeVisible()
    if (options.assertAxisDialogs) {
        const addRowName = options.locale === 'ru' ? 'Добавить строку' : 'Add row'
        const addColumnName = options.locale === 'ru' ? 'Добавить колонку' : 'Add column'
        await expect(table.getByRole('button', { name: addRowName })).toBeEnabled()
        await table.getByRole('button', { name: addRowName }).click()
        const rowDialog = page.getByRole('dialog', { name: addRowName })
        await expect(rowDialog).toBeVisible()
        await expectAxisDialogStandardSpacing(rowDialog, {
            fieldName: options.locale === 'ru' ? 'Название строки' : 'Row name',
            createName: options.locale === 'ru' ? 'Создать' : 'Create',
            label: `Matrix Table ${options.locale} add row`
        })
        await expect(rowDialog.getByRole('radio')).toHaveCount(0)
        await rowDialog.getByRole('button', { name: options.locale === 'ru' ? 'Отмена' : 'Cancel' }).click()
        await expect(rowDialog).toHaveCount(0)
        await expect(rootCellButton).toBeVisible()
        await table.getByRole('button', { name: addColumnName }).click()
        const columnDialog = page.getByRole('dialog', { name: addColumnName })
        await expect(columnDialog).toBeVisible()
        await expectAxisDialogStandardSpacing(columnDialog, {
            fieldName: options.locale === 'ru' ? 'Название колонки' : 'Column name',
            createName: options.locale === 'ru' ? 'Создать' : 'Create',
            label: `Matrix Table ${options.locale} add column`
        })
        await expect(columnDialog.getByRole('radio')).toHaveCount(0)
        await columnDialog.getByRole('button', { name: options.locale === 'ru' ? 'Отмена' : 'Cancel' }).click()
        await expect(columnDialog).toHaveCount(0)
    }
    if (options.assertDefaultCellDialog) {
        const addCellName = options.locale === 'ru' ? 'Добавить' : 'Add'
        const addCellDialogName = options.locale === 'ru' ? 'Добавить ячейку' : 'Add cell'
        await matrixPane
            .getByTestId('interpretation-network-matrix-toolbar')
            .getByRole('button', { name: addCellName, exact: true })
            .click()
        const cellDialog = page.getByRole('dialog', { name: addCellDialogName })
        await expect(cellDialog).toBeVisible()
        await expect(cellDialog.getByRole('radio')).toHaveCount(0)
        await expect(cellDialog.getByRole('combobox', { name: options.locale === 'ru' ? 'Выберите строку' : 'Select row' })).toHaveCount(0)
        await expect(
            cellDialog.getByRole('combobox', { name: options.locale === 'ru' ? 'Выберите колонку' : 'Select column' })
        ).toHaveCount(0)
        await expect(
            cellDialog.getByText(
                options.locale === 'ru' ? 'Создаётся автоматически для новой ячейки.' : 'Created automatically for the new cell.'
            )
        ).toHaveCount(2)
        await expect(cellDialog).not.toContainText(options.locale === 'ru' ? 'Новая строка' : 'New row')
        await expect(cellDialog).not.toContainText(options.locale === 'ru' ? 'Новая колонка' : 'New column')
        await cellDialog.getByRole('button', { name: options.locale === 'ru' ? 'Отмена' : 'Cancel' }).click()
        await expect(cellDialog).toHaveCount(0)
    }
    await expect(page.getByTestId('interpretation-network-cell')).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(options.structureName)
    await expectNoTechnicalLeakage(tableRegion, {
        label: `Interpretation Network Matrix Table ${options.locale}`,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i, /"blocks"/i]
    })
    await expectNoPageHorizontalOverflow(page, `Interpretation Network Matrix Table ${options.locale}`)
}

const dragMatrixCellByPointer = async (
    source: Locator,
    target: Locator,
    placement: 'before' | 'child' | 'after',
    options: { targetIsHigherLevel?: boolean; axis?: 'horizontal' | 'vertical' } = {}
): Promise<void> => {
    const sourceHandle = source.getByLabel('Drag cell')
    await expect(sourceHandle).toBeVisible()
    const sourceCellBox = await source.boundingBox()
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await target.boundingBox()
    expect(sourceCellBox, 'matrix drag source cell box').toBeTruthy()
    expect(sourceBox, 'matrix drag source handle box').toBeTruthy()
    expect(targetBox, 'matrix drag target cell box').toBeTruthy()
    if (!sourceCellBox || !sourceBox || !targetBox) return
    const targetCellId = await target.getAttribute('data-cell-id')
    expect(targetCellId, 'matrix drag target stable cell id').toBeTruthy()
    if (!targetCellId) return

    const sourceStartX = sourceBox.x + sourceBox.width / 2
    const sourceStartY = sourceBox.y + sourceBox.height / 2
    const sourceHandleToCellCenterX = sourceCellBox.x + sourceCellBox.width / 2 - sourceStartX
    const sourceHandleToCellCenterY = sourceCellBox.y + sourceCellBox.height / 2 - sourceStartY
    await sourceHandle.hover()
    await source.page().mouse.move(sourceStartX, sourceStartY)
    await source.page().mouse.down()
    const sourceApproachesFromRight = sourceCellBox.x >= targetBox.x
    const moveSourceCenterTo = async (sourceCenterX: number, sourceCenterY = targetBox.y + targetBox.height / 2) => {
        await source.page().mouse.move(sourceCenterX - sourceHandleToCellCenterX, sourceCenterY - sourceHandleToCellCenterY, { steps: 12 })
    }
    const currentTarget = source.page().locator(`[data-testid="interpretation-network-cell"][data-cell-id="${targetCellId}"]`)

    if (options.targetIsHigherLevel) {
        const targetProgress = placement === 'before' ? 0.125 : placement === 'after' ? 0.875 : 0.5
        await moveSourceCenterTo(targetBox.x + targetBox.width * targetProgress)
        await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    } else if (placement === 'child' && options.axis === 'vertical') {
        await moveSourceCenterTo(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * 1.18)
        await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    } else if (placement === 'child') {
        const overlapBaseWidth = Math.min(sourceCellBox.width, targetBox.width)
        for (const overlapRatio of [0.45, 0.35, 0.25, 0.15]) {
            const childOverlapWidth = overlapBaseWidth * overlapRatio
            const candidateCenters = [
                targetBox.x + childOverlapWidth - sourceCellBox.width / 2,
                targetBox.x + targetBox.width - childOverlapWidth + sourceCellBox.width / 2
            ]
            let matchedChildPlacement = false
            for (const sourceCenterX of candidateCenters) {
                await moveSourceCenterTo(sourceCenterX, targetBox.y + targetBox.height * 0.72)
                await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
                matchedChildPlacement = await expect
                    .poll(async () => currentTarget.first().getAttribute('data-drop-placement'), {
                        timeout: 1_500
                    })
                    .toBe('child')
                    .then(
                        () => true,
                        () => false
                    )
                if (matchedChildPlacement) break
            }
            if (matchedChildPlacement) break
        }
    } else {
        const sourceCenterX =
            placement === 'before'
                ? sourceApproachesFromRight
                    ? targetBox.x + targetBox.width * 0.25 + sourceCellBox.width / 2
                    : targetBox.x + targetBox.width * 0.25
                : sourceApproachesFromRight
                ? targetBox.x + targetBox.width * 0.75
                : targetBox.x + targetBox.width * 0.75 - sourceCellBox.width / 2
        await moveSourceCenterTo(sourceCenterX)
        await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    }
    await expect
        .poll(async () => currentTarget.first().getAttribute('data-drop-placement'), {
            message: `matrix drop placement should be ${placement}`
        })
        .toBe(placement)
    await expect(currentTarget.first().getByTestId('interpretation-network-drop-indicator')).toBeVisible({ timeout: 10_000 })
    if (placement === 'child' || placement === 'before' || placement === 'after') {
        const placeholder = source.page().getByTestId('interpretation-network-drop-placeholder')
        await expect(placeholder).toBeVisible({ timeout: 10_000 })
        await expect(placeholder).toHaveAttribute('data-drop-placement', placement)
    }
    await source.page().mouse.up()
}

const dragMatrixTableCellToEmptySlot = async (source: Locator, target: Locator): Promise<void> => {
    const sourceHandle = source.getByRole('button', { name: 'Drag cell' })
    await expect(sourceHandle).toBeVisible()
    await expect(target).toHaveAttribute('data-empty-drop-enabled', 'true')
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await target.boundingBox()
    expect(sourceBox, 'Matrix Table drag source handle box').toBeTruthy()
    expect(targetBox, 'Matrix Table empty drop target box').toBeTruthy()
    if (!sourceBox || !targetBox) return

    await sourceHandle.hover()
    await source.page().mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await source.page().mouse.down()
    await source.page().mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 16 })
    await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(target).toHaveAttribute('data-drop-target', 'true')
    await source.page().mouse.up()
}

const moveSelectedMatrixTableCellToEmptySlotByKeyboard = async (source: Locator, target: Locator): Promise<void> => {
    await source.click()
    const targetAccessibleName = await target.getAttribute('aria-label')
    expect(targetAccessibleName, 'Matrix Table empty drop target must be user-labeled').toMatch(/^Empty intersection:/)
    const moveButton = target.getByRole('button', { name: /^Move selected cell here:/ })
    await moveButton.focus()
    await expect(moveButton).toBeFocused()
    await source.page().keyboard.press('Enter')
}

const waitForMatrixMoveResponse = (page: Page, applicationId: string, timeout = 15_000) =>
    waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/') &&
            response.url().includes('/batch'),
        { label: 'Moving matrix cell by drag and drop', timeout }
    )

const expectMatrixCellMoveNotSwapWithNewAxesCellDialog = async (page: Page, applicationId: string): Promise<void> => {
    const horizontalRowsButton = page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', {
        name: 'Horizontal rows'
    })
    await expect(horizontalRowsButton).toBeVisible({ timeout: 30_000 })
    if ((await horizontalRowsButton.getAttribute('aria-pressed')) !== 'true') {
        await horizontalRowsButton.click()
        await expect(horizontalRowsButton).toHaveAttribute('aria-pressed', 'true')
    }

    const rootCell = page.getByTestId('interpretation-network-cell').first()
    await expect(rootCell).toHaveAttribute('data-cell-id', /.+/)
    const rootCellId = await rootCell.getAttribute('data-cell-id')
    expect(rootCellId, 'root Universe cell must expose its stable CellId for hierarchy assertions').toBeTruthy()
    await rootCell.click()
    await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Add' }).click()
    const firstChildDialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(firstChildDialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(firstChildDialog, { longTextLabels: ['Description'] })
    await expect(
        firstChildDialog.getByRole('radio', { name: 'New row' }),
        'This move oracle intentionally runs after opt-in inline row creation is enabled'
    ).toBeVisible()
    await expect(firstChildDialog.getByRole('radio', { name: 'New row' })).toBeChecked()
    await expect(firstChildDialog.getByRole('radio', { name: 'New column' })).toBeChecked()
    await firstChildDialog.getByRole('textbox', { name: 'New row name' }).fill('E2E concepts row')
    await firstChildDialog.getByRole('textbox', { name: 'New column name' }).fill('E2E primary column')
    await firstChildDialog.getByRole('textbox', { name: 'Title' }).fill('E2E first child cell')
    await firstChildDialog.getByRole('textbox', { name: 'Description' }).fill('E2E first child description')
    const addFirstChildRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/'),
        { label: 'Creating first hierarchical matrix child' }
    )
    await firstChildDialog.getByRole('button', { name: 'Create' }).click()
    expect((await addFirstChildRequest).ok()).toBe(true)
    await expect(firstChildDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' })).toBeVisible({
        timeout: 30_000
    })

    await rootCell.click()
    await page.getByRole('button', { name: 'Add' }).click()
    const secondChildDialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(secondChildDialog).toBeVisible({ timeout: 30_000 })
    await secondChildDialog.getByRole('radio', { name: 'Existing row' }).check()
    await expect(secondChildDialog.getByRole('radio', { name: 'Existing row' })).toBeChecked()
    const secondChildRowSelect = secondChildDialog.getByRole('combobox', { name: 'Select row' })
    await secondChildRowSelect.fill('E2E concepts row')
    await page.getByRole('option', { name: 'E2E concepts row' }).click()
    await expect(secondChildRowSelect).toHaveValue('E2E concepts row')
    await expect(secondChildDialog.getByRole('radio', { name: 'New column' })).toBeChecked()
    await secondChildDialog.getByRole('textbox', { name: 'New column name' }).fill('E2E secondary column')
    await secondChildDialog.getByRole('textbox', { name: 'Title' }).fill('E2E second child cell')
    await secondChildDialog.getByRole('textbox', { name: 'Description' }).fill('E2E second child description')
    const addSecondChildRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/'),
        { label: 'Creating second hierarchical matrix child' }
    )
    await secondChildDialog.getByRole('button', { name: 'Create' }).click()
    expect((await addSecondChildRequest).ok()).toBe(true)
    await expect(secondChildDialog).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText(/New row|New cell/)
    await expect(page.getByTestId('interpretation-network-matrix-row')).toHaveCount(2, { timeout: 30_000 })

    const beforeRows = await readMatrixRowCellTexts(page)
    expect(beforeRows).toEqual([
        [expect.stringContaining('Universe')],
        [expect.stringContaining('E2E first child cell'), expect.stringContaining('E2E second child cell')]
    ])

    const sourceCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E second child cell' }).first()
    const targetCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first()
    await expect(sourceCell).toHaveAttribute('data-cell-id', /.+/)
    await expect(targetCell).toHaveAttribute('data-cell-id', /.+/)
    const moveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await dragMatrixCellByPointer(sourceCell, targetCell, 'before')
    const moveResponse = await moveRequest
    expect(moveResponse.ok()).toBe(true)
    const movePayload = moveResponse.request().postDataJSON() as { updates?: Array<{ data?: Record<string, unknown> }> }
    expect(
        Array.isArray(movePayload.updates) ? movePayload.updates.length : 0,
        'drag/drop move must update moved cell without swapping'
    ).toBeGreaterThanOrEqual(1)
    expect(movePayload.updates?.[0]?.data, 'dragged sibling reorder must not reparent the moved cell').not.toHaveProperty('ParentCellId')
    expect(movePayload.updates?.[0]?.data?._tp_sort_order, 'dragged sibling reorder must persist the new sibling order').toBe(0)

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            [expect.stringContaining('Universe')],
            [expect.stringContaining('E2E second child cell'), expect.stringContaining('E2E first child cell')]
        ])

    const keyboardMoveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    const firstChildActions = page.getByRole('button', { name: 'Cell actions: E2E first child cell' })
    await firstChildActions.focus()
    await page.keyboard.press('Enter')
    const moveUpMenuItem = page.getByRole('menuitem', { name: 'Up' })
    await expect(moveUpMenuItem).toBeVisible()
    await moveUpMenuItem.focus()
    await page.keyboard.press('Enter')
    const keyboardMoveResponse = await keyboardMoveRequest
    expect(keyboardMoveResponse.ok()).toBe(true)
    const keyboardMovePayload = keyboardMoveResponse.request().postDataJSON() as { updates?: Array<{ data?: Record<string, unknown> }> }
    expect(keyboardMovePayload.updates?.[0]?.data, 'menu move must not reparent the moved cell').not.toHaveProperty('ParentCellId')

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            [expect.stringContaining('Universe')],
            [expect.stringContaining('E2E first child cell'), expect.stringContaining('E2E second child cell')]
        ])

    await page.getByRole('button', { name: 'Vertical tree' }).click()
    await expect(page.getByRole('button', { name: 'Vertical tree' })).toHaveAttribute('aria-pressed', 'true')
    const childDropSource = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E second child cell' }).first()
    const childDropTarget = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first()
    const firstChildId = await childDropTarget.getAttribute('data-cell-id')
    expect(firstChildId, 'child drop target must expose its stable CellId').toBeTruthy()
    const childMoveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await dragMatrixCellByPointer(childDropSource, childDropTarget, 'child', { axis: 'vertical' })
    const childMoveResponse = await childMoveRequest
    expect(childMoveResponse.ok()).toBe(true)
    const childMovePayload = childMoveResponse.request().postDataJSON() as { updates?: Array<{ data?: Record<string, unknown> }> }
    expect(childMovePayload.updates?.[0]?.data?.ParentCellId, 'center drop must reparent the moved cell').toBe(firstChildId)
    expect(childMovePayload.updates?.[0]?.data?._tp_sort_order, 'first child under a new parent must start at sibling order zero').toBe(0)

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')]),
            expect.arrayContaining([expect.stringContaining('E2E second child cell')])
        ])

    await page.reload()
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Horizontal rows' }).click()
    await page.getByTestId('interpretation-network-cell').filter({ hasText: 'Universe' }).first().click()
    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')])
        ])
    await page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first().click()
    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')]),
            expect.arrayContaining([expect.stringContaining('E2E second child cell')])
        ])

    await page.getByRole('button', { name: 'Cell actions: E2E second child cell' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const editCellDialog = page.getByRole('dialog', { name: 'Edit cell' })
    await expect(editCellDialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(editCellDialog, { longTextLabels: ['Description'] })
    await editCellDialog.getByRole('textbox', { name: 'Title' }).fill('E2E edited child cell')
    await editCellDialog.getByRole('textbox', { name: 'Description' }).fill('E2E edited child description')
    const editCellRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/') &&
            (response.request().method() === 'PATCH' || (response.request().method() === 'POST' && response.url().includes('/batch'))),
        { label: 'Editing an Interpretation Network Matrix cell' }
    )
    await editCellDialog.getByRole('button', { name: 'Save' }).click()
    expect((await editCellRequest).ok()).toBe(true)
    await expect(editCellDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E edited child cell' })).toBeVisible({
        timeout: 30_000
    })

    await page.getByRole('button', { name: 'Cell actions: E2E edited child cell' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const deleteCellDialog = page.getByRole('dialog', { name: 'Delete cell?' })
    await expect(deleteCellDialog).toBeVisible()
    const deleteCellRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/'),
        { label: 'Deleting an Interpretation Network Matrix cell' }
    )
    await deleteCellDialog.getByRole('button', { name: 'Delete' }).click()
    expect((await deleteCellRequest).ok()).toBe(true)
    await expect(deleteCellDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E edited child cell' })).toHaveCount(0)
}

const expectInterpretationNetworkMatrixSettings = async (page: Page, applicationId: string, testInfo: TestInfo): Promise<void> => {
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab', { name: 'Matrix' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Learning Content' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('tab', { name: 'Matrix' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Hierarchical cells' })).toHaveCount(0)
    await expectNoTechnicalLeakage(page.getByRole('main'), {
        label: 'Interpretation Network application Matrix settings',
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network application Matrix settings')
    await attachRuntimeScreenshot(page, testInfo, 'application-settings-matrix-desktop-1280')
    await expectRuntimeUxViewportMatrix(page, 'Interpretation Network application Matrix settings', {
        beforeEachViewport: async () => {
            await page.goto(`/a/${applicationId}/admin/settings`)
            await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
            await page.getByRole('tab', { name: 'Matrix' }).click()
            await expect(page.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible({ timeout: 30_000 })
        }
    })
}

const saveApplicationMatrixViewSettings = async (
    page: Page,
    applicationId: string,
    settings: {
        matrixMode?: 'Hierarchical cells' | 'Independent rows'
        table: boolean
        horizontalRows: boolean
        verticalTree: boolean
        defaultView: 'Table view' | 'Horizontal rows' | 'Vertical tree'
        allowNewAxesInCellDialog?: boolean
    }
): Promise<void> => {
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('tab', { name: 'Matrix' })).toHaveAttribute('aria-selected', 'true')

    let changed = false

    if (settings.matrixMode) {
        const matrixMode = page.getByRole('combobox', { name: 'Matrix mode' })
        if ((await matrixMode.textContent())?.trim() !== settings.matrixMode) {
            await matrixMode.click()
            await page.getByRole('option', { name: settings.matrixMode }).click()
            changed = true
        }
    }

    const setChecked = async (name: 'Table view' | 'Horizontal rows' | 'Vertical tree', checked: boolean) => {
        const checkbox = page.getByRole('checkbox', { name })
        await expect(checkbox).toBeVisible()
        if ((await checkbox.isChecked()) !== checked) {
            await checkbox.click()
            changed = true
        }
        await expect(checkbox).toBeChecked({ checked })
    }

    await setChecked('Table view', settings.table)
    await setChecked('Horizontal rows', settings.horizontalRows)
    await setChecked('Vertical tree', settings.verticalTree)
    if (settings.allowNewAxesInCellDialog !== undefined) {
        const axisDialogSwitch = page.getByTestId('application-setting-matrix-new-axes-in-cell-dialog').getByRole('switch')
        await expect(axisDialogSwitch).toBeVisible()
        if ((await axisDialogSwitch.isChecked()) !== settings.allowNewAxesInCellDialog) {
            await axisDialogSwitch.click()
            changed = true
        }
        await expect(axisDialogSwitch).toBeChecked({ checked: settings.allowNewAxesInCellDialog })
    }
    const defaultView = page.getByRole('combobox', { name: 'Default view' })
    if ((await defaultView.textContent())?.trim() !== settings.defaultView) {
        await defaultView.click()
        await page.getByRole('option', { name: settings.defaultView }).click()
        changed = true
    }
    if (!changed) {
        await expect(page.getByTestId('application-settings-matrix-save')).toHaveCount(0)
        return
    }

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) => matchesApplicationLayoutWidgetConfigUpdate(response, applicationId),
        { label: 'Saving Interpretation Network Matrix settings' }
    )
    await expect(page.getByTestId('application-settings-matrix-save')).toBeVisible()
    await page.getByTestId('application-settings-matrix-save').click()
    await expect((await saveResponse).ok(), 'Matrix settings widget config update must succeed').toBe(true)
    await expect(page.getByTestId('application-settings-matrix-save')).toHaveCount(0)
}

const expectHorizontalRowsOnlyMatrixRuntime = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await page.goto(`/a/${applicationId}/${structureSectionId}/${structureId}`)
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })
    await expect(matrixPane.getByRole('button', { name: 'Horizontal rows' })).toHaveCount(0)
    await expect(matrixPane.getByRole('button', { name: 'Table view' })).toHaveCount(0)
    await expect(matrixPane.getByRole('button', { name: 'Vertical tree' })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'Universe' }).first()).toBeVisible()
    await expect(page.getByTestId('interpretation-network-matrix-row')).toHaveCount(1)
    await expect(getMatrixTable(page)).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network Horizontal rows only runtime')
}

const expectIndependentRowsTableDrop = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Independent rows',
        table: true,
        horizontalRows: true,
        verticalTree: false,
        defaultView: 'Table view',
        allowNewAxesInCellDialog: true
    })
    await page.goto(`/a/${applicationId}/${structureSectionId}/${structureId}`)
    await expectMatrixTableDefaultRuntime(page, {
        locale: 'en',
        structureName: createdStructureName,
        verticalTreeAvailable: false
    })

    const toolbar = page.getByTestId('interpretation-network-matrix-toolbar')
    await expect(toolbar.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true')
    const sourceCell = getMatrixTable(page).getByTestId('interpretation-network-table-cell').filter({ hasText: 'E2E first child cell' })
    await expect(sourceCell).toBeVisible()
    await expect(getMatrixTable(page).getByRole('button', { name: 'Drag cell' }).first()).toBeEnabled()
    await expect(getMatrixTable(page).getByRole('button', { name: 'Add row' })).toBeEnabled()
    await getMatrixTable(page).getByRole('button', { name: 'Add row' }).click()
    const rowDialog = page.getByRole('dialog', { name: 'Add row' })
    await expect(rowDialog).toBeVisible()
    await rowDialog.getByRole('textbox', { name: 'Row name' }).fill('E2E independent target row')
    const addRowRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().includes('/tabular/'),
        { label: 'Creating independent Matrix Table target row' }
    )
    await rowDialog.getByRole('button', { name: 'Create' }).click()
    expect((await addRowRequest).ok()).toBe(true)
    await expect(rowDialog).toHaveCount(0)
    await expect(getMatrixTable(page).getByRole('rowheader', { name: 'E2E independent target row' })).toBeVisible({
        timeout: 30_000
    })

    const independentTarget = getMatrixTable(page).locator(
        '[data-testid="interpretation-network-table-empty-cell"][data-empty-drop-enabled="true"][aria-label^="Empty intersection: E2E independent target row,"]'
    )
    await expect(independentTarget.first()).toBeVisible()
    const moveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await moveSelectedMatrixTableCellToEmptySlotByKeyboard(sourceCell, independentTarget.first())
    const moveResponse = await moveRequest
    expect(moveResponse.ok()).toBe(true)
    const movePayload = moveResponse.request().postDataJSON() as { updates?: Array<{ data?: Record<string, unknown> }> }
    expect(movePayload.updates?.[0]?.data).toEqual(
        expect.objectContaining({
            RowKey: expect.any(String),
            ColKey: expect.any(String),
            _tp_sort_order: expect.any(Number)
        })
    )
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Hierarchical cells',
        table: true,
        horizontalRows: true,
        verticalTree: true,
        defaultView: 'Table view'
    })
    await page.goto(`/a/${applicationId}/${structureSectionId}/${structureId}`)
    await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })
}

const expectHierarchicalTableFreeSlotDrop = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Hierarchical cells',
        table: true,
        horizontalRows: true,
        verticalTree: true,
        defaultView: 'Table view'
    })
    await page.goto(`/a/${applicationId}/${structureSectionId}/${structureId}`)
    await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })

    const table = getMatrixTable(page)
    const sourceCell = table.getByTestId('interpretation-network-table-cell').filter({ hasText: 'E2E first child cell' }).first()
    await sourceCell.scrollIntoViewIfNeeded()
    await expect(sourceCell).toBeVisible({ timeout: 30_000 })
    await expect(table.getByRole('button', { name: 'Drag cell' }).first()).toBeEnabled()

    const enabledEmptyTargets = table.locator('[data-testid="interpretation-network-table-empty-cell"][data-empty-drop-enabled="true"]')
    const target = enabledEmptyTargets.first()
    await target.scrollIntoViewIfNeeded()
    await expect(target).toBeVisible()
    const targetAccessibleName = await target.getAttribute('aria-label')
    expect(targetAccessibleName, 'hierarchical Matrix Table empty drop target must be user-labeled').toMatch(/^Empty intersection:/)

    const moveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await dragMatrixTableCellToEmptySlot(sourceCell, target)
    const moveResponse = await moveRequest
    expect(moveResponse.ok()).toBe(true)
    const movePayload = moveResponse.request().postDataJSON() as { updates?: Array<{ data?: Record<string, unknown> }> }
    expect(movePayload.updates?.[0]?.data, 'hierarchical table free-slot move must persist table coordinates').toEqual(
        expect.objectContaining({
            RowKey: expect.any(String),
            ColKey: expect.any(String)
        })
    )
    expect(
        movePayload.updates?.[0]?.data,
        'hierarchical table free-slot move must preserve the existing parent relation by omitting ParentCellId'
    ).not.toHaveProperty('ParentCellId')
    expect(
        movePayload.updates?.[0]?.data,
        'hierarchical table free-slot move must preserve sibling order by omitting _tp_sort_order'
    ).not.toHaveProperty('_tp_sort_order')
    expect(movePayload.updates, 'hierarchical table free-slot move must not compact unrelated sibling order').toHaveLength(1)
    await expect(table.getByTestId('interpretation-network-table-cell').filter({ hasText: 'E2E first child cell' })).toBeVisible({
        timeout: 30_000
    })
}

async function fillMaterialDialogFields(dialog: Locator, values: { title: string; description: string }) {
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(values.title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(values.description)
}

async function fillMaterialBlockEditor(page: Page, surface: Locator, value: string) {
    const editorRoot = surface.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(surface.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    const previousCommittedSequence = await editorRoot.getAttribute('data-editorjs-committed-sequence')
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.fill(value)
    await expect(editorRoot.getByText(value)).toBeVisible()
    await expect(editableBlock).toContainText(value)
    await expect
        .poll(() => editorRoot.getAttribute('data-editorjs-committed-sequence'), {
            message: 'Editor.js material content must commit before saving',
            timeout: 20_000
        })
        .not.toBe(previousCommittedSequence)
}

test.describe('Interpretation Network imported snapshot @flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('imported interpretation-network snapshot renders the interpretation workspace', async ({ page, runManifest }, testInfo) => {
        const browserIssues = watchInterpretationNetworkBrowserRegressionIssues(page)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const { applicationId, metahub } = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: 'flow'
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: 'Interpretation Network flow',
            codename: 'interpretation-network-flow'
        })
        await updateMetahub(api, metahub.id, {
            name: { en: 'Renamed Interpretation Network flow' },
            description: {
                en: 'Renamed during E2E to verify runtime menu targets are UUID-backed.'
            },
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: 'en',
            codename: codenameVlc('RenamedInterpretationNetworkFlow')
        })

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByText('Renamed Interpretation Network flow', { exact: true }).first()).toBeVisible({
            timeout: 30_000
        })

        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)
        await expect(page.getByRole('main')).not.toContainText('Users')
        await expect(page.getByRole('main')).not.toContainText('Conversions')
        await expect(page.getByRole('main')).not.toContainText('Event count')
        await expectRuntimeSideMenuModes(page, testInfo)
        await expectInterpretationNetworkMatrixSettings(page, applicationId, testInfo)
        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)

        const menu = getDockedRuntimeNavigation(page)
        await menu.getByRole('link', { name: 'Workspaces' }).click()
        await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        const workspaceMenu = getVisibleRuntimeNavigation(page)
        await expect(workspaceMenu.getByRole('link', { name: 'Structures' })).toBeVisible()
        await workspaceMenu.getByRole('link', { name: 'Structures' }).click()
        await expectEmptyStructuresWorkspace(page)
        await expectStructuresOverlayUsesFullRail(page, testInfo)
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network workspace shell')
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network workspace shell', {
            beforeEachViewport: async () => {
                await expectEmptyStructuresWorkspace(page)
            }
        })

        const runtimeSections = await expectInterpretationNetworkRuntimeDataReady(api, applicationId)
        await page.setViewportSize({ width: 1280, height: 900 })
        await expectEmptyStructuresWorkspace(page)
        await expectEqualDesktopPaneWidths(page, 'Empty Interpretation Network workspace')
        await applyBrowserPreferences(page, { language: 'ru' })
        await page.reload()
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('heading', { name: 'Структуры' })).toBeVisible()
        await expect(
            page.getByTestId('interpretation-network-structure-pane').getByRole('textbox', { name: 'Фильтр по названию' })
        ).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Табличный вид' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Карточки' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Создать' })).toBeVisible()
        await expectEqualDesktopPaneWidths(page, 'RU empty Interpretation Network workspace')
        await applyBrowserPreferences(page, { language: 'en' })
        await page.reload()
        await expectEmptyStructuresWorkspace(page)
        const activeWorkspaceId = await getVisibleWorkspaceSwitcher(page).locator('input').inputValue()
        expect(activeWorkspaceId, 'Interpretation Network workspace mutation checks need the active workspace id').toMatch(
            /^[0-9a-f-]{36}$/i
        )
        await page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Create' }).click()
        const structureDialog = page.getByRole('dialog', { name: 'Create structure' })
        await expect(structureDialog).toBeVisible({ timeout: 30_000 })
        if ((await structureDialog.getByRole('textbox', { name: 'Description', exact: true }).count()) > 0) {
            await expectSemanticFieldControls(structureDialog, { longTextLabels: ['Description'] })
        }
        await fillOptionalStructureDialogFields(structureDialog, {
            name: createdStructureName,
            description: createdStructureDescription
        })
        const createStructureRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesRuntimeRowsCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network structure' }
        )
        await structureDialog.getByRole('button', { name: 'Create' }).click()
        const createStructureResponse = await createStructureRequest
        expect(createStructureResponse.ok()).toBe(true)
        const createdStructure = (await createStructureResponse.json()) as { id?: string }
        expect(createdStructure.id, 'created structure id must be returned by runtime create').toMatch(/^[0-9a-f-]{36}$/i)
        await expect(structureDialog).toHaveCount(0)
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureName, { timeout: 30_000 })
        await expect(page.getByRole('tab', { name: 'Matrix' })).toBeVisible()
        await expect(page.getByRole('tabpanel', { name: 'Matrix' })).toBeVisible()
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.structureSectionId)}/${escapeRegExp(
                    createdStructure.id ?? ''
                )}$`
            )
        )
        await expectMatrixTableDefaultRuntime(page, {
            locale: 'en',
            structureName: createdStructureName,
            assertAxisDialogs: true,
            assertDefaultCellDialog: true
        })
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: false,
            horizontalRows: true,
            verticalTree: false,
            defaultView: 'Horizontal rows'
        })
        await expectHorizontalRowsOnlyMatrixRuntime(page, applicationId, runtimeSections.structureSectionId, createdStructure.id ?? '')
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: true,
            horizontalRows: true,
            verticalTree: true,
            defaultView: 'Table view'
        })
        await page.goto(`/a/${applicationId}/${runtimeSections.structureSectionId}/${createdStructure.id ?? ''}`)
        await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })
        const matrixDisplayToggle = page
            .getByTestId('interpretation-network-matrix-toolbar')
            .getByRole('button', { name: 'Horizontal rows' })
        const tableDisplayToggle = page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Table view' })
        const matrixTableBox = await getMatrixTable(page).boundingBox()
        expect(matrixTableBox?.width, 'Matrix Table must render inside its scroll container').toBeGreaterThan(0)

        const firstMenuLink = getDockedRuntimeNavigation(page).getByRole('link').first()
        const menuGap = await firstMenuLink.evaluate((link) => {
            const icon = link.querySelector('.MuiListItemIcon-root')?.getBoundingClientRect()
            const label = link.querySelector('.MuiListItemText-root')?.getBoundingClientRect()
            return icon && label ? label.left - icon.right : null
        })
        expect(menuGap, 'published SideMenu icon-label gap').not.toBeNull()
        expect(menuGap ?? 0).toBeGreaterThanOrEqual(7)
        expect(menuGap ?? 0).toBeLessThanOrEqual(9)
        await page.reload()
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.structureSectionId)}/${escapeRegExp(
                    createdStructure.id ?? ''
                )}$`
            )
        )
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureName, { timeout: 30_000 })
        await expect(page.getByRole('tab', { name: 'Matrix' })).toBeVisible()
        await expect(page.getByRole('tabpanel', { name: 'Matrix' })).toBeVisible()
        await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })
        await matrixDisplayToggle.click()
        const cells = page.getByTestId('interpretation-network-cell')
        await expect(cells.first()).toBeVisible({ timeout: 30_000 })
        await expect(cells.first()).toContainText('Universe')
        await expect(cells.first()).not.toContainText('Empty cell')
        const matrixHorizontalToggle = page.getByRole('button', { name: 'Horizontal rows' })
        await expect(matrixHorizontalToggle).toHaveAttribute('aria-pressed', 'true')
        const matrixToggleBox = await matrixHorizontalToggle.boundingBox()
        expect(matrixToggleBox?.width, 'Matrix view toggle width').toBeCloseTo(40, 0)
        expect(matrixToggleBox?.height, 'Matrix view toggle height').toBeCloseTo(40, 0)
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: true,
            horizontalRows: true,
            verticalTree: true,
            defaultView: 'Table view',
            allowNewAxesInCellDialog: true
        })
        await page.goto(`/a/${applicationId}/${runtimeSections.structureSectionId}/${createdStructure.id ?? ''}`)
        await expectMatrixCellMoveNotSwapWithNewAxesCellDialog(page, applicationId)
        await expectHierarchicalTableFreeSlotDrop(page, applicationId, runtimeSections.structureSectionId, createdStructure.id ?? '')
        await expectIndependentRowsTableDrop(page, applicationId, runtimeSections.structureSectionId, createdStructure.id ?? '')
        await page.getByRole('button', { name: 'Horizontal rows' }).click()
        await cells.first().click()
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        const materialTableToggle = page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Table view' })
        await expect(matrixDisplayToggle).toHaveAttribute('aria-pressed', 'true')
        await expect(materialTableToggle).toHaveAttribute('aria-pressed', 'true')
        const [matrixToggleColors, materialToggleColors] = await Promise.all(
            [matrixDisplayToggle, materialTableToggle].map((toggle) =>
                toggle.evaluate((element) => {
                    const style = getComputedStyle(element)
                    return { color: style.color, backgroundColor: style.backgroundColor }
                })
            )
        )
        expectSameSelectedToggleTheme(
            matrixToggleColors,
            materialToggleColors,
            'Matrix display toggle must reuse the Material selected theme state'
        )
        await expect(
            page.getByTestId('interpretation-network-details-pane').getByRole('textbox', { name: 'Filter by title' })
        ).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Relations' })).toHaveCount(0)
        await expect(page.getByRole('tab', { name: 'Templates' })).toHaveCount(0)

        await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' }).click()
        const materialDialog = page.getByRole('dialog', { name: 'Add material' })
        await expect(materialDialog).toBeVisible({ timeout: 30_000 })
        await expectSemanticFieldControls(materialDialog, { longTextLabels: ['Description'] })
        await fillMaterialDialogFields(materialDialog, {
            title: createdMaterialTitle,
            description: createdMaterialDescription
        })
        const createMaterialRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesRuntimeRowsCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network material' }
        )
        await materialDialog.getByRole('button', { name: 'Create' }).click()
        expect((await createMaterialRequest).ok()).toBe(true)
        await expect(materialDialog).toHaveCount(0)
        const detailsPane = page.getByTestId('interpretation-network-details-pane')
        await expect(detailsPane.getByTestId('interpretation-network-material-table')).toBeVisible({ timeout: 30_000 })
        await expect(detailsPane.locator('.MuiDataGrid-root')).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Title' })).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Description' })).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Body' })).toHaveCount(0)
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expect(detailsPane.getByText(createdMaterialDescription)).toBeVisible()
        await expectDataGridHorizontalScrollConstrained(page, 'Interpretation Network material table')
        await expectNoDataGridTechnicalLeakage(detailsPane, {
            label: 'Interpretation Network material table',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Body/i, /\[object Object\]/i, /"blocks"/i]
        })
        await detailsPane.getByRole('columnheader', { name: 'Title' }).click()
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await detailsPane.getByRole('textbox', { name: 'Filter by title' }).fill('source')
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expect(detailsPane.getByText(/For cell/i)).toHaveCount(0)
        await detailsPane.getByRole('button', { name: 'Card view' }).click()
        await expect(detailsPane.getByTestId('interpretation-network-material-cards')).toBeVisible()
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expectNoTechnicalLeakage(detailsPane.getByTestId('interpretation-network-material-cards'), {
            label: 'Interpretation Network material cards',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Body/i, /\[object Object\]/i, /"blocks"/i]
        })
        await detailsPane.getByRole('button', { name: `Material actions: ${createdMaterialTitle}` }).click()
        await page.getByRole('menuitem', { name: 'Edit material' }).click()
        const editMaterialDialog = page.getByRole('dialog', { name: 'Edit material' })
        await expect(editMaterialDialog).toBeVisible({ timeout: 30_000 })
        await expect(editMaterialDialog.getByLabel('Body')).toHaveCount(0)
        await fillMaterialDialogFields(editMaterialDialog, {
            title: updatedMaterialTitle,
            description: updatedMaterialDescription
        })
        const editMaterialRequest = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                response.url().includes(`workspaceId=${encodeURIComponent(activeWorkspaceId)}`),
            { label: 'Editing Interpretation Network material metadata' }
        )
        await editMaterialDialog.getByRole('button', { name: 'Save' }).click()
        const editMaterialResponse = await editMaterialRequest
        expect(editMaterialResponse.ok()).toBe(true)
        const editPayload = editMaterialResponse.request().postDataJSON() as { data?: unknown }
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialTitle)).toBe(true)
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialDescription)).toBe(true)
        await expect(editMaterialDialog).toHaveCount(0)
        await expect(getMaterialOpenButton(detailsPane, updatedMaterialTitle)).toBeVisible()
        await getMaterialOpenButton(detailsPane, updatedMaterialTitle).click()
        await expect(detailsPane.getByTestId('interpretation-network-material-editor')).toBeVisible({ timeout: 30_000 })
        await expect(detailsPane.getByLabel('Title')).toHaveCount(0)
        await expect(detailsPane.getByLabel('Description')).toHaveCount(0)
        await expect(detailsPane.getByRole('tab', { name: 'English' })).toBeVisible()
        await detailsPane.getByRole('button', { name: 'Add language' }).click()
        await page.getByRole('menuitem', { name: 'Russian' }).click()
        await expect(detailsPane.getByRole('tab', { name: 'Russian' })).toBeVisible()
        await fillMaterialBlockEditor(page, detailsPane, materialBodyText)
        const saveMaterialBodyRequest = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                response.url().includes(`workspaceId=${encodeURIComponent(activeWorkspaceId)}`),
            { label: 'Saving Interpretation Network material body' }
        )
        await detailsPane.getByRole('button', { name: 'Save' }).click()
        expect((await saveMaterialBodyRequest).ok()).toBe(true)
        await expectNoTechnicalLeakage(detailsPane, {
            label: 'Interpretation Network material authoring pane',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i]
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network created structure runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i]
        })
        await detailsPane.getByRole('button', { name: 'Back to materials' }).click()
        await expect(detailsPane.getByRole('button', { name: 'Create' })).toBeVisible({ timeout: 30_000 })
        await expect(getMaterialOpenButton(detailsPane, updatedMaterialTitle)).toBeVisible()
        await applyBrowserPreferences(page, { language: 'ru' })
        await page.reload()
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Действия ячейки: E2E first child cell' }).click()
        await page.getByRole('menuitem', { name: 'Редактировать' }).click()
        const ruCellDialog = page.getByRole('dialog', { name: 'Редактировать ячейку' })
        await expect(ruCellDialog).toBeVisible({ timeout: 30_000 })
        await expectSemanticFieldControls(ruCellDialog, { longTextLabels: ['Описание'] })
        await ruCellDialog.getByRole('textbox', { name: 'Название', exact: true }).fill('')
        await ruCellDialog.getByRole('button', { name: 'Сохранить' }).click()
        await expect(ruCellDialog.getByText('Заполните это поле.')).toBeVisible()
        await expectLocalizedValidation(ruCellDialog, 'ru', { label: 'RU Interpretation Network cell validation' })
        await page.keyboard.press('Escape')
        await expect(ruCellDialog).toHaveCount(0)
        await detailsPane.getByRole('button', { name: 'Создать' }).click()
        const ruMaterialDialog = page.getByRole('dialog').first()
        await expect(ruMaterialDialog).toBeVisible({ timeout: 30_000 })
        const ruMaterialTitleField = ruMaterialDialog.getByRole('textbox', { name: 'Название' })
        await ruMaterialTitleField.fill('А'.repeat(260))
        await expect(ruMaterialTitleField).toHaveValue('А'.repeat(255))
        await expect(ruMaterialDialog.getByText('Максимальная длина: 255')).toBeVisible()
        await expect(ruMaterialDialog.getByRole('button', { name: 'Создать' })).toBeEnabled()
        await expectLocalizedValidation(ruMaterialDialog, 'ru', { label: 'RU Interpretation Network material validation' })
        await page.keyboard.press('Escape')
        await expect(ruMaterialDialog).toHaveCount(0)
        await page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Табличный вид' }).click()
        await expectMatrixTableDefaultRuntime(page, {
            locale: 'ru',
            structureName: createdStructureName,
            rootTitle: 'Вселенная'
        })
        const ruMatrixCellButton = getMatrixTable(page).getByRole('button', { name: /^Вселенная, Вселенная, 1,/ })
        await ruMatrixCellButton.focus()
        await expect(ruMatrixCellButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Создать' })).toBeVisible()
        const ruMatrixCellActions = page.getByRole('button', { name: 'Действия ячейки: Вселенная' }).first()
        await ruMatrixCellActions.focus()
        await expect(ruMatrixCellActions).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('menuitem', { name: 'Редактировать' })).toBeVisible()
        await page.keyboard.press('Escape')
        await applyBrowserPreferences(page, { language: 'en' })
        await page.reload()
        await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network created structure runtime', {
            beforeEachViewport: async () => {
                await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
                await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureName)
                await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName })
                await expectMatrixTableHorizontalScrollConstrained(page, 'Interpretation Network created structure runtime viewport')
                await getMatrixTable(page)
                    .getByRole('button', { name: /^Universe, Universe, 1,/ })
                    .click()
                await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
                const viewport = page.viewportSize()
                await attachRuntimeScreenshot(page, testInfo, `matrix-table-${viewport?.width ?? 0}x${viewport?.height ?? 0}`)
            }
        })

        await page.setViewportSize({ width: 1280, height: 900 })
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(getMaterialOpenButton(page.getByTestId('interpretation-network-details-pane'), updatedMaterialTitle)).toBeVisible()
        await getMatrixTable(page).evaluate((node) => {
            ;(node as HTMLElement).scrollLeft = 0
        })
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        const matrixScreenshot = await page.getByTestId('interpretation-network-matrix-workspace').screenshot({
            animations: 'disabled'
        })
        await testInfo.attach('interpretation-network-matrix-runtime-polish', {
            body: matrixScreenshot,
            contentType: 'image/png'
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network Material workspace tab')
        await expectMatrixTableHorizontalScrollConstrained(page, 'Interpretation Network Materials workspace tab')
        await expectNoDataGridTechnicalLeakage(page.getByTestId('interpretation-network-details-pane'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true
        })
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network Materials workspace tab', {
            beforeEachViewport: async () => {
                await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible({
                    timeout: 30_000
                })
                await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Table view' }).click()
                await expect(page.getByTestId('interpretation-network-details-pane').locator('.MuiDataGrid-root')).toBeVisible()
            }
        })

        expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'Interpretation Network imported snapshot flow')
    })
})
