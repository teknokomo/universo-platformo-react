// Focused helpers for the imported Interpretation Network snapshot flow.

import { expect } from '../../fixtures/test'

import type { Locator, Page, TestInfo } from '@playwright/test'

import { expectNoPageHorizontalOverflow, expectRuntimeNavigationIconSemantics } from '../../support/browser/runtimeUx'

export const expectInterpretationNetworkStartPage = async (page: Page): Promise<void> => {
    const menu = getVisibleRuntimeNavigation(page)
    const locale = (await page.locator('html').getAttribute('lang'))?.toLowerCase()
    const labels = locale?.startsWith('ru')
        ? {
              welcome: 'Добро пожаловать',
              start: 'Начало',
              structures: 'Структуры',
              workspaces: 'Рабочие пространства',
              dashboard: 'Дашборд',
              access: 'Доступ',
              settings: 'Настройки',
              defaultHub: 'Основной',
              intro: 'Трактовочная сеть помогает создавать иерархию структур, ячеек, связей и материалов Editor.js для анализа смыслов в разных контекстах.'
          }
        : {
              welcome: 'Welcome',
              start: 'Start',
              structures: 'Structures',
              workspaces: 'Workspaces',
              dashboard: 'Dashboard',
              access: 'Access',
              settings: 'Settings',
              defaultHub: 'Main',
              intro: 'The interpretation network helps build a hierarchy of structures, cells, relations, and Editor.js materials for analyzing meanings across contexts.'
          }
    const navigationLabels = [labels.start, labels.structures, labels.dashboard, labels.access, labels.settings]
    await expect(menu).toBeVisible()
    const startPage = menu.getByRole('link', { name: labels.start, exact: true })
    const structures = menu.getByRole('link', { name: labels.structures, exact: true })
    await expect(startPage).toBeVisible()
    await expect(startPage).not.toHaveAttribute('aria-current', 'page')
    await expect(structures).toBeVisible()
    await expect(menu.getByRole('heading', { name: labels.defaultHub, exact: true })).toHaveCount(0)
    await expect(menu.getByRole('link')).toHaveText(navigationLabels)
    await expect(menu.getByRole('link', { name: labels.welcome, exact: true })).toHaveCount(0)
    await expect(menu.getByRole('link', { name: labels.workspaces, exact: true })).toHaveCount(0)
    await expectRuntimeNavigationIconSemantics(menu, [
        { label: labels.start, family: 'home' },
        { label: labels.structures, family: 'structures' },
        { label: labels.dashboard, family: 'dashboard' },
        { label: labels.access, family: 'access' },
        { label: labels.settings, family: 'settings' }
    ])
    const main = page.getByRole('main')
    await expect(main).toContainText(labels.intro)
    await expect(main.getByRole('heading', { name: /^(?:Interpretation Network|Трактовочная сеть|Сеть интерпретаций)$/u })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)

    await startPage.click()
    await expect(page).toHaveURL(/targetKind=page/)
    await expect(page).toHaveURL(/entityTypeCodename=InterpretationNetworkIntro/)
    await expect(startPage).toHaveAttribute('aria-current', 'page')
    await expect(main).toContainText(labels.intro)
    await expect(main.getByRole('heading', { name: /^(?:Interpretation Network|Трактовочная сеть|Сеть интерпретаций)$/u })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)

    await structures.click()
    await expect(page).toHaveURL(/targetKind=object/)
    await expect(page).toHaveURL(/entityTypeCodename=Structure/)
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible()
}

export const expectSingleSystemMatrixWorkspace = async (page: Page, locale: 'en' | 'ru' = 'en'): Promise<void> => {
    const labels =
        locale === 'ru'
            ? {
                  saveAsTemplate: 'Сохранить как шаблон',
                  createFromTemplate: 'Создать из шаблона',
                  create: 'Создать',
                  matrix: 'Матрица',
                  favorites: 'Избранное',
                  templates: 'Шаблоны',
                  workspaceSections: 'Разделы рабочего пространства'
              }
            : {
                  saveAsTemplate: 'Save as template',
                  createFromTemplate: 'Create from template',
                  create: 'Create',
                  matrix: 'Matrix',
                  favorites: 'Favorites',
                  templates: 'Templates',
                  workspaceSections: 'Workspace sections'
              }
    const main = page.getByRole('main')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    const structurePane = page.getByTestId('interpretation-network-structure-pane')
    await expect(page.getByTestId('interpretation-network-matrix-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(structurePane.getByRole('heading', { name: 'Structures' })).toHaveCount(0)
    await expect(structurePane.getByRole('heading', { name: 'Структуры' })).toHaveCount(0)
    await expect(structurePane.getByRole('textbox', { name: 'Filter by title' })).toHaveCount(0)
    await expect(structurePane.getByRole('textbox', { name: 'Фильтр по названию' })).toHaveCount(0)
    await expect(structurePane.getByRole('button', { name: 'Create' })).toHaveCount(0)
    await expect(structurePane.getByRole('button', { name: 'Создать' })).toHaveCount(0)
    const workspaceTabs = page
        .getByTestId('interpretation-network-matrix-workspace')
        .getByRole('tablist', { name: labels.workspaceSections, exact: true })
    await expect(workspaceTabs.getByRole('tab', { name: labels.matrix, exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab', { name: labels.favorites, exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab', { name: labels.templates, exact: true })).toBeVisible()
    await expect(workspaceTabs.getByRole('tab')).toHaveCount(3)
    await expect(structurePane.getByRole('tablist', { name: /Structure list sections|Разделы списка структур/ })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-structure-header')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Universe|Вселенная/ }).first()).toBeVisible({
        timeout: 30_000
    })
    await expect(structurePane.getByRole('button', { name: labels.saveAsTemplate })).toBeVisible()
    await expect(structurePane.getByRole('button', { name: labels.createFromTemplate })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: labels.create })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Add page' })).toHaveCount(0)
    await expect(main.getByText('Gravity', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Gravity material', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Attraction between masses', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Basic interpretation matrix', { exact: false })).toHaveCount(0)
}

export const expectMultipleStructuresWorkspace = async (page: Page, locale: 'en' | 'ru' = 'en'): Promise<void> => {
    const labels =
        locale === 'ru'
            ? { structures: 'Структуры', templates: 'Шаблоны', create: 'Создать' }
            : { structures: 'Structures', templates: 'Templates', create: 'Create' }
    const structurePane = page.getByTestId('interpretation-network-structure-pane')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-matrix-workspace')).toHaveCount(0)
    await expect(structurePane.getByRole('heading', { name: labels.structures })).toBeVisible()
    await expect(structurePane.getByRole('tab', { name: labels.templates })).toBeVisible()
    await expect(structurePane.getByRole('button', { name: labels.create, exact: true })).toBeVisible()
    await expect(structurePane.getByRole('tabpanel', { name: labels.structures })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-header')).toHaveCount(0)
}

export const expectEqualDesktopPaneWidths = async (page: Page, label: string): Promise<void> => {
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

export const getVisibleWorkspaceSwitcher = (page: Page): Locator =>
    page.getByTestId('runtime-workspace-switcher').filter({ visible: true }).first()

export const getDockedRuntimeNavigation = (page: Page): Locator =>
    page.getByTestId('runtime-side-menu-docked').getByRole('navigation').first()

export const getOverlayRuntimeNavigation = (page: Page): Locator =>
    page.getByTestId('runtime-side-menu-overlay').getByRole('navigation').first()

export const getVisibleRuntimeNavigation = (page: Page): Locator =>
    page
        .getByRole('navigation', { name: /^(?:Application navigation|Навигация приложения)$/u })
        .filter({ visible: true })
        .first()

export const getRuntimeNavigationItem = (navigation: Locator, name: string): Locator =>
    navigation.getByRole('link', { name }).or(navigation.getByRole('button', { name })).first()

export const readNavigationDrawerWidth = async (navigation: Locator): Promise<number> =>
    navigation.evaluate((node) => {
        const drawerPaper = node.closest('.MuiDrawer-paper')
        const rect = (drawerPaper ?? node).getBoundingClientRect()
        return Math.round(rect.width)
    })

export const parseCssRgba = (value: string): { red: number; green: number; blue: number; alpha: number } | null => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i)
    if (!match) return null
    return {
        red: Number(match[1]),
        green: Number(match[2]),
        blue: Number(match[3]),
        alpha: match[4] === undefined ? 1 : Number(match[4])
    }
}

export const expectSameSelectedToggleTheme = (
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

export const expectContentAlignedWithRail = async (page: Page, label: string): Promise<void> => {
    const alignment = await page.evaluate(() => {
        const content =
            document.querySelector('[data-testid="interpretation-network-details-pane"]') ??
            document.querySelector('[data-testid="runtime-main-grid"]')
        if (!content) {
            return null
        }

        const contentRect = content.getBoundingClientRect()
        return {
            contentRight: Math.round(contentRect.right),
            viewportWidth: window.innerWidth
        }
    })

    expect(alignment, `${label} content rail alignment`).not.toBeNull()
    expect(
        Math.abs((alignment?.viewportWidth ?? 0) - (alignment?.contentRight ?? 0)),
        `${label} content right rail inset`
    ).toBeLessThanOrEqual(32)
}

export const expectStructuresVisualRails = async (
    page: Page,
    label: string,
    expected: { left: number; rightInset: number }
): Promise<void> => {
    const geometry = await page.evaluate(() => {
        const structurePane = document.querySelector('[data-testid="interpretation-network-structure-pane"]')
        const detailsPane = document.querySelector('[data-testid="interpretation-network-details-pane"]')
        if (!structurePane || !detailsPane) {
            return null
        }

        const structureRect = structurePane.getBoundingClientRect()
        const detailsRect = detailsPane.getBoundingClientRect()
        return {
            structureLeft: Math.round(structureRect.left),
            detailsRight: Math.round(detailsRect.right),
            viewportWidth: window.innerWidth
        }
    })

    expect(geometry, `${label} structures visual rail geometry`).not.toBeNull()
    expect(Math.abs((geometry?.structureLeft ?? 0) - expected.left), `${label} content left rail`).toBeLessThanOrEqual(4)
    expect(
        Math.abs((geometry?.viewportWidth ?? 0) - expected.rightInset - (geometry?.detailsRight ?? 0)),
        `${label} content right rail`
    ).toBeLessThanOrEqual(4)
}

export const expectOverlayContentUsesFullRail = async (page: Page, label: string): Promise<void> => {
    const geometry = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="runtime-main-grid"]')
        if (!grid) {
            return null
        }

        const gridRect = grid.getBoundingClientRect()
        return {
            gridLeft: Math.round(gridRect.left),
            gridRight: Math.round(gridRect.right),
            viewportWidth: window.innerWidth
        }
    })

    expect(geometry, `${label} overlay geometry`).not.toBeNull()
    expect(geometry?.gridLeft, `${label} content left rail`).toBeLessThanOrEqual(32)
    expect(Math.abs((geometry?.viewportWidth ?? 0) - (geometry?.gridRight ?? 0)), `${label} content right rail`).toBeLessThanOrEqual(32)
}

export const attachRuntimeScreenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

export const expectRuntimeSideMenuModes = async (page: Page, testInfo: TestInfo): Promise<void> => {
    const viewports = [
        { name: 'desktop-1920', width: 1920, height: 1080 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'mobile-390', width: 390, height: 844 }
    ] as const

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        if (viewport.width < 900) {
            await expect(getDockedRuntimeNavigation(page)).toBeHidden()
            await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        } else {
            await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByTestId('runtime-side-menu-controls')).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
        }
        await expectNoPageHorizontalOverflow(page, `Interpretation Network wide side menu ${viewport.name}`)
        await attachRuntimeScreenshot(page, testInfo, `side-menu-wide-${viewport.name}`)
    }

    await page.setViewportSize({ width: 1920, height: 1080 })
    const wideNavigation = getDockedRuntimeNavigation(page)
    await expect(getRuntimeNavigationItem(wideNavigation, 'Start')).toBeVisible()
    await expect(getRuntimeNavigationItem(wideNavigation, 'Structures')).toBeVisible()
    expect(await readNavigationDrawerWidth(wideNavigation), 'wide side menu width').toBeGreaterThanOrEqual(220)
    await expectContentAlignedWithRail(page, 'Interpretation Network desktop content rail 1920')

    await page.getByRole('button', { name: 'Enable compact menu' }).click()
    const compactNavigation = getDockedRuntimeNavigation(page)
    await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible()
    await expect(getRuntimeNavigationItem(compactNavigation, 'Start')).toBeVisible()
    await expect(getRuntimeNavigationItem(compactNavigation, 'Structures')).toBeVisible()
    expect(await readNavigationDrawerWidth(compactNavigation), 'compact side menu width').toBeLessThan(100)
    await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network compact side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-compact-desktop-1280')

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        if (viewport.width < 900) {
            await expect(getDockedRuntimeNavigation(page)).toBeHidden()
            await expect(page.getByTestId('runtime-main-content')).toBeVisible()
        } else {
            await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByTestId('runtime-side-menu-controls')).toBeVisible({ timeout: 30_000 })
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
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Start')).toBeVisible()
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Structures')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use docked menu' })).toBeVisible()
    expect(await readNavigationDrawerWidth(overlayNavigation), 'overlay side menu width').toBeGreaterThanOrEqual(220)
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network overlay side menu 1920')
    await expectContentAlignedWithRail(page, 'Interpretation Network overlay content rail 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-desktop-1920')
    await page.getByRole('button', { name: 'Use docked menu' }).click()
    await expect(overlayNavigation).toBeHidden()
    await expect(dockedNavigation).toBeVisible()

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        if (viewport.width < 900) {
            await expect(getDockedRuntimeNavigation(page)).toBeHidden()
            await expect(page.getByTestId('runtime-main-content')).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Interpretation Network mobile runtime ${viewport.name}`)
            await attachRuntimeScreenshot(page, testInfo, `side-menu-mobile-${viewport.name}`)
            continue
        }

        await page.getByRole('button', { name: 'Use overlay menu' }).click()
        const viewportOverlayNavigation = getOverlayRuntimeNavigation(page)
        await expect(getDockedRuntimeNavigation(page)).toBeHidden()
        await expect(getRuntimeNavigationItem(viewportOverlayNavigation, 'Start')).toBeVisible({ timeout: 30_000 })
        await expect(getRuntimeNavigationItem(viewportOverlayNavigation, 'Structures')).toBeVisible({ timeout: 30_000 })
        await expectNoPageHorizontalOverflow(page, `Interpretation Network overlay side menu ${viewport.name}`)
        await attachRuntimeScreenshot(page, testInfo, `side-menu-overlay-${viewport.name}`)
        await page.getByRole('button', { name: 'Use docked menu' }).click()
        await expect(viewportOverlayNavigation).toBeHidden()
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
}

export const expectStructuresOverlayUsesFullRail = async (page: Page, testInfo: TestInfo): Promise<void> => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expectSingleSystemMatrixWorkspace(page)
    await expectStructuresVisualRails(page, 'Interpretation Network Structures wide side menu 1920', { left: 264, rightInset: 24 })
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Enable compact menu' }).click()
    await expect(page.getByRole('button', { name: 'Enable wide menu' })).toBeVisible()
    await expectSingleSystemMatrixWorkspace(page)
    await expectStructuresVisualRails(page, 'Interpretation Network Structures compact side menu 1920', { left: 96, rightInset: 24 })
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-compact-structures-desktop-1920')
    await page.getByRole('button', { name: 'Enable wide menu' }).click()
    await expect(page.getByRole('button', { name: 'Enable compact menu' })).toBeVisible()
    await expectSingleSystemMatrixWorkspace(page)
    await expect(page.getByRole('button', { name: 'Use overlay menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Use overlay menu' }).click()

    const overlayNavigation = getOverlayRuntimeNavigation(page)
    await expect(getDockedRuntimeNavigation(page)).toBeHidden()
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Start')).toBeVisible({ timeout: 30_000 })
    await expect(getRuntimeNavigationItem(overlayNavigation, 'Structures')).toBeVisible({ timeout: 30_000 })
    await expectOverlayContentUsesFullRail(page, 'Interpretation Network Structures overlay 1920')
    await expectStructuresVisualRails(page, 'Interpretation Network Structures overlay 1920', { left: 24, rightInset: 24 })
    await expectContentAlignedWithRail(page, 'Interpretation Network Structures overlay content rail 1920')
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network Structures overlay side menu')
    await attachRuntimeScreenshot(page, testInfo, 'side-menu-overlay-structures-desktop-1920')

    await page.getByRole('button', { name: 'Use docked menu' }).click()
    await expect(overlayNavigation).toBeHidden()
    await expect(getDockedRuntimeNavigation(page)).toBeVisible()
    await expectSingleSystemMatrixWorkspace(page)
}
