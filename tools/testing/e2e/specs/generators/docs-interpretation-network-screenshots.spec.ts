import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Browser, Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLocalizedContent } from '@universo-react/utils'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    RUNTIME_UX_VIEWPORT_MATRIX,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    listApplicationWorkspaces,
    listApplicationLayoutWidgets,
    listApplicationLayouts,
    sendWithCsrf,
    setApplicationPublicEntryWorkspace
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    expectNoInterpretationNetworkBrowserRegressionIssues,
    watchInterpretationNetworkBrowserRegressionIssues
} from '../../support/interpretationNetworkRuntime'
import {
    addRussianVariant,
    ensureSystemStructure,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig
} from '../../support/interpretationNetworkFocused'
import {
    expectPublicDashboardShell,
    expectPublicInterpretationNetworkWorkspace
} from '../flows/interpretation-network-public-runtime.helpers'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type Locale = 'en' | 'ru'
type ManifestEntry = {
    id: string
    filename: string
    workflowStepIds: string[]
    expectedDimensions: { width: number; height: number }
    requiredVisibleText?: Record<Locale, string[]>
    viewportMatrixRequired?: boolean
}

const DOCS_VIEWPORT = { width: 1920, height: 1080 } as const
const manifestPath = path.join(repoRoot, 'tools/docs/interpretation-network-screenshot-manifest.json')
const provenancePath = path.join(repoRoot, 'tools/docs/interpretation-network-screenshot-provenance.json')
const generatorPath = path.join(repoRoot, 'tools/testing/e2e/specs/generators/docs-interpretation-network-screenshots.spec.ts')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { screenshots: ManifestEntry[] }
const entries = new Map(manifest.screenshots.map((entry) => [entry.id, entry]))
const ID_LIKE_PATH_SEGMENT = /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=\/|$|\?)/gi
const COMMON_FORBIDDEN_VISIBLE_TEXT: Record<Locale, string[]> = {
    en: ['[object Object]', 'ParentCellId', 'OwnerId', 'TemplateOwnerId', 'MaterialRef', 'RowKey', 'ColKey'],
    ru: [
        '[object Object]',
        'ParentCellId',
        'OwnerId',
        'TemplateOwnerId',
        'MaterialRef',
        'RowKey',
        'ColKey',
        'No data to display',
        'Create element',
        'Edit element'
    ]
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const forbiddenVisibleTextPatterns = (locale: Locale): RegExp[] =>
    COMMON_FORBIDDEN_VISIBLE_TEXT[locale].map((value) => new RegExp(escapeRegExp(value), 'i'))

const viewportMatrixEvidence: Array<{
    id: string
    locale: Locale
    viewports: Array<{ name: string; width: number; height: number }>
}> = []
const captureEvidence: Array<{
    id: string
    locale: Locale
    path: string
    captureType: 'overview' | 'workflow-step'
    stepId?: string
    stepIndex?: number
    route: string
    viewport: typeof DOCS_VIEWPORT
}> = []

function getEntry(id: string): ManifestEntry {
    const entry = entries.get(id)
    if (!entry) throw new Error(`Unknown Interpretation Network docs screenshot id: ${id}`)
    return entry
}

function readPngDimensions(buffer: Buffer) {
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    }
}

function sha256(buffer: Buffer | string): string {
    return createHash('sha256').update(buffer).digest('hex')
}

function normalizeDocsRoute(page: Page): string {
    const currentUrl = new URL(page.url())
    const normalizedPath = currentUrl.pathname
        .replace(/\/public\/a\/[^/]+/g, '/public/a/{applicationId}')
        .replace(/\/a\/[^/]+/g, '/a/{applicationId}')
        .replace(ID_LIKE_PATH_SEGMENT, '/{routeId}')
    const normalizedSearch = currentUrl.search.replace(
        /([?&][^=]+=)(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=&|$)/gi,
        '$1{routeId}'
    )
    return `${normalizedPath}${normalizedSearch}`
}

async function ensureDocsAssetDirectory(locale: Locale): Promise<void> {
    await fs.mkdir(path.join(repoRoot, `docs/${locale}/.gitbook/assets/interpretation-network`), { recursive: true })
}

async function writeScreenshotProvenance(): Promise<void> {
    const assets = []
    for (const locale of ['en', 'ru'] as const) {
        for (const entry of manifest.screenshots) {
            const filenameBase = entry.filename.replace(/\.png$/, '')
            const filenames = [entry.filename, ...entry.workflowStepIds.map((_, index) => `${filenameBase}-step-${index + 1}.png`)]
            for (const filename of filenames) {
                const relativePath = `docs/${locale}/.gitbook/assets/interpretation-network/${filename}`
                const absolutePath = path.join(repoRoot, relativePath)
                const buffer = await fs.readFile(absolutePath)
                assets.push({
                    locale,
                    path: relativePath,
                    sha256: sha256(buffer),
                    dimensions: readPngDimensions(buffer)
                })
            }
        }
    }

    await fs.writeFile(
        provenancePath,
        `${JSON.stringify(
            {
                version: 1,
                generator: path.relative(repoRoot, generatorPath),
                generatorSha256: sha256(await fs.readFile(generatorPath)),
                manifest: path.relative(repoRoot, manifestPath),
                manifestSha256: sha256(await fs.readFile(manifestPath)),
                viewport: DOCS_VIEWPORT,
                viewportMatrix: viewportMatrixEvidence,
                captures: captureEvidence,
                assets
            },
            null,
            4
        )}\n`
    )
}

async function expectWholeViewportSafe(page: Page, locale: Locale, id: string): Promise<void> {
    const body = page.locator('body')
    await expectNoTechnicalLeakage(body, {
        label: `${id} ${locale} viewport`,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: forbiddenVisibleTextPatterns(locale)
    })
    await expectNoDataGridTechnicalLeakage(body, { label: `${id} ${locale} viewport`, checkUuidSubstrings: true })
    await expectNoPageHorizontalOverflow(page, `${id} ${locale}`)
}

async function captureDocsScreenshot(
    page: Page,
    locale: Locale,
    id: string,
    surface: Locator = page.locator('body'),
    filenameOverride?: string
): Promise<void> {
    const entry = getEntry(id)
    await page.setViewportSize(DOCS_VIEWPORT)
    await page.evaluate(() => document.fonts.ready)
    await waitForLayoutFrame(page)
    await expectWholeViewportSafe(page, locale, id)
    await expectNoTechnicalLeakage(surface, {
        label: `${id} ${locale} surface`,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: forbiddenVisibleTextPatterns(locale)
    })

    if (!filenameOverride) {
        for (const text of entry.requiredVisibleText?.[locale] ?? []) {
            await expect(page.getByText(text, { exact: false }).first(), `${id} ${locale} must show ${text}`).toBeVisible({
                timeout: 30_000
            })
        }
    }

    if (entry.viewportMatrixRequired && !filenameOverride) {
        await expectRuntimeUxViewportMatrix(page, `${id} ${locale}`, {
            beforeEachViewport: async () => {
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `${id} ${locale} viewport matrix`,
                    checkUuidSubstrings: true
                })
            }
        })
        viewportMatrixEvidence.push({ id, locale, viewports: RUNTIME_UX_VIEWPORT_MATRIX.map((viewport) => ({ ...viewport })) })
        await page.setViewportSize(DOCS_VIEWPORT)
    }

    await ensureDocsAssetDirectory(locale)
    const outputPath = path.join(repoRoot, `docs/${locale}/.gitbook/assets/interpretation-network/${filenameOverride ?? entry.filename}`)
    await page.screenshot({ path: outputPath, fullPage: false, animations: 'disabled' })
    const dimensions = readPngDimensions(await fs.readFile(outputPath))
    expect(dimensions, `${id} ${locale} PNG dimensions`).toEqual(entry.expectedDimensions)

    const stepIndex = filenameOverride?.match(/-step-(\d+)\.png$/)?.[1]
    const parsedStepIndex = stepIndex ? Number.parseInt(stepIndex, 10) : undefined
    captureEvidence.push({
        id,
        locale,
        path: path.relative(repoRoot, outputPath).replaceAll(path.sep, '/'),
        captureType: parsedStepIndex ? 'workflow-step' : 'overview',
        ...(parsedStepIndex ? { stepIndex: parsedStepIndex, stepId: entry.workflowStepIds[parsedStepIndex - 1] } : {}),
        route: normalizeDocsRoute(page),
        viewport: DOCS_VIEWPORT
    })
}

async function captureDocsStepScreenshot(
    page: Page,
    locale: Locale,
    id: string,
    stepIndex: number,
    surface: Locator = page.locator('body')
) {
    const entry = getEntry(id)
    const filenameBase = entry.filename.replace(/\.png$/, '')
    await captureDocsScreenshot(page, locale, id, surface, `${filenameBase}-step-${stepIndex}.png`)
}

function localized(locale: Locale, en: string, ru: string): string {
    return locale === 'en' ? en : ru
}

function matrixCellButtonByTitle(matrix: Locator, title: string): Locator {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    return matrix.getByRole('button', { name: new RegExp(`,\\s*${escapedTitle}$`, 'u') })
}

async function openStructuresForLocale(page: Page, locale: Locale): Promise<void> {
    const navigation = page
        .getByRole('navigation')
        .filter({
            has: page
                .getByRole('link', { name: localized(locale, 'Structures', 'Структуры') })
                .or(page.getByRole('button', { name: localized(locale, 'Structures', 'Структуры') }))
        })
        .filter({ visible: true })
        .first()
    await expect(navigation).toBeVisible({ timeout: 30_000 })
    await navigation
        .getByRole('link', { name: localized(locale, 'Structures', 'Структуры') })
        .or(navigation.getByRole('button', { name: localized(locale, 'Structures', 'Структуры') }))
        .first()
        .click()
}

async function expectSingleSystemMatrixForLocale(page: Page, locale: Locale): Promise<void> {
    const matrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(matrixWorkspace).toBeVisible({ timeout: 30_000 })
    const workspaceSections = matrixWorkspace.getByRole('tablist', {
        name: localized(locale, 'Workspace sections', 'Разделы рабочего пространства'),
        exact: true
    })
    for (const label of [
        localized(locale, 'Matrix', 'Матрица'),
        localized(locale, 'Favorites', 'Избранное'),
        localized(locale, 'Templates', 'Шаблоны')
    ]) {
        await expect(workspaceSections.getByRole('tab', { name: label, exact: true })).toBeVisible()
    }
    await expect(workspaceSections.getByRole('tab')).toHaveCount(3)
    await expect(page.getByRole('button', { name: /Universe|Вселенная/ }).first()).toBeVisible({ timeout: 30_000 })
}

async function expectMultipleStructuresForLocale(page: Page, locale: Locale): Promise<void> {
    const pane = page.getByTestId('interpretation-network-structure-pane')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-matrix-workspace')).toHaveCount(0)
    await expect(pane.getByRole('heading', { name: localized(locale, 'Structures', 'Структуры') })).toBeVisible()
    await expect(pane.getByRole('tab', { name: localized(locale, 'Templates', 'Шаблоны') })).toBeVisible()
    await expect(pane.getByRole('button', { name: localized(locale, 'Create', 'Создать'), exact: true })).toBeVisible()
    await expect(pane.getByRole('grid').getByRole('row').nth(1)).toContainText(localized(locale, 'System structure', 'Системная структура'))
}

async function waitForCellCreateResponse(page: Page, applicationId: string) {
    return waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells`,
        { label: 'Creating an Interpretation Network docs cell', timeout: 30_000 }
    )
}

async function openAddCellDialog(page: Page, locale: Locale): Promise<Locator> {
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await matrixPane
        .getByRole('button', { name: /Universe|Вселенная/ })
        .first()
        .click()
    const detailsPane = page.getByTestId('interpretation-network-details-pane')
    const backToMaterials = detailsPane.getByRole('button', {
        name: localized(locale, 'Back to materials', 'К материалам')
    })
    if ((await backToMaterials.count()) > 0) await backToMaterials.click()
    await expect(detailsPane.getByText(localized(locale, 'Materials', 'Материалы'), { exact: true })).toBeVisible()
    await matrixPane
        .getByRole('button', { name: localized(locale, 'Add', 'Добавить'), exact: true })
        .first()
        .click()
    const dialog = page.getByRole('dialog', { name: localized(locale, 'Add cell', 'Добавить ячейку') })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(dialog, { longTextLabels: [localized(locale, 'Description', 'Описание')] })
    return dialog
}

async function createCellThroughUi(
    page: Page,
    locale: Locale,
    applicationId: string,
    parentTitle: string,
    cellTitle: string
): Promise<void> {
    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    const parentCell = matrixCellButtonByTitle(matrix, parentTitle)
    await expect(parentCell, `The Matrix contains exactly one parent cell titled “${parentTitle}”`).toHaveCount(1)
    await expect(parentCell).toBeVisible({ timeout: 30_000 })
    await parentCell.click()
    await expect(parentCell, `The selected parent cell is “${parentTitle}”`).toHaveAttribute('aria-pressed', 'true')
    await matrix
        .getByRole('button', { name: localized(locale, 'Add', 'Добавить'), exact: true })
        .first()
        .click()

    const dialog = page.getByRole('dialog', { name: localized(locale, 'Add cell', 'Добавить ячейку') })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog.getByRole('textbox', { name: localized(locale, 'Title', 'Название'), exact: true }).fill(cellTitle)
    await dialog
        .getByRole('textbox', { name: localized(locale, 'Description', 'Описание') })
        .fill(localized(locale, `Created for the ${cellTitle} guide branch.`, `Создано для ветки руководства «${cellTitle}».`))
    const responsePromise = waitForCellCreateResponse(page, applicationId)
    await dialog.getByRole('button', { name: localized(locale, 'Create', 'Создать'), exact: true }).click()
    expect((await responsePromise).ok(), `Creating guide cell ${cellTitle}`).toBe(true)
    await expect(dialog).toHaveCount(0, { timeout: 30_000 })
    await expect(matrixCellButtonByTitle(matrix, cellTitle), `The Matrix renders the new cell titled “${cellTitle}”`).toBeVisible({
        timeout: 30_000
    })
}

async function createMaterialThroughUi(
    page: Page,
    locale: Locale,
    applicationId: string,
    title: string,
    description: string
): Promise<void> {
    const detailsPane = page.getByTestId('interpretation-network-details-pane')
    await detailsPane.getByRole('button', { name: localized(locale, 'Create', 'Создать') }).click()
    const dialog = page.getByRole('dialog', { name: localized(locale, 'Add material', 'Добавить материал') })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(dialog, { longTextLabels: [localized(locale, 'Description', 'Описание')] })
    await dialog.getByRole('textbox', { name: localized(locale, 'Title', 'Название'), exact: true }).fill(title)
    await dialog.getByRole('textbox', { name: localized(locale, 'Description', 'Описание') }).fill(description)
    const responsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials`,
        { label: 'Creating an Interpretation Network docs material', timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: localized(locale, 'Create', 'Создать') }).click()
    expect((await responsePromise).ok()).toBe(true)
    await expect(dialog).toHaveCount(0, { timeout: 30_000 })
    await expect(detailsPane.getByText(title, { exact: false })).toBeVisible({ timeout: 30_000 })
}

async function openSaveTemplateDialog(page: Page, locale: Locale): Promise<Locator> {
    await page
        .getByTestId('interpretation-network-structure-pane')
        .getByRole('button', { name: localized(locale, 'Save as template', 'Сохранить как шаблон') })
        .click()
    const dialog = page.getByRole('dialog', {
        name: localized(locale, 'Save structure as template', 'Сохранить структуру как шаблон')
    })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(dialog, { longTextLabels: [localized(locale, 'Description', 'Описание')] })
    return dialog
}

async function openApplicationMatrixSettings(page: Page, locale: Locale, applicationId: string): Promise<void> {
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: localized(locale, 'Application Settings', 'Настройки приложения') })).toBeVisible({
        timeout: 30_000
    })
    await page.getByRole('tab', { name: localized(locale, 'Matrix', 'Матрица') }).click()
    await expect(page.getByRole('tab', { name: localized(locale, 'Matrix', 'Матрица') })).toHaveAttribute('aria-selected', 'true')
}

async function openPublishedApplication(page: Page, locale: Locale, applicationId: string): Promise<void> {
    await page.goto(`/a/${applicationId}`)
    const desktopWorkspaceSwitcher = page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
    await expect(desktopWorkspaceSwitcher).toBeVisible({ timeout: 30_000 })
    await expect(
        desktopWorkspaceSwitcher.getByRole('combobox', {
            name: localized(locale, 'Switch workspace', 'Переключить пространство')
        })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: localized(locale, 'Start', 'Начало') })).toBeVisible({ timeout: 30_000 })
}

async function preparePublicEntryWorkspace(api: ApiContext, applicationId: string, locale: Locale): Promise<void> {
    const workspaceList = await listApplicationWorkspaces(api, applicationId)
    const sharedWorkspace = (workspaceList?.items ?? []).find(
        (workspace: Record<string, unknown>) => workspace.workspaceType !== 'personal' && !workspace.personalUserId
    ) as { id?: string } | undefined
    const createdWorkspace = sharedWorkspace
        ? undefined
        : await createApplicationWorkspace(api, applicationId, {
              name: createLocalizedContent(locale, localized(locale, 'Public guide workspace', 'Публичное пространство руководства')),
              description: createLocalizedContent(
                  locale,
                  localized(locale, 'Read-only public guide view.', 'Публичное представление только для чтения.')
              )
          })
    const workspaceId = sharedWorkspace?.id ?? createdWorkspace?.id
    if (typeof workspaceId !== 'string') {
        throw new Error('The Interpretation Network screenshot generator could not prepare its public entry workspace')
    }

    await setApplicationPublicEntryWorkspace(api, applicationId, workspaceId)
    await ensureSystemStructure(api, applicationId, workspaceId)
}

async function captureAnonymousPublicViewerStep(
    browser: Browser,
    origin: string,
    locale: Locale,
    applicationId: string,
    testInfo: TestInfo
): Promise<void> {
    const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: locale === 'en' ? 'en-US' : 'ru-RU',
        viewport: DOCS_VIEWPORT
    })

    try {
        expect(await context.cookies(), 'The public screenshot context starts without authentication cookies').toEqual([])
        const publicPage = await context.newPage()
        const waitForPublicView = (view: string) =>
            publicPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname.includes('/runtime/widgets/') &&
                    url.pathname.endsWith('/interpretation-network') &&
                    url.searchParams.get('view') === view
                )
            })
        const dashboardResponsePromise = publicPage.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && url.pathname === `/api/v1/public/applications/${applicationId}/runtime`
        })
        const structuresResponsePromise = waitForPublicView('structures')
        await publicPage.goto(
            new URL(`/a/${applicationId}?targetKind=object&entityTypeCodename=Structure&locale=${locale}`, origin).toString()
        )
        expect((await dashboardResponsePromise).status(), 'Anonymous public dashboard projection').toBe(200)
        expect((await structuresResponsePromise).status(), 'Anonymous public Structures projection').toBe(200)
        expect(await context.cookies(), 'The populated public Dashboard remains unauthenticated').toEqual([])
        await expectPublicDashboardShell(publicPage)
        await expectPublicInterpretationNetworkWorkspace(publicPage)

        const publicStructureTable = publicPage.getByTestId('interpretation-network-structure-table')
        const publicStructureTitle = localized(locale, 'System structure', 'Системная структура')
        const publicStructureButton = publicStructureTable.getByRole('button', { name: publicStructureTitle, exact: true })
        await expect(publicStructureTable).toBeVisible()
        await expect(publicStructureButton, 'The loaded public DataGrid shows the localized structure').toBeVisible()
        await testInfo.attach(`anonymous-public-dashboard-${locale}`, {
            body: await publicPage.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await publicPage.setViewportSize({ width: viewport.width, height: viewport.height })
            await waitForLayoutFrame(publicPage)
            await expectPublicDashboardShell(publicPage)
            await expect(publicStructureButton, `Anonymous public Structures row at ${viewport.width}px`).toBeVisible()
            await expectNoDataGridTechnicalLeakage(publicStructureTable, {
                label: `Anonymous public Structures at ${viewport.width}px`,
                requireVisibleGrid: true,
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(publicPage, `Anonymous public Structures at ${viewport.width}px`)
            await publicStructureTable.locator('.MuiDataGrid-virtualScroller').evaluateAll((scrollers) => {
                for (const scroller of scrollers) (scroller as HTMLElement).scrollLeft = 0
            })
            await waitForLayoutFrame(publicPage)
            await testInfo.attach(`anonymous-public-structures-${locale}-${viewport.name}`, {
                body: await publicPage.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
        }
        await publicPage.setViewportSize(DOCS_VIEWPORT)
        await waitForLayoutFrame(publicPage)

        const interpretationsResponsePromise = waitForPublicView('interpretations')
        const matrixResponsePromise = waitForPublicView('matrix')
        await publicStructureButton.click()
        expect((await interpretationsResponsePromise).status(), 'Anonymous public Interpretations projection').toBe(200)
        expect((await matrixResponsePromise).status(), 'Anonymous public Matrix projection').toBe(200)

        const matrix = publicPage.getByTestId('interpretation-network-matrix-workspace')
        const rootCell = matrixCellButtonByTitle(matrix, 'Universe')
        await expect(matrix).toBeVisible({ timeout: 30_000 })
        await expect(rootCell, 'The anonymous public Matrix displays its actual Universe cell').toBeVisible()
        await expect(rootCell, 'The public viewer selects the root cell for reading by default').toHaveAttribute('aria-pressed', 'true')
        await expectPublicDashboardShell(publicPage)
        const editActionPattern =
            locale === 'en' ? /Add|Create|Save as template|Edit|Delete/iu : /Добавить|Создать|Сохранить как шаблон|Изменить|Удалить/iu
        await expect(publicPage.getByRole('main').getByRole('button', { name: editActionPattern })).toHaveCount(0)
        expect(await context.cookies(), 'The anonymous public view does not create an authenticated session').toEqual([])
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await publicPage.setViewportSize({ width: viewport.width, height: viewport.height })
            await waitForLayoutFrame(publicPage)
            await expect(matrix, `Anonymous public Matrix at ${viewport.width}px`).toBeVisible()
            await expect(rootCell, `The Universe cell remains available at ${viewport.width}px`).toBeVisible()
            await expect(rootCell, `The Universe cell remains selected at ${viewport.width}px`).toHaveAttribute('aria-pressed', 'true')
            await expectNoPageHorizontalOverflow(publicPage, `Anonymous public Matrix at ${viewport.width}px`)
            await testInfo.attach(`anonymous-public-matrix-${locale}-${viewport.name}`, {
                body: await publicPage.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })
        }
        await publicPage.setViewportSize(DOCS_VIEWPORT)
        await captureDocsStepScreenshot(publicPage, locale, 'getting-started', 3, publicPage.locator('body'))
    } finally {
        await context.close()
    }
}

async function selectMatrixView(page: Page, locale: Locale, en: string, ru: string): Promise<void> {
    const button = page.getByTestId('interpretation-network-matrix-workspace').getByRole('button', {
        name: localized(locale, en, ru)
    })
    await expect(button).toBeVisible({ timeout: 30_000 })
    await button.click()
}

async function captureLocaleGuide(
    page: Page,
    browser: Browser,
    api: ApiContext,
    locale: Locale,
    applicationId: string,
    metahubId: string,
    testInfo: TestInfo
): Promise<void> {
    await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
    await openPublishedApplication(page, locale, applicationId)
    await captureDocsScreenshot(page, locale, 'overview', page.getByRole('main'))
    await captureDocsStepScreenshot(page, locale, 'overview', 1, page.locator('body'))
    const structuresLayoutResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === 'GET' && url.pathname.endsWith('/runtime/effective-layout')
    })
    await openStructuresForLocale(page, locale)
    const structuresLayoutResponse = await structuresLayoutResponsePromise
    expect(structuresLayoutResponse.ok(), 'The Structures route loads its effective Dashboard layout').toBe(true)
    const structuresLayout = (await structuresLayoutResponse.json()) as {
        widgets?: Array<{ widgetKey?: string; config?: Record<string, unknown> }>
    }
    const structuresRuntimeModes = (structuresLayout.widgets ?? [])
        .filter((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
        .map((widget) => widget.config?.structureMode)
    expect(structuresRuntimeModes.length, 'The Structures route contains the Interpretation Network widget').toBeGreaterThan(0)
    expect(
        structuresRuntimeModes.every((mode) => mode === 'multiple'),
        `The Structures route uses the application-level multiple structure mode; received ${JSON.stringify(structuresRuntimeModes)}`
    ).toBe(true)
    await expectMultipleStructuresForLocale(page, locale)
    await captureDocsStepScreenshot(page, locale, 'overview', 2, page.locator('body'))

    await page.goto(`/metahub/${metahubId}`)
    await captureDocsScreenshot(page, locale, 'getting-started', page.locator('body'))
    await captureDocsStepScreenshot(page, locale, 'getting-started', 1, page.locator('body'))
    await openPublishedApplication(page, locale, applicationId)
    await captureDocsStepScreenshot(page, locale, 'getting-started', 2, page.locator('body'))
    await captureAnonymousPublicViewerStep(browser, new URL(page.url()).origin, locale, applicationId, testInfo)

    await page.goto(`/metahub/${metahubId}/publications`)
    await expect(page.getByRole('heading', { name: localized(locale, 'Publications', 'Публикации') })).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'create-and-publish', page.locator('body'))
    await captureDocsStepScreenshot(page, locale, 'create-and-publish', 1, page.locator('body'))
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: localized(locale, 'Application Settings', 'Настройки приложения') })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'create-and-publish', 2, page.locator('body'))
    await openPublishedApplication(page, locale, applicationId)
    await captureDocsStepScreenshot(page, locale, 'create-and-publish', 3, page.locator('body'))

    await openApplicationMatrixSettings(page, locale, applicationId)
    await captureDocsScreenshot(page, locale, 'application-settings', page.getByRole('main'))
    await captureDocsStepScreenshot(page, locale, 'application-settings', 1, page.locator('body'))
    await page.getByRole('combobox', { name: localized(locale, 'Structure mode', 'Режим Структур') }).click()
    await captureDocsStepScreenshot(page, locale, 'application-settings', 2, page.locator('body'))
    await page.keyboard.press('Escape')
    await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode: 'singleSystem' })
    await openApplicationMatrixSettings(page, locale, applicationId)
    await expect(page.getByTestId('application-settings-matrix-reset')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'application-settings', 3, page.locator('body'))

    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    await selectMatrixView(page, locale, 'Horizontal rows', 'Горизонтальные строки')
    await captureDocsScreenshot(page, locale, 'workspace-and-matrix', page.locator('body'))
    await selectMatrixView(page, locale, 'Table view', 'Табличный вид')
    await captureDocsStepScreenshot(page, locale, 'workspace-and-matrix', 1, page.locator('body'))
    await page
        .getByRole('button', { name: /Universe|Вселенная/ })
        .first()
        .click()
    await selectMatrixView(page, locale, 'Vertical tree', 'Вертикальное дерево')
    await captureDocsStepScreenshot(page, locale, 'workspace-and-matrix', 2, page.locator('body'))
    await selectMatrixView(page, locale, 'Horizontal rows', 'Горизонтальные строки')
    await captureDocsStepScreenshot(page, locale, 'workspace-and-matrix', 3, page.locator('body'))

    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    await selectMatrixView(page, locale, 'Vertical tree', 'Вертикальное дерево')
    const favoriteCellTitle = localized(locale, 'Emergence', 'Эмерджентность')
    await createCellThroughUi(page, locale, applicationId, 'Universe', favoriteCellTitle)
    const favoriteCell = page
        .getByTestId('interpretation-network-matrix-workspace')
        .getByRole('button')
        .filter({ hasText: favoriteCellTitle })
        .first()
    await expect(favoriteCell).toBeVisible({ timeout: 30_000 })
    await favoriteCell.click()
    await expect(favoriteCell).toBeFocused()
    await page.keyboard.press('Tab')
    const favoriteCellActions = page.getByRole('button', {
        name: localized(locale, `Cell actions: ${favoriteCellTitle}`, `Действия ячейки: ${favoriteCellTitle}`),
        exact: true
    })
    await expect(favoriteCellActions).toBeFocused()
    await page.keyboard.press('Enter')
    const addFavorite = page.getByRole('menuitem', { name: localized(locale, 'Add to favorites', 'Добавить в избранное'), exact: true })
    await expect(addFavorite).toBeVisible()
    await addFavorite.click()
    const favoritesTabList = page
        .getByTestId('interpretation-network-matrix-workspace')
        .getByRole('tablist', { name: localized(locale, 'Workspace sections', 'Разделы рабочего пространства'), exact: true })
    await favoritesTabList.getByRole('tab', { name: localized(locale, 'Favorites', 'Избранное'), exact: true }).click()
    const favoritesPanel = page
        .getByTestId('interpretation-network-matrix-workspace')
        .getByRole('tabpanel', { name: localized(locale, 'Favorites', 'Избранное'), exact: true })
    await expect(favoritesPanel).toBeVisible()
    await expect(favoritesPanel.getByText(favoriteCellTitle, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'workspace-and-matrix', 4, page.locator('body'))

    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    const addCellDialog = await openAddCellDialog(page, locale)
    await captureDocsStepScreenshot(page, locale, 'cells-and-materials', 1, page.locator('body'))
    await addCellDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(addCellDialog).toHaveCount(0, { timeout: 30_000 })
    const createdCellTitle = localized(locale, 'Emergence', 'Эмерджентность')
    await expect(page.getByRole('button', { name: new RegExp(`^\\d+/\\d+, ${escapeRegExp(createdCellTitle)}$`) })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'cells-and-materials', 2, page.locator('body'))
    await page.getByTestId('interpretation-network-matrix-workspace').getByRole('button').filter({ hasText: 'Universe' }).first().click()
    await createMaterialThroughUi(
        page,
        locale,
        applicationId,
        localized(locale, 'Guide material', 'Материал руководства'),
        localized(locale, 'A short material attached to the selected concept.', 'Короткий материал, прикреплённый к выбранному понятию.')
    )
    await captureDocsStepScreenshot(page, locale, 'cells-and-materials', 3, page.locator('body'))
    const detailsPane = page.getByTestId('interpretation-network-details-pane')
    const materialTitle = localized(locale, 'Guide material', 'Материал руководства')
    await expect(detailsPane.getByRole('heading', { name: materialTitle })).toBeVisible()
    await expect(detailsPane.getByTestId('interpretation-network-material-editor')).toBeVisible({ timeout: 30_000 })
    await detailsPane.getByRole('button', { name: localized(locale, 'Back to materials', 'К материалам') }).click()
    const materialButton = detailsPane.getByRole('button', { name: materialTitle, exact: true })
    await expect(materialButton).toBeVisible({ timeout: 30_000 })
    await materialButton.click()
    await expect(detailsPane.getByTestId('interpretation-network-material-editor')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'cells-and-materials', 4, page.locator('body'))
    await detailsPane.getByRole('button', { name: localized(locale, 'Back to materials', 'К материалам') }).click()
    await detailsPane
        .getByRole('button', {
            name: localized(locale, `Material actions: ${materialTitle}`, `Действия материала: ${materialTitle}`),
            exact: true
        })
        .click()
    await page
        .getByRole('menuitem', {
            name: localized(locale, 'Set as Primary Material', 'Сделать основным материалом'),
            exact: true
        })
        .click()
    const matrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
    await matrixWorkspace.getByRole('button').filter({ hasText: createdCellTitle }).first().click()
    await matrixWorkspace.getByRole('button').filter({ hasText: 'Universe' }).first().click()
    await expect(detailsPane.getByRole('button', { name: localized(locale, 'Back to materials', 'К материалам') })).toBeVisible()
    await expect(detailsPane.getByText(localized(locale, 'Primary Material', 'Основной материал'), { exact: true })).toBeVisible()
    await expect(detailsPane.getByText(materialTitle, { exact: true })).toBeVisible()
    await expect(detailsPane.getByTestId('interpretation-network-material-table')).toHaveCount(0)
    await captureDocsScreenshot(page, locale, 'cells-and-materials', page.locator('body'))
    await captureDocsStepScreenshot(page, locale, 'cells-and-materials', 5, page.locator('body'))

    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    const templateDialog = await openSaveTemplateDialog(page, locale)
    await captureDocsScreenshot(page, locale, 'templates', page.locator('body'))
    await captureDocsStepScreenshot(page, locale, 'templates', 1, page.locator('body'))
    await templateDialog
        .getByRole('textbox', { name: localized(locale, 'Template name', 'Название шаблона') })
        .first()
        .fill(localized(locale, 'Guide template', 'Шаблон руководства'))
    await templateDialog
        .getByRole('textbox', { name: localized(locale, 'Description', 'Описание') })
        .first()
        .fill(localized(locale, 'Reusable Matrix shape.', 'Переиспользуемая форма Матрицы.'))
    if (locale === 'en') {
        await addRussianVariant(page, templateDialog.getByRole('textbox', { name: 'Template name' }).first(), 'Шаблон руководства')
    }
    await templateDialog.getByRole('button', { name: localized(locale, 'Save', 'Сохранить') }).click()
    await expect(templateDialog).toHaveCount(0, { timeout: 30_000 })
    await page
        .getByTestId('interpretation-network-structure-pane')
        .getByRole('tab', { name: localized(locale, 'Templates', 'Шаблоны') })
        .click()
    await captureDocsStepScreenshot(page, locale, 'templates', 2, page.locator('body'))
    await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode: 'multiple' })
    const layouts = (await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string; isActive?: boolean }>
    }
    const activeLayouts = (layouts.items ?? []).filter(
        (layout): layout is { id: string; isActive: true } => typeof layout.id === 'string' && layout.isActive === true
    )
    const widgetCollections = await Promise.all(activeLayouts.map((layout) => listApplicationLayoutWidgets(api, applicationId, layout.id)))
    const configuredModes = widgetCollections
        .flatMap(
            (collection) => (collection?.items ?? []) as Array<{ widgetKey?: string; isActive?: boolean; config?: Record<string, unknown> }>
        )
        .filter((widget) => widget.widgetKey === 'interpretationNetworkWorkspace' && widget.isActive === true)
        .map((widget) => widget.config?.structureMode)
    expect(configuredModes.length, 'The active layouts expose an active Interpretation Network widget').toBeGreaterThan(0)
    expect(
        configuredModes.every((mode) => mode === 'multiple'),
        'The multiple structure mode is persisted before reload'
    ).toBe(true)
    const effectiveLayoutResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === 'GET' && url.pathname.endsWith('/runtime/effective-layout')
    })
    await page.reload()
    const effectiveLayoutResponse = await effectiveLayoutResponsePromise
    expect(effectiveLayoutResponse.ok(), 'The active Dashboard layout reloads successfully').toBe(true)
    const effectiveLayout = (await effectiveLayoutResponse.json()) as {
        widgets?: Array<{ widgetKey?: string; config?: Record<string, unknown> }>
    }
    const runtimeModes = (effectiveLayout.widgets ?? [])
        .filter((widget) => widget.widgetKey === 'interpretationNetworkWorkspace')
        .map((widget) => widget.config?.structureMode)
    expect(runtimeModes.length, 'The resolved Dashboard layout contains the Interpretation Network widget').toBeGreaterThan(0)
    expect(
        runtimeModes.every((mode) => mode === 'multiple'),
        'The resolved Dashboard mode matches the app setting'
    ).toBe(true)
    await openStructuresForLocale(page, locale)
    const createButton = page
        .getByTestId('interpretation-network-structure-pane')
        .getByRole('button', { name: localized(locale, 'Create', 'Создать'), exact: true })
    await createButton.click()
    const createStructureDialog = page.getByRole('dialog', { name: localized(locale, 'Create structure', 'Создать структуру') })
    await expect(createStructureDialog).toBeVisible({ timeout: 30_000 })
    await createStructureDialog.getByRole('tab', { name: localized(locale, 'Templates', 'Шаблоны') }).click()
    await captureDocsStepScreenshot(page, locale, 'templates', 3, page.locator('body'))
    await createStructureDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(createStructureDialog).toHaveCount(0, { timeout: 30_000 })
    await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode: 'singleSystem' })

    const branchTitle = localized(locale, 'Guide branch', 'Ветка руководства')
    const branchChildTitle = localized(locale, 'Guide branch child', 'Дочерняя ячейка ветки')
    const outsideBranchTitle = localized(locale, 'Outside guide branch', 'Вне ветки руководства')
    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    await selectMatrixView(page, locale, 'Vertical tree', 'Вертикальное дерево')
    await createCellThroughUi(page, locale, applicationId, 'Universe', branchTitle)
    await createCellThroughUi(page, locale, applicationId, branchTitle, branchChildTitle)
    await createCellThroughUi(page, locale, applicationId, 'Universe', outsideBranchTitle)
    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    const branchCell = matrixCellButtonByTitle(matrix, branchTitle)
    await expect(branchCell, 'The selected branch locator resolves to exactly the requested cell').toHaveCount(1)
    await branchCell.click()
    await expect(branchCell, 'The requested branch is selected before opening template settings').toHaveAttribute('aria-pressed', 'true')
    const selectedBranchDialog = await openSaveTemplateDialog(page, locale)
    await selectedBranchDialog.getByRole('radio', { name: localized(locale, 'Selected branch', 'Выбранную ветку'), exact: true }).check()
    await expect(
        selectedBranchDialog.getByRole('radio', { name: localized(locale, 'Selected branch', 'Выбранную ветку'), exact: true })
    ).toBeChecked()
    await expect(selectedBranchDialog).toContainText(
        localized(locale, `Selected path: Universe › ${branchTitle}`, `Выбранный путь: Universe › ${branchTitle}`)
    )
    await captureDocsStepScreenshot(page, locale, 'templates', 4, page.locator('body'))
    await selectedBranchDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(selectedBranchDialog).toHaveCount(0, { timeout: 30_000 })

    await openPublishedApplication(page, locale, applicationId)
    await openStructuresForLocale(page, locale)
    await expectSingleSystemMatrixForLocale(page, locale)
    const validationDialog = await openAddCellDialog(page, locale)
    await captureDocsScreenshot(page, locale, 'troubleshooting', page.locator('body'))
    await validationDialog.getByRole('textbox', { name: localized(locale, 'Title', 'Название'), exact: true }).fill('')
    await validationDialog.getByRole('button', { name: localized(locale, 'Create', 'Создать') }).click()
    await expectLocalizedValidation(validationDialog, locale, { label: `${locale} Interpretation Network docs validation` })
    await expect(
        validationDialog.getByText(localized(locale, 'This field is required.', 'Заполните это поле.'), { exact: true })
    ).toBeVisible()
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 1, page.locator('body'))
    await validationDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(validationDialog).toHaveCount(0, { timeout: 30_000 })
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: localized(locale, 'Application Settings', 'Настройки приложения') })).toBeVisible({
        timeout: 30_000
    })
    await page.getByRole('tab', { name: localized(locale, 'Access', 'Доступ') }).click()
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 2, page.locator('body'))
    await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode: 'singleSystem' })
    await openApplicationMatrixSettings(page, locale, applicationId)
    await expect(page.getByTestId('application-settings-matrix-reset')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 3, page.locator('body'))
}

test.describe('Interpretation Network GitBook screenshots @generator', () => {
    test('@generator interpretation network gitbook screenshots use canonical snapshot and runtime UX oracles', async ({
        browser,
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(600_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            for (const locale of ['en', 'ru'] as const) {
                const browserIssues = watchInterpretationNetworkBrowserRegressionIssues(page)
                const imported = await importInterpretationNetworkSnapshot(api, {
                    snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                    label: `interpretation-network-guide-${locale}`,
                    isPublic: true
                })
                await recordCreatedMetahub({
                    id: imported.metahub.id,
                    name: `Interpretation Network GitBook screenshots ${locale}`,
                    codename: `interpretation-network-docs-${locale}-${runManifest.runId}`
                })

                await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
                await preparePublicEntryWorkspace(api, imported.applicationId, locale)
                const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)
                const systemStructure = await sendWithCsrf(
                    api,
                    'POST',
                    `/api/v1/applications/${
                        imported.applicationId
                    }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
                    { locale }
                )
                expect(
                    systemStructure.ok,
                    `Ensuring the ${locale} system structure returned ${systemStructure.status}: ${await systemStructure.text()}`
                ).toBe(true)

                await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'multiple' })
                await captureLocaleGuide(page, browser, api, locale, imported.applicationId, imported.metahub.id, testInfo)
                expectNoInterpretationNetworkBrowserRegressionIssues(
                    browserIssues,
                    `Interpretation Network GitBook screenshot generator ${locale}`
                )
            }
            await writeScreenshotProvenance()
        } finally {
            await disposeApiContext(api)
        }
    })
})
