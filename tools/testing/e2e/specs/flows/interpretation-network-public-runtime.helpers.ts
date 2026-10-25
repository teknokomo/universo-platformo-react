import { expect } from '@playwright/test'
import type { Browser, BrowserContext, Locator, Page, Response, TestInfo } from '@playwright/test'
import { createBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { sendWithCsrf } from '../../support/backend/api-session.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectSemanticFieldControls } from '../../support/browser/runtimeUx'
import { loginThroughUi } from '../../support/browser/auth'

export const PUBLIC_RUNTIME_PATH_PATTERN = /^\/api\/v1\/public\/applications\/[^/]+\/runtime(?:\/|$)/u
export const PUBLIC_MULTILINE_CELL_DESCRIPTION = 'Public matrix description first line\nPublic matrix description second line'
const PUBLIC_EMPTY_CELL_TITLE = {
    en: 'Untitled cell',
    ru: 'Ячейка без названия'
} as const

const getPublicRuntimeLocale = async (page: Page): Promise<'en' | 'ru'> => {
    const requestedLocale = new URL(page.url()).searchParams.get('locale')?.toLowerCase()
    const documentLocale = (await page.locator('html').getAttribute('lang'))?.toLowerCase()
    return requestedLocale?.startsWith('ru') || documentLocale?.startsWith('ru') ? 'ru' : 'en'
}

export const watchPublicRuntimeServerErrors = (context: BrowserContext) => {
    const serverErrors: string[] = []
    context.on('response', (response) => {
        const pathname = new URL(response.url()).pathname
        const status = response.status()
        if (status >= 500 && status < 600 && PUBLIC_RUNTIME_PATH_PATTERN.test(pathname)) {
            serverErrors.push(`${status} ${pathname}`)
        }
    })
    return serverErrors
}

const OPAQUE_RUNTIME_HANDLE_PATTERN = /(?:rh1|pn1)\.[A-Za-z0-9_-]{20,1020}/u
const MEMBER_RUNTIME_DIALOG_VIEWPORTS = [
    { name: 'wide-desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
] as const

export const expectNoRuntimeLeakage = async (target: Locator, label: string) => {
    await expectNoTechnicalLeakage(target, { label, checkUuidSubstrings: true, checkOpaqueRuntimeHandles: true })
    const accessibilityTree = await target.ariaSnapshot()
    expect(accessibilityTree, `${label} computed accessibility text must not expose opaque runtime handles`).not.toMatch(
        OPAQUE_RUNTIME_HANDLE_PATTERN
    )
}

export const captureMemberRuntimeDialogViewports = async (
    page: Page,
    dialog: Locator,
    testInfo: TestInfo,
    label: string,
    longTextLabels: string[] = []
) => {
    for (const viewport of MEMBER_RUNTIME_DIALOG_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(dialog, `${label} remains visible at ${viewport.width}px`).toBeVisible()
        if (longTextLabels.length > 0) await expectSemanticFieldControls(dialog, { longTextLabels })
        await expectNoRuntimeLeakage(dialog, `${label} dialog at ${viewport.width}px`)
        await expectNoPageHorizontalOverflow(page, `${label} at ${viewport.width}px`)
        await attachRuntimeScreenshot(page, testInfo, `interpretation-network-${label}-${viewport.name}`)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
}

export const openPublicSystemMatrix = async (page: Page) => {
    const locale = await getPublicRuntimeLocale(page)
    const structurePane = page.getByTestId('interpretation-network-structure-pane')
    const systemStructureName = locale === 'ru' ? 'Системная структура' : 'System structure'
    const systemStructure = structurePane.getByRole('button', { name: systemStructureName, exact: true })
    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    await expect
        .poll(async () => (await matrix.isVisible()) || (await systemStructure.isVisible()), {
            message: 'The public workspace renders either its single-system Matrix or its Structure table'
        })
        .toBe(true)
    const matrixAlreadyVisible = await matrix.isVisible()
    const materialsResponsePromise = matrixAlreadyVisible ? null : waitForPublicMaterialsResponse(page)
    if (!matrixAlreadyVisible) {
        await expect(systemStructure, 'The public Structure table contains the seeded system Structure').toBeVisible()
        await systemStructure.click()
    }
    await expect(matrix).toBeVisible({ timeout: 30_000 })
    const rootCellButton = matrix.getByRole('button', { name: /,\s*Universe$/u })
    await expect(rootCellButton, 'The shared Matrix exposes the seeded Universe cell as a selectable button').toHaveCount(1)
    await expect(rootCellButton).toBeVisible()
    await expect(rootCellButton, 'The public viewer selects the single root cell by default').toHaveAttribute('aria-pressed', 'true')
    const materialsResponse = materialsResponsePromise ? await materialsResponsePromise : null
    if (materialsResponse) {
        expect(materialsResponse.status, 'Selecting the public system structure loads its materials through the read endpoint').toBe(200)
    }
    const multilineDescription = matrix
        .getByTestId('interpretation-network-cell-description')
        .filter({ hasText: 'Public matrix description first line' })
    await expect(multilineDescription, 'Public Matrix descriptions preserve user-entered line breaks').toBeVisible()
    await expect.poll(() => multilineDescription.evaluate((element) => element.textContent)).toBe(PUBLIC_MULTILINE_CELL_DESCRIPTION)
    await expect(multilineDescription).toHaveCSS('white-space', 'pre-wrap')
    return { matrix, materialsResponse }
}

export const readPageResponseSnapshot = async (response: Response) => ({
    status: response.status(),
    body: await response.text()
})

export const waitForPageResponseSnapshot = (page: Page, predicate: (response: Response) => boolean) =>
    page.waitForResponse(predicate).then(readPageResponseSnapshot)

export const waitForPublicMaterialsResponse = (page: Page) =>
    waitForPageResponseSnapshot(page, (response) => {
        const url = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            url.pathname.includes('/runtime/widgets/') &&
            url.pathname.endsWith('/interpretation-network') &&
            url.searchParams.get('view') === 'materials'
        )
    })

export const expectPublicDashboardShell = async (page: Page) => {
    const mainContent = page.getByRole('main')
    await expect(mainContent, 'Anonymous runtime uses the same semantic Dashboard main region as authenticated applications').toHaveCount(1)
    await expect(mainContent).toBeVisible()
    await expect(page.getByTestId('runtime-main-content'), 'The canonical Dashboard content grid is mounted').toBeVisible()
    const applicationNavigation = page.getByRole('navigation', { name: /^(?:Application navigation|Навигация приложения)$/u })
    const viewportWidth = page.viewportSize()?.width ?? 1280
    const locale = (await page.locator('html').getAttribute('lang'))?.toLowerCase()
    const firstConfiguredMenuItem = locale?.startsWith('ru') ? 'Начало' : 'Start'
    if (viewportWidth < 900) {
        await expect(
            page.getByTestId('runtime-side-menu-docked'),
            'The docked Dashboard menu is hidden at the mobile breakpoint'
        ).toBeHidden()
        const openMenuButton = page.getByRole('button', { name: /^(?:Open menu|Открыть меню)$/u })
        await expect(openMenuButton, 'The mobile Dashboard provides its canonical menu trigger').toBeVisible()
        await openMenuButton.click()
        await expect(applicationNavigation, 'The canonical mobile drawer renders application navigation when opened').toBeVisible()
        await expect(applicationNavigation.getByRole('link', { name: firstConfiguredMenuItem, exact: true })).toBeVisible()
        await expect(applicationNavigation.getByRole('link'), 'Anonymous navigation exposes only its first configured item').toHaveCount(1)
        await expect(applicationNavigation, 'Mobile application navigation is unique while open').toHaveCount(1)
        await expectNoPageHorizontalOverflow(page, 'Public mobile navigation drawer')
        await page.keyboard.press('Escape')
        await expect(applicationNavigation, 'The mobile application navigation closes with Escape').toBeHidden()
    } else {
        await expect(page.getByTestId('runtime-side-menu-docked'), 'The canonical Dashboard side menu is mounted').toBeVisible()
        await expect(applicationNavigation, 'The canonical side-menu widget renders the application navigation').toBeVisible()
        await expect(
            applicationNavigation.getByRole('link', { name: firstConfiguredMenuItem, exact: true }),
            'The public Dashboard retains the exact first configured menu item'
        ).toBeVisible()
        await expect(applicationNavigation.getByRole('link'), 'Anonymous navigation exposes only its first configured item').toHaveCount(1)
    }
    await expect(
        mainContent.getByRole('heading', { name: /^(?:Interpretation Network|Трактовочная сеть|Сеть интерпретаций)$/u }),
        'The public Start page does not repeat the application name as a central heading'
    ).toHaveCount(0)
    await expect(page.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
    await expect(
        mainContent.getByRole('button', {
            name: /^(?:Create|Add|Edit|Delete|Save|Save as template|Settings|Access|Post|Run action|Favorite|Favorites|Move|Copy|Publish|Создать|Добавить|Изменить|Редактировать|Удалить|Сохранить|Сохранить в шаблон|Настройки|Доступ|Опубликовать|Выполнить действие|Избранное|Переместить|Копировать)(?=$|\s|:)/iu
        })
    ).toHaveCount(0)
    await expectNoRuntimeLeakage(page.locator('body'), 'Public Dashboard shell')
}

export const expectPublicInterpretationNetworkWorkspace = async (page: Page) => {
    const mainContent = page.getByRole('main')
    const structurePane = mainContent.getByTestId('interpretation-network-structure-pane')
    await expect(structurePane, 'The Structures route renders the shared Interpretation Network workspace').toBeVisible()
    const workspaceContent = structurePane
        .getByTestId('interpretation-network-matrix-workspace')
        .or(structurePane.getByTestId('interpretation-network-structure-table'))
        .or(structurePane.getByTestId('interpretation-network-structure-cards'))
    await expect(workspaceContent, 'The public workspace uses its actual Matrix or Structure view').toBeVisible()
    await expect(
        mainContent.getByRole('button', {
            name: /^(?:Create|Add|Edit|Delete|Save|Save as template|Settings|Access|Post|Run action|Favorite|Favorites|Move|Copy|Publish|Cell actions:|Material actions:|Language actions:|Создать|Добавить|Изменить|Редактировать|Удалить|Сохранить|Сохранить в шаблон|Настройки|Доступ|Опубликовать|Выполнить действие|Избранное|Переместить|Копировать|Действия ячейки:|Действия материала:)(?=$|\s|:)/iu
        })
    ).toHaveCount(0)
    const documentLocale = (await page.locator('html').getAttribute('lang'))?.toLowerCase()
    const listFilterLabel = documentLocale?.startsWith('ru') ? 'Фильтр по названию' : 'Filter by title'
    const materialsPane = mainContent.getByTestId('interpretation-network-details-pane')
    let visibleFilterCount = 0
    for (const [regionName, region] of [
        ['Structure', structurePane],
        ['Materials', materialsPane]
    ] as const) {
        const regionFilterCount = await region.getByRole('textbox', { name: listFilterLabel, exact: true }).count()
        expect(regionFilterCount, `At most one localized filter may be present in the ${regionName} list`).toBeLessThanOrEqual(1)
        visibleFilterCount += regionFilterCount
    }
    await expect(
        mainContent.getByRole('textbox'),
        'The public viewer exposes only localized list filters and no editable record fields'
    ).toHaveCount(visibleFilterCount)
    await expect(mainContent.getByRole('menuitem'), 'The public viewer does not expose authoring menus').toHaveCount(0)
    await expect(mainContent.getByRole('columnheader', { name: /^(?:Actions|Действия)$/iu })).toHaveCount(0)
    await expect(mainContent.getByRole('button', { name: /^(?:Drag cell|Перетащить ячейку)$/iu })).toHaveCount(0)
    await expectNoRuntimeLeakage(page.locator('body'), 'Public Interpretation Network semantic shell')
}

export const expectPublicNoWorkspacesState = async (page: Page, locale: 'en' | 'ru' = 'en') => {
    const copy =
        locale === 'ru'
            ? { message: 'В этом публичном приложении пока нет доступных общих рабочих пространств.' }
            : { message: 'This public application has no shared workspace available yet.' }
    const emptyState = page.getByTestId('public-interpretation-network-empty-state')
    const runtimeContent = page.getByTestId('runtime-main-content')
    await expect(emptyState, 'The public entry renders its dedicated empty state when no Workspace is shared').toBeVisible()
    await expect(emptyState.getByRole('heading'), 'The no-workspace state must not render an unrelated application title').toHaveCount(0)
    await expect(emptyState.getByRole('alert'), 'The empty state exposes one localized, accessible status message').toHaveText(copy.message)
    await expect(runtimeContent, 'The canonical Dashboard content region hosts the public empty state').toBeVisible()
    await expect(runtimeContent.getByTestId('public-interpretation-network-empty-state')).toHaveCount(1)
    const mainContent = page.getByRole('main')
    await expect(mainContent, 'The public page keeps the regular Dashboard main landmark').toHaveCount(1)
    await expect(mainContent).toContainText(copy.message)
    await expect(page.getByTestId('runtime-header'), 'The public application retains its configured runtime header').toBeVisible()
    await expect(page).not.toHaveURL(/\/auth(?:\?|$)/u)
    await expect(runtimeContent.getByRole('textbox')).toHaveCount(0)
    await expect(
        runtimeContent.getByRole('button', {
            name: /^(?:Create|Add|Edit|Delete|Save|Save as template|Settings|Access|Post|Run action|Favorite|Favorites|Move|Copy|Publish|Cell actions:|Material actions:|Создать|Добавить|Изменить|Редактировать|Удалить|Сохранить|Сохранить в шаблон|Настройки|Доступ|Опубликовать|Выполнить действие|Избранное|Переместить|Копировать|Действия ячейки:|Действия материала:)(?=$|\s|:)/iu
        })
    ).toHaveCount(0)
    await expect(runtimeContent.getByRole('menuitem')).toHaveCount(0)
    await expect(page.getByTestId('runtime-workspace-switcher')).toHaveCount(0)
    const applicationNavigation = page.getByRole('navigation', { name: /^(?:Application navigation|Навигация приложения)$/u })
    const viewportWidth = page.viewportSize()?.width ?? 1280
    if (viewportWidth < 900) {
        await expect(page.getByTestId('runtime-side-menu-docked')).toBeHidden()
        const openMenuButton = page.getByRole('button', { name: /^(?:Open menu|Открыть меню)$/u })
        await expect(openMenuButton, 'The mobile public app keeps the canonical Dashboard menu trigger').toBeVisible()
        await openMenuButton.click()
        await expect(applicationNavigation, 'The mobile public Dashboard opens its application navigation').toBeVisible()
        await expect(applicationNavigation.getByRole('link').first()).toBeVisible()
        await expect(applicationNavigation.getByRole('link')).toHaveCount(1)
        await page.keyboard.press('Escape')
        await expect(applicationNavigation).toBeHidden()
    } else {
        await expect(page.getByTestId('runtime-side-menu-docked')).toBeVisible()
        await expect(applicationNavigation, 'The public app uses the normal Dashboard application navigation').toBeVisible()
        await expect(applicationNavigation.getByRole('link').first()).toBeVisible()
        await expect(applicationNavigation.getByRole('link')).toHaveCount(1)
    }
    await expectNoRuntimeLeakage(page.locator('body'), 'Public Dashboard without a shared Workspace')
}

export const expectPublicMatrixReadOnly = async (page: Page, matrix: Locator) => {
    const locale = await getPublicRuntimeLocale(page)
    const syntheticCellTitle = PUBLIC_EMPTY_CELL_TITLE[locale]
    await expect(matrix, `The ${locale} public Matrix does not render a synthetic untitled-cell title`).not.toContainText(
        syntheticCellTitle
    )
    expect(
        await matrix.ariaSnapshot(),
        `The ${locale} public Matrix accessibility tree does not expose a synthetic untitled-cell title`
    ).not.toContain(syntheticCellTitle)
    const toolbar = page.getByTestId('interpretation-network-matrix-toolbar')
    await expect(toolbar, 'The public viewer preserves the configured, read-only Matrix display controls').toBeVisible()
    await expect(
        toolbar.getByRole('button', {
            name: /^(?:Table view|Horizontal rows|Vertical tree|Табличный вид|Горизонтальные строки|Вертикальное дерево)$/u
        }),
        'Matrix display controls remain available without enabling authoring'
    ).toHaveCount(3)
    await expect(
        toolbar.getByRole('button', {
            name: /^(?:Create|Add|Save|Save as template|Edit|Delete|Создать|Добавить|Сохранить|Сохранить в шаблон|Изменить|Удалить)/iu
        })
    ).toHaveCount(0)
    await expect(
        matrix.getByRole('button', {
            name: /^(?:Create|Add|Edit|Delete|Save as template|Settings|Access|Favorite|Post|Run action|Cell actions:|Material actions:|Создать|Добавить|Изменить|Удалить|Сохранить в шаблон|Настройки|Доступ|Избранное|Опубликовать|Выполнить действие)(?=$|\s|:)/iu
        })
    ).toHaveCount(0)
}

const expectPublicMatrixVisibleAtViewport = async (page: Page, matrix: Locator) => {
    await expectPublicDashboardShell(page)
    await expectPublicInterpretationNetworkWorkspace(page)
    await expect(matrix).toBeVisible()
    const rootCellButton = matrix.getByRole('button', { name: /,\s*Universe$/u })
    await expect(rootCellButton).toBeVisible()
    await expect(rootCellButton).toHaveAttribute('aria-pressed', 'true')
    const multilineDescription = matrix
        .getByTestId('interpretation-network-cell-description')
        .filter({ hasText: 'Public matrix description first line' })
    await expect(multilineDescription).toBeVisible()
    await expect.poll(() => multilineDescription.evaluate((element) => element.textContent)).toBe(PUBLIC_MULTILINE_CELL_DESCRIPTION)
    await expect(multilineDescription).toHaveCSS('white-space', 'pre-wrap')
    await expectPublicMatrixReadOnly(page, matrix)
}

export const attachReadOnlyMatrixViewportEvidence = async (page: Page, testInfo: TestInfo, label: string) => {
    for (const viewport of [
        { name: 'wide-desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        const matrix = page.getByTestId('interpretation-network-matrix-workspace')
        await expectPublicMatrixVisibleAtViewport(page, matrix)
        await expectNoPageHorizontalOverflow(page, `${label} Matrix at ${viewport.width}px`)
        await attachRuntimeScreenshot(page, testInfo, `${label}-matrix-${viewport.name}`)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
}

export const attachRuntimeScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png'
    })
}

const expectNoUuidLeakage = (target: Locator, label: string) => expectNoTechnicalLeakage(target, { label, checkUuidSubstrings: true })

export const expectLoginScreenForUnavailablePublicReference = async (page: Page, label: string) => {
    await expect(page).toHaveURL(/\/auth(?:\?|$)/u)
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
    await expectNoUuidLeakage(page.locator('body'), label)
}

export type PublicRuntimeScenario = {
    applicationId: string
    publicEntryWorkspaceId: string
    alias: string
    secondaryAlias: string
}

export const createAnonymousBrowserContext = async (browser: Browser, testInfo: TestInfo) => {
    const baseURL = testInfo.project.use.baseURL
    if (typeof baseURL !== 'string') throw new Error('The public runtime test project must define the E2E base URL')
    const context = await browser.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light'
    })
    try {
        expect(await context.cookies()).toEqual([])
        return { baseURL, context }
    } catch (error) {
        await context.close()
        throw error
    }
}

export const watchNonGetApiRequests = (context: BrowserContext, baseUrl: string) => {
    const applicationOrigin = new URL(baseUrl).origin
    const nonGetApiRequests: string[] = []
    context.on('request', (request) => {
        const requestUrl = new URL(request.url())
        if (requestUrl.origin === applicationOrigin && requestUrl.pathname.startsWith('/api/v1/') && request.method() !== 'GET') {
            nonGetApiRequests.push(`${request.method()} ${requestUrl.pathname}`)
        }
    })
    return nonGetApiRequests
}

export const createAuthenticatedBrowserSession = async (browser: Browser, credentials: { email: string; password: string }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    try {
        const page = await context.newPage()
        await loginThroughUi(page, credentials)
        return { context, page }
    } catch (error) {
        await context.close()
        throw error
    }
}

export const setCanonicalAliasRouting = async (
    bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>>,
    applicationId: string
) => {
    const response = await sendWithCsrf(bootstrapApi, 'PATCH', `/api/v1/applications/${applicationId}/aliases/policy`, {
        routingMode: 'canonical'
    })
    if (!response.ok) {
        throw new Error(
            `Setting canonical public Interpretation Network alias routing failed with ${response.status}: ${await response.text()}`
        )
    }
}
