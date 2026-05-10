import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page, Response } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    listLinkedCollections,
    listMetahubEntityTypes,
    listLayouts,
    listApplicationWorkspaces,
    listLayoutZoneWidgets,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'
import {
    assertLmsFixtureEnvelopeContract,
    LMS_DEMO_ENROLLMENTS,
    LMS_DEMO_MODULE,
    LMS_DEMO_MODULE_PROGRESS,
    LMS_DEMO_MODULES,
    LMS_DEMO_QUIZ,
    LMS_DEMO_QUIZZES,
    LMS_DEMO_QUIZ_RESPONSES,
    LMS_DEMO_STUDENTS,
    LMS_FIXTURE_FILENAME,
    LMS_PUBLICATION,
    LMS_SAMPLE_LINK,
    LMS_SECONDARY_LINK,
    LMS_WELCOME_PAGE
} from '../../support/lmsFixtureContract'
import {
    waitForApplicationCatalogId,
    waitForApplicationLedgerFactCount,
    waitForApplicationLedgerId,
    waitForApplicationRuntimeRowCount,
    type ApiContext
} from '../../support/lmsRuntime'

type SnapshotFixture = Record<string, unknown>
type BrowserRuntimeIssue = {
    source: 'console' | 'pageerror' | 'response'
    text: string
    method?: string
    status?: number
    url?: string
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

async function checkQuizOption(page: Page, value: unknown, locale: string): Promise<void> {
    const primaryLabel = readLocalizedText(value, locale)
    if (primaryLabel) {
        const primaryLocator = page.getByLabel(primaryLabel)
        if (await primaryLocator.count()) {
            await primaryLocator.check()
            return
        }
    }

    const fallbackLabel = readLocalizedText(value, 'en')
    if (fallbackLabel) {
        await page.getByLabel(fallbackLabel).check()
        return
    }

    throw new Error(`Quiz option label is missing for locale ${locale}`)
}

async function clickRuntimeNavigationItem(page: Page, name: string): Promise<void> {
    const directLink = page.getByRole('link', { name })
    await expect(directLink.first()).toBeVisible({ timeout: 30_000 })
    await directLink.first().click()
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))
    expect(overflowPx, `${label} must not create horizontal page overflow`).toBeLessThanOrEqual(1)
}

async function assertElementFitsViewport(page: Page, testId: string, label: string): Promise<void> {
    const box = await page.getByTestId(testId).boundingBox()
    expect(box, `${label} must be rendered`).not.toBeNull()
    if (!box) return

    const viewport = page.viewportSize()
    expect(viewport, `${label} requires a viewport`).not.toBeNull()
    if (!viewport) return

    expect(box.x, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width, `${label} must fit inside the viewport`).toBeLessThanOrEqual(viewport.width + 1)
}

function watchBrowserRuntimeIssues(page: Page): BrowserRuntimeIssue[] {
    const issues: BrowserRuntimeIssue[] = []
    page.on('console', (message) => {
        if (message.type() !== 'error') return
        if (message.text().startsWith('Failed to load resource:')) return
        issues.push({
            source: 'console',
            text: message.text()
        })
    })
    page.on('pageerror', (error) => {
        issues.push({
            source: 'pageerror',
            text: error.message
        })
    })
    page.on('response', (response) => {
        const status = response.status()
        const responseUrl = response.url()
        if (!responseUrl.includes('/api/')) return
        const method = response.request().method()

        if (status < 400) {
            const transientCsrfIndex = issues.findIndex(
                (issue) => issue.source === 'response' && issue.status === 419 && issue.method === method && issue.url === responseUrl
            )
            if (transientCsrfIndex >= 0) {
                issues.splice(transientCsrfIndex, 1)
            }
            return
        }

        issues.push({
            source: 'response',
            text: `HTTP ${status} ${method} ${responseUrl}`,
            method,
            status,
            url: responseUrl
        })
    })
    return issues
}

function expectNoBrowserRuntimeIssues(issues: BrowserRuntimeIssue[], label: string): void {
    expect(
        issues,
        `${label} produced browser runtime issues:\n${issues.map((issue) => `[${issue.source}] ${issue.text}`).join('\n')}`
    ).toEqual([])
}

async function runRuntimeRecordCommandFromRow(page: Page, rowId: string, command: 'post' | 'unpost'): Promise<void> {
    const trigger = page.getByTestId(`grid-row-actions-trigger-${rowId}`)
    await expect(trigger).toBeVisible({ timeout: 30_000 })
    await trigger.click()

    const commandItemByTestId = page.getByTestId(`runtime-record-command-${command}`).first()
    const commandItem =
        (await commandItemByTestId.count()) > 0
            ? commandItemByTestId
            : page
                  .getByRole('menuitem', {
                      name: command === 'post' ? /^(post|провести|опубликовать)$/i : /^(unpost|отменить проведение|распровести)$/i
                  })
                  .first()
    await expect(commandItem).toBeVisible({ timeout: 30_000 })
    const commandResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().includes(`/runtime/rows/${encodeURIComponent(rowId)}/${command}`),
        { timeout: 30_000 }
    )
    await commandItem.click()
    const commandResponse = await commandResponsePromise
    expect(commandResponse.ok(), `${command} runtime record command must succeed`).toBe(true)
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
}

async function submitSnapshotImportDialog(page: Page, dialog: Locator): Promise<Response> {
    const importButton = dialog.getByRole('button', { name: /import/i }).last()
    const pendingResponses: Response[] = []
    const pendingWaiters: Array<(response: Response) => void> = []
    const onResponse = (response: Response) => {
        if (response.request().method() !== 'POST' || !response.url().endsWith('/api/v1/metahubs/import')) {
            return
        }
        const waiter = pendingWaiters.shift()
        if (waiter) {
            waiter(response)
            return
        }
        pendingResponses.push(response)
    }
    const waitForNextImportResponse = (timeoutMs: number): Promise<Response> => {
        const queued = pendingResponses.shift()
        if (queued) {
            return Promise.resolve(queued)
        }
        return new Promise((resolve, reject) => {
            let timeout: ReturnType<typeof setTimeout>
            const waiter = (response: Response) => {
                clearTimeout(timeout)
                resolve(response)
            }
            timeout = setTimeout(() => {
                const index = pendingWaiters.indexOf(waiter)
                if (index >= 0) {
                    pendingWaiters.splice(index, 1)
                }
                reject(new Error(`Timed out waiting for metahub import response after ${timeoutMs}ms`))
            }, timeoutMs)
            pendingWaiters.push(waiter)
        })
    }

    page.on('response', onResponse)
    try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            await importButton.click()
            let response = await waitForNextImportResponse(180_000)

            for (let retryAttempt = 0; retryAttempt < 3; retryAttempt += 1) {
                if (response.status() === 201) return response

                const bodyText = await response.text().catch(() => '')
                if (response.status() === 419 && /csrf/i.test(bodyText)) {
                    await page.evaluate(() => window.sessionStorage.removeItem('up.auth.csrf'))
                    const automaticRetryResponse = await waitForNextImportResponse(180_000).catch(() => null)
                    if (automaticRetryResponse) {
                        response = automaticRetryResponse
                        continue
                    }
                    await expect(importButton).toBeEnabled({ timeout: 15_000 })
                    break
                }

                throw new Error(`Snapshot import failed with HTTP ${response.status()}: ${bodyText.slice(0, 500)}`)
            }
        }
    } finally {
        page.off('response', onResponse)
    }

    throw new Error('Snapshot import did not return HTTP 201 after CSRF retry')
}

async function loadLmsFixture(): Promise<{ fixturePath: string; metahubName: string }> {
    const fixturePath = path.join(process.cwd(), 'tools', 'fixtures', LMS_FIXTURE_FILENAME)
    const rawFixture = await fs.readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(rawFixture) as SnapshotFixture

    assertLmsFixtureEnvelopeContract(fixture)

    const metahubName = readLocalizedText((fixture as { metahub?: { name?: unknown } }).metahub?.name)
    if (!metahubName) {
        throw new Error('LMS snapshot fixture does not contain a metahub name')
    }

    return { fixturePath, metahubName }
}

async function findEntityInstanceIdByCodename(api: ApiContext, metahubId: string, kindKey: string, codename: string): Promise<string> {
    const payload = await listLinkedCollections(api, metahubId, { kindKey, limit: 200, offset: 0 })
    const entity = (payload?.items ?? []).find((item: Record<string, unknown>) => readLocalizedText(item?.codename, 'en') === codename)
    if (!entity || typeof entity.id !== 'string') {
        throw new Error(`Entity ${kindKey}/${codename} was not found in imported LMS metahub ${metahubId}`)
    }

    return entity.id
}

async function findCatalogIdByCodename(api: ApiContext, metahubId: string, codename: string): Promise<string> {
    return findEntityInstanceIdByCodename(api, metahubId, 'catalog', codename)
}

async function findEntityTypeIdByKind(api: ApiContext, metahubId: string, kindKey: string): Promise<string> {
    const payload = await listMetahubEntityTypes(api, metahubId, { limit: 100, offset: 0 })
    const entityType = (payload?.items ?? []).find((item: Record<string, unknown>) => item?.kindKey === kindKey)
    if (!entityType || typeof entityType.id !== 'string') {
        throw new Error(`Entity type ${kindKey} was not found in imported LMS metahub ${metahubId}`)
    }

    return entityType.id
}

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.find((layout) => layout?.isDefault)?.id ?? response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for imported metahub ${metahubId}`)
    }

    return layoutId
}

async function expectPublicRuntimeSecurityEdges(page: Page, applicationId: string): Promise<void> {
    const linkResponse = await page.request.get(`/api/v1/public/a/${applicationId}/links/${LMS_SAMPLE_LINK.slug}`)
    expect(linkResponse.status()).toBe(200)
    const linkBody = await linkResponse.json()
    const targetId = typeof linkBody?.targetId === 'string' ? linkBody.targetId : ''
    expect(targetId).toMatch(/^[0-9a-f-]{36}$/i)

    const missingSlugResponse = await page.request.get(`/api/v1/public/a/${applicationId}/runtime?targetType=content&targetId=${targetId}`)
    expect(missingSlugResponse.status()).toBe(400)

    const foreignTargetResponse = await page.request.get(
        `/api/v1/public/a/${applicationId}/runtime?slug=${encodeURIComponent(
            LMS_SAMPLE_LINK.slug
        )}&targetType=assessment&targetId=018f8a78-7b8f-7c1d-a111-222233334777`
    )
    expect(foreignTargetResponse.status()).toBe(403)
}

async function expectRegistrarOnlyLedgerRejectsManualWrite(
    api: ApiContext,
    applicationId: string,
    ledgerId: string,
    workspaceId: string
): Promise<void> {
    const response = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/applications/${applicationId}/runtime/ledgers/${ledgerId}/facts?workspaceId=${workspaceId}`,
        {
            facts: [
                {
                    data: {
                        SourceRowId: 'manual-probe',
                        SourceLineId: 'manual-probe',
                        ProgressDelta: 1
                    }
                }
            ]
        }
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toMatchObject({ code: 'LEDGER_REGISTRAR_ONLY' })
}

test.describe('LMS Snapshot Import Runtime Flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@flow lms snapshot fixture imports through the browser UI and is immediately usable after linked app creation', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(720_000)
        const browserIssues = watchBrowserRuntimeIssues(page)

        const fixture = await loadLmsFixture()
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        await page.goto('/metahubs')

        const primaryActionBtn = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(primaryActionBtn).toBeVisible({ timeout: 15_000 })

        const dropdownArrow = page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`)
        await dropdownArrow.click()

        const importOption = page.getByRole('menuitem', { name: /import/i })
        await expect(importOption).toBeVisible()
        await importOption.click()

        const dialog = page.getByRole('dialog', { name: /import/i })
        await expect(dialog).toBeVisible()

        await dialog.locator('input[type="file"]').setInputFiles(fixture.fixturePath)
        await expect(dialog.getByText(LMS_FIXTURE_FILENAME)).toBeVisible()

        const importResponse = await submitSnapshotImportDialog(page, dialog)
        expect(importResponse.status()).toBe(201)

        const importBody = await importResponse.json()
        const importedId = importBody?.metahub?.id
        const importedPublicationId = importBody?.publication?.id
        expect(typeof importedId).toBe('string')
        expect(typeof importedPublicationId).toBe('string')

        await recordCreatedMetahub({
            id: importedId,
            name: fixture.metahubName,
            codename: 'learning-portal-lms-imported'
        })
        await recordCreatedPublication({
            id: importedPublicationId,
            metahubId: importedId
        })

        await expect(dialog).toHaveCount(0)
        await expect(page.getByText(fixture.metahubName, { exact: true }).first()).toBeVisible({ timeout: 15_000 })

        const layoutId = await waitForLayoutId(api, importedId)
        const layoutWidgets = await listLayoutZoneWidgets(api, importedId, layoutId)
        const widgetKeys = new Set((layoutWidgets.items ?? []).map((item: Record<string, any>) => item?.widgetKey))
        expect(widgetKeys.has('moduleViewerWidget')).toBe(false)
        expect(widgetKeys.has('statsViewerWidget')).toBe(false)
        expect(widgetKeys.has('qrCodeWidget')).toBe(false)

        const menuWidget = (layoutWidgets.items ?? []).find((item: Record<string, any>) => item?.widgetKey === 'menuWidget')
        expect(menuWidget?.config?.autoShowAllCatalogs).toBe(false)
        expect(menuWidget?.config?.maxPrimaryItems).toBe(6)
        expect(menuWidget?.config?.startPage).toBe('LearnerHome')

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${importedId}/entities/catalog/instances`)
        await expect(page.getByRole('heading', { name: 'Каталоги' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByPlaceholder(/Поиск каталогов/i)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Ledgers' })).toHaveCount(0)

        const metahubProgressLedgerId = await findEntityInstanceIdByCodename(api, importedId, 'catalog', 'ProgressLedger')
        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', metahubProgressLedgerId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', metahubProgressLedgerId)).click()
        let progressLedgerDialog = page.getByRole('dialog', { name: /Редактировать каталог/i })
        await expect(progressLedgerDialog).toBeVisible({ timeout: 30_000 })
        await progressLedgerDialog.getByRole('tab', { name: 'Схема регистра' }).click()
        await expect(progressLedgerDialog.getByLabel('Режим регистра')).toContainText('Остатки')
        await expect(progressLedgerDialog.getByLabel('Политика изменений')).toContainText('Только добавление')
        await expect(progressLedgerDialog.getByLabel('Политика источника')).toContainText('Только регистратор')
        await expect(progressLedgerDialog.getByText('Роли полей')).toBeVisible()
        await expect(progressLedgerDialog.getByText('Проекции')).toBeVisible()
        await progressLedgerDialog.screenshot({ path: testInfo.outputPath('metahub-ledger-progress-schema-before-save-ru.png') })
        await progressLedgerDialog.getByLabel('Периодичность').click()
        await page.getByRole('option', { name: 'Месяц' }).click()

        const ledgerSchemaSaveResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(
                    `/api/v1/metahub/${importedId}/entities/catalog/instance/${metahubProgressLedgerId}`
                ),
            { label: 'Saving LMS Progress ledger schema periodicity' }
        )
        await progressLedgerDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await ledgerSchemaSaveResponse).ok()).toBe(true)
        await expect(progressLedgerDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', metahubProgressLedgerId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', metahubProgressLedgerId)).click()
        progressLedgerDialog = page.getByRole('dialog', { name: /Редактировать каталог/i })
        await expect(progressLedgerDialog).toBeVisible({ timeout: 30_000 })
        await progressLedgerDialog.getByRole('tab', { name: 'Схема регистра' }).click()
        await expect(progressLedgerDialog.getByLabel('Периодичность')).toContainText('Месяц')
        await progressLedgerDialog.screenshot({ path: testInfo.outputPath('metahub-ledger-progress-schema-reopened-ru.png') })
        await progressLedgerDialog.getByLabel('Периодичность').click()
        await page.getByRole('option', { name: 'Нет' }).click()
        const ledgerSchemaRestoreResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(
                    `/api/v1/metahub/${importedId}/entities/catalog/instance/${metahubProgressLedgerId}`
                ),
            { label: 'Restoring LMS Progress ledger schema periodicity' }
        )
        await progressLedgerDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await ledgerSchemaRestoreResponse).ok()).toBe(true)
        await expect(progressLedgerDialog).toHaveCount(0)

        const progressLedgerCell = page.getByText('Регистр прогресса', { exact: true }).first()
        await expect(progressLedgerCell).toBeVisible({ timeout: 30_000 })
        await progressLedgerCell.click()
        await expect(page).toHaveURL(/\/entities\/catalog\/instance\/[0-9a-f-]+\/field-definitions$/i)

        const catalogTypeId = await findEntityTypeIdByKind(api, importedId, 'catalog')
        await page.goto(`/metahub/${importedId}/entities`)
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('entity-type', catalogTypeId))).toBeVisible({ timeout: 30_000 })
        await page.getByTestId(buildEntityMenuTriggerSelector('entity-type', catalogTypeId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('entity-type', 'edit', catalogTypeId)).click()

        const catalogTypeDialog = page.getByRole('dialog', { name: /Редактировать сущность|Edit Entity/i })
        await expect(catalogTypeDialog).toBeVisible({ timeout: 30_000 })
        await expect(catalogTypeDialog.getByRole('checkbox', { name: 'Поведение' })).toBeChecked()
        await expect(catalogTypeDialog.getByLabel('Дополнительные вкладки')).toHaveValue(/hubs/)
        await catalogTypeDialog.getByRole('tab', { name: 'Компоненты' }).click()
        await expect(catalogTypeDialog.getByLabel('Схема данных')).toBeChecked()
        await expect(catalogTypeDialog.getByLabel('Скрипты')).toBeChecked()
        await expect(catalogTypeDialog.getByLabel('Runtime-поведение')).toBeChecked()
        await expect(catalogTypeDialog.getByLabel('Физическая таблица')).toBeChecked()
        await catalogTypeDialog.screenshot({ path: testInfo.outputPath('metahub-catalog-type-behavior-components-ru.png') })
        await catalogTypeDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(catalogTypeDialog).toHaveCount(0)

        const enrollmentCatalogId = await findCatalogIdByCodename(api, importedId, 'Enrollments')
        await page.goto(`/metahub/${importedId}/entities/catalog/instances`)
        await expect(page.getByRole('heading', { name: 'Каталоги' })).toBeVisible({ timeout: 30_000 })

        await page
            .getByRole('button', { name: /создать/i })
            .last()
            .click()
        const createCatalogDialog = page.getByRole('dialog', { name: /Создать каталог/i })
        await expect(createCatalogDialog).toBeVisible({ timeout: 30_000 })
        await createCatalogDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(createCatalogDialog.getByLabel('Режим записей')).toContainText('Справочник')
        await expect(createCatalogDialog.getByLabel('Включить нумерацию записей')).not.toBeChecked()
        await expect(createCatalogDialog.getByLabel('Включить дату действия')).not.toBeChecked()
        await expect(createCatalogDialog.getByLabel('Префикс')).toHaveCount(0)
        await createCatalogDialog.screenshot({ path: testInfo.outputPath('metahub-catalog-create-behavior-defaults-ru.png') })
        await createCatalogDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(createCatalogDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', enrollmentCatalogId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', enrollmentCatalogId)).click()
        let enrollmentDialog = page.getByRole('dialog', { name: /Редактировать каталог/i })
        await expect(enrollmentDialog).toBeVisible({ timeout: 30_000 })
        await enrollmentDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(enrollmentDialog.getByLabel('Режим записей')).toContainText('Транзакционный')
        await expect(enrollmentDialog.getByLabel('Префикс')).toHaveValue('ENR-')
        await expect(enrollmentDialog.getByText(/Регистр прогресса|ProgressLedger/).first()).toBeVisible({ timeout: 30_000 })
        await expect(enrollmentDialog.getByText(/Enrollment Posting Script|EnrollmentPostingScript/).first()).toBeVisible({
            timeout: 30_000
        })
        await enrollmentDialog.screenshot({ path: testInfo.outputPath('metahub-catalog-enrollments-behavior-before-save-ru.png') })
        await enrollmentDialog.getByLabel('Префикс').fill('ENR-QA-')

        const behaviorSaveResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/catalog/instance/${enrollmentCatalogId}`),
            { label: 'Saving LMS Enrollment behavior prefix' }
        )
        await enrollmentDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await behaviorSaveResponse).ok()).toBe(true)
        await expect(enrollmentDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', enrollmentCatalogId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'edit', enrollmentCatalogId)).click()
        enrollmentDialog = page.getByRole('dialog', { name: /Редактировать каталог/i })
        await expect(enrollmentDialog).toBeVisible({ timeout: 30_000 })
        await enrollmentDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(enrollmentDialog.getByLabel('Префикс')).toHaveValue('ENR-QA-')
        await enrollmentDialog.screenshot({ path: testInfo.outputPath('metahub-catalog-enrollments-behavior-reopened-ru.png') })
        await enrollmentDialog.getByLabel('Префикс').fill('ENR-')
        const behaviorRestoreResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/catalog/instance/${enrollmentCatalogId}`),
            { label: 'Restoring LMS Enrollment behavior prefix' }
        )
        await enrollmentDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await behaviorRestoreResponse).ok()).toBe(true)
        await expect(enrollmentDialog).toHaveCount(0)

        const linkedApplication = await createPublicationLinkedApplication(api, importedId, importedPublicationId, {
            name: LMS_PUBLICATION.applicationName,
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Import flow did not create an application id from the imported LMS publication')
        }
        const connectorId = linkedApplication?.connector?.id
        if (typeof connectorId !== 'string') {
            throw new Error('Import flow did not create a connector id from the imported LMS publication')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}/admin/connector/${connectorId}`)
        await expect(page.getByTestId('application-connector-board-schema-card')).toBeVisible({ timeout: 30_000 })

        const diffResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/application/${applicationId}/diff`),
            { timeout: 60_000 }
        )
        await page.getByTestId('application-connector-board-sync-button').click()
        const diffResponse = await diffResponsePromise
        expect(diffResponse.status()).toBe(200)

        const diffDialog = page.getByRole('dialog', { name: 'Schema Changes' })
        await expect(diffDialog).toBeVisible({ timeout: 30_000 })
        await expect(diffDialog.getByText('This publication version requires application workspaces.')).toBeVisible()
        await expect(diffDialog.getByText('Workspaces', { exact: true })).toHaveCount(0)
        await diffDialog
            .getByLabel('I understand that workspaces cannot be turned off after they are enabled for this application.')
            .check()

        const syncResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/application/${applicationId}/sync`),
            { label: 'Creating imported LMS application schema with workspaces', timeout: 420_000 }
        )
        await diffDialog.getByRole('button', { name: 'Create Schema' }).click()
        const syncResponse = await syncResponsePromise
        expect(syncResponse.status()).toBe(200)
        expect(syncResponse.request().postDataJSON()).toMatchObject({
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect(diffDialog).toHaveCount(0)

        const [studentsCatalogId, quizResponsesCatalogId, moduleProgressCatalogId, enrollmentsCatalogId, progressLedgerId] =
            await Promise.all([
                waitForApplicationCatalogId(api, applicationId, 'Students'),
                waitForApplicationCatalogId(api, applicationId, 'Quiz Responses'),
                waitForApplicationCatalogId(api, applicationId, 'Module Progress'),
                waitForApplicationCatalogId(api, applicationId, 'Enrollments'),
                waitForApplicationLedgerId(api, applicationId, 'ProgressLedger')
            ])

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Learning' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.title.en, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.en)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByText(LMS_WELCOME_PAGE.howToStartTitle.en, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.en)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Catalog', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Learners', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Department Progress', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Assignment Scores', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: 'Workspaces' })).toHaveCount(1)
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Learning portal stats')).toHaveCount(0)
        await expect(page.getByText('Dashboard preview of the canonical learning lesson')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0)
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await assertNoHorizontalOverflow(page, 'LMS dashboard')
        await assertElementFitsViewport(page, 'runtime-page-blocks', 'LMS dashboard page block surface')
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-en.png'), fullPage: true })

        await page.getByRole('link', { name: 'Workspaces' }).first().click()
        await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-workspaces-card-view')).toBeVisible({ timeout: 30_000 })
        await assertNoHorizontalOverflow(page, 'LMS workspaces page')
        await assertElementFitsViewport(page, 'runtime-workspaces-card-view', 'LMS workspaces card surface')
        await page.screenshot({ path: testInfo.outputPath('lms-workspaces-en.png'), fullPage: true })
        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })

        await clickRuntimeNavigationItem(page, 'Knowledge')
        await expect(page.getByText('Quizzes', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await clickRuntimeNavigationItem(page, 'Development')
        await expect(page.getByText('Classes', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await clickRuntimeNavigationItem(page, 'Reports')
        await expect(page.getByText('Reports', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Обучение' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.title.ru, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.ru)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByText(LMS_WELCOME_PAGE.howToStartTitle.ru, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.ru)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Каталог', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Учащиеся', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Прогресс подразделений', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Оценки заданий', { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Нет данных для отображения', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Learners', { exact: true })).toHaveCount(0)
        await expect(page.getByText('No data to display', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Рабочие пространства' })).toHaveCount(1)
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Статистика учебного портала')).toHaveCount(0)
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-ru.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SAMPLE_LINK.slug}`)

        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Your name').fill('Learning guest learner')
        await page.getByRole('button', { name: 'Start learning' }).click()

        await expect(page.getByText(LMS_DEMO_MODULE.title.en)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_DEMO_MODULE.contentItems.en[0].itemContent)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Next' }).click()
        await expect(page.getByText(LMS_DEMO_MODULE.contentItems.en[1].itemTitle)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Open quiz' }).click()

        await expect(page.getByText(LMS_DEMO_QUIZ.questions.en[0].prompt)).toBeVisible({ timeout: 30_000 })
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[0].options[0].label, 'en')
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[1].options[0].label, 'en')
        await page.getByRole('button', { name: 'Submit quiz' }).click()
        await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Back to module' }).click()
        await page.getByRole('button', { name: 'Complete module' }).click()
        await expect(page.getByText('Module complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SECONDARY_LINK.slug}?locale=ru`)

        await expect(page.getByLabel('Ваше имя')).toBeVisible({ timeout: 30_000 })
        await page.getByLabel('Ваше имя').fill('Русский гость')
        await page.getByRole('button', { name: 'Начать обучение' }).click()

        const secondaryModule = LMS_DEMO_MODULES.find((module) => module.accessLinkSlug === LMS_SECONDARY_LINK.slug)
        if (!secondaryModule) {
            throw new Error('LMS fixture contract is missing the secondary public module definition')
        }

        await expect(page.getByText(secondaryModule.title.ru)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(secondaryModule.contentItems.ru[0].itemContent ?? '')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Далее' }).click()
        await expect(page.getByText(secondaryModule.contentItems.ru[1].itemTitle)).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Открыть тест' }).click()

        const secondaryQuiz = LMS_DEMO_QUIZZES.find((quiz) => quiz.key === 'docking-corridor')
        if (!secondaryQuiz) {
            throw new Error('LMS fixture contract is missing the secondary public quiz definition')
        }

        await expect(page.getByText(secondaryQuiz.questions.ru[0].prompt)).toBeVisible({ timeout: 30_000 })
        await checkQuizOption(page, secondaryQuiz.questions.ru[0].options[0].label, 'ru')
        await checkQuizOption(page, secondaryQuiz.questions.ru[1].options[0].label, 'ru')
        await page.getByRole('button', { name: 'Отправить тест' }).click()
        await expect(page.getByText('Результат 2 / 2')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Назад к модулю' }).click()
        await expect(page.getByRole('button', { name: 'Завершить модуль' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Завершить модуль' }).click()
        await expect(page.getByText('Модуль завершён. Прогресс записан для этой сессии.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey-ru.png'), fullPage: true })

        const workspaces = await listApplicationWorkspaces(api, applicationId)
        const workspaceItems = Array.isArray(workspaces?.items) ? workspaces.items : []
        expect(workspaceItems.filter((workspace) => workspace?.workspaceType === 'shared' || workspace?.type === 'shared')).toHaveLength(0)
        const mainWorkspaceId = workspaceItems.find(
            (workspace) => workspace?.isDefault === true || workspace?.workspaceType === 'personal' || workspace?.type === 'personal'
        )?.id
        if (typeof mainWorkspaceId !== 'string' || mainWorkspaceId.length === 0) {
            throw new Error('Main application workspace was not found for final runtime verification')
        }

        await expectPublicRuntimeSecurityEdges(page, applicationId)
        await expectRegistrarOnlyLedgerRejectsManualWrite(api, applicationId, progressLedgerId, mainWorkspaceId)

        const enrollmentRows = await waitForApplicationRuntimeRowCount(
            api,
            applicationId,
            enrollmentsCatalogId,
            LMS_DEMO_ENROLLMENTS.length,
            {
                workspaceId: mainWorkspaceId
            }
        )
        const enrollmentToPost = enrollmentRows.find((row) => row?._app_record_state !== 'posted') ?? enrollmentRows[0]
        if (typeof enrollmentToPost?.id !== 'string') {
            throw new Error('LMS posting proof could not find an enrollment runtime row')
        }

        await page.goto(`/a/${applicationId}/${encodeURIComponent(enrollmentsCatalogId)}`)
        await expect(page.getByTestId(`grid-row-actions-trigger-${enrollmentToPost.id}`)).toBeVisible({ timeout: 30_000 })
        await runRuntimeRecordCommandFromRow(page, enrollmentToPost.id, 'post')

        const progressFacts = await waitForApplicationLedgerFactCount(api, applicationId, progressLedgerId, 1, {
            workspaceId: mainWorkspaceId
        })
        expect(progressFacts[0]?.data).toMatchObject({
            SourceRowId: enrollmentToPost.id,
            SourceLineId: 'enrollment-progress'
        })
        const postedProgressDelta = Number(progressFacts[0]?.data?.ProgressDelta ?? 0)
        expect(Number.isFinite(postedProgressDelta)).toBe(true)

        await runRuntimeRecordCommandFromRow(page, enrollmentToPost.id, 'unpost')

        const compensatedProgressFacts = await waitForApplicationLedgerFactCount(api, applicationId, progressLedgerId, 2, {
            workspaceId: mainWorkspaceId
        })
        const progressDeltas = compensatedProgressFacts
            .map((fact) => Number(fact?.data?.ProgressDelta ?? 0))
            .sort((left, right) => left - right)
        expect(progressDeltas.every(Number.isFinite)).toBe(true)
        expect(progressDeltas.reduce((sum, delta) => sum + delta, 0)).toBeCloseTo(0)
        if (postedProgressDelta !== 0) {
            expect(progressDeltas).toEqual([-postedProgressDelta, postedProgressDelta].sort((left, right) => left - right))
        } else {
            expect(progressDeltas.every((delta) => delta === 0)).toBe(true)
        }

        const [studentRows, quizResponseRows, moduleProgressRows] = await Promise.all([
            waitForApplicationRuntimeRowCount(api, applicationId, studentsCatalogId, LMS_DEMO_STUDENTS.length + 2, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, quizResponsesCatalogId, LMS_DEMO_QUIZ_RESPONSES.length + 4, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, moduleProgressCatalogId, LMS_DEMO_MODULE_PROGRESS.length + 2, {
                workspaceId: mainWorkspaceId
            })
        ])

        expect(studentRows).toHaveLength(LMS_DEMO_STUDENTS.length + 2)
        expect(quizResponseRows).toHaveLength(LMS_DEMO_QUIZ_RESPONSES.length + 4)
        expect(moduleProgressRows).toHaveLength(LMS_DEMO_MODULE_PROGRESS.length + 2)
        expectNoBrowserRuntimeIssues(browserIssues, 'LMS snapshot runtime flow')
    })
})
