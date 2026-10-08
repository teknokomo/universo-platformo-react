import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { buildVLC } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectHeightsAligned } from '../../support/browser/spacing'
import {
    expectDataGridHorizontalScrollConstrained,
    expectElementFitsViewport,
    expectLocatorFitsViewport,
    expectLocatorHasNoInlineOverflow,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    RUNTIME_UX_VIEWPORT_MATRIX,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    listApplicationWorkspaces,
    sendWithCsrf,
    setApplicationDefaultWorkspace,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { importLmsSnapshotThroughUi } from '../../support/lmsSnapshotImport'
import {
    LMS_DEMO_CONTENT_NODE,
    LMS_DEMO_CONTENT_NODES,
    LMS_DEMO_QUIZ,
    LMS_DEMO_QUIZZES,
    LMS_SAMPLE_LINK,
    LMS_SECONDARY_LINK
} from '../../support/lmsFixtureContract'
import { applicationSelectors, confirmDeleteSelectors, entityDialogSelectors } from '../../support/selectors/contracts'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type Locale = 'en' | 'ru'
type ManifestEntry = {
    id: string
    filename: string
    workflowStepIds: string[]
    expectedDimensions: { width: number; height: number }
    requiredVisibleText?: Record<Locale, string[]>
    workflowStepEvidence?: Record<string, { requiredVisibleText?: Record<Locale, string[]> }>
    forbiddenVisibleText?: Record<Locale, string[]>
    viewportMatrixRequired?: boolean
}

const DOCS_VIEWPORT = { width: 1920, height: 1080 } as const
const manifestPath = path.join(repoRoot, 'tools/docs/lms-user-guide-screenshot-manifest.json')
const provenancePath = path.join(repoRoot, 'tools/docs/lms-user-guide-screenshot-provenance.json')
const generatorPath = path.join(repoRoot, 'tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { screenshots: ManifestEntry[] }
const entries = new Map(manifest.screenshots.map((entry) => [entry.id, entry]))
const ID_LIKE_PATH_SEGMENT = /\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{32})(?=\/|$|\?)/gi
const COMMON_FORBIDDEN_VISIBLE_TEXT: Record<Locale, string[]> = {
    en: [],
    ru: ['Documentation public guest workspace']
}
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
    if (!entry) {
        throw new Error(`Unknown LMS docs screenshot id: ${id}`)
    }
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

async function writeScreenshotProvenance(): Promise<void> {
    const assets = []
    for (const locale of ['en', 'ru'] as const) {
        for (const entry of manifest.screenshots) {
            const filenameBase = entry.filename.replace(/\.png$/, '')
            const filenames = [entry.filename, ...entry.workflowStepIds.map((_, index) => `${filenameBase}-step-${index + 1}.png`)]
            for (const filename of filenames) {
                const relativePath = `docs/${locale}/.gitbook/assets/lms-user-guide/${filename}`
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
                generatedAt: new Date().toISOString(),
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

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object' || !('locales' in value)) {
        return undefined
    }

    const localized = value as { _primary?: string; locales?: Record<string, { content?: string }> }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const directValue = locales[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary ? locales[localized._primary]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(locales).find((entry) => typeof entry?.content === 'string' && entry.content.length > 0)?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

async function checkQuizOption(page: Page, value: unknown, locale: Locale): Promise<void> {
    const label = readLocalizedText(value, locale)
    if (!label) {
        throw new Error(`LMS docs screenshot generator could not resolve quiz option label for locale ${locale}`)
    }

    const option = page.getByLabel(label).first()
    await expect(option, `Quiz option ${label} must be visible for ${locale}`).toBeVisible({ timeout: 30_000 })
    await option.check()
    await expect(option, `Quiz option ${label} must be checked for ${locale}`).toBeChecked()
}

async function ensureDocsAssetDirectory(locale: Locale) {
    await fs.mkdir(path.join(repoRoot, `docs/${locale}/.gitbook/assets/lms-user-guide`), { recursive: true })
}

async function expectNoDevtools(page: Page, label: string) {
    await expect(page.getByText(/TanStack Query|React Query Devtools/i), `${label} must not show query devtools text`).toHaveCount(0)
    await expect(
        page.locator('[aria-label*="React Query"], [aria-label*="TanStack"]'),
        `${label} must not show query devtools button`
    ).toHaveCount(0)
}

async function assertToolbarGeometry(page: Page, label: string) {
    const createButton = page.getByTestId(applicationSelectors.runtimeCreateButton).first()
    if (!(await createButton.isVisible().catch(() => false))) return

    await expectLocatorFitsViewport(createButton, `${label} create button`)
    await expectLocatorHasNoInlineOverflow(createButton, `${label} create button`)

    const columnsButton = page.getByRole('button', { name: /columns|колонки/i }).first()
    if (await columnsButton.isVisible().catch(() => false)) {
        await expectHeightsAligned(createButton, columnsButton)
        await expectLocatorFitsViewport(columnsButton, `${label} columns button`)
        await expectLocatorHasNoInlineOverflow(columnsButton, `${label} columns button`)
    }
}

async function expectWholeViewportSafe(page: Page, locale: Locale, id: string, forbiddenText: string[]): Promise<void> {
    const body = page.locator('body')
    await expectNoTechnicalLeakage(body, { label: `${id} ${locale} viewport`, checkUuidSubstrings: true })
    await expectNoDataGridTechnicalLeakage(body, { label: `${id} ${locale} viewport`, checkUuidSubstrings: true })
    if (forbiddenText.length > 0) {
        await expectNoVisibleTextPatterns(
            body,
            forbiddenText.map((text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
            { label: `${id} ${locale} viewport` }
        )
    }
}

async function resetAndAssertDataGridsAtLeftEdge(page: Page, label: string): Promise<void> {
    const grids = page.locator('.MuiDataGrid-root')
    const count = await grids.count()
    if (count === 0) return

    await grids.evaluateAll((nodes) => {
        for (const node of nodes) {
            const root = node as HTMLElement
            const scroller = root.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement | null
            if (scroller) {
                scroller.scrollLeft = 0
            }
        }
    })
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

    const metrics = await grids.evaluateAll((nodes) =>
        nodes
            .map((node, index) => {
                const root = node as HTMLElement
                const rootRect = root.getBoundingClientRect()
                const scroller = root.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement | null
                const firstHeader = Array.from(root.querySelectorAll('[role="columnheader"]'))
                    .map((element) => {
                        const rect = (element as HTMLElement).getBoundingClientRect()
                        const text = ((element as HTMLElement).innerText || element.textContent || '').trim()
                        return { left: rect.left, right: rect.right, width: rect.width, text }
                    })
                    .filter((header) => header.width > 0 && header.right > rootRect.left && header.left < rootRect.right)
                    .sort((left, right) => left.left - right.left)[0]

                return {
                    index,
                    visible: rootRect.width > 0 && rootRect.height > 0,
                    scrollLeft: scroller?.scrollLeft ?? 0,
                    rootLeft: rootRect.left,
                    firstHeaderLeft: firstHeader?.left ?? null,
                    firstHeaderText: firstHeader?.text ?? ''
                }
            })
            .filter((metric) => metric.visible)
    )

    for (const metric of metrics) {
        expect(metric.scrollLeft, `${label} DataGrid #${metric.index} must be captured from its left edge`).toBeLessThanOrEqual(1)
        if (metric.firstHeaderLeft !== null) {
            expect(
                metric.firstHeaderLeft,
                `${label} DataGrid #${metric.index} first visible column must not be clipped: ${metric.firstHeaderText}`
            ).toBeGreaterThanOrEqual(metric.rootLeft - 1)
        }
    }
}

async function expectBlockEditorBodyControl(dialog: Locator, locale: Locale, label: string): Promise<Locator> {
    await expect(dialog.getByText(locale === 'en' ? 'Body' : 'Содержимое').first(), `${label} body label`).toBeVisible({
        timeout: 30_000
    })
    const editorHolder = dialog.getByTestId('editorjs-block-editor').last()
    await expect(editorHolder, `${label} body editor holder`).toBeVisible({ timeout: 30_000 })
    const holderBox = await editorHolder.boundingBox()
    expect(holderBox?.height ?? 0, `${label} body editor must provide a multiline editing area`).toBeGreaterThanOrEqual(120)

    const editor = dialog.locator('[contenteditable="true"]').last()
    await expect(editor, `${label} body editor`).toBeVisible({ timeout: 30_000 })
    await expect(editor, `${label} body editor must be editable`).toHaveAttribute('contenteditable', 'true')
    return editor
}

async function expectOptionalMultilineTextControls(dialog: Locator, locale: Locale, label: string): Promise<void> {
    for (const controlLabel of [localized(locale, 'Description', 'Описание'), localized(locale, 'Notes', 'Заметки')]) {
        const control = dialog.getByLabel(controlLabel, { exact: false }).first()
        if (await control.isVisible().catch(() => false)) {
            await expectSemanticFieldControls(dialog, { longTextLabels: [controlLabel] })
        }
    }

    const bodyLabel = dialog.getByText(localized(locale, 'Body', 'Содержимое')).first()
    if (await bodyLabel.isVisible().catch(() => false)) {
        await expectBlockEditorBodyControl(dialog, locale, label)
    }
}

async function captureDocsScreenshot(
    page: Page,
    locale: Locale,
    id: string,
    surface: Locator = page.locator('body'),
    filenameOverride?: string
) {
    const entry = getEntry(id)
    await page.setViewportSize(DOCS_VIEWPORT)
    await expectNoDevtools(page, id)
    await expectNoPageHorizontalOverflow(page, id)
    await expectNoTechnicalLeakage(surface, { label: `${id} ${locale}`, checkUuidSubstrings: true })
    await expectNoDataGridTechnicalLeakage(surface, { label: `${id} ${locale}`, checkUuidSubstrings: true })
    await resetAndAssertDataGridsAtLeftEdge(page, `${id} ${locale}`)
    await assertToolbarGeometry(page, id)

    const forbidden = [...(entry.forbiddenVisibleText?.[locale] ?? []), ...COMMON_FORBIDDEN_VISIBLE_TEXT[locale]]
    await expectWholeViewportSafe(page, locale, id, forbidden)
    if (forbidden.length > 0) {
        await expectNoVisibleTextPatterns(
            surface,
            forbidden.map((text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
            { label: `${id} ${locale}` }
        )
    }

    if (!filenameOverride) {
        const required = entry.requiredVisibleText?.[locale] ?? []
        for (const text of required) {
            await expect(surface.getByText(text, { exact: false }).first(), `${id} ${locale} must show ${text}`).toBeVisible({
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
        viewportMatrixEvidence.push({
            id,
            locale,
            viewports: RUNTIME_UX_VIEWPORT_MATRIX.map((viewport) => ({ ...viewport }))
        })
        await page.setViewportSize(DOCS_VIEWPORT)
    }

    await ensureDocsAssetDirectory(locale)
    const outputPath = path.join(repoRoot, `docs/${locale}/.gitbook/assets/lms-user-guide/${filenameOverride ?? entry.filename}`)
    await page.screenshot({ path: outputPath, fullPage: false })

    const buffer = await fs.readFile(outputPath)
    const dimensions = readPngDimensions(buffer)
    expect(dimensions, `${id} ${locale} source PNG dimensions`).toEqual(entry.expectedDimensions)

    const relativePath = path.relative(repoRoot, outputPath).replaceAll(path.sep, '/')
    const stepIndex = filenameOverride?.match(/-step-(\d+)\.png$/)?.[1]
    const parsedStepIndex = stepIndex ? Number.parseInt(stepIndex, 10) : undefined
    captureEvidence.push({
        id,
        locale,
        path: relativePath,
        captureType: parsedStepIndex ? 'workflow-step' : 'overview',
        ...(parsedStepIndex
            ? {
                  stepIndex: parsedStepIndex,
                  stepId: entry.workflowStepIds[parsedStepIndex - 1]
              }
            : {}),
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
    const stepId = entry.workflowStepIds[stepIndex - 1]
    const requiredVisibleText = stepId ? entry.workflowStepEvidence?.[stepId]?.requiredVisibleText?.[locale] ?? [] : []
    for (const text of requiredVisibleText) {
        await expect(surface.getByText(text, { exact: false }).first(), `${id} ${locale} step ${stepIndex} must show ${text}`).toBeVisible({
            timeout: 30_000
        })
    }
    await captureDocsScreenshot(page, locale, id, surface, `${filenameBase}-step-${stepIndex}.png`)
}

async function clickNavigation(page: Page, label: string) {
    const navigationItem = page
        .getByRole('link', { name: label })
        .or(page.getByRole('button', { name: label }))
        .first()
    await expect(navigationItem, `Navigation item ${label}`).toBeVisible({ timeout: 30_000 })
    const href = await navigationItem.getAttribute('href')
    if (!href) {
        throw new Error(`Navigation item ${label} must expose its destination`)
    }
    const targetUrl = new URL(href, page.url())
    await navigationItem.click()
    await expect(navigationItem, `Navigation item ${label} must be selected`).toHaveAttribute('aria-current', 'page', {
        timeout: 30_000
    })
    await expect(
        page,
        `Navigation item ${label} must reach its destination while page-level reading progress may remain visible`
    ).toHaveURL(
        (currentUrl) =>
            currentUrl.pathname === targetUrl.pathname &&
            Array.from(targetUrl.searchParams.entries()).every(([key, value]) => currentUrl.searchParams.get(key) === value),
        { timeout: 30_000 }
    )
}

async function clickNavigationAndExpectText(page: Page, label: string, expectedText: string) {
    await clickNavigation(page, label)
    await expect(page.locator('main').getByText(expectedText, { exact: false }).first(), `Navigation item ${label} target`).toBeVisible({
        timeout: 30_000
    })
}

async function selectBuilderTab(page: Page, label: string, description: string) {
    const tab = page.getByRole('tab', { name: label, exact: true })
    await expect(tab, `${description} tab`).toBeVisible({ timeout: 30_000 })
    await expect(tab, `${description} tab`).toBeEnabled()
    await tab.click()
    await expect(tab, `${description} tab selection`).toHaveAttribute('aria-selected', 'true')
}

async function fillVisibleSearch(page: Page, locale: Locale, value: string) {
    const search = page
        .locator('main')
        .getByRole('textbox', { name: locale === 'en' ? /search/i : /поиск/i })
        .first()
    await expect(search, `${locale} search input must be visible`).toBeVisible({ timeout: 30_000 })
    await search.fill(value)
}

function localized(locale: Locale, en: string, ru: string): string {
    return locale === 'en' ? en : ru
}

function localizedPattern(locale: Locale, en: RegExp, ru: RegExp): RegExp {
    return locale === 'en' ? en : ru
}

async function openFirstRuntimeRowActions(page: Page, label: string): Promise<void> {
    const firstRowAction = page.getByRole('button', { name: /^(?:Actions for|Действия для) .+$/ }).first()
    await expect(firstRowAction, `${label} row action`).toBeVisible({ timeout: 30_000 })
    await firstRowAction.click()
    await expect(page.getByRole('menu'), `${label} row action menu`).toBeVisible({ timeout: 30_000 })
}

async function selectRuntimeCardView(page: Page, locale: Locale, label: string): Promise<void> {
    const cardViewButton = page.getByRole('button', {
        name: localizedPattern(locale, /card view/i, /карточками/i)
    })
    await expect(cardViewButton, `${label} card view toggle`).toBeEnabled()
    await cardViewButton.click()
    await expect(cardViewButton, `${label} card view selection`).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^(?:Actions for|Действия для) .+$/ }).first(), `${label} card actions`).toBeVisible({
        timeout: 30_000
    })
}

async function selectRuntimeRowAction(page: Page, locale: Locale, en: string, ru: string, label: string): Promise<void> {
    await page.getByRole('menuitem', { name: localized(locale, en, ru) }).click()
    await expect(page.getByRole('menu'), `${label} row action menu closed`).toHaveCount(0, { timeout: 30_000 })
}

async function confirmVisibleDelete(page: Page, label: string): Promise<void> {
    const confirmDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByTestId(confirmDeleteSelectors.confirmButton) })
        .first()
    await expect(confirmDialog, `${label} delete confirmation`).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(confirmDialog, { label: `${label} delete confirmation`, checkUuidSubstrings: true })
    await confirmDialog.getByTestId(confirmDeleteSelectors.confirmButton).click()
    await expect(confirmDialog, `${label} delete confirmation closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
}

async function openTrashRestoreDialog(page: Page, locale: Locale, label: string): Promise<Locator> {
    const restoreAction = page.getByRole('button', { name: localized(locale, 'Restore', 'Восстановить') }).first()
    await expect(restoreAction, `${label} restore action`).toBeVisible({ timeout: 30_000 })
    await restoreAction.click()
    const dialog = page.getByRole('dialog', { name: localizedPattern(locale, /Restore to project/i, /Восстановить в проект/i) })
    await expect(dialog, `${label} restore dialog`).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(dialog, { label: `${label} restore dialog`, checkUuidSubstrings: true })
    return dialog
}

async function selectTrashRestoreTarget(page: Page, locale: Locale, label: string): Promise<Locator> {
    const dialog = await openTrashRestoreDialog(page, locale, label)
    const projectPicker = dialog.getByRole('combobox', { name: localized(locale, 'Project', 'Проект') })
    await projectPicker.click()
    const projectList = page.getByRole('listbox')
    await expect(projectList, `${label} restore project choices`).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(projectList, { label: `${label} restore project choices`, checkUuidSubstrings: true })
    const projectOption = projectList.getByRole('option').first()
    await expect(projectOption, `${label} restore project choice`).toBeVisible({ timeout: 30_000 })
    const projectName = (await projectOption.innerText()).trim()
    expect(projectName, `${label} restore project name`).not.toBe('')
    await projectOption.click()
    await expect(projectPicker, `${label} selected restore project`).toContainText(projectName)
    return dialog
}

async function submitTrashRestore(page: Page, applicationId: string, locale: Locale, dialog: Locator, label: string): Promise<void> {
    const restoreResponsePromise = page.waitForResponse(
        (response) => {
            if (response.request().method() !== 'POST') return false
            const pathname = new URL(response.url()).pathname
            return pathname.startsWith(`/api/v1/applications/${applicationId}/runtime/rows/`) && pathname.endsWith('/restore')
        },
        { timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: localized(locale, 'Restore', 'Восстановить') }).click()
    const restoreResponse = await restoreResponsePromise
    expect(restoreResponse.ok(), `${label} restore request`).toBe(true)
    await expect(dialog, `${label} restore dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar'), `${label} restore completion`).toHaveCount(0, { timeout: 30_000 })
}

async function verifyRuntimeRowFormLifecycle(page: Page, locale: Locale, action: 'edit' | 'copy', label: string): Promise<void> {
    await openFirstRuntimeRowActions(page, label)
    await selectRuntimeRowAction(
        page,
        locale,
        action === 'edit' ? 'Edit' : 'Copy',
        action === 'edit' ? 'Редактировать' : 'Копировать',
        label
    )
    const dialog = page.getByRole('dialog').first()
    await expect(dialog, `${label} ${action} dialog`).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(dialog, { label: `${label} ${action} dialog`, checkUuidSubstrings: true })
    await expectOptionalMultilineTextControls(dialog, locale, `${label} ${action}`)
    await expect(dialog.getByTestId(entityDialogSelectors.submitButton), `${label} ${action} submit button`).toBeVisible({
        timeout: 30_000
    })
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog, `${label} ${action} dialog closed`).toHaveCount(0, { timeout: 30_000 })
}

async function captureDashboardGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'dashboard-overview', page.locator('main').first())
    await clickNavigation(page, labels.workspaces)
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 1, page.locator('body'))
    await page
        .getByText(locale === 'en' ? 'Main' : 'Основное')
        .first()
        .click()
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 2, page.locator('body'))
    await page.keyboard.press('Escape')
    await clickNavigation(page, labels.learningContent)
    const safetySearch = localized(locale, 'safety', 'безопасности')
    await fillVisibleSearch(page, locale, safetySearch)
    await expect(
        page.locator('main').getByText(localized(locale, 'Safety intro video', 'Вводное видео по безопасности'), { exact: false }).first(),
        `${locale} dashboard guide safety search result`
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 3, page.locator('body'))
    await clickNavigation(page, labels.reports)
    await expect(
        page.getByText(localized(locale, 'Learning Content summary', 'Сводка учебного контента'), { exact: true }).first(),
        `${locale} dashboard guide reports view`
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 4, page.locator('body'))
}

async function captureGettingAroundGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.workspaces)
    await expectElementFitsViewport(page, 'runtime-workspaces-page', `${locale} workspaces page`)
    const createWorkspaceButton = page
        .getByTestId(applicationSelectors.runtimeCreateButton)
        .or(page.getByRole('button', { name: localizedPattern(locale, /create/i, /создать/i) }))
        .first()
    await expect(createWorkspaceButton, `${locale} create workspace action`).toBeVisible({ timeout: 30_000 })
    await createWorkspaceButton.click()
    const workspaceDialog = page.getByRole('dialog').first()
    await expect(workspaceDialog, `${locale} workspace create dialog`).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'getting-around', page.locator('body'))
    await page.keyboard.press('Escape')
    if (await workspaceDialog.isVisible().catch(() => false)) {
        await workspaceDialog.getByRole('button', { name: localizedPattern(locale, /cancel/i, /отмена/i) }).click()
    }
    await expect(workspaceDialog, `${locale} workspace create dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'getting-around', 1, page.locator('body'))
    await clickNavigationAndExpectText(page, labels.courses, locale === 'en' ? 'Sections' : 'Разделы')
    await clickNavigationAndExpectText(page, labels.tracks, locale === 'en' ? 'Stages' : 'Этапы')
    await captureDocsStepScreenshot(page, locale, 'getting-around', 2, page.locator('body'))
    await clickNavigation(page, labels.learningContent)
    await fillVisibleSearch(page, locale, locale === 'en' ? 'video' : 'видео')
    await expect(
        page.locator('main').getByText(localized(locale, 'Safety intro video', 'Вводное видео по безопасности'), { exact: false }).first(),
        `${locale} getting-around video search result`
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'getting-around', 3, page.locator('body'))
    await selectRuntimeCardView(page, locale, `${locale} getting-around`)
    await captureDocsStepScreenshot(page, locale, 'getting-around', 4, page.locator('body'))
    await openFirstRuntimeRowActions(page, `${locale} getting-around`)
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Edit', 'Редактировать'), exact: true })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'getting-around', 5, page.locator('body'))
    await page.keyboard.press('Escape')
}

async function captureLearningContentGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('library-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    const tableViewButton = page.getByRole('button', { name: localized(locale, 'Table view', 'Табличный вид') })
    await expect(tableViewButton, `${locale} table view`).toHaveAttribute('aria-pressed', 'true')
    await expectDataGridHorizontalScrollConstrained(page, `${locale} Learning Content library`)
    await captureDocsScreenshot(page, locale, 'learning-content-library', surface)
    await fillVisibleSearch(page, locale, locale === 'en' ? 'course' : 'курс')
    const complianceCourseTitle = localized(locale, 'Compliance Refresh Course', 'Курс обновления требований')
    await expect(
        surface.getByText(complianceCourseTitle, { exact: false }).first(),
        `${locale} Learning Content title search result`
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 1, page.locator('body'))
    await fillVisibleSearch(page, locale, '')
    const targetFilter = surface.getByTestId('library-target-filter').getByRole('combobox')
    await targetFilter.click()
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('option', { name: localized(locale, 'Courses', 'Курсы'), exact: true }).click()
    await expect(targetFilter, `${locale} selected course filter`).toContainText(localized(locale, 'Courses', 'Курсы'))
    await expect(surface.getByText(complianceCourseTitle, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await expect(surface.getByText(localized(locale, 'Safety intro video', 'Вводное видео по безопасности'))).toHaveCount(0)
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 2, page.locator('body'))
    await targetFilter.click()
    await page.getByRole('option', { name: localized(locale, 'All types', 'Все типы'), exact: true }).click()
    await expect(surface.getByText(localized(locale, 'Safety intro video', 'Вводное видео по безопасности'))).toBeVisible({
        timeout: 30_000
    })
    await selectRuntimeCardView(page, locale, `${locale} Learning Content library`)
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 3, page.locator('body'))
    await surface.getByTestId('records-union-create-target-menu-button').click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 4, page.locator('body'))
    await page.keyboard.press('Escape')
    await openFirstRuntimeRowActions(page, `${locale} Learning Content library`)
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Edit', 'Редактировать'), exact: true })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 5, page.locator('body'))
    await page.keyboard.press('Escape')
    await verifyRuntimeRowFormLifecycle(page, locale, 'edit', `${locale} Learning Content edit lifecycle`)
    await verifyRuntimeRowFormLifecycle(page, locale, 'copy', `${locale} Learning Content copy lifecycle`)
}

async function captureProjectsGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('library-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    await fillVisibleSearch(page, locale, localized(locale, 'project', 'проект'))
    await captureDocsScreenshot(page, locale, 'projects', surface)
    await surface.getByTestId('records-union-create-target-menu-button').click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'projects', 1, page.locator('body'))
    await page.getByRole('menuitem', { name: localized(locale, 'Project', 'Проект'), exact: true }).click()
    const projectDialog = page.getByRole('dialog').first()
    await expect(projectDialog, `${locale} project create dialog`).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(projectDialog, {
        longTextLabels: [localized(locale, 'Description', 'Описание')],
        forbiddenEditableIdLabels: ['ProjectId', 'OwnerId', 'UserId']
    })
    const projectTitle = localized(locale, 'Documentation workspace project', 'Проект документации')
    const projectTitleInput = projectDialog.getByLabel(localized(locale, 'Title *', 'Заголовок *'), { exact: true })
    await projectTitleInput.fill(projectTitle)
    await expect(projectTitleInput, `${locale} project title input`).toHaveValue(projectTitle)
    await projectDialog
        .getByLabel(localized(locale, 'Description', 'Описание'), { exact: true })
        .fill(
            localized(
                locale,
                'Reusable documentation examples and learner journey checks.',
                'Повторно используемые примеры документации и проверки пути учащегося.'
            )
        )
    await captureDocsStepScreenshot(page, locale, 'projects', 2, page.locator('body'))
    await projectDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(projectDialog, `${locale} project create dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await fillVisibleSearch(page, locale, '')
    await openFirstRuntimeRowActions(page, `${locale} projects move`)
    await selectRuntimeRowAction(page, locale, 'Move to project', 'Переместить в проект', `${locale} projects move`)
    const moveDialog = page.getByRole('dialog', { name: localizedPattern(locale, /Move to project/i, /Переместить в проект/i) }).first()
    await expect(moveDialog, `${locale} move to project dialog`).toBeVisible({ timeout: 30_000 })
    const projectField = moveDialog.getByRole('combobox', { name: localized(locale, 'Project', 'Проект') })
    await projectField.click()
    await expect(page.getByRole('listbox'), `${locale} project picker list`).toBeVisible({ timeout: 30_000 })
    const projectOption = page.getByRole('option', { name: projectTitle, exact: true })
    await expect(projectOption, `${locale} created project in move dialog`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'projects', 3, page.locator('body'))
    await projectOption.click()
    await expect(projectField, `${locale} selected project`).toContainText(projectTitle)
    await captureDocsStepScreenshot(page, locale, 'projects', 4, page.locator('body'))
    const moveResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`),
        { timeout: 30_000 }
    )
    await moveDialog.getByRole('button', { name: localized(locale, 'Move to project', 'Переместить в проект') }).click()
    const moveResponse = await moveResponsePromise
    expect(moveResponse.ok(), `${locale} content move to the created project`).toBe(true)
    await expect(moveDialog, `${locale} move to project dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await openFirstRuntimeRowActions(page, `${locale} projects delete`)
    await selectRuntimeRowAction(page, locale, 'Delete', 'Удалить', `${locale} projects delete`)
    await confirmVisibleDelete(page, `${locale} projects delete`)
    await clickNavigation(page, labels.trash)
    const restoreDialog = await selectTrashRestoreTarget(page, locale, `${locale} projects`)
    await captureDocsStepScreenshot(page, locale, 'projects', 5, page.locator('body'))
    await submitTrashRestore(page, applicationId, locale, restoreDialog, `${locale} projects`)
}

async function captureResourcesGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('library-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    await surface.getByTestId('records-union-create-target-menu-button').click()
    await page.getByRole('menuitem', { name: locale === 'en' ? 'Page' : 'Страница', exact: true }).click()
    let dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(dialog, {
        forbiddenEditableIdLabels: ['ProjectId', 'OwnerId', 'UserId']
    })
    const pageBodyEditor = await expectBlockEditorBodyControl(dialog, locale, `${locale} page resource`)
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 1, dialog)
    await dialog
        .getByLabel(locale === 'en' ? 'Title *' : 'Заголовок *', { exact: true })
        .fill(locale === 'en' ? 'Operations handbook' : 'Справочник операций')
    await pageBodyEditor.fill(locale === 'en' ? 'Short operating procedure for learners.' : 'Короткая рабочая инструкция для учащихся.')
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 2, dialog)
    await dialog.getByLabel(locale === 'en' ? 'Estimated Time, min' : 'Оценочное время, мин', { exact: true }).fill('12')
    await dialog.getByLabel(locale === 'en' ? 'Title *' : 'Заголовок *', { exact: true }).focus()
    await captureDocsScreenshot(page, locale, 'resources-pages-links', dialog)
    await dialog.getByLabel(locale === 'en' ? 'Estimated Time, min' : 'Оценочное время, мин', { exact: true }).focus()
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 3, dialog)
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)

    await clickNavigation(page, labels.learningContent)
    const refreshedSurface = page.getByTestId('library-details-table').first()
    await expect(refreshedSurface).toBeVisible({ timeout: 30_000 })
    await refreshedSurface.getByTestId('records-union-create-target-menu-button').click()
    await page.getByRole('menuitem', { name: locale === 'en' ? 'Link' : 'Ссылка', exact: true }).click()
    dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog
        .getByLabel(locale === 'en' ? 'Title *' : 'Заголовок *', { exact: true })
        .fill(locale === 'en' ? 'Operations handbook' : 'Справочник операций')
    const sourceUrlField = dialog.getByLabel(locale === 'en' ? 'Source URL *' : 'URL источника *', { exact: true })
    await sourceUrlField.fill('https://example.test/training/operations-handbook')
    await expect(sourceUrlField).toHaveValue('https://example.test/training/operations-handbook')
    await expect(dialog.getByTestId(entityDialogSelectors.submitButton)).toBeEnabled()
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 4, dialog)
    await sourceUrlField.fill('example.test/training')
    await expectLocalizedValidation(dialog, locale, { label: `${locale} link validation` })
    const invalidUrlMessage = localized(locale, 'Enter an absolute http or https URL.', 'Введите абсолютный URL http или https.')
    await expect(dialog.getByText(invalidUrlMessage, { exact: true }), `${locale} visible invalid URL message`).toBeVisible()
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 5, dialog)
    await sourceUrlField.fill('https://example.test/training/operations-handbook')
    await expect(dialog.getByText(invalidUrlMessage, { exact: true }), `${locale} corrected URL validation`).toHaveCount(0)
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
}

async function captureCoursesGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    const sectionsLabel = localized(locale, 'Sections', 'Разделы')
    const courseItemsLabel = localized(locale, 'Course items', 'Элементы курса')
    await clickNavigationAndExpectText(page, labels.courses, sectionsLabel)
    await selectBuilderTab(page, sectionsLabel, `${locale} course sections`)
    await captureDocsScreenshot(page, locale, 'courses', page.locator('main').first())
    const complianceCourse = page.getByRole('tab', {
        name: localized(locale, 'Compliance Refresh Course', 'Курс обновления требований'),
        exact: true
    })
    await expect(complianceCourse, `${locale} compliance course selection`).toBeVisible({ timeout: 30_000 })
    await complianceCourse.click()
    await expect(complianceCourse).toHaveAttribute('aria-selected', 'true')
    await expect(
        page.getByText(localized(locale, 'Read the certificate policy', 'Изучите политику сертификатов'), { exact: true }).first()
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'courses', 1, page.locator('body'))
    await selectBuilderTab(page, courseItemsLabel, `${locale} course items`)
    await expect(page.getByRole('heading', { name: courseItemsLabel, exact: true })).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'courses', 2, page.locator('body'))
    const createButton = page.getByRole('button', { name: localized(locale, 'Create', 'Создать'), exact: true }).first()
    await expect(createButton, `${locale} course item create action`).toBeVisible({ timeout: 30_000 })
    await createButton.click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectOptionalMultilineTextControls(dialog, locale, `${locale} course item`)
    await captureDocsStepScreenshot(page, locale, 'courses', 3, page.locator('body'))
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    await selectBuilderTab(page, sectionsLabel, `${locale} course section actions`)
    await complianceCourse.click()
    await expect(complianceCourse).toHaveAttribute('aria-selected', 'true')
    await expect(
        page.getByText(localized(locale, 'Read the certificate policy', 'Изучите политику сертификатов'), { exact: true }).first()
    ).toBeVisible({ timeout: 30_000 })
    await openFirstRuntimeRowActions(page, `${locale} course section actions`)
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Edit', 'Редактировать'), exact: true })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'courses', 4, page.locator('body'))
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0, { timeout: 30_000 })
    await selectBuilderTab(page, localized(locale, 'Reports', 'Отчёты'), `${locale} course reports`)
    await expect(page.getByTestId('runtime-report-details-table').first(), `${locale} course report details`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'courses', 5, page.locator('body'))
}

async function captureTracksGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    const stagesLabel = localized(locale, 'Stages', 'Этапы')
    const trackStepsLabel = localized(locale, 'Track steps', 'Шаги трека')
    await clickNavigationAndExpectText(page, labels.tracks, stagesLabel)
    await selectBuilderTab(page, stagesLabel, `${locale} track stages`)
    await captureDocsScreenshot(page, locale, 'learning-tracks', page.locator('main').first())
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 1, page.locator('body'))
    await selectBuilderTab(page, trackStepsLabel, `${locale} track steps`)
    await expect(page.getByRole('heading', { name: trackStepsLabel, exact: true })).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 2, page.locator('body'))
    const createButton = page.getByRole('button', { name: localized(locale, 'Create', 'Создать'), exact: true }).first()
    await expect(createButton, `${locale} track step create action`).toBeVisible({ timeout: 30_000 })
    await createButton.click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectOptionalMultilineTextControls(dialog, locale, `${locale} track step`)
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 3, page.locator('body'))
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    const complianceTrack = page.getByRole('tab', {
        name: localized(locale, 'Compliance refresh track', 'Трек обновления требований'),
        exact: true
    })
    await expect(complianceTrack, `${locale} second learning track selection`).toBeVisible({ timeout: 30_000 })
    await complianceTrack.click()
    await expect(complianceTrack).toHaveAttribute('aria-selected', 'true')
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 4, page.locator('body'))
    await selectBuilderTab(page, localized(locale, 'Player', 'Проигрыватель'), `${locale} learning track player`)
    await selectBuilderTab(page, localized(locale, 'Reports', 'Отчёты'), `${locale} learning track reports`)
    await expect(page.getByTestId('runtime-report-details-table').first(), `${locale} track report details`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 5, page.locator('body'))
}

async function captureSharingGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('library-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    const targetFilter = surface.getByTestId('library-target-filter').getByRole('combobox')
    await targetFilter.click()
    await page.getByRole('option', { name: localized(locale, 'Resources', 'Ресурсы'), exact: true }).click()
    await expect(surface.getByText(localized(locale, 'Safety intro video', 'Вводное видео по безопасности'))).toBeVisible({
        timeout: 30_000
    })
    await captureDocsScreenshot(page, locale, 'sharing-recent-favorites-trash', surface)
    await openFirstRuntimeRowActions(page, `${locale} sharing star`)
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Add to starred', 'Добавить в избранное') })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 1, page.locator('body'))
    await selectRuntimeRowAction(page, locale, 'Add to starred', 'Добавить в избранное', `${locale} sharing star`)
    await openFirstRuntimeRowActions(page, `${locale} sharing starred state`)
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Remove from starred', 'Убрать из избранного') })).toBeVisible({
        timeout: 30_000
    })
    await selectRuntimeRowAction(page, locale, 'Share', 'Поделиться', `${locale} sharing share`)
    const shareDialog = page.getByRole('dialog', { name: localizedPattern(locale, /Share content/i, /Поделиться контентом/i) }).first()
    await expect(shareDialog, `${locale} share dialog`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 2, page.locator('body'))
    await shareDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(shareDialog, `${locale} share dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await clickNavigation(page, labels.home)
    await selectBuilderTab(page, labels.recent, `${locale} recent learning content`)
    await expect(page.getByTestId('library-details-table').first(), `${locale} recent learning content view`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 3, page.locator('body'))
    await clickNavigation(page, labels.learningContent)
    await openFirstRuntimeRowActions(page, `${locale} sharing delete`)
    await selectRuntimeRowAction(page, locale, 'Delete', 'Удалить', `${locale} sharing delete`)
    const deleteDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByTestId(confirmDeleteSelectors.confirmButton) })
        .first()
    await expect(deleteDialog, `${locale} sharing delete confirmation`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 4, page.locator('body'))
    await deleteDialog.getByTestId(confirmDeleteSelectors.confirmButton).click()
    await expect(deleteDialog, `${locale} sharing delete confirmation closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await clickNavigation(page, labels.trash)
    const restoreDialog = await selectTrashRestoreTarget(page, locale, `${locale} sharing`)
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 5, page.locator('body'))
    await submitTrashRestore(page, applicationId, locale, restoreDialog, `${locale} sharing`)
}

async function captureLearnerExperienceGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    const courseTitle = localized(locale, 'Learner Onboarding Course', 'Курс адаптации учащегося')
    const playerTabName = localized(locale, 'Player', 'Проигрыватель')
    const parentTabsLabel = localized(locale, 'Content', 'Контент')
    const learningItemsLabel = localized(locale, 'Learning items', 'Учебные материалы')
    const courseTabs = (player: Locator) => player.getByRole('tablist', { name: parentTabsLabel })
    const learningItemTabs = (player: Locator) => player.getByRole('tablist', { name: learningItemsLabel }).getByRole('tab')
    const openPlayerForCourse = async () => {
        await page.reload()
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await selectBuilderTab(page, playerTabName, `${locale} learner player`)
        const currentPlayer = page.getByTestId('runtime-learner-player')
        await expect(currentPlayer, `${locale} learner player`).toBeVisible({ timeout: 30_000 })
        const courseTab = courseTabs(currentPlayer).getByRole('tab', { name: courseTitle, exact: true })
        await expect(courseTab, `${locale} assigned course`).toBeVisible({ timeout: 30_000 })
        await courseTab.click()
        await expect(courseTab).toHaveAttribute('aria-selected', 'true')
        return currentPlayer
    }

    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.courses)
    await selectBuilderTab(page, playerTabName, `${locale} learner player`)
    let player = page.getByTestId('runtime-learner-player')
    await expect(player, `${locale} learner player`).toBeVisible({ timeout: 30_000 })
    const courseTab = courseTabs(player).getByRole('tab', { name: courseTitle, exact: true })
    await expect(courseTab, `${locale} assigned course`).toBeVisible({ timeout: 30_000 })
    const comparisonCourseTab = courseTabs(player).getByRole('tab', {
        name: localized(locale, 'Compliance Refresh Course', 'Курс обновления требований'),
        exact: true
    })
    await expect(comparisonCourseTab, `${locale} comparison course`).toBeVisible({ timeout: 30_000 })
    await comparisonCourseTab.click()
    await expect(comparisonCourseTab).toHaveAttribute('aria-selected', 'true')
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 1, page.locator('body'))
    await courseTab.click()
    await expect(courseTab).toHaveAttribute('aria-selected', 'true')
    await captureDocsScreenshot(page, locale, 'learner-experience', page.locator('main').first())
    const itemTabs = learningItemTabs(player)
    await expect(itemTabs, `${locale} course learning items`).toHaveCount(2, { timeout: 30_000 })
    await expect(itemTabs.first()).toHaveAttribute('aria-selected', 'true')
    await expect(itemTabs.nth(1), `${locale} next course item starts locked`).toBeDisabled()
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 2, page.locator('body'))

    const completeButton = player.getByRole('button', {
        name: localized(locale, 'Mark complete', 'Отметить завершенным'),
        exact: true
    })
    await expect(completeButton, `${locale} current item completion action`).toBeEnabled({ timeout: 30_000 })
    const completionResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/progress/content` &&
            response.ok(),
        { timeout: 30_000 }
    )
    await completeButton.click()
    const completionResponse = await completionResponsePromise
    const completionPayload = (await completionResponse.json()) as Record<string, unknown>
    expect(completionPayload).toMatchObject({
        persisted: true,
        targetObjectCodename: 'CourseItems',
        status: 'completed',
        progressPercent: 100
    })
    await expect(
        player.getByText(localizedPattern(locale, /Reading progress 100%/i, /Прогресс чтения 100%/i)),
        `${locale} completed item reading progress`
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 3, page.locator('body'))

    player = await openPlayerForCourse()
    const reloadedItemTabs = learningItemTabs(player)
    await expect(reloadedItemTabs.nth(1), `${locale} completion unlocks the next course item`).toBeEnabled({ timeout: 30_000 })
    await reloadedItemTabs.nth(1).click()
    await expect(reloadedItemTabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 4, page.locator('body'))

    player = await openPlayerForCourse()
    await expect(player.getByText(localized(locale, 'Completed', 'Завершено'), { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(learningItemTabs(player).nth(1), `${locale} completed progress survives reload`).toBeEnabled()
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 5, page.locator('body'))
}

async function captureKnowledgeGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.knowledge)
    const knowledgeArticlesTable = page.getByTestId('dashboard-entity-table').first()
    await expect(knowledgeArticlesTable, `${locale} Knowledge Articles table`).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'knowledge', page.locator('main').first())
    await page.getByRole('columnheader', { name: locale === 'en' ? /title/i : /заголовок/i }).click()
    await captureDocsStepScreenshot(page, locale, 'knowledge', 1, page.locator('body'))
    const createMenu = knowledgeArticlesTable.getByTestId('records-union-create-target-menu-button')
    await expect(createMenu, `${locale} Knowledge Article create menu`).toBeEnabled({ timeout: 30_000 })
    await createMenu.click()
    await page.getByRole('menuitem', { name: localized(locale, 'Article', 'Статья'), exact: true }).click()
    let dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'knowledge', 2, page.locator('body'))
    await dialog.getByLabel(localized(locale, 'Knowledge Folder', 'Папка знаний')).click()
    await page.getByRole('option', { name: /Getting started articles|Статьи для старта/i }).click()
    const articleTitle = locale === 'en' ? 'Operations handbook' : 'Справочник операций'
    await dialog.getByLabel(localized(locale, 'Title', 'Заголовок'), { exact: false }).first().fill(articleTitle)
    await captureDocsStepScreenshot(page, locale, 'knowledge', 3, page.locator('body'))
    const bodyEditor = await expectBlockEditorBodyControl(dialog, locale, `${locale} knowledge article`)
    await bodyEditor.fill(
        locale === 'en'
            ? 'Keep operating procedures short and easy to scan.'
            : 'Делайте рабочие инструкции короткими и удобными для просмотра.'
    )
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog, `${locale} saved Knowledge Article dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    const createdArticleRow = knowledgeArticlesTable.getByRole('row').filter({ hasText: articleTitle }).first()
    await expect(createdArticleRow, `${locale} saved Knowledge Article row`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'knowledge', 4, page.locator('body'))
    await createdArticleRow.getByRole('button', { name: /^(?:Actions for|Действия для) .+$/ }).click()
    await expect(page.getByRole('menu'), `${locale} saved Knowledge Article actions`).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('menuitem', { name: localized(locale, 'Edit', 'Редактировать'), exact: true })).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'knowledge', 5, page.locator('body'))
    await page.keyboard.press('Escape')
}

async function captureReportsGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.reports)
    await captureDocsScreenshot(page, locale, 'reports', page.locator('main').first())
    const firstReportRow = page.locator('main [role="row"]').nth(1)
    await expect(firstReportRow, `${locale} reports first data row`).toBeVisible({ timeout: 30_000 })
    await firstReportRow.click()
    const reportDetailsTable = page.getByTestId('runtime-report-details-table').first()
    await expect(reportDetailsTable).toBeVisible({ timeout: 30_000 })
    const titleHeader = reportDetailsTable.getByRole('columnheader', { name: locale === 'en' ? /^Title/ : /^Заголовок/ })
    const typeHeader = reportDetailsTable.getByRole('columnheader', { name: locale === 'en' ? /^Type/ : /^Тип/ })
    await expect(titleHeader).toBeVisible()
    await expect(typeHeader).toBeVisible()
    await captureDocsStepScreenshot(page, locale, 'reports', 1, page.locator('body'))
    await titleHeader.click()
    await expect(titleHeader, `${locale} report title sort state`).toHaveAttribute('aria-sort', /ascending|descending/)
    await captureDocsStepScreenshot(page, locale, 'reports', 2, page.locator('body'))
    await typeHeader.click()
    await expect(typeHeader, `${locale} report type sort state`).toHaveAttribute('aria-sort', /ascending|descending/)
    await captureDocsStepScreenshot(page, locale, 'reports', 3, page.locator('body'))
    await reportDetailsTable.getByRole('button', { name: locale === 'en' ? /export csv/i : /экспорт csv/i }).focus()
    await captureDocsStepScreenshot(page, locale, 'reports', 4, page.locator('body'))
    await clickNavigation(page, labels.learningContent)
    const librarySurface = page.getByTestId('library-details-table').first()
    await expect(librarySurface, `${locale} report source library`).toBeVisible({ timeout: 30_000 })
    const resourceFilter = librarySurface.getByTestId('library-target-filter').getByRole('combobox')
    await resourceFilter.click()
    await page.getByRole('option', { name: localized(locale, 'Resources', 'Ресурсы'), exact: true }).click()
    await expect(resourceFilter).toContainText(localized(locale, 'Resources', 'Ресурсы'))
    const reportSourceTitle = localized(locale, 'Certificate policy page', 'Страница политики сертификатов')
    await fillVisibleSearch(page, locale, reportSourceTitle)
    await expect(librarySurface.getByText(reportSourceTitle, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'reports', 5, page.locator('body'))
    await clickNavigation(page, labels.reports)
}

async function createDocsPublicWorkspace(api: ApiContext, applicationId: string): Promise<string> {
    const existingWorkspaces = await listApplicationWorkspaces(api, applicationId)
    const defaultWorkspaceId = (Array.isArray(existingWorkspaces?.items) ? existingWorkspaces.items : []).find(
        (item: Record<string, unknown>) => item?.isDefault === true || item?.workspaceType === 'personal' || item?.type === 'personal'
    )?.id
    const workspaceResponse = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/workspaces`, {
        name: buildVLC('Documentation public guest workspace', 'Публичное гостевое пространство документации')
    })
    if (!workspaceResponse.ok) {
        throw new Error(`Creating LMS docs public guest workspace failed with ${workspaceResponse.status}`)
    }

    const workspace = await workspaceResponse.json()
    if (typeof workspace?.id === 'string' && workspace.id.length > 0) {
        if (typeof defaultWorkspaceId === 'string' && defaultWorkspaceId.length > 0) {
            await setApplicationDefaultWorkspace(api, applicationId, defaultWorkspaceId)
        }
        return workspace.id
    }

    const workspaces = await listApplicationWorkspaces(api, applicationId)
    const fallbackWorkspaceId = (Array.isArray(workspaces?.items) ? workspaces.items : []).find(
        (item: Record<string, unknown>) => item?.workspaceType === 'personal' || item?.type === 'personal' || item?.isDefault === true
    )?.id
    if (typeof fallbackWorkspaceId === 'string' && fallbackWorkspaceId.length > 0) {
        return fallbackWorkspaceId
    }

    throw new Error('LMS docs screenshot generator could not resolve a workspace for public guest content')
}

async function verifyDocsPublicGuestContent(api: ApiContext, page: Page, applicationId: string): Promise<void> {
    await createDocsPublicWorkspace(api, applicationId)
    const publicContentNodes = LMS_DEMO_CONTENT_NODES.filter((content) => typeof content.accessLinkSlug === 'string')

    for (const seededContent of publicContentNodes) {
        await expect
            .poll(
                async () => {
                    const response = await page.request.get(`/api/v1/public/a/${applicationId}/links/${seededContent.accessLinkSlug}`)
                    if (response.status() !== 200) {
                        return `${response.status()}:${await response.text()}`
                    }

                    const payload = await response.json()
                    return {
                        idPresent: typeof payload?.id === 'string' && payload.id.length > 0,
                        slug: payload?.slug,
                        targetPresent: typeof payload?.targetId === 'string' && payload.targetId.length > 0
                    }
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toEqual({ idPresent: true, slug: seededContent.accessLinkSlug, targetPresent: true })
    }
}

async function captureGuestGuide(page: Page, locale: Locale, applicationId: string) {
    const isRu = locale === 'ru'
    const content = isRu ? LMS_DEMO_CONTENT_NODES.find((node) => node.accessLinkSlug === LMS_SECONDARY_LINK.slug) : LMS_DEMO_CONTENT_NODE
    const quiz = isRu ? LMS_DEMO_QUIZZES.find((item) => item.key === 'docking-corridor') : LMS_DEMO_QUIZ
    if (!content || !quiz) {
        throw new Error(`LMS docs guest guide cannot resolve public content for ${locale}`)
    }

    await page.goto(`/public/a/${applicationId}/links/${isRu ? LMS_SECONDARY_LINK.slug : LMS_SAMPLE_LINK.slug}${isRu ? '?locale=ru' : ''}`)
    await expect(page.getByRole('button', { name: isRu ? 'Начать обучение' : 'Start learning' })).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'guest-access')
    await page.getByLabel(isRu ? 'Ваше имя' : 'Your name').fill(isRu ? 'Гость обучения' : 'Learning guest')
    await captureDocsStepScreenshot(page, locale, 'guest-access', 1, page.locator('body'))
    await page.getByRole('button', { name: isRu ? 'Начать обучение' : 'Start learning' }).click()
    await expect(page.getByText(content.title[locale])).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'guest-access', 2, page.locator('body'))
    await page.getByRole('button', { name: isRu ? 'Далее' : 'Next' }).click()
    await expect(page.getByText(content.contentItems[locale][1].itemTitle)).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'guest-access', 3, page.locator('body'))
    await page.getByRole('button', { name: isRu ? 'Открыть тест' : 'Open quiz' }).click()
    await expect(page.getByText(quiz.questions[locale][0].prompt)).toBeVisible({ timeout: 30_000 })
    await checkQuizOption(page, quiz.questions[locale][0].options[0].label, locale)
    await checkQuizOption(page, quiz.questions[locale][1].options[0].label, locale)
    await captureDocsStepScreenshot(page, locale, 'guest-access', 4, page.locator('body'))
    await page.getByRole('button', { name: isRu ? 'Отправить тест' : 'Submit quiz' }).click()
    await expect(page.getByText(isRu ? 'Результат 2 / 2' : 'Score 2 / 2')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: isRu ? 'Назад к контенту' : 'Back to content' }).click()
    await page.getByRole('button', { name: isRu ? 'Завершить контент' : 'Complete content' }).click()
    await expect(
        page.getByText(
            isRu ? 'Контент завершён. Прогресс записан для этой сессии.' : 'Content complete. Progress has been recorded for this session.'
        )
    ).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'guest-access', 5, page.locator('body'))
}

async function captureTroubleshootingGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    await fillVisibleSearch(page, locale, locale === 'en' ? 'missing item' : 'нет материала')
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 1, page.locator('body'))
    await fillVisibleSearch(page, locale, '')
    const surface = page.getByTestId('library-details-table').first()
    await surface.getByTestId('records-union-create-target-menu-button').click()
    await page.getByRole('menuitem', { name: locale === 'en' ? 'Link' : 'Ссылка', exact: true }).click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 2, dialog)
    await dialog.getByLabel(locale === 'en' ? 'Source URL *' : 'URL источника *', { exact: true }).fill('example.test/training')
    await expectLocalizedValidation(dialog, locale, { label: `${locale} troubleshooting validation` })
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 3, dialog)
    await dialog.getByLabel(locale === 'en' ? 'Source URL *' : 'URL источника *', { exact: true }).fill('ftp://example.test/training')
    await expectLocalizedValidation(dialog, locale, { label: `${locale} troubleshooting overview validation` })
    await captureDocsScreenshot(page, locale, 'troubleshooting', dialog)
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    await clickNavigation(page, labels.trash)
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 4, page.locator('body'))
    await page.setViewportSize({ width: 390, height: 844 })
    await expectNoPageHorizontalOverflow(page, `${locale} troubleshooting mobile`)
    await page.setViewportSize(DOCS_VIEWPORT)
    await page.getByRole('combobox', { name: locale === 'en' ? 'Switch workspace' : 'Переключить пространство' }).click()
    await captureDocsStepScreenshot(page, locale, 'troubleshooting', 5, page.locator('body'))
}

test.describe('LMS user guide documentation screenshots', () => {
    let api: ApiContext | undefined

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
            api = undefined
        }
    })

    test('@generator lms user guide screenshots use canonical snapshot and runtime UX oracles', async ({ page, runManifest }) => {
        test.setTimeout(1_800_000)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const imported = await importLmsSnapshotThroughUi(page)
        await recordCreatedMetahub({
            id: imported.metahubId,
            name: imported.metahubName,
            codename: 'learning-portal-lms-docs'
        })
        await recordCreatedPublication({
            id: imported.publicationId,
            metahubId: imported.metahubId
        })

        for (const locale of ['en', 'ru'] as const) {
            // Keep locale captures isolated so learner progress and other runtime mutations
            // from the first locale cannot change the starting state of the second locale.
            const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
                name: { en: 'Learning Portal', ru: 'Учебный портал' },
                namePrimaryLocale: 'en',
                createApplicationSchema: false,
                isPublic: true
            })
            const applicationId = linkedApplication?.application?.id
            if (typeof applicationId !== 'string') {
                throw new Error(`LMS docs screenshot generator did not create an application id for ${locale}`)
            }
            await recordCreatedApplication({
                id: applicationId
            })
            await syncApplicationSchema(api, applicationId, {
                schemaOptions: {
                    workspaceModeRequested: 'enabled',
                    acknowledgeIrreversibleWorkspaceEnablement: true
                }
            })
            await verifyDocsPublicGuestContent(api, page, applicationId)

            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
            const labels =
                locale === 'en'
                    ? {
                          workspaces: 'Workspaces',
                          home: 'Welcome',
                          learningContent: 'Content Projects',
                          courses: 'Courses',
                          tracks: 'Learning Tracks',
                          recent: 'Recent',
                          trash: 'Trash',
                          knowledge: 'Knowledge Articles',
                          reports: 'Reports',
                          startLearning: 'Start learning'
                      }
                    : {
                          workspaces: 'Рабочие пространства',
                          home: 'Добро пожаловать',
                          learningContent: 'Проекты контента',
                          courses: 'Курсы',
                          tracks: 'Учебные треки',
                          recent: 'Недавние',
                          trash: 'Корзина',
                          knowledge: 'Статьи базы знаний',
                          reports: 'Отчёты',
                          startLearning: 'Начать обучение'
                      }

            await captureDashboardGuide(page, locale, applicationId, labels)
            await captureGettingAroundGuide(page, locale, applicationId, labels)
            await captureLearningContentGuide(page, locale, applicationId, labels)
            await captureProjectsGuide(page, locale, applicationId, labels)
            await captureResourcesGuide(page, locale, applicationId, labels)
            await captureCoursesGuide(page, locale, applicationId, labels)
            await captureTracksGuide(page, locale, applicationId, labels)
            await captureSharingGuide(page, locale, applicationId, labels)
            await captureLearnerExperienceGuide(page, locale, applicationId, labels)
            await captureKnowledgeGuide(page, locale, applicationId, labels)
            await captureReportsGuide(page, locale, applicationId, labels)
            await captureGuestGuide(page, locale, applicationId)
            await captureTroubleshootingGuide(page, locale, applicationId, labels)
        }

        await writeScreenshotProvenance()
    })
})
