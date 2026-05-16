import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page, Response } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    createRuntimeRow,
    disposeApiContext,
    listObjectCollections,
    listMetahubEntityTypes,
    listLayouts,
    listApplicationWorkspaces,
    listLayoutZoneWidgets,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import {
    applicationSelectors,
    buildGridRowActionsTriggerSelector,
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
    LMS_DEMO_REPORTS,
    LMS_DEMO_STUDENTS,
    LMS_FIXTURE_FILENAME,
    LMS_PUBLICATION,
    LMS_SAMPLE_LINK,
    LMS_SECONDARY_LINK,
    LMS_WELCOME_PAGE
} from '../../support/lmsFixtureContract'
import {
    waitForApplicationObjectId,
    waitForApplicationLedgerFactCount,
    waitForApplicationLedgerId,
    waitForApplicationRuntimeRow,
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
type RuntimeMutationResponse = {
    id?: string
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
    const directItem = page.getByRole('link', { name }).or(page.getByRole('button', { name })).first()
    try {
        await expect(directItem).toBeVisible({ timeout: 30_000 })
        await directItem.click()
        return
    } catch (error) {
        if ((await directItem.count()) > 0) {
            throw error
        }
    }

    const overflowButton = page.getByRole('button', { name: 'More' })
    await expect(overflowButton).toBeVisible({ timeout: 30_000 })
    await overflowButton.click()

    const overflowItem = page.getByRole('menuitem', { name })
    await expect(overflowItem).toBeVisible({ timeout: 30_000 })
    await overflowItem.click()
}

async function expectRuntimeNavigationItemSelected(page: Page, name: string): Promise<void> {
    const directItem = page.getByRole('link', { name }).or(page.getByRole('button', { name })).first()
    try {
        await expect(directItem).toBeVisible({ timeout: 5_000 })
        await expect(directItem).toHaveAttribute('aria-current', 'page')
        return
    } catch (error) {
        if ((await directItem.count()) > 0) {
            throw error
        }
    }

    const overflowButton = page.getByRole('button', { name: 'More' })
    await expect(overflowButton).toBeVisible({ timeout: 30_000 })
    await overflowButton.click()

    const overflowItem = page.getByRole('menuitem', { name })
    await expect(overflowItem).toHaveClass(/Mui-selected/)
    await page.keyboard.press('Escape')
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()
    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }
    return JSON.parse(bodyText) as T
}

async function fillRuntimeBlockEditorField(page: Page, dialog: Locator, value: string) {
    const editorRoot = dialog.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
    await expect(editorRoot.getByText(value)).toBeVisible()
    await page.waitForTimeout(800)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function extractRuntimeBlockTexts(value: unknown): string[] {
    const root = isRecord(value) ? value : null
    const data = isRecord(root?.data) ? root.data : null
    const blocks = Array.isArray(root?.blocks) ? root.blocks : Array.isArray(data?.blocks) ? data.blocks : []

    return blocks.flatMap((block) => {
        const blockRecord = isRecord(block) ? block : null
        const blockData = isRecord(blockRecord?.data) ? blockRecord.data : null
        return typeof blockData?.text === 'string' ? [blockData.text] : []
    })
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
    const importResponseTimeoutMs = 300_000
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
            let response = await waitForNextImportResponse(importResponseTimeoutMs)

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
    const payload = await listObjectCollections(api, metahubId, { kindKey, limit: 200, offset: 0 })
    const entity = (payload?.items ?? []).find((item: Record<string, unknown>) => readLocalizedText(item?.codename, 'en') === codename)
    if (!entity || typeof entity.id !== 'string') {
        throw new Error(`Entity ${kindKey}/${codename} was not found in imported LMS metahub ${metahubId}`)
    }

    return entity.id
}

async function findObjectIdByCodename(api: ApiContext, metahubId: string, codename: string): Promise<string> {
    return findEntityInstanceIdByCodename(api, metahubId, 'object', codename)
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

function buildLmsOwnerWorkflowRolePolicies() {
    const workflowCapabilities = [
        'assignment.review',
        'attendance.mark',
        'attendance.manage',
        'certificate.issue',
        'certificate.revoke',
        'development.task.update',
        'notification.deliver',
        'notification.manage'
    ]

    return {
        templates: [
            {
                codename: 'ownerPolicy',
                title: { en: 'LMS workflow operations' },
                baseRole: 'owner',
                rules: workflowCapabilities.map((capability) => ({
                    capability,
                    effect: 'allow',
                    scope: 'workspace'
                }))
            }
        ]
    }
}

async function grantLmsOwnerWorkflowCapabilities(api: ApiContext, applicationId: string): Promise<void> {
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
        settings: {
            rolePolicies: buildLmsOwnerWorkflowRolePolicies()
        }
    })

    if (!response.ok) {
        throw new Error(`Granting LMS owner workflow capabilities failed with ${response.status}: ${await response.text()}`)
    }
}

function requireRuntimeRowVersion(row: Record<string, unknown>, label: string): number {
    const version = Number(row._upl_version ?? row.version)
    if (!Number.isInteger(version) || version <= 0) {
        throw new Error(`${label} does not expose a positive runtime row version`)
    }
    return version
}

function requireRuntimeRowId(row: Record<string, unknown>, label: string): string {
    if (typeof row.id !== 'string') {
        throw new Error(`${label} does not expose a runtime row id`)
    }
    return row.id
}

async function createWorkflowRuntimeRow(
    api: ApiContext,
    applicationId: string,
    objectCollectionId: string,
    data: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const created = await createRuntimeRow(api, applicationId, {
        objectCollectionId,
        data
    })
    if (typeof created?.id !== 'string') {
        throw new Error(`Runtime row creation did not return an id for ${objectCollectionId}`)
    }

    return waitForApplicationRuntimeRow(api, applicationId, objectCollectionId, created.id)
}

async function runLmsWorkflowActionThroughUi(
    page: Page,
    api: ApiContext,
    applicationId: string,
    workspaceId: string,
    objectCollectionId: string,
    row: Record<string, unknown>,
    actionCodename: string,
    expectedToStatus: string,
    expectedPostingCommand: string | null = null
): Promise<Record<string, unknown>> {
    const rowId = requireRuntimeRowId(row, `Browser workflow action ${actionCodename}`)
    const expectedVersion = requireRuntimeRowVersion(row, `${objectCollectionId}/${rowId}`)

    await page.goto(`/a/${applicationId}/${encodeURIComponent(objectCollectionId)}`)
    const rowActions = page.getByTestId(`grid-row-actions-trigger-${rowId}`)
    await expect(rowActions).toBeVisible({ timeout: 30_000 })
    await rowActions.click()

    const action = page.getByTestId(`runtime-workflow-action-${actionCodename}`).first()
    await expect(action).toBeVisible({ timeout: 30_000 })

    const responsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/runtime/rows/${encodeURIComponent(rowId)}/workflow/${encodeURIComponent(actionCodename)}`),
        { timeout: 30_000 }
    )
    await action.click()
    const confirmationDialog = page.getByRole('dialog').last()
    if (await confirmationDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        const confirmButtonNames: Record<string, string> = {
            AcceptSubmission: 'Accept',
            DeclineSubmission: 'Decline',
            IssueCertificate: 'Issue',
            RevokeCertificate: 'Revoke'
        }
        const confirmButtonName = confirmButtonNames[actionCodename] ?? 'Confirm'
        await confirmationDialog.getByRole('button', { name: confirmButtonName }).click()
    }
    const response = await responsePromise
    expect(response.ok(), `Browser workflow action ${actionCodename} must succeed`).toBe(true)

    const payload = await response.json()
    expect(payload).toMatchObject({
        id: rowId,
        actionCodename,
        toStatus: expectedToStatus,
        postingCommand: expectedPostingCommand
    })
    expect(Number(payload.version), `${actionCodename} must advance the row version through UI`).toBe(expectedVersion + 1)

    const updatedRow = await waitForApplicationRuntimeRow(api, applicationId, objectCollectionId, rowId)
    expect(requireRuntimeRowVersion(updatedRow, `${objectCollectionId}/${rowId}`)).toBe(expectedVersion + 1)
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    return updatedRow
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
        const widgetKeys = new Set((layoutWidgets.items ?? []).map((item: Record<string, unknown>) => item?.widgetKey))
        expect(widgetKeys.has('moduleViewerWidget')).toBe(false)
        expect(widgetKeys.has('statsViewerWidget')).toBe(false)
        expect(widgetKeys.has('qrCodeWidget')).toBe(false)

        const menuWidget = (layoutWidgets.items ?? []).find((item: Record<string, unknown>) => item?.widgetKey === 'menuWidget')
        const menuWidgetConfig = menuWidget?.config && typeof menuWidget.config === 'object' ? menuWidget.config : {}
        expect((menuWidgetConfig as Record<string, unknown>).autoShowAllSections).toBe(false)
        expect((menuWidgetConfig as Record<string, unknown>).maxPrimaryItems).toBe(8)
        expect((menuWidgetConfig as Record<string, unknown>).startPage).toBe('LearnerHome')

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${importedId}/entities/object/instances`)
        await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByPlaceholder(/Поиск объектов/i)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Ledgers' })).toHaveCount(0)

        const metahubProgressLedgerId = await findEntityInstanceIdByCodename(api, importedId, 'object', 'ProgressLedger')
        await page.getByTestId(buildEntityMenuTriggerSelector('object', metahubProgressLedgerId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('object', 'edit', metahubProgressLedgerId)).click()
        let progressLedgerDialog = page.getByRole('dialog', { name: /Редактировать объект/i })
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
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/object/instance/${metahubProgressLedgerId}`),
            { label: 'Saving LMS Progress ledger schema periodicity' }
        )
        await progressLedgerDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await ledgerSchemaSaveResponse).ok()).toBe(true)
        await expect(progressLedgerDialog).toHaveCount(0)

        await page.getByTestId(buildEntityMenuTriggerSelector('object', metahubProgressLedgerId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('object', 'edit', metahubProgressLedgerId)).click()
        progressLedgerDialog = page.getByRole('dialog', { name: /Редактировать объект/i })
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
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/object/instance/${metahubProgressLedgerId}`),
            { label: 'Restoring LMS Progress ledger schema periodicity' }
        )
        await progressLedgerDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await ledgerSchemaRestoreResponse).ok()).toBe(true)
        await expect(progressLedgerDialog).toHaveCount(0)

        const progressLedgerCell = page.getByText('Регистр прогресса', { exact: true }).first()
        await expect(progressLedgerCell).toBeVisible({ timeout: 30_000 })
        await progressLedgerCell.click()
        await expect(page).toHaveURL(/\/entities\/object\/instance\/[0-9a-f-]+\/components$/i)

        const objectTypeId = await findEntityTypeIdByKind(api, importedId, 'object')
        await page.goto(`/metahub/${importedId}/entities`)
        await expect(page.getByTestId(buildEntityMenuTriggerSelector('entity-type', objectTypeId))).toBeVisible({ timeout: 30_000 })
        await page.getByTestId(buildEntityMenuTriggerSelector('entity-type', objectTypeId)).click()
        await page.getByTestId(buildEntityMenuItemSelector('entity-type', 'edit', objectTypeId)).click()

        const objectTypeDialog = page.getByRole('dialog', { name: /Редактировать сущность|Edit Entity/i })
        await expect(objectTypeDialog).toBeVisible({ timeout: 30_000 })
        await expect(objectTypeDialog.getByRole('checkbox', { name: 'Поведение' })).toBeChecked()
        await expect(objectTypeDialog.getByLabel('Дополнительные вкладки')).toHaveValue(/hubs/)
        await objectTypeDialog.getByRole('tab', { name: 'Возможности' }).click()
        await expect(objectTypeDialog.getByLabel('Схема данных')).toBeChecked()
        await expect(objectTypeDialog.getByLabel('Скрипты')).toBeChecked()
        await expect(objectTypeDialog.getByLabel('Runtime-поведение')).toBeChecked()
        await expect(objectTypeDialog.getByLabel('Физическая таблица')).toBeChecked()
        await objectTypeDialog.screenshot({ path: testInfo.outputPath('metahub-object-type-behavior-components-ru.png') })
        await objectTypeDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(objectTypeDialog).toHaveCount(0)

        const enrollmentObjectId = await findObjectIdByCodename(api, importedId, 'Enrollments')
        await page.goto(`/metahub/${importedId}/entities/object/instances`)
        await expect(page.getByRole('heading', { name: 'Объекты' })).toBeVisible({ timeout: 30_000 })
        const openEnrollmentObjectDialog = async () => {
            await page.getByPlaceholder(/Поиск объектов/i).fill('Enrollments')
            const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('object', enrollmentObjectId))
            await expect(menuTrigger).toBeVisible({ timeout: 30_000 })
            await menuTrigger.click()
            await page.getByTestId(buildEntityMenuItemSelector('object', 'edit', enrollmentObjectId)).click()
            const dialog = page.getByRole('dialog', { name: /Редактировать объект/i })
            await expect(dialog).toBeVisible({ timeout: 30_000 })
            return dialog
        }

        await page
            .getByRole('button', { name: /создать/i })
            .last()
            .click()
        const createObjectDialog = page.getByRole('dialog', { name: /Создать объект/i })
        await expect(createObjectDialog).toBeVisible({ timeout: 30_000 })
        await createObjectDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(createObjectDialog.getByLabel('Режим записей')).toContainText('Справочник')
        await expect(createObjectDialog.getByLabel('Включить нумерацию записей')).not.toBeChecked()
        await expect(createObjectDialog.getByLabel('Включить дату действия')).not.toBeChecked()
        await expect(createObjectDialog.getByLabel('Префикс')).toHaveCount(0)
        await createObjectDialog.screenshot({ path: testInfo.outputPath('metahub-object-create-behavior-defaults-ru.png') })
        await createObjectDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(createObjectDialog).toHaveCount(0)

        let enrollmentDialog = await openEnrollmentObjectDialog()
        await enrollmentDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(enrollmentDialog.getByLabel('Режим записей')).toContainText('Транзакционный')
        await expect(enrollmentDialog.getByLabel('Префикс')).toHaveValue('ENR-')
        await expect(enrollmentDialog.getByText(/Регистр прогресса|ProgressLedger/).first()).toBeVisible({ timeout: 30_000 })
        await expect(enrollmentDialog.locator('input[value="EnrollmentPostingScript"]')).toHaveCount(1, { timeout: 30_000 })
        await enrollmentDialog.screenshot({ path: testInfo.outputPath('metahub-object-enrollments-behavior-before-save-ru.png') })
        await enrollmentDialog.getByLabel('Префикс').fill('ENR-QA-')

        const behaviorSaveResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/object/instance/${enrollmentObjectId}`),
            { label: 'Saving LMS Enrollment behavior prefix' }
        )
        await enrollmentDialog.getByTestId(entityDialogSelectors.submitButton).click()
        expect((await behaviorSaveResponse).ok()).toBe(true)
        await expect(enrollmentDialog).toHaveCount(0)

        enrollmentDialog = await openEnrollmentObjectDialog()
        await enrollmentDialog.getByRole('tab', { name: 'Поведение' }).click()
        await expect(enrollmentDialog.getByLabel('Префикс')).toHaveValue('ENR-QA-')
        await enrollmentDialog.screenshot({ path: testInfo.outputPath('metahub-object-enrollments-behavior-reopened-ru.png') })
        await enrollmentDialog.getByLabel('Префикс').fill('ENR-')
        const behaviorRestoreResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/metahub/${importedId}/entities/object/instance/${enrollmentObjectId}`),
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
        await expect(
            diffDialog.getByText(
                'Application workspaces are enabled because the source metahub requires workspace-isolated application data. The schema will be created with workspace isolation automatically.'
            )
        ).toBeVisible()
        await expect(diffDialog.getByRole('switch', { name: 'Application workspaces are enabled' })).toBeChecked()
        await expect(
            diffDialog.getByLabel('I understand that workspaces cannot be turned off after they are enabled for this application.')
        ).toHaveCount(0)
        await expect(diffDialog.getByText('0 fields, 0 elements')).toHaveCount(0)
        await expect(diffDialog.getByText(/\d+ linked entities/).first()).toBeVisible()
        await expect(diffDialog.getByText(/\d+ blocks/).first()).toBeVisible()
        await expect(diffDialog.getByText(/\d+ constants/).first()).toBeVisible()
        await expect(diffDialog.getByText(/\d+ values/).first()).toBeVisible()
        await diffDialog.screenshot({ path: testInfo.outputPath('application-schema-diff-entity-metrics-en.png') })

        const syncResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/application/${applicationId}/sync`),
            { label: 'Creating imported LMS application schema with workspaces', timeout: 420_000 }
        )
        await diffDialog.getByRole('button', { name: 'Create Schema' }).click()
        const syncResponse = await syncResponsePromise
        expect(syncResponse.status()).toBe(200)
        expect(syncResponse.request().postDataJSON()).toMatchObject({
            schemaOptions: {
                workspaceModeRequested: 'enabled'
            }
        })
        await expect(diffDialog).toHaveCount(0)

        const [
            studentsObjectId,
            quizResponsesObjectId,
            moduleProgressObjectId,
            enrollmentsObjectId,
            assignmentsObjectId,
            assignmentSubmissionsObjectId,
            trainingEventsObjectId,
            trainingAttendanceObjectId,
            certificatesObjectId,
            certificateIssuesObjectId,
            developmentPlanStagesObjectId,
            developmentPlanTasksObjectId,
            notificationOutboxObjectId,
            progressLedgerId
        ] = await Promise.all([
            waitForApplicationObjectId(api, applicationId, 'Students'),
            waitForApplicationObjectId(api, applicationId, 'Quiz Responses'),
            waitForApplicationObjectId(api, applicationId, 'Module Progress'),
            waitForApplicationObjectId(api, applicationId, 'Enrollments'),
            waitForApplicationObjectId(api, applicationId, 'Assignments'),
            waitForApplicationObjectId(api, applicationId, 'AssignmentSubmissions'),
            waitForApplicationObjectId(api, applicationId, 'TrainingEvents'),
            waitForApplicationObjectId(api, applicationId, 'TrainingAttendance'),
            waitForApplicationObjectId(api, applicationId, 'Certificates'),
            waitForApplicationObjectId(api, applicationId, 'CertificateIssues'),
            waitForApplicationObjectId(api, applicationId, 'DevelopmentPlanStages'),
            waitForApplicationObjectId(api, applicationId, 'DevelopmentPlanTasks'),
            waitForApplicationObjectId(api, applicationId, 'NotificationOutbox'),
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
        await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Enrollments' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Certificates' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Department Progress' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Assignment Scores' })).toBeVisible({ timeout: 30_000 })
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
        await expect(page.getByTestId('runtime-pagination-surface')).toBeVisible({ timeout: 30_000 })
        await assertNoHorizontalOverflow(page, 'LMS workspaces page')
        await assertElementFitsViewport(page, 'runtime-workspaces-card-view', 'LMS workspaces card surface')
        await page.getByRole('button', { name: 'Table view' }).click()
        await expect(page.getByTestId('runtime-list-surface')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('runtime-pagination-surface')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-workspaces-en.png'), fullPage: true })
        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })

        const assertHomeDashboardWidgetsHidden = async () => {
            await expect(page.getByText('Learners', { exact: true })).toHaveCount(0)
            await expect(page.getByText('Department Progress', { exact: true })).toHaveCount(0)
            await expect(page.getByText('Assignment Scores', { exact: true })).toHaveCount(0)
        }

        await clickRuntimeNavigationItem(page, 'Knowledge')
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
        const knowledgeArticlesObjectId = await waitForApplicationObjectId(api, applicationId, 'Knowledge Articles')
        const authoredArticleTitle = `Published app article ${runManifest.runId}`
        const authoredArticleBody = `Created in the published application ${runManifest.runId}`
        const updatedArticleBody = `Updated in the published application ${runManifest.runId}`

        await page.getByTestId(applicationSelectors.runtimeCreateButton).click()
        const createArticleDialog = page.getByRole('dialog', { name: 'Create element' })
        await expect(createArticleDialog).toBeVisible()
        await createArticleDialog.getByLabel('Knowledge Folder').click()
        await page.getByRole('option', { name: /Getting started articles/ }).click()
        await createArticleDialog.getByLabel('Title').first().fill(authoredArticleTitle)
        await fillRuntimeBlockEditorField(page, createArticleDialog, authoredArticleBody)
        const createArticleRequest = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows`),
            { label: 'Creating LMS knowledge article' }
        )
        await createArticleDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const createdArticleResponse = await createArticleRequest
        const createdArticle = await parseJsonResponse<RuntimeMutationResponse>(createdArticleResponse, 'Creating LMS knowledge article')
        if (!createdArticle.id) {
            throw new Error('Created LMS knowledge article did not return an id')
        }
        await expect(page.getByText(authoredArticleTitle, { exact: true })).toBeVisible({ timeout: 30_000 })
        const createdArticleRow = await waitForApplicationRuntimeRow(api, applicationId, knowledgeArticlesObjectId, createdArticle.id)
        expect(readLocalizedText(createdArticleRow?.Title)).toBe(authoredArticleTitle)
        expect(extractRuntimeBlockTexts(createdArticleRow?.Body)).toContain(authoredArticleBody)

        await page.getByTestId(buildGridRowActionsTriggerSelector(createdArticle.id)).click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        const editArticleDialog = page.getByRole('dialog', { name: 'Edit element' })
        await expect(editArticleDialog).toBeVisible()
        await fillRuntimeBlockEditorField(page, editArticleDialog, updatedArticleBody)
        const editArticleRequest = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/runtime/rows/${createdArticle.id}`),
            { label: 'Editing LMS knowledge article' }
        )
        await editArticleDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect((await editArticleRequest).ok()).toBe(true)
        const updatedArticleRow = await waitForApplicationRuntimeRow(api, applicationId, knowledgeArticlesObjectId, createdArticle.id)
        expect(extractRuntimeBlockTexts(updatedArticleRow?.Body)).toContain(updatedArticleBody)
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await expect(page.getByText('[object Object]', { exact: true })).toHaveCount(0)
        await assertHomeDashboardWidgetsHidden()
        await page.screenshot({ path: testInfo.outputPath('lms-knowledge-without-home-widgets-en.png'), fullPage: true })
        await clickRuntimeNavigationItem(page, 'Development')
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await assertHomeDashboardWidgetsHidden()
        const reportsNavigationItem = page
            .getByRole('link', { name: 'Reports' })
            .or(page.getByRole('button', { name: 'Reports' }))
            .first()
        await expect(reportsNavigationItem).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('link', { name: 'More' }).or(page.getByRole('button', { name: 'More' }))).toHaveCount(0)
        await clickRuntimeNavigationItem(page, 'Reports')
        await expectRuntimeNavigationItemSelected(page, 'Reports')
        await expect(page.getByText('Reports', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        await expect(page.getByText('[object Object]', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('gridcell', { name: 'All active learners' }).first()).toBeVisible({ timeout: 30_000 })
        await assertHomeDashboardWidgetsHidden()

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
        await expect(page.getByRole('heading', { name: 'Учащиеся' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Модули' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Назначения' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Сертификаты' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Прогресс подразделений' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Оценки заданий' })).toBeVisible({ timeout: 30_000 })
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
            enrollmentsObjectId,
            LMS_DEMO_ENROLLMENTS.length,
            {
                workspaceId: mainWorkspaceId
            }
        )
        const enrollmentToPost = enrollmentRows.find((row) => row?._app_record_state !== 'posted') ?? enrollmentRows[0]
        if (typeof enrollmentToPost?.id !== 'string') {
            throw new Error('LMS posting proof could not find an enrollment runtime row')
        }

        await page.goto(`/a/${applicationId}/${encodeURIComponent(enrollmentsObjectId)}`)
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
            waitForApplicationRuntimeRowCount(api, applicationId, studentsObjectId, LMS_DEMO_STUDENTS.length + 2, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, quizResponsesObjectId, LMS_DEMO_QUIZ_RESPONSES.length + 4, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, moduleProgressObjectId, LMS_DEMO_MODULE_PROGRESS.length + 2, {
                workspaceId: mainWorkspaceId
            })
        ])

        expect(studentRows).toHaveLength(LMS_DEMO_STUDENTS.length + 2)
        expect(quizResponseRows).toHaveLength(LMS_DEMO_QUIZ_RESPONSES.length + 4)
        expect(moduleProgressRows).toHaveLength(LMS_DEMO_MODULE_PROGRESS.length + 2)
        const primaryStudentId = studentRows.find((row) => typeof row?.id === 'string')?.id
        if (typeof primaryStudentId !== 'string') {
            throw new Error('LMS workflow proof could not find a student runtime row')
        }

        const developmentStageRows = await waitForApplicationRuntimeRowCount(api, applicationId, developmentPlanStagesObjectId, 1, {
            workspaceId: mainWorkspaceId
        })
        const primaryDevelopmentStageId = developmentStageRows.find((row) => typeof row?.id === 'string')?.id
        if (typeof primaryDevelopmentStageId !== 'string') {
            throw new Error('LMS workflow proof could not find a development stage runtime row')
        }

        const assignmentRow = await createWorkflowRuntimeRow(api, applicationId, assignmentsObjectId, {
            Title: 'Operational workflow assignment',
            TargetType: 'module'
        })
        const trainingEventRow = await createWorkflowRuntimeRow(api, applicationId, trainingEventsObjectId, {
            Title: 'Operational workflow training event',
            StartsAt: '2026-05-15T09:00:00.000Z',
            EndsAt: '2026-05-15T10:00:00.000Z',
            Capacity: 12
        })
        const certificateRow = await createWorkflowRuntimeRow(api, applicationId, certificatesObjectId, {
            CertificateNumber: 'CERT-E2E-WORKFLOW',
            StudentId: primaryStudentId,
            IssuedAt: '2026-05-15T10:00:00.000Z'
        })
        const assignmentRowId = requireRuntimeRowId(assignmentRow, 'Operational workflow assignment')
        const trainingEventRowId = requireRuntimeRowId(trainingEventRow, 'Operational workflow training event')
        const certificateRowId = requireRuntimeRowId(certificateRow, 'Operational workflow certificate')

        let browserGatedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, assignmentSubmissionsObjectId, {
            AssignmentId: assignmentRowId,
            StudentId: primaryStudentId,
            SubmittedAt: '2026-05-15T10:30:00.000Z',
            Status: 'Submitted',
            Score: 0
        })
        const browserGatedSubmissionRowId = requireRuntimeRowId(browserGatedSubmissionRow, 'Browser-gated workflow submission')
        const browserGatedSubmissionVersion = requireRuntimeRowVersion(browserGatedSubmissionRow, 'Browser-gated workflow submission')

        await page.goto(`/a/${applicationId}/${encodeURIComponent(assignmentSubmissionsObjectId)}`)
        await expect(page.getByTestId(`grid-row-actions-trigger-${browserGatedSubmissionRowId}`)).toBeVisible({ timeout: 30_000 })
        await page.getByTestId(`grid-row-actions-trigger-${browserGatedSubmissionRowId}`).click()
        await expect(page.getByTestId('runtime-workflow-action-StartSubmissionReview')).toHaveCount(0)
        await page.screenshot({ path: testInfo.outputPath('lms-workflow-action-hidden-without-capability-en.png'), fullPage: true })
        await page.keyboard.press('Escape')

        const deniedWorkflowResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/rows/${browserGatedSubmissionRowId}/workflow/StartSubmissionReview?workspaceId=${encodeURIComponent(
                mainWorkspaceId
            )}`,
            {
                objectCollectionId: assignmentSubmissionsObjectId,
                expectedVersion: browserGatedSubmissionVersion
            }
        )
        expect(deniedWorkflowResponse.status).toBe(403)
        await expect(deniedWorkflowResponse.json()).resolves.toMatchObject({
            code: 'WORKFLOW_ACTION_UNAVAILABLE',
            reason: 'missingCapability',
            missingCapabilities: ['assignment.review']
        })

        await grantLmsOwnerWorkflowCapabilities(api, applicationId)
        await page.goto(`/a/${applicationId}/${encodeURIComponent(assignmentSubmissionsObjectId)}`)
        await expect(page.getByTestId(`grid-row-actions-trigger-${browserGatedSubmissionRowId}`)).toBeVisible({ timeout: 30_000 })
        await page.getByTestId(`grid-row-actions-trigger-${browserGatedSubmissionRowId}`).click()
        const startReviewAction = page.getByTestId('runtime-workflow-action-StartSubmissionReview').first()
        await expect(startReviewAction).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-workflow-action-visible-with-capability-en.png'), fullPage: true })
        const browserWorkflowResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/runtime/rows/${encodeURIComponent(browserGatedSubmissionRowId)}/workflow/StartSubmissionReview`),
            { timeout: 30_000 }
        )
        await startReviewAction.click()
        const browserWorkflowResponse = await browserWorkflowResponsePromise
        expect(browserWorkflowResponse.ok(), 'Browser workflow action must succeed after the capability grant').toBe(true)
        browserGatedSubmissionRow = await waitForApplicationRuntimeRow(
            api,
            applicationId,
            assignmentSubmissionsObjectId,
            browserGatedSubmissionRowId
        )
        expect(browserGatedSubmissionRow.Status).toBe('PendingReview')
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        let acceptedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, assignmentSubmissionsObjectId, {
            AssignmentId: assignmentRowId,
            StudentId: primaryStudentId,
            SubmittedAt: '2026-05-15T11:00:00.000Z',
            Status: 'Submitted',
            Score: 0
        })
        acceptedSubmissionRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            assignmentSubmissionsObjectId,
            acceptedSubmissionRow,
            'StartSubmissionReview',
            'PendingReview'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            assignmentSubmissionsObjectId,
            acceptedSubmissionRow,
            'AcceptSubmission',
            'Accepted',
            'post'
        )

        let declinedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, assignmentSubmissionsObjectId, {
            AssignmentId: assignmentRowId,
            StudentId: primaryStudentId,
            SubmittedAt: '2026-05-15T11:30:00.000Z',
            Status: 'Submitted',
            Score: 0
        })
        declinedSubmissionRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            assignmentSubmissionsObjectId,
            declinedSubmissionRow,
            'StartSubmissionReview',
            'PendingReview'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            assignmentSubmissionsObjectId,
            declinedSubmissionRow,
            'DeclineSubmission',
            'Declined'
        )

        let attendedRow = await createWorkflowRuntimeRow(api, applicationId, trainingAttendanceObjectId, {
            TrainingEventId: trainingEventRowId,
            StudentId: primaryStudentId,
            CheckedInAt: '2026-05-15T09:05:00.000Z',
            Status: 'Registered',
            DurationMinutes: 60
        })
        attendedRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            trainingAttendanceObjectId,
            attendedRow,
            'MarkAttendanceAttended',
            'Attended',
            'post'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            trainingAttendanceObjectId,
            attendedRow,
            'CancelAttendance',
            'Cancelled',
            'void'
        )

        const noShowRow = await createWorkflowRuntimeRow(api, applicationId, trainingAttendanceObjectId, {
            TrainingEventId: trainingEventRowId,
            StudentId: primaryStudentId,
            CheckedInAt: '2026-05-15T09:10:00.000Z',
            Status: 'Registered',
            DurationMinutes: 0
        })
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            trainingAttendanceObjectId,
            noShowRow,
            'MarkAttendanceNoShow',
            'NoShow',
            'post'
        )

        let certificateIssueRow = await createWorkflowRuntimeRow(api, applicationId, certificateIssuesObjectId, {
            CertificateId: certificateRowId,
            CertificateNumber: 'CERT-E2E-ISSUE-001',
            StudentId: primaryStudentId,
            IssuedAt: '2026-05-15T12:00:00.000Z',
            Status: 'Eligible'
        })
        certificateIssueRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            certificateIssuesObjectId,
            certificateIssueRow,
            'IssueCertificate',
            'Issued',
            'post'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            certificateIssuesObjectId,
            certificateIssueRow,
            'RevokeCertificate',
            'Revoked',
            'post'
        )

        let developmentTaskRow = await createWorkflowRuntimeRow(api, applicationId, developmentPlanTasksObjectId, {
            StageId: primaryDevelopmentStageId,
            Title: 'Operational workflow task',
            Status: 'NotStarted',
            UpdatedAt: '2026-05-15T13:00:00.000Z'
        })
        developmentTaskRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            developmentPlanTasksObjectId,
            developmentTaskRow,
            'StartDevelopmentTask',
            'InProgress'
        )
        developmentTaskRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            developmentPlanTasksObjectId,
            developmentTaskRow,
            'CompleteDevelopmentTask',
            'Completed'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            developmentPlanTasksObjectId,
            developmentTaskRow,
            'ReopenDevelopmentTask',
            'InProgress'
        )

        const sentNotificationRow = await createWorkflowRuntimeRow(api, applicationId, notificationOutboxObjectId, {
            Recipient: 'learner@example.test',
            Payload: { template: 'assignment-review-completed' },
            CreatedAt: '2026-05-15T14:00:00.000Z',
            Status: 'Queued'
        })
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            notificationOutboxObjectId,
            sentNotificationRow,
            'MarkNotificationSent',
            'Sent',
            'post'
        )

        let failedNotificationRow = await createWorkflowRuntimeRow(api, applicationId, notificationOutboxObjectId, {
            Recipient: 'ops@example.test',
            Payload: { template: 'attendance-follow-up' },
            CreatedAt: '2026-05-15T14:15:00.000Z',
            Status: 'Queued'
        })
        failedNotificationRow = await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            notificationOutboxObjectId,
            failedNotificationRow,
            'MarkNotificationFailed',
            'Failed'
        )
        await runLmsWorkflowActionThroughUi(
            page,
            api,
            applicationId,
            mainWorkspaceId,
            notificationOutboxObjectId,
            failedNotificationRow,
            'CancelNotification',
            'Cancelled',
            'void'
        )

        const learnerProgressReport = LMS_DEMO_REPORTS.find((report) => report.codename === 'LearnerProgress')
        if (!learnerProgressReport) {
            throw new Error('LMS fixture contract is missing the learner progress report definition')
        }

        const reportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(mainWorkspaceId)}`,
            {
                reportCodename: learnerProgressReport.codename,
                limit: 10,
                offset: 0
            }
        )
        if (!reportResponse.ok) {
            throw new Error(`Saved LMS report execution failed with ${reportResponse.status}: ${await reportResponse.text()}`)
        }

        const reportPayload = await reportResponse.json()
        expect(reportPayload.definition?.codename).toBe(learnerProgressReport.codename)
        expect(Array.isArray(reportPayload.rows)).toBe(true)
        expect(Number(reportPayload.total)).toBeGreaterThanOrEqual(LMS_DEMO_MODULE_PROGRESS.length)
        expect(typeof reportPayload.aggregations?.AverageProgress).toBe('number')

        expectNoBrowserRuntimeIssues(browserIssues, 'LMS snapshot runtime flow')
    })
})
