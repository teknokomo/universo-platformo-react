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
    createRuntimeRow,
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
import {
    waitForApplicationObjectId,
    waitForApplicationRuntimeRow,
    waitForMetahubEnumerationId,
    waitForOptionValueId
} from '../../support/lmsRuntime'
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
    await navigationItem.click()
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
}

async function openNavigation(page: Page, label: string) {
    const item = page
        .getByRole('link', { name: label })
        .or(page.getByRole('button', { name: label }))
        .first()
    await expect(item, `Navigation item ${label} must be visible`).toBeVisible({ timeout: 30_000 })
    await item.focus()
    await expect(item, `Navigation item ${label} must receive keyboard focus`).toBeFocused()
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
    const firstRowAction = page.locator('[data-testid^="grid-row-actions-trigger-"], [data-testid^="records-union-card-actions-"]').first()
    await expect(firstRowAction, `${label} row action`).toBeVisible({ timeout: 30_000 })
    await firstRowAction.click()
    await expect(page.getByRole('menu'), `${label} row action menu`).toBeVisible({ timeout: 30_000 })
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
    await openNavigation(page, labels.workspaces)
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 1, page.locator('body'))
    await page
        .getByText(locale === 'en' ? 'Main' : 'Основное')
        .first()
        .click()
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 2, page.locator('body'))
    await page.keyboard.press('Escape')
    await openNavigation(page, labels.learningContent)
    await captureDocsStepScreenshot(page, locale, 'dashboard-overview', 3, page.locator('body'))
    await openNavigation(page, labels.reports)
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
    await clickNavigation(page, labels.courses)
    await openNavigation(page, labels.tracks)
    await captureDocsStepScreenshot(page, locale, 'getting-around', 2, page.locator('body'))
    await clickNavigation(page, labels.learningContent)
    await fillVisibleSearch(page, locale, locale === 'en' ? 'course' : 'курс')
    await captureDocsStepScreenshot(page, locale, 'getting-around', 3, page.locator('body'))
    await fillVisibleSearch(page, locale, '')
    await page.getByRole('button', { name: locale === 'en' ? 'Card view' : 'Карточный вид' }).click()
    await expect(page.locator('[data-testid^="records-union-card-actions-"]').first()).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'getting-around', 4, page.locator('body'))
    await page.locator('[data-testid^="records-union-card-actions-"]').first().click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'getting-around', 5, page.locator('body'))
    await page.keyboard.press('Escape')
}

async function captureLearningContentGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('records-union-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'learning-content-library', surface)
    await fillVisibleSearch(page, locale, locale === 'en' ? 'course' : 'курс')
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 1, page.locator('body'))
    await surface.getByTestId('records-union-target-filter').first().click()
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 2, page.locator('body'))
    await page.keyboard.press('Escape')
    await fillVisibleSearch(page, locale, '')
    await page.getByRole('button', { name: localized(locale, 'Table view', 'Табличный вид') }).click()
    const columnsButton = page.getByRole('button', { name: locale === 'en' ? /columns/i : /колонки/i })
    await expect(columnsButton, `${locale} columns button`).toBeVisible({ timeout: 30_000 })
    await expectDataGridHorizontalScrollConstrained(page, `${locale} Learning Content library`)
    await columnsButton.click()
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 3, page.locator('body'))
    await page.keyboard.press('Escape')
    await fillVisibleSearch(page, locale, '')
    await surface.getByTestId('records-union-create-target-menu-button').click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 4, page.locator('body'))
    await page.keyboard.press('Escape')
    const firstRowAction = page.locator('[data-testid^="grid-row-actions-trigger-"], [data-testid^="records-union-card-actions-"]').first()
    await expect(firstRowAction).toBeVisible({ timeout: 30_000 })
    await firstRowAction.click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learning-content-library', 5, page.locator('body'))
    await page.keyboard.press('Escape')
    await verifyRuntimeRowFormLifecycle(page, locale, 'edit', `${locale} Learning Content edit lifecycle`)
    await verifyRuntimeRowFormLifecycle(page, locale, 'copy', `${locale} Learning Content copy lifecycle`)
}

async function captureProjectsGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('records-union-details-table').first()
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
    await expect(
        page.locator('main').getByText(localized(locale, 'Current workspace', 'Текущее рабочее пространство')).first(),
        `${locale} project metric card`
    ).toBeVisible({ timeout: 30_000 })
    const expectedProjectCount = locale === 'en' ? '3' : '4'
    await expect(page.locator('main').getByText(expectedProjectCount).first(), `${locale} project count after create`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'projects', 3, page.locator('body'))
    await fillVisibleSearch(page, locale, '')
    await openFirstRuntimeRowActions(page, `${locale} projects move`)
    await selectRuntimeRowAction(page, locale, 'Move to project', 'Переместить в проект', `${locale} projects move`)
    const moveDialog = page.getByRole('dialog', { name: localizedPattern(locale, /Move to project/i, /Переместить в проект/i) }).first()
    await expect(moveDialog, `${locale} move to project dialog`).toBeVisible({ timeout: 30_000 })
    await moveDialog.getByRole('combobox', { name: localized(locale, 'Project', 'Проект') }).click()
    await expect(page.getByRole('listbox'), `${locale} project picker list`).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('option', { name: new RegExp(projectTitle) }), `${locale} created project in move dialog`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'projects', 4, page.locator('body'))
    await page.keyboard.press('Escape')
    await moveDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(moveDialog, `${locale} move to project dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await openFirstRuntimeRowActions(page, `${locale} projects delete`)
    await selectRuntimeRowAction(page, locale, 'Delete', 'Удалить', `${locale} projects delete`)
    await confirmVisibleDelete(page, `${locale} projects delete`)
    await clickNavigation(page, locale === 'en' ? 'Trash' : 'Корзина')
    await openTrashRestoreDialog(page, locale, `${locale} projects`)
    await captureDocsStepScreenshot(page, locale, 'projects', 5, page.locator('body'))
    await page.keyboard.press('Escape')
}

async function captureResourcesGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('records-union-details-table').first()
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
    const refreshedSurface = page.getByTestId('records-union-details-table').first()
    await expect(refreshedSurface).toBeVisible({ timeout: 30_000 })
    await refreshedSurface.getByTestId('records-union-create-target-menu-button').click()
    await page.getByRole('menuitem', { name: locale === 'en' ? 'Link' : 'Ссылка', exact: true }).click()
    dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 4, dialog)
    await dialog
        .getByLabel(locale === 'en' ? 'Source URL *' : 'URL источника *', { exact: true })
        .fill('https://example.test/training/operations-handbook')
    await dialog.getByLabel(locale === 'en' ? 'Source URL *' : 'URL источника *', { exact: true }).fill('example.test/training')
    await expectLocalizedValidation(dialog, locale, { label: `${locale} link validation` })
    await captureDocsStepScreenshot(page, locale, 'resources-pages-links', 5, dialog)
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
}

async function captureCoursesGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.courses)
    await captureDocsScreenshot(page, locale, 'courses', page.locator('main').first())
    await page.getByRole('tab', { name: locale === 'en' ? 'General' : 'Общее' }).click()
    await captureDocsStepScreenshot(page, locale, 'courses', 1, page.locator('body'))
    await page.getByRole('tab', { name: locale === 'en' ? 'Outline' : 'Структура' }).click()
    await captureDocsStepScreenshot(page, locale, 'courses', 2, page.locator('body'))
    await page
        .getByRole('heading', { name: locale === 'en' ? 'Items' : 'Элементы', exact: true })
        .locator('..')
        .getByRole('button', { name: locale === 'en' ? 'Create' : 'Создать' })
        .click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectOptionalMultilineTextControls(dialog, locale, `${locale} course item`)
    await captureDocsStepScreenshot(page, locale, 'courses', 3, page.locator('body'))
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('tab', { name: locale === 'en' ? 'Completion' : 'Завершение' }).click()
    await captureDocsStepScreenshot(page, locale, 'courses', 4, page.locator('body'))
    await page.getByRole('tab', { name: locale === 'en' ? 'Player' : 'Проигрыватель' }).click()
    await captureDocsStepScreenshot(page, locale, 'courses', 5, page.locator('body'))
}

async function captureTracksGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.tracks)
    await captureDocsScreenshot(page, locale, 'learning-tracks', page.locator('main').first())
    await page.getByRole('tab', { name: locale === 'en' ? 'General' : 'Общее' }).click()
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 1, page.locator('body'))
    await page.getByRole('tab', { name: locale === 'en' ? 'Outline' : 'Структура' }).click()
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 2, page.locator('body'))
    await page
        .getByRole('heading', { name: locale === 'en' ? 'Steps' : 'Шаги', exact: true })
        .locator('..')
        .getByRole('button', { name: locale === 'en' ? 'Create' : 'Создать' })
        .click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expectOptionalMultilineTextControls(dialog, locale, `${locale} track step`)
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 3, page.locator('body'))
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('tab', { name: locale === 'en' ? 'Completion' : 'Завершение' }).click()
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 4, page.locator('body'))
    await page.getByRole('tab', { name: locale === 'en' ? 'Player' : 'Проигрыватель' }).click()
    await captureDocsStepScreenshot(page, locale, 'learning-tracks', 5, page.locator('body'))
}

async function captureSharingGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.learningContent)
    const surface = page.getByTestId('records-union-details-table').first()
    await expect(surface).toBeVisible({ timeout: 30_000 })
    await captureDocsScreenshot(page, locale, 'sharing-recent-favorites-trash', surface)
    await openFirstRuntimeRowActions(page, `${locale} sharing star`)
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 1, page.locator('body'))
    await selectRuntimeRowAction(page, locale, 'Share', 'Поделиться', `${locale} sharing share`)
    const shareDialog = page.getByRole('dialog', { name: localizedPattern(locale, /Share content/i, /Поделиться контентом/i) }).first()
    await expect(shareDialog, `${locale} share dialog`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 2, page.locator('body'))
    await shareDialog.getByRole('button', { name: localized(locale, 'Cancel', 'Отмена') }).click()
    await expect(shareDialog, `${locale} share dialog closed`).toHaveCount(0, { timeout: 30_000 })
    await clickNavigation(page, labels.recent)
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
    await clickNavigation(page, locale === 'en' ? 'Trash' : 'Корзина')
    await openTrashRestoreDialog(page, locale, `${locale} sharing`)
    await captureDocsStepScreenshot(page, locale, 'sharing-recent-favorites-trash', 5, page.locator('body'))
    await page.keyboard.press('Escape')
}

async function captureLearnerExperienceGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    const courseTitle = localized(locale, 'Learner Onboarding Course', 'Курс адаптации учащегося')
    const ensureLearnerCourseSelected = async (player: Locator, label: string) => {
        const heading = player.getByRole('heading', { name: courseTitle })
        if (await heading.isVisible().catch(() => false)) return

        await player.getByRole('combobox', { name: localized(locale, 'Course', 'Курс') }).click()
        await page.getByRole('option', { name: courseTitle }).click()
        await expect(heading, label).toBeVisible({ timeout: 30_000 })
    }

    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.courses)
    await page.getByRole('tab', { name: localized(locale, 'Player', 'Проигрыватель') }).click()
    let player = page.getByTestId('learner-player')
    await expect(player, `${locale} learner player`).toBeVisible({ timeout: 30_000 })
    await ensureLearnerCourseSelected(player, `${locale} learner course heading`)
    await captureDocsScreenshot(page, locale, 'learner-experience', page.locator('main').first())
    await player.getByRole('combobox', { name: localized(locale, 'Course', 'Курс') }).click()
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 1, page.locator('body'))
    await page.keyboard.press('Escape')
    const outline = player.getByTestId('learner-player-outline')
    await expect(outline).toBeVisible({ timeout: 30_000 })
    const outlineButtons = outline.getByRole('button')
    if ((await outlineButtons.count()) > 1) {
        await outlineButtons.nth(1).click()
    }
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 2, page.locator('body'))
    await outlineButtons.first().click()
    let completeButton = player.getByRole('button', { name: localized(locale, 'Complete', 'Завершить') }).first()
    for (let attempt = 0; attempt < 5 && !(await completeButton.isEnabled().catch(() => false)); attempt += 1) {
        const nextButton = player.getByRole('button', { name: localized(locale, 'Next', 'Далее') }).first()
        if (!(await nextButton.isEnabled().catch(() => false))) break
        await nextButton.click()
        await expect(player, `${locale} learner player after moving to next item`).toBeVisible({ timeout: 30_000 })
        completeButton = player.getByRole('button', { name: localized(locale, 'Complete', 'Завершить') }).first()
    }
    const progressPattern = localizedPattern(locale, /\b[1-9]\d* of \d+ completed\b/i, /Завершено [1-9]\d* из \d+/i)
    if (await completeButton.isEnabled().catch(() => false)) {
        await completeButton.click()
    } else {
        await expect(player.getByText(progressPattern).first(), `${locale} learner progress before complete fallback`).toBeVisible({
            timeout: 30_000
        })
    }
    await expect(player.getByText(progressPattern).first(), `${locale} learner progress after complete`).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 3, page.locator('body'))
    const nextButton = player.getByRole('button', { name: localized(locale, 'Next', 'Далее') }).first()
    if (await nextButton.isEnabled().catch(() => false)) {
        await nextButton.click()
    } else {
        const buttons = player.getByTestId('learner-player-outline').getByRole('button')
        if ((await buttons.count()) > 1) {
            await buttons.first().click()
        } else {
            await buttons.first().click()
        }
    }
    await expect(player.getByText(progressPattern).first(), `${locale} learner progress remains visible after next`).toBeVisible({
        timeout: 30_000
    })
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 4, page.locator('body'))

    const finalCompleteButton = player.getByRole('button', { name: localized(locale, 'Complete', 'Завершить') }).first()
    if (await finalCompleteButton.isEnabled().catch(() => false)) {
        await finalCompleteButton.click()
        await expect(
            player.getByText(localizedPattern(locale, /\b2 of 2 completed\b/i, /Завершено 2 из 2/i)).first(),
            `${locale} learner final progress before reload`
        ).toBeVisible({ timeout: 30_000 })
    }

    await page.reload()
    await page.getByRole('tab', { name: localized(locale, 'Player', 'Проигрыватель') }).click()
    player = page.getByTestId('learner-player')
    await expect(player, `${locale} learner player after reload`).toBeVisible({ timeout: 30_000 })
    await ensureLearnerCourseSelected(player, `${locale} learner course heading after reload`)
    await expect(player.getByText(progressPattern)).toBeVisible({ timeout: 30_000 })
    await player.getByRole('combobox', { name: localized(locale, 'Course', 'Курс') }).click()
    await captureDocsStepScreenshot(page, locale, 'learner-experience', 5, page.locator('body'))
}

async function captureKnowledgeGuide(page: Page, locale: Locale, applicationId: string, labels: Record<string, string>) {
    await page.goto(`/a/${applicationId}`)
    await clickNavigation(page, labels.knowledge)
    await captureDocsScreenshot(page, locale, 'knowledge', page.locator('main').first())
    await page.getByRole('columnheader', { name: locale === 'en' ? /title/i : /заголовок/i }).click()
    await captureDocsStepScreenshot(page, locale, 'knowledge', 1, page.locator('body'))
    const createButton = page.getByTestId(applicationSelectors.runtimeCreateButton).first()
    await expect(createButton).toBeVisible({ timeout: 30_000 })
    await createButton.click()
    let dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await captureDocsStepScreenshot(page, locale, 'knowledge', 2, page.locator('body'))
    await dialog
        .getByLabel(locale === 'en' ? 'Title *' : 'Заголовок *', { exact: true })
        .fill(locale === 'en' ? 'Operations handbook' : 'Справочник операций')
    await captureDocsStepScreenshot(page, locale, 'knowledge', 3, page.locator('body'))
    const bodyEditor = await expectBlockEditorBodyControl(dialog, locale, `${locale} knowledge article`)
    await bodyEditor.fill(
        locale === 'en'
            ? 'Keep operating procedures short and easy to scan.'
            : 'Делайте рабочие инструкции короткими и удобными для просмотра.'
    )
    await captureDocsStepScreenshot(page, locale, 'knowledge', 4, page.locator('body'))
    await dialog.getByTestId(entityDialogSelectors.cancelButton).click()
    await expect(dialog).toHaveCount(0)
    await page
        .getByRole('button', { name: locale === 'en' ? 'Actions' : 'Действия' })
        .first()
        .click()
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 30_000 })
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
    await captureDocsStepScreenshot(page, locale, 'reports', 1, page.locator('body'))
    await page.getByRole('columnheader', { name: locale === 'en' ? /title/i : /заголовок/i }).click()
    await captureDocsStepScreenshot(page, locale, 'reports', 2, page.locator('body'))
    await page.getByRole('columnheader', { name: locale === 'en' ? /type/i : /тип/i }).click()
    await captureDocsStepScreenshot(page, locale, 'reports', 3, page.locator('body'))
    await page.getByRole('button', { name: locale === 'en' ? /export csv/i : /экспорт csv/i }).focus()
    await captureDocsStepScreenshot(page, locale, 'reports', 4, page.locator('body'))
    await clickNavigation(page, labels.learningContent)
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

async function seedDocsPublicGuestContent(api: ApiContext, page: Page, metahubId: string, applicationId: string): Promise<void> {
    const [
        learningResourcesObjectId,
        quizzesObjectId,
        accessLinksObjectId,
        contentTypeEnumerationId,
        resourceTypeEnumerationId,
        publicationStatusEnumerationId,
        questionTypeEnumerationId
    ] = await Promise.all([
        waitForApplicationObjectId(api, applicationId, 'LearningResources'),
        waitForApplicationObjectId(api, applicationId, 'Quizzes'),
        waitForApplicationObjectId(api, applicationId, 'AccessLinks'),
        waitForMetahubEnumerationId(api, metahubId, 'Content Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Resource Type'),
        waitForMetahubEnumerationId(api, metahubId, 'Publication Status'),
        waitForMetahubEnumerationId(api, metahubId, 'Question Type')
    ])
    const [textValueId, quizRefValueId, pageResourceTypeValueId, publishedPublicationStatusValueId, singleChoiceValueId] =
        await Promise.all([
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'Text'),
            waitForOptionValueId(api, metahubId, contentTypeEnumerationId, 'QuizRef'),
            waitForOptionValueId(api, metahubId, resourceTypeEnumerationId, 'Page'),
            waitForOptionValueId(api, metahubId, publicationStatusEnumerationId, 'Published'),
            waitForOptionValueId(api, metahubId, questionTypeEnumerationId, 'SingleChoice')
        ])
    const workspaceId = await createDocsPublicWorkspace(api, applicationId)
    const publicContentNodes = LMS_DEMO_CONTENT_NODES.filter((content) => typeof content.accessLinkSlug === 'string')
    const quizRowsByKey = new Map<string, { id: string }>()

    for (const seededQuiz of LMS_DEMO_QUIZZES.filter((quiz) => publicContentNodes.some((content) => content.linkedQuizKey === quiz.key))) {
        const quizRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: quizzesObjectId,
            data: {
                Title: buildVLC(seededQuiz.title.en, seededQuiz.title.ru),
                Description: buildVLC(seededQuiz.description.en, seededQuiz.description.ru),
                PassingScorePercent: seededQuiz.passingScorePercent,
                MaxAttempts: seededQuiz.maxAttempts,
                Questions: seededQuiz.questions.en.map((question, index) => {
                    const localizedQuestion = seededQuiz.questions.ru[index]
                    return {
                        Id: `${seededQuiz.key}-docs-public-question-${index + 1}`,
                        Prompt: buildVLC(question.prompt, localizedQuestion.prompt),
                        QuestionDescription: buildVLC(question.description, localizedQuestion.description),
                        QuestionType: singleChoiceValueId,
                        Difficulty: 1,
                        Explanation: buildVLC(question.explanation, localizedQuestion.explanation),
                        Options: question.options,
                        SortOrder: question.sortOrder
                    }
                })
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, quizzesObjectId, quizRow.id, { workspaceId })
        quizRowsByKey.set(seededQuiz.key, { id: quizRow.id })
    }

    for (const seededContent of publicContentNodes) {
        const linkedQuiz = quizRowsByKey.get(seededContent.linkedQuizKey)
        if (!linkedQuiz) {
            throw new Error(`LMS docs public content seed could not find linked quiz ${seededContent.linkedQuizKey}`)
        }

        const contentRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: learningResourcesObjectId,
            data: {
                Title: buildVLC(seededContent.title.en, seededContent.title.ru),
                Name: seededContent.title.en,
                Description: buildVLC(seededContent.description.en, seededContent.description.ru),
                ResourceType: pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'CourseOverview' },
                EstimatedTimeMinutes: seededContent.estimatedDurationMinutes,
                PublicationStatus: publishedPublicationStatusValueId,
                ContentItems: seededContent.contentItems.en.map((item, index) => {
                    const localizedItem = seededContent.contentItems.ru[index]
                    const isQuizRef = item.itemType === 'QuizRef'
                    return {
                        ItemType: isQuizRef ? quizRefValueId : textValueId,
                        ItemTitle: buildVLC(item.itemTitle, localizedItem.itemTitle),
                        ...(item.itemContent
                            ? { ItemContent: buildVLC(item.itemContent, localizedItem.itemContent ?? localizedItem.itemTitle) }
                            : {}),
                        ...(isQuizRef ? { QuizId: linkedQuiz.id } : {}),
                        SortOrder: item.sortOrder
                    }
                })
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, learningResourcesObjectId, contentRow.id, { workspaceId })

        const linkTitle = seededContent.accessLinkSlug === LMS_SECONDARY_LINK.slug ? LMS_SECONDARY_LINK.title : LMS_SAMPLE_LINK.title
        const accessLinkRow = await createRuntimeRow(api, applicationId, {
            workspaceId,
            objectCollectionId: accessLinksObjectId,
            data: {
                Slug: seededContent.accessLinkSlug,
                TargetType: 'content',
                TargetId: contentRow.id,
                ContentNodeIdRef: contentRow.id,
                IsActive: true,
                MaxUses: 20,
                UseCount: 0,
                LinkTitle: buildVLC(linkTitle.en, linkTitle.ru)
            }
        })
        await waitForApplicationRuntimeRow(api, applicationId, accessLinksObjectId, accessLinkRow.id, { workspaceId })
        await expect
            .poll(
                async () => {
                    const response = await page.request.get(`/api/v1/public/a/${applicationId}/links/${seededContent.accessLinkSlug}`)
                    if (response.status() !== 200) {
                        return `${response.status()}:${await response.text()}`
                    }

                    const payload = await response.json()
                    return typeof payload?.id === 'string' ? payload.id : 'missing-link-id'
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toBe(accessLinkRow.id)
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
    const surface = page.getByTestId('records-union-details-table').first()
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
    await clickNavigation(page, locale === 'en' ? 'Trash' : 'Корзина')
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

        const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: 'Learning Portal', ru: 'Учебный портал' },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })
        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('LMS docs screenshot generator did not create an application id')
        }
        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })
        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await seedDocsPublicGuestContent(api, page, imported.metahubId, applicationId)

        for (const locale of ['en', 'ru'] as const) {
            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
            const labels =
                locale === 'en'
                    ? {
                          workspaces: 'Workspaces',
                          learningContent: 'Learning Content',
                          courses: 'Courses',
                          tracks: 'Tracks',
                          recent: 'Recent',
                          knowledge: 'Knowledge',
                          reports: 'Reports',
                          startLearning: 'Start learning'
                      }
                    : {
                          workspaces: 'Рабочие пространства',
                          learningContent: 'Учебный контент',
                          courses: 'Курсы',
                          tracks: 'Треки',
                          recent: 'Недавние',
                          knowledge: 'Знания',
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
