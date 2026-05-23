import fs from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page, Response } from '@playwright/test'
import { buildVLC, createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectHeightsAligned, expectVerticalGapBetween } from '../../support/browser/spacing'
import {
    expectDataGridHorizontalScrollConstrained,
    expectElementFitsViewport,
    expectLocatorFitsViewport,
    expectLocatorHasNoInlineOverflow,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectRuntimeUxViewportMatrix,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    createRuntimeRow,
    disposeApiContext,
    getApplication,
    getApplicationRuntime,
    getRuntimeRow,
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
    LMS_DEMO_CONTENT_NODE,
    LMS_DEMO_CONTENT_PROGRESS,
    LMS_DEMO_CONTENT_NODES,
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
    waitForMetahubEnumerationId,
    waitForOptionValueId,
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

const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

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

async function seedSharedPublicGuestContent(options: {
    api: ApiContext
    page: Page
    applicationId: string
    workspaceId: string
    learningResourcesObjectId: string
    quizzesObjectId: string
    accessLinksObjectId: string
    textValueId: string
    quizRefValueId: string
    pageResourceTypeValueId: string
    publishedPublicationStatusValueId: string
    singleChoiceValueId: string
}) {
    const quizRowsByKey = new Map<string, { id: string }>()
    const publicContentNodes = LMS_DEMO_CONTENT_NODES.filter((content) => typeof content.accessLinkSlug === 'string')

    for (const seededQuiz of LMS_DEMO_QUIZZES.filter((quiz) => publicContentNodes.some((content) => content.linkedQuizKey === quiz.key))) {
        const quizRow = await createRuntimeRow(options.api, options.applicationId, {
            workspaceId: options.workspaceId,
            objectCollectionId: options.quizzesObjectId,
            data: {
                Title: buildVLC(seededQuiz.title.en, seededQuiz.title.ru),
                Description: buildVLC(seededQuiz.description.en, seededQuiz.description.ru),
                PassingScorePercent: seededQuiz.passingScorePercent,
                MaxAttempts: seededQuiz.maxAttempts,
                Questions: seededQuiz.questions.en.map((question, index) => ({
                    Id: `${seededQuiz.key}-public-question-${index + 1}`,
                    Prompt: buildVLC(question.prompt, seededQuiz.questions.ru[index].prompt),
                    QuestionDescription: buildVLC(question.description, seededQuiz.questions.ru[index].description),
                    QuestionType: options.singleChoiceValueId,
                    Difficulty: 1,
                    Explanation: buildVLC(question.explanation, seededQuiz.questions.ru[index].explanation),
                    Options: question.options,
                    SortOrder: question.sortOrder
                }))
            }
        })
        await waitForApplicationRuntimeRow(options.api, options.applicationId, options.quizzesObjectId, quizRow.id, {
            workspaceId: options.workspaceId
        })
        quizRowsByKey.set(seededQuiz.key, { id: quizRow.id })
    }

    for (const seededContent of publicContentNodes) {
        const linkedQuiz = quizRowsByKey.get(seededContent.linkedQuizKey)
        if (!linkedQuiz) {
            throw new Error(`Shared public LMS seed could not find linked quiz ${seededContent.linkedQuizKey}`)
        }

        const contentRow = await createRuntimeRow(options.api, options.applicationId, {
            workspaceId: options.workspaceId,
            objectCollectionId: options.learningResourcesObjectId,
            data: {
                Title: buildVLC(seededContent.title.en, seededContent.title.ru),
                Name: seededContent.title.en,
                Description: buildVLC(seededContent.description.en, seededContent.description.ru),
                ResourceType: options.pageResourceTypeValueId,
                Source: { type: 'page', pageCodename: 'CourseOverview' },
                EstimatedTimeMinutes: seededContent.estimatedDurationMinutes,
                PublicationStatus: options.publishedPublicationStatusValueId,
                ContentItems: seededContent.contentItems.en.map((item, index) => {
                    const localizedItem = seededContent.contentItems.ru[index]
                    const isQuizRef = item.itemType === 'QuizRef'
                    return {
                        ItemType: isQuizRef ? options.quizRefValueId : options.textValueId,
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
        await waitForApplicationRuntimeRow(options.api, options.applicationId, options.learningResourcesObjectId, contentRow.id, {
            workspaceId: options.workspaceId
        })

        const linkTitle = seededContent.accessLinkSlug === LMS_SECONDARY_LINK.slug ? LMS_SECONDARY_LINK.title : LMS_SAMPLE_LINK.title
        const accessLinkRow = await createRuntimeRow(options.api, options.applicationId, {
            workspaceId: options.workspaceId,
            objectCollectionId: options.accessLinksObjectId,
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
        await waitForApplicationRuntimeRow(options.api, options.applicationId, options.accessLinksObjectId, accessLinkRow.id, {
            workspaceId: options.workspaceId
        })

        await expect
            .poll(
                async () => {
                    const response = await options.page.request.get(
                        `/api/v1/public/a/${options.applicationId}/links/${seededContent.accessLinkSlug}`
                    )
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

async function checkQuizOption(page: Page, value: unknown, locale: string): Promise<void> {
    const primaryLabel = readLocalizedText(value, locale)
    let option: Locator | null = null
    if (primaryLabel) {
        const primaryLocator = page.getByLabel(primaryLabel)
        if (await primaryLocator.count()) {
            option = primaryLocator.first()
        }
    }

    if (!option && locale === 'en') {
        const fallbackLabel = readLocalizedText(value, 'en')
        if (fallbackLabel) {
            option = page.getByLabel(fallbackLabel).first()
        }
    }

    if (!option) {
        throw new Error(`Quiz option label is missing for locale ${locale}`)
    }

    await option.focus()
    await expect(option, `Quiz option must be keyboard-focusable for locale ${locale}`).toBeFocused()
    await page.keyboard.press('Space')
    await expect(option, `Quiz option must be checked after keyboard activation for locale ${locale}`).toBeChecked()
}

const RU_LMS_ENGLISH_FALLBACK_PATTERNS = [
    /\bCertificate policy page\b/,
    /\bCertificate policy PDF\b/,
    /\bCompliance Refresh Course\b/,
    /\bLearning Path 101\b/,
    /\bDocking Corridor Basics\b/,
    /\bCourse overview page\b/,
    /\bLearning portal web link\b/,
    /\bEmbedded orientation video\b/,
    /\bUse this page resource inside learning flows\./,
    /\bOpen page\b/,
    /\bNo data to display\b/,
    /\bLearners\b/,
    /\b(?:Create|Search|Type|Table columns|Card view|Table view|Copy|Delete|Restore|Share|Move to project|Rows per page)\b/
]

async function expectNoRussianLmsFallbackText(surface: Locator, label: string): Promise<void> {
    await expectNoVisibleTextPatterns(surface, RU_LMS_ENGLISH_FALLBACK_PATTERNS, { label })
}

async function activateButtonByKeyboard(page: Page, button: Locator, label: string): Promise<void> {
    await expect(button, `${label} button must be visible before keyboard activation`).toBeVisible({ timeout: 30_000 })
    await expect(button, `${label} button must be enabled before keyboard activation`).toBeEnabled({ timeout: 30_000 })
    await button.focus()
    await expect(button, `${label} button must receive keyboard focus`).toBeFocused()
    await page.keyboard.press('Enter')
}

async function clickRuntimeNavigationItem(page: Page, name: string): Promise<void> {
    const directItem = await waitForVisibleRuntimeNavigationItem(page, name, 30_000)
    if (directItem) {
        await directItem.click()
        return
    }

    const overflowButton = page.getByRole('button', { name: 'More' })
    await expect(overflowButton).toBeVisible({ timeout: 30_000 })
    await overflowButton.click()

    const overflowItem = page.getByRole('menuitem', { name })
    await expect(overflowItem).toBeVisible({ timeout: 30_000 })
    await overflowItem.click()
}

async function expectRuntimeNavigationItemSelected(page: Page, name: string): Promise<void> {
    const directItem = await waitForVisibleRuntimeNavigationItem(page, name, 30_000)
    if (directItem) {
        await expect(directItem).toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
        return
    }

    const overflowButton = page.getByRole('button', { name: 'More' })
    await expect(overflowButton).toBeVisible({ timeout: 30_000 })
    await overflowButton.click()

    const overflowItem = page.getByRole('menuitem', { name })
    await expect(overflowItem).toHaveClass(/Mui-selected/)
    await page.keyboard.press('Escape')
}

async function findVisibleRuntimeNavigationItem(page: Page, name: string): Promise<Locator | null> {
    const items = page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true }))
    const count = await items.count()
    for (let index = 0; index < count; index += 1) {
        const item = items.nth(index)
        if (await item.isVisible()) {
            return item
        }
    }
    return null
}

async function waitForVisibleRuntimeNavigationItem(page: Page, name: string, timeout: number): Promise<Locator | null> {
    try {
        await expect
            .poll(async () => Boolean(await findVisibleRuntimeNavigationItem(page, name)), {
                timeout,
                message: `runtime navigation item "${name}" should become visible`
            })
            .toBe(true)
        return findVisibleRuntimeNavigationItem(page, name)
    } catch {
        return null
    }
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()
    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }
    return JSON.parse(bodyText) as T
}

async function fillRuntimeBlockEditorField(_page: Page, dialog: Locator, value: string) {
    const editorRoot = dialog.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    const previousCommittedSequence = await editorRoot.getAttribute('data-editorjs-committed-sequence')
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.fill(value)
    await expect(editorRoot.getByText(value)).toBeVisible()
    await expect(editableBlock).toContainText(value)
    await expect
        .poll(() => editorRoot.getAttribute('data-editorjs-committed-sequence'), {
            message: 'Editor.js field must commit the latest visible text before submit',
            timeout: 20_000
        })
        .not.toBe(previousCommittedSequence)
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
    await expectRuntimeUxViewportMatrix(page, label)
}

async function assertElementFitsViewport(page: Page, testId: string, label: string): Promise<void> {
    await expectElementFitsViewport(page, testId, label)
}

async function assertNoHorizontalOverflowWithScreenshots(page: Page, label: string, screenshotPath: string): Promise<void> {
    const parsedPath = path.parse(screenshotPath)
    await expectRuntimeUxViewportMatrix(page, label, {
        beforeEachViewport: async (viewport) => {
            await page.screenshot({
                path: path.join(parsedPath.dir, `${parsedPath.name}-${viewport.name}${parsedPath.ext}`),
                fullPage: true
            })
        }
    })
}

async function revealRuntimeGridRowActions(page: Page): Promise<void> {
    const grid = page.getByRole('grid').first()
    await expect(grid).toBeVisible({ timeout: 30_000 })
    await grid.evaluate((node) => {
        const scroller = node.querySelector('.MuiDataGrid-virtualScroller')
        if (scroller instanceof HTMLElement) {
            scroller.scrollLeft = scroller.scrollWidth
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
        }
    })
}

async function getVisibleRuntimeRowActions(page: Page, rowId: string): Promise<Locator> {
    const trigger = page.getByTestId(`grid-row-actions-trigger-${rowId}`)
    if ((await trigger.count()) > 0) {
        try {
            await expect(trigger).toBeVisible({ timeout: 1_000 })
            return trigger
        } catch {
            // The actions column can be horizontally virtualized in wide LMS tables.
        }
    }

    await revealRuntimeGridRowActions(page)
    await expect(trigger).toBeVisible({ timeout: 30_000 })
    return trigger
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

async function getRuntimeRecordCommandMenuItem(page: Page, rowId: string, command: 'post' | 'unpost'): Promise<Locator> {
    const commandItemByTestId = page.getByTestId(`runtime-record-command-${command}`).first()
    const commandItemByLabel = page
        .getByRole('menuitem', {
            name: command === 'post' ? /^(post|провести|опубликовать)$/i : /^(unpost|отменить проведение|распровести)$/i
        })
        .first()

    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
        const trigger = await getVisibleRuntimeRowActions(page, rowId)
        await trigger.click()
        const commandItem = (await commandItemByTestId.count()) > 0 ? commandItemByTestId : commandItemByLabel

        try {
            await expect(commandItem).toBeVisible({ timeout: 1_500 })
            return commandItem
        } catch {
            await page.keyboard.press('Escape').catch(() => undefined)
            await expect(commandItem)
                .toHaveCount(0, { timeout: 750 })
                .catch(() => undefined)
        }
    }

    const trigger = await getVisibleRuntimeRowActions(page, rowId)
    await trigger.click()
    const commandItem = (await commandItemByTestId.count()) > 0 ? commandItemByTestId : commandItemByLabel
    await expect(commandItem).toBeVisible({ timeout: 1_500 })
    return commandItem
}

async function runRuntimeRecordCommandFromRow(page: Page, rowId: string, command: 'post' | 'unpost'): Promise<void> {
    const commandItem = await getRuntimeRecordCommandMenuItem(page, rowId, command)
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
                    const automaticRetryResponse = await waitForNextImportResponse(importResponseTimeoutMs).catch(() => null)
                    if (automaticRetryResponse) {
                        response = automaticRetryResponse
                        continue
                    }
                    await expect(importButton).toBeEnabled({ timeout: 120_000 })
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
        'notification.manage',
        'workflow.execute'
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

async function readSortedRuntimeRowIds(
    api: ApiContext,
    applicationId: string,
    objectId: string,
    workspaceId: string,
    label: string
): Promise<string[]> {
    const runtime = await getApplicationRuntime(api, applicationId, {
        objectId,
        workspaceId,
        limit: 100,
        offset: 0,
        sort: JSON.stringify([{ field: 'SortOrder', direction: 'asc' }])
    })
    const rows = Array.isArray(runtime.rows) ? (runtime.rows as Array<Record<string, unknown>>) : []
    return rows.map((row, index) => requireRuntimeRowId(row, `${label} row ${index + 1}`))
}

async function readSortedRuntimeRows(
    api: ApiContext,
    applicationId: string,
    objectId: string,
    workspaceId: string,
    label: string
): Promise<Array<Record<string, unknown> & { id: string }>> {
    const runtime = await getApplicationRuntime(api, applicationId, {
        objectId,
        workspaceId,
        limit: 100,
        offset: 0,
        sort: JSON.stringify([{ field: 'SortOrder', direction: 'asc' }])
    })
    const rows = Array.isArray(runtime.rows) ? (runtime.rows as Array<Record<string, unknown>>) : []
    const columns = Array.isArray(runtime.columns) ? (runtime.columns as Array<{ field?: unknown; codename?: unknown }>) : []
    return rows.map((row, index) => ({
        ...withRuntimeCodenameAliases(row, columns),
        id: requireRuntimeRowId(row, `${label} row ${index + 1}`)
    }))
}

async function expectRuntimeCollectionRowIdsUnique(
    api: ApiContext,
    applicationId: string,
    objectId: string,
    workspaceId: string,
    label: string
): Promise<string[]> {
    const runtime = await getApplicationRuntime(api, applicationId, {
        objectId,
        workspaceId,
        limit: 200,
        offset: 0
    })
    const rows = Array.isArray(runtime.rows) ? (runtime.rows as Array<Record<string, unknown>>) : []
    const rowIds = rows.map((row, index) => requireRuntimeRowId(row, `${label} row ${index + 1}`))

    expect(rowIds.length, `${label} must expose rows for uniqueness proof`).toBeGreaterThan(0)
    expect(new Set(rowIds).size, `${label} must not duplicate runtime row ids`).toBe(rowIds.length)

    return rowIds
}

function withRuntimeCodenameAliases(
    row: Record<string, unknown>,
    columns: Array<{ field?: unknown; codename?: unknown }>
): Record<string, unknown> {
    const mappedRow = { ...row }
    const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}

    for (const column of columns) {
        if (typeof column.field !== 'string' || typeof column.codename !== 'string') {
            continue
        }

        if (Object.prototype.hasOwnProperty.call(mappedRow, column.codename)) {
            continue
        }

        mappedRow[column.codename] = row[column.field] ?? data[column.field]
    }

    return mappedRow
}

function readRuntimeRowLabel(row: Record<string, unknown>, label: string): string {
    const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
    for (const field of ['DisplayName', 'displayName', 'Name', 'name', 'Title', 'title', 'ItemTitle', 'itemTitle', 'Label', 'label']) {
        const value = row[field] ?? data[field]
        const text = typeof value === 'string' ? value : readLocalizedText(value, 'en')
        if (text && text.trim().length > 0) {
            return text.trim()
        }
    }

    throw new Error(`${label} row does not expose a readable title for row-specific action labels`)
}

async function readVisibleSortableRuntimeRowIds(surface: Locator): Promise<string[]> {
    return surface.locator('tbody tr').evaluateAll((rows) =>
        rows
            .map((row) => {
                const sortableAction = row.querySelector('[data-testid^="runtime-row-move-down-"], [data-testid^="runtime-row-move-up-"]')
                const testId = sortableAction?.getAttribute('data-testid') ?? ''
                return testId.replace(/^runtime-row-move-(?:down|up)-/, '')
            })
            .filter(Boolean)
    )
}

async function readVisibleGridActionRowIds(surface: Locator): Promise<string[]> {
    return surface.locator('[data-testid^="grid-row-actions-trigger-"]').evaluateAll((actions) =>
        actions
            .map((action) => (action.getAttribute('data-testid') ?? '').replace(/^grid-row-actions-trigger-/, ''))
            .map((rowKey) => rowKey.split(':').at(-1) ?? rowKey)
            .filter(Boolean)
    )
}

function expectUniqueRuntimeRowIds(rowIds: string[], label: string): void {
    expect(rowIds.length, `${label} must expose row ids for uniqueness checks`).toBeGreaterThan(0)
    expect(new Set(rowIds).size, `${label} must not duplicate runtime row ids`).toBe(rowIds.length)
}

async function expectPublishedOutlineReorder(options: {
    page: Page
    api: ApiContext
    applicationId: string
    objectId: string
    workspaceId: string
    label: string
    screenshotPath: string
}): Promise<void> {
    const { page, api, applicationId, objectId, workspaceId, label, screenshotPath } = options
    const beforeRows = await readSortedRuntimeRows(api, applicationId, objectId, workspaceId, label)
    const beforeOrder = beforeRows.map((row) => row.id)
    expect(beforeOrder.length, `${label} must have at least two rows for ordering proof`).toBeGreaterThanOrEqual(2)
    const firstRowLabel = readRuntimeRowLabel(beforeRows[0], label)

    await page.goto(`/a/${applicationId}/${encodeURIComponent(objectId)}`)
    const surface = page.getByTestId('runtime-list-surface').first()
    await expect(surface, `${label} ordering table must use the generic runtime list surface`).toBeVisible({ timeout: 30_000 })
    await expect
        .poll(
            async () => {
                const visibleOrder = await readVisibleSortableRuntimeRowIds(surface)
                return visibleOrder.slice(0, 2)
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toEqual(beforeOrder.slice(0, 2))

    const isReorderResponse = (response: Response) =>
        response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/reorder`)
    const moveDownButton = surface.getByRole('button', { name: `Move ${firstRowLabel} down` }).first()
    await expect(moveDownButton, `${label} first row move-down action must be visible`).toBeVisible({ timeout: 30_000 })
    await expect(moveDownButton, `${label} first row move-down action must be enabled`).toBeEnabled({ timeout: 30_000 })
    await expect(moveDownButton, `${label} move-down action must name the actual first row`).toHaveAttribute(
        'aria-label',
        `Move ${firstRowLabel} down`
    )

    let reorderResponse: Response | null = null
    for (let attempt = 0; attempt < 2 && reorderResponse === null; attempt += 1) {
        await page.mouse.move(0, 0)
        await moveDownButton.scrollIntoViewIfNeeded()
        const reorderResponsePromise = page
            .waitForResponse(isReorderResponse, { timeout: attempt === 0 ? 15_000 : 30_000 })
            .catch(() => null)
        await moveDownButton.click()
        reorderResponse = await reorderResponsePromise
    }

    expect(reorderResponse, `${label} row reorder must send the generic reorder request`).not.toBeNull()
    if (!reorderResponse) {
        throw new Error(`${label} row reorder did not send the generic reorder request`)
    }
    expect(reorderResponse.ok(), `${label} row reorder must succeed from the published app`).toBe(true)
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

    await expect
        .poll(
            async () => {
                const afterOrder = await readSortedRuntimeRowIds(api, applicationId, objectId, workspaceId, label)
                return afterOrder.slice(0, 2)
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toEqual([beforeOrder[1], beforeOrder[0]])

    await expect
        .poll(
            async () => {
                const visibleOrder = await readVisibleSortableRuntimeRowIds(surface)
                return visibleOrder.slice(0, 2)
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toEqual([beforeOrder[1], beforeOrder[0]])

    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectReportCsvExport(page: Page, reportSurface: Locator, label: string): Promise<void> {
    const exportButton = reportSurface
        .getByRole('button', { name: 'Export CSV' })
        .or(page.getByRole('button', { name: 'Export CSV' }))
        .first()
    await expect(exportButton, `${label} must expose CSV export`).toBeVisible({ timeout: 30_000 })
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await exportButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename(), `${label} export must produce a CSV file`).toMatch(/\.csv$/i)
    const downloadPath = await download.path()
    expect(downloadPath, `${label} export must be readable from disk`).toBeTruthy()
    const csv = await fs.readFile(downloadPath!, 'utf8')
    expect(csv, `${label} export must not expose runtime internals`).not.toMatch(
        /\b(__runtime|TargetRecordId|TargetObjectCodename|PrincipalId|OwnerUserId|_upl_|_app_)\b/
    )
    expect(csv, `${label} export must not expose raw UUID values`).not.toMatch(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
    )
    expect(csv, `${label} export must not expose raw object rendering`).not.toContain('[object Object]')
    expect(csv, `${label} export must not expose raw JSON payloads`).not.toMatch(/"\s*\{|\}\s*"/)
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
}

async function expectPublishedBuilderTabs(options: {
    page: Page
    navigationItem: string
    label: string
    screenshotPath: string
    tabNames?: string[]
}): Promise<void> {
    const {
        page,
        navigationItem,
        label,
        screenshotPath,
        tabNames = ['Outline', 'General', 'Completion', 'Enrollments', 'Reports']
    } = options
    await clickRuntimeNavigationItem(page, navigationItem)
    await expectRuntimeNavigationItemSelected(page, navigationItem)

    const tabs = page.getByTestId('runtime-details-tabs').first()
    await expect(tabs, `${label} must render the generic detailsTabs surface`).toBeVisible({ timeout: 30_000 })
    for (const tabName of tabNames) {
        await expect(page.getByRole('tab', { name: tabName }), `${label} tab ${tabName} must be visible`).toBeVisible({ timeout: 30_000 })
    }

    await page.getByRole('tab', { name: 'Completion' }).click()
    await expect(page.getByRole('tab', { name: 'Completion' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('columnheader', { name: 'Availability', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Available').first(), `${label} sequence policy must mark the first step as available`).toBeVisible({
        timeout: 30_000
    })
    await expect(page.getByText('Locked').first(), `${label} sequence policy must mark later sequential steps as locked`).toBeVisible({
        timeout: 30_000
    })
    if (tabNames.includes('Reports')) {
        await page.getByRole('tab', { name: 'Reports' }).click()
        await expect(page.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true')
        const reportSurface = page.getByTestId('runtime-report-details-table').or(page.getByRole('grid')).first()
        await expect(reportSurface, `${label} report tab must render a generic report surface`).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(reportSurface, { label: `${label} report tab`, checkUuidSubstrings: true })
        await expectReportCsvExport(page, reportSurface, `${label} report tab`)
    }
    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectNoVisibleLearningContentTechnicalText(surface: Locator, label: string): Promise<void> {
    const text = await surface.evaluate((node) => {
        const element = node as HTMLElement
        return element.innerText || element.textContent || ''
    })
    expect(text, `${label} must not expose hidden Learning Content technical columns`).not.toMatch(
        /\b(ProjectId|CreatedBy|OwnerUserId|TargetRecordId|__runtime|SourceJson)\b/
    )
}

async function expectPublishedLearningContentView(options: {
    page: Page
    api?: ApiContext
    applicationId?: string
    workspaceId?: string
    navigationItem: string
    label: string
    screenshotPath: string
    expectedDefaultView?: 'table' | 'card'
    cardScreenshotPath?: string
    captureViewportScreenshots?: boolean
    expectCreateMenu?: boolean
    expectRowActions?: boolean
    expectShareWithMemberAction?: boolean
    expectMoveToProjectAction?: boolean
}): Promise<void> {
    const {
        page,
        api,
        applicationId,
        workspaceId,
        navigationItem,
        label,
        screenshotPath,
        expectedDefaultView = 'table',
        cardScreenshotPath,
        captureViewportScreenshots = false,
        expectCreateMenu = false,
        expectRowActions = false,
        expectShareWithMemberAction = false,
        expectMoveToProjectAction = false
    } = options
    await clickRuntimeNavigationItem(page, navigationItem)
    await expectRuntimeNavigationItemSelected(page, navigationItem)

    const genericRuntimeSurface = page
        .getByTestId('records-union-details-table')
        .or(page.getByTestId('runtime-list-surface'))
        .or(page.getByTestId('records-union-card-view'))
        .or(page.getByRole('grid'))
        .first()
    await expect(genericRuntimeSurface, `${label} must render a generic runtime data surface`).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await expectNoTechnicalLeakage(genericRuntimeSurface, { label, checkUuidSubstrings: true })
    await expectNoVisibleLearningContentTechnicalText(genericRuntimeSurface, label)

    const getCreateButton = () => page.getByTestId('records-union-create-target-menu-button')
    if (expectCreateMenu) {
        const returnToCreateTargetSurface = async () => {
            await clickRuntimeNavigationItem(page, navigationItem)
            await expectRuntimeNavigationItemSelected(page, navigationItem)
            await expect(genericRuntimeSurface, `${label} create target surface must be visible`).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
        }

        const getDialogLabelLocator = (dialog: Locator, labelText: string | RegExp) =>
            typeof labelText === 'string' ? dialog.getByLabel(labelText, { exact: true }) : dialog.getByLabel(labelText)

        const assertCreateTargetDefaults = async (targetLabel: 'Page' | 'Link', screenshotSuffix: string) => {
            if (!api || !applicationId || !workspaceId) {
                throw new Error(`${targetLabel} create target persistence proof requires api, applicationId, and workspaceId`)
            }
            await returnToCreateTargetSurface()
            const createButton = getCreateButton()
            await expect(createButton, `${label} create menu button must stay available before selecting ${targetLabel}`).toBeVisible({
                timeout: 30_000
            })
            await createButton.click()
            await expect(page.getByRole('menu'), `${label} create menu must open before selecting ${targetLabel}`).toBeVisible({
                timeout: 30_000
            })
            await page.getByRole('menuitem', { name: targetLabel, exact: true }).click()
            const dialog = page.getByRole('dialog').first()
            await expect(dialog, `${label} ${targetLabel} target must open the generic create dialog`).toBeVisible({ timeout: 30_000 })

            const title = targetLabel === 'Page' ? 'Runtime authoring proof page' : 'Runtime authoring proof link'
            if (targetLabel === 'Page') {
                await expect(dialog.getByRole('combobox', { name: 'Resource Type', exact: true })).toContainText(/Page/i)
                await expect(
                    dialog.getByLabel(/Page codename/i),
                    `${label} Page target must not require authors to type a technical page codename`
                ).toHaveCount(0)
                await expect(dialog.getByTestId('entity-form-submit')).toBeDisabled()
                await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
                await expect(dialog.getByTestId('entity-form-submit')).toBeEnabled()
            } else {
                await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
                const sourceUrl = getDialogLabelLocator(dialog, 'Source URL *')
                await expect(sourceUrl, `${label} Link target must preselect the expected resource source draft`).toBeVisible({
                    timeout: 30_000
                })
                await expect(
                    dialog.getByText('Enter an absolute http or https URL.'),
                    `${label} optional Link source must not show validation before a source is entered`
                ).toHaveCount(0)
                await sourceUrl.fill('javascript:alert(1)')
                await expect(dialog.getByText('Enter an absolute http or https URL.')).toBeVisible()
                await expect(dialog.locator('[data-testid$="resource-source-domain-preview"]')).toHaveCount(0)
                await sourceUrl.fill('https://example.com/lesson')
                await expect(dialog.getByTestId('resource-preview-domain')).toContainText('Domain: example.com')
            }

            await dialog.screenshot({ path: screenshotPath.replace(/\.png$/i, `-${screenshotSuffix}.png`) })
            const learningResourcesObjectId = await waitForApplicationObjectId(api, applicationId, 'LearningResources')
            const resourceIdsBeforeCreate = await expectRuntimeCollectionRowIdsUnique(
                api,
                applicationId,
                learningResourcesObjectId,
                workspaceId,
                `${label} LearningResources before ${targetLabel} create`
            )
            const createResourceRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows`),
                { label: `Creating LMS Learning Content ${targetLabel}` }
            )
            await dialog.getByTestId(entityDialogSelectors.submitButton).click()
            const createdResourceResponse = await createResourceRequest
            const createdResource = await parseJsonResponse<RuntimeMutationResponse>(
                createdResourceResponse,
                `Creating LMS Learning Content ${targetLabel}`
            )
            if (!createdResource.id) {
                throw new Error(`Created LMS Learning Content ${targetLabel} did not return an id`)
            }
            await expect(dialog).toHaveCount(0)

            const createdResourceRow = await waitForApplicationRuntimeRow(
                api,
                applicationId,
                learningResourcesObjectId,
                createdResource.id,
                {
                    workspaceId
                }
            )
            expect(readLocalizedText(createdResourceRow?.Title)).toBe(title)
            expect(createdResourceRow?.Source).toMatchObject(
                targetLabel === 'Page'
                    ? { type: 'page', pageCodename: 'runtime-authoring-proof-page' }
                    : { type: 'url', url: 'https://example.com/lesson' }
            )
            const resourceIdsAfterCreate = await expectRuntimeCollectionRowIdsUnique(
                api,
                applicationId,
                learningResourcesObjectId,
                workspaceId,
                `${label} LearningResources after ${targetLabel} create`
            )
            expect(resourceIdsBeforeCreate, `${label} ${targetLabel} create must allocate a new row id`).not.toContain(createdResource.id)
            expect(resourceIdsAfterCreate, `${label} ${targetLabel} create must persist the new row id`).toContain(createdResource.id)
        }

        const assertSettingsDerivedCreateTargetDefaults = async (
            targetLabel: 'Course' | 'Learning Track',
            expectedFields: Array<{ label: string; value: RegExp }>,
            screenshotSuffix: string
        ) => {
            await returnToCreateTargetSurface()
            const createButton = getCreateButton()
            await expect(createButton, `${label} create menu button must stay available before selecting ${targetLabel}`).toBeVisible({
                timeout: 30_000
            })
            await createButton.click()
            await expect(page.getByRole('menu'), `${label} create menu must open before selecting ${targetLabel}`).toBeVisible({
                timeout: 30_000
            })
            await page.getByRole('menuitem', { name: targetLabel, exact: true }).click()
            const dialog = page.getByRole('dialog').first()
            await expect(dialog, `${label} ${targetLabel} target must open the generic create dialog`).toBeVisible({ timeout: 30_000 })

            for (const expectedField of expectedFields) {
                await expect(
                    dialog.getByRole('combobox', { name: expectedField.label, exact: true }),
                    `${label} ${targetLabel} target must apply the configured ${expectedField.label} default`
                ).toContainText(expectedField.value)
            }

            await dialog.screenshot({ path: screenshotPath.replace(/\.png$/i, `-${screenshotSuffix}.png`) })
            await dialog.getByTestId('entity-form-cancel').click()
            await expect(dialog).toHaveCount(0)
        }

        const assertProjectCreateTargetDialog = async () => {
            if (!api || !applicationId || !workspaceId) {
                throw new Error('Project create target persistence proof requires api, applicationId, and workspaceId')
            }
            await returnToCreateTargetSurface()
            const createButton = getCreateButton()
            await expect(createButton, `${label} create menu button must stay available before selecting Project`).toBeVisible({
                timeout: 30_000
            })
            await createButton.click()
            await expect(page.getByRole('menu'), `${label} create menu must open before selecting Project`).toBeVisible({
                timeout: 30_000
            })
            await page.getByRole('menuitem', { name: 'Project', exact: true }).click()
            const dialog = page.getByRole('dialog').first()
            await expect(dialog, `${label} Project target must open the generic create dialog`).toBeVisible({ timeout: 30_000 })
            await expect(dialog.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible()
            await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toBeVisible()
            await expectSemanticFieldControls(dialog, {
                longTextLabels: ['Description'],
                forbiddenEditableIdLabels: ['ProjectId', 'OwnerId', 'UserId', 'WorkspaceId']
            })
            await expect(dialog.getByLabel(/ProjectId|OwnerId|UserId|WorkspaceId/i)).toHaveCount(0)
            await expect(dialog.getByTestId('entity-form-submit')).toBeDisabled()
            const projectTitle = 'Runtime authoring proof project'
            const projectDescription = 'Created through the generic Learning Content create target'
            await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(projectTitle)
            await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(projectDescription)
            await expect(dialog.getByTestId('entity-form-submit')).toBeEnabled()
            await dialog.screenshot({ path: screenshotPath.replace(/\.png$/i, '-create-project-dialog.png') })

            const contentProjectsObjectId = await waitForApplicationObjectId(api, applicationId, 'ContentProjects')
            const projectIdsBeforeCreate = await expectRuntimeCollectionRowIdsUnique(
                api,
                applicationId,
                contentProjectsObjectId,
                workspaceId,
                `${label} ContentProjects before Project create`
            )
            const createProjectRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows`),
                { label: 'Creating LMS Learning Content project' }
            )
            await dialog.getByTestId(entityDialogSelectors.submitButton).click()
            const createdProjectResponse = await createProjectRequest
            const createdProject = await parseJsonResponse<RuntimeMutationResponse>(
                createdProjectResponse,
                'Creating LMS Learning Content project'
            )
            if (!createdProject.id) {
                throw new Error('Created LMS Learning Content project did not return an id')
            }
            await expect(dialog).toHaveCount(0)
            await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

            const createdProjectRow = await waitForApplicationRuntimeRow(api, applicationId, contentProjectsObjectId, createdProject.id, {
                workspaceId
            })
            expect(readLocalizedText(createdProjectRow?.Title)).toBe(projectTitle)
            expect(readLocalizedText(createdProjectRow?.Description)).toBe(projectDescription)
            const projectIdsAfterCreate = await expectRuntimeCollectionRowIdsUnique(
                api,
                applicationId,
                contentProjectsObjectId,
                workspaceId,
                `${label} ContentProjects after Project create`
            )
            expect(projectIdsBeforeCreate, `${label} Project create must allocate a new row id`).not.toContain(createdProject.id)
            expect(projectIdsAfterCreate, `${label} Project create must persist the new row id`).toContain(createdProject.id)
        }

        const createButton = getCreateButton()
        await expect(createButton, `${label} must expose the generic create menu`).toBeVisible({ timeout: 30_000 })
        await createButton.click()
        await expect(page.getByRole('menu'), `${label} create menu must open`).toBeVisible({ timeout: 30_000 })
        for (const targetLabel of ['Project', 'Page', 'Link', 'Course', 'Learning Track']) {
            await expect(
                page.getByRole('menuitem', { name: targetLabel }),
                `${label} create menu must include ${targetLabel}`
            ).toBeVisible()
        }
        await expect(page.getByRole('menuitem', { name: /Quiz-lite/i })).toBeDisabled()
        await expect(page.getByText('Quiz authoring is planned for a later Learning Content phase.')).toBeVisible()
        await expect(page.getByRole('menuitem', { name: /Assignment-lite/i })).toBeDisabled()
        await expect(page.getByText('Assignment authoring is planned for a later Learning Content phase.')).toBeVisible()
        await expect(page.getByRole('menuitem', { name: /Import package/i })).toBeDisabled()
        await expect(page.getByText('File import and SCORM/xAPI support are planned for a later phase.')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)

        await assertProjectCreateTargetDialog()
        await assertCreateTargetDefaults('Page', 'create-page-defaults')
        await assertCreateTargetDefaults('Link', 'create-link-defaults')
        await assertSettingsDerivedCreateTargetDefaults(
            'Course',
            [
                { label: 'Navigation Mode', value: /Sequential/i },
                { label: 'Completion Condition', value: /Selected items/i },
                { label: 'Status Format', value: /Passed \/ Failed/i }
            ],
            'create-course-settings-defaults'
        )
        await assertSettingsDerivedCreateTargetDefaults(
            'Learning Track',
            [{ label: 'Order Mode', value: /By days/i }],
            'create-track-settings-defaults'
        )
        await returnToCreateTargetSurface()
    }

    if (expectedDefaultView === 'card') {
        const cardSurface = page.getByTestId('records-union-card-view').first()
        await expect(cardSurface, `${label} must use the configured card default view`).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(cardSurface, { label: `${label} card view`, checkUuidSubstrings: true })
        await expectNoVisibleLearningContentTechnicalText(cardSurface, `${label} card view`)
        if (cardScreenshotPath) {
            await assertNoHorizontalOverflowWithScreenshots(page, `${label} card view`, cardScreenshotPath)
        } else {
            await assertNoHorizontalOverflow(page, `${label} card view`)
        }
        if (expectRowActions) {
            const cardAction = page.locator('[data-testid^="records-union-card-actions-"]').first()
            await expect(cardAction, `${label} card view must expose generic row actions`).toBeVisible({ timeout: 30_000 })
            await cardAction.click()
            await expect(page.getByRole('menuitem', { name: 'Edit' }), `${label} card row actions must include Edit`).toBeVisible({
                timeout: 30_000
            })
            await expect(page.getByRole('menuitem', { name: 'Copy' }), `${label} card row actions must include Copy`).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Delete' }), `${label} card row actions must include Delete`).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.getByRole('menu')).toHaveCount(0)
        }
    } else {
        const unionWidget = page.getByTestId('records-union-details-table').first()
        const hasVisibleUnionWidget = await unionWidget.isVisible().catch(() => false)
        const grid = hasVisibleUnionWidget ? unionWidget.getByRole('grid').first() : page.getByRole('grid').first()
        const searchInput = unionWidget.getByRole('textbox', { name: /Search/i }).first()
        await expect(searchInput, `${label} table view must expose generic runtime search`).toBeVisible({ timeout: 30_000 })
        if (navigationItem === 'Learning Content') {
            const searchResponsePromise = page.waitForResponse(
                (response) => {
                    if (response.request().method() !== 'POST') return false
                    if (!response.url().includes('/runtime/datasources/records/union')) return false
                    try {
                        const body = response.request().postDataJSON() as {
                            datasource?: { query?: { search?: unknown } }
                            offset?: unknown
                        }
                        return body.datasource?.query?.search === 'Safety' && body.offset === 0
                    } catch {
                        return false
                    }
                },
                { timeout: 30_000 }
            )
            await searchInput.fill('Safety')
            expect((await searchResponsePromise).ok(), 'Learning Content runtime search request must succeed').toBe(true)
            await searchInput.clear()
            await expect(searchInput, 'Learning Content runtime search must clear without stale visible input').toHaveValue('')
            await expect(
                grid.getByRole('row', { name: /Certificate policy page/i }).first(),
                'Learning Content runtime search reset must restore non-search rows'
            ).toBeVisible({ timeout: 30_000 })

            const typeFilter = unionWidget.getByRole('combobox', { name: 'Type' }).first()
            await expect(typeFilter, `${label} table view must expose generic type filtering`).toBeVisible({ timeout: 30_000 })
            await typeFilter.click()
            const typeFilterListbox = page.getByRole('listbox')
            await expect(typeFilterListbox.getByRole('option', { name: 'Resources' })).toBeVisible()
            await expect(typeFilterListbox.getByRole('option', { name: 'Courses' })).toBeVisible()
            await expect(typeFilterListbox.getByRole('option', { name: 'Learning Tracks' })).toBeVisible()
            await expectNoTechnicalLeakage(typeFilterListbox, { label: `${label} type filter`, checkUuidSubstrings: true })
            const courseFilterResponsePromise = page.waitForResponse(
                (response) => {
                    if (response.request().method() !== 'POST') return false
                    if (!response.url().includes('/runtime/datasources/records/union')) return false
                    try {
                        const body = response.request().postDataJSON() as {
                            datasource?: { targets?: Array<{ displayType?: unknown }> }
                            offset?: unknown
                        }
                        return (
                            body.offset === 0 &&
                            body.datasource?.targets?.length === 1 &&
                            body.datasource.targets[0]?.displayType === 'course'
                        )
                    } catch {
                        return false
                    }
                },
                { timeout: 30_000 }
            )
            await typeFilterListbox.getByRole('option', { name: 'Courses' }).click()
            expect((await courseFilterResponsePromise).ok(), 'Learning Content type filter request must succeed').toBe(true)

            await typeFilter.click()
            await page.getByRole('option', { name: 'All types' }).click()
            await expect(
                grid.getByRole('row', { name: /Learning Tracks/i }).first(),
                'Learning Content type filter reset must restore non-course rows'
            ).toBeVisible({ timeout: 30_000 })
        }
        await expect(grid, `${label} must use the configured table default view`).toBeVisible({ timeout: 30_000 })
        await expect(
            grid
                .getByRole('columnheader')
                .filter({ hasText: /^Type$/ })
                .first()
        ).toBeVisible({ timeout: 30_000 })
        await expect(
            grid
                .getByRole('columnheader')
                .filter({ hasText: /^Title$/ })
                .first()
        ).toBeVisible({ timeout: 30_000 })
        await expect(
            grid
                .getByRole('columnheader')
                .filter({ hasText: /^Status$/ })
                .first()
        ).toBeVisible({ timeout: 30_000 })
        if (navigationItem === 'Learning Content') {
            await expectVerticalGapBetween(page.getByRole('heading', { name: 'Content Projects' }).first(), unionWidget, {
                min: 16,
                max: 160,
                label: `${label} heading-to-table module spacing`
            })
        }
        await expect(grid.getByRole('columnheader', { name: /ProjectId|CreatedBy/i })).toHaveCount(0)
        const columnVisibilityButton = unionWidget.getByTestId('runtime-column-visibility-button').first()
        await expect(columnVisibilityButton, `${label} table view must expose generic safe column settings`).toBeVisible({
            timeout: 30_000
        })
        await columnVisibilityButton.click()
        const columnVisibilityMenu = page.getByRole('menu', { name: 'Table columns' })
        await expect(columnVisibilityMenu, `${label} column settings menu must open`).toBeVisible({ timeout: 30_000 })
        await expect(columnVisibilityMenu.getByText('Title', { exact: true })).toBeVisible()
        await expect(columnVisibilityMenu.getByText('Status', { exact: true })).toBeVisible()
        await expect(columnVisibilityMenu.getByText(/ProjectId|CreatedBy|OwnerUserId|TargetRecordId|SourceJson/i)).toHaveCount(0)
        await expectNoTechnicalLeakage(columnVisibilityMenu, { label: `${label} column settings`, checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(page, `${label} column settings`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu', { name: 'Table columns' })).toHaveCount(0)
        if (navigationItem === 'Learning Content') {
            const originalViewport = page.viewportSize()
            const toolbarViewports = [
                { name: 'desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]

            try {
                for (const viewport of toolbarViewports) {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height })
                    const createButton = getCreateButton().first()
                    const typeFilter = unionWidget.getByTestId('records-union-target-filter').first()
                    const cardViewButton = unionWidget.getByRole('button', { name: 'Card view' }).first()
                    const tableViewButton = unionWidget.getByRole('button', { name: 'Table view' }).first()

                    await expect(
                        page.getByTestId('application-runtime-create-row'),
                        `${label} ${viewport.name} toolbar must not duplicate the primary create action`
                    ).toHaveCount(0)
                    await expect(createButton, `${label} ${viewport.name} toolbar must keep the create menu visible`).toBeVisible({
                        timeout: 30_000
                    })
                    await expect(typeFilter, `${label} ${viewport.name} toolbar must keep the type filter visible`).toBeVisible({
                        timeout: 30_000
                    })
                    await expect(columnVisibilityButton, `${label} ${viewport.name} toolbar must keep column settings visible`).toBeVisible(
                        {
                            timeout: 30_000
                        }
                    )
                    await expect(cardViewButton, `${label} ${viewport.name} toolbar must keep card view visible`).toBeVisible({
                        timeout: 30_000
                    })
                    await expect(tableViewButton, `${label} ${viewport.name} toolbar must keep table view visible`).toBeVisible({
                        timeout: 30_000
                    })

                    await expectHeightsAligned(createButton, typeFilter, 2)
                    await expectHeightsAligned(createButton, columnVisibilityButton, 2)
                    await expectHeightsAligned(createButton, cardViewButton, 2)
                    await expectHeightsAligned(createButton, tableViewButton, 2)
                    await expectLocatorFitsViewport(createButton, `${label} ${viewport.name} create button`)
                    await expectLocatorFitsViewport(typeFilter, `${label} ${viewport.name} type filter`)
                    await expectLocatorFitsViewport(columnVisibilityButton, `${label} ${viewport.name} column visibility button`)
                    await expectLocatorHasNoInlineOverflow(createButton, `${label} ${viewport.name} create button`)
                    await expectLocatorHasNoInlineOverflow(columnVisibilityButton, `${label} ${viewport.name} column visibility button`)
                    await expectNoPageHorizontalOverflow(page, `${label} ${viewport.name} toolbar`)

                    if (viewport.name === 'mobile') {
                        await page.screenshot({ path: screenshotPath.replace(/\.png$/i, '-mobile-toolbar.png'), fullPage: true })
                    }
                }
            } finally {
                if (originalViewport) {
                    await page.setViewportSize(originalViewport)
                }
            }
        }
        await expectDataGridHorizontalScrollConstrained(page, `${label} table view`)
        await expectNoDataGridTechnicalLeakage(unionWidget, { label: `${label} table view`, checkUuidSubstrings: true })
        if (captureViewportScreenshots) {
            await assertNoHorizontalOverflowWithScreenshots(page, `${label} table view`, screenshotPath)
        } else {
            await assertNoHorizontalOverflow(page, label)
        }
        if (expectRowActions) {
            const rowActionScope = hasVisibleUnionWidget ? unionWidget : page
            const rowAction = rowActionScope.locator('[data-testid^="grid-row-actions-trigger-"]').first()
            await expect(rowAction, `${label} table view must expose generic row actions`).toBeVisible({ timeout: 30_000 })
            await expect(rowAction, `${label} table row action must name the target row`).toHaveAttribute('aria-label', /Actions for .+/, {
                timeout: 30_000
            })
            await rowAction.click()
            await expect(page.getByRole('menuitem', { name: 'Edit' }), `${label} table row actions must include Edit`).toBeVisible({
                timeout: 30_000
            })
            const copyAction = page.getByRole('menuitem', { name: 'Copy' })
            await expect(copyAction, `${label} table row actions must include Copy`).toBeVisible()
            await expect(page.getByRole('menuitem', { name: 'Delete' }), `${label} table row actions must include Delete`).toBeVisible()
            if (expectShareWithMemberAction) {
                const shareAction = page.getByRole('menuitem', { name: 'Share' })
                await expect(shareAction, `${label} table row actions must include Share`).toBeVisible({ timeout: 30_000 })
                await shareAction.click()

                const shareDialog = page.getByRole('dialog', { name: 'Share content' })
                await expect(shareDialog, `${label} Share content dialog must open`).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(shareDialog, { label: `${label} Share content dialog`, checkUuidSubstrings: true })
                await shareDialog.getByRole('combobox', { name: 'Workspace member' }).click()
                const shareListbox = page.getByRole('listbox')
                await expect(shareListbox, `${label} Share workspace member list must open`).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(shareListbox, { label: `${label} Share workspace member list`, checkUuidSubstrings: true })
                const firstMemberOption = shareListbox.getByRole('option').first()
                await expect(firstMemberOption, `${label} Share list must contain a readable workspace member`).toBeVisible({
                    timeout: 30_000
                })
                await firstMemberOption.click()

                const shareResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) =>
                        response.request().method() === 'POST' &&
                        response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                        response.url().includes('/library/shared'),
                    { label: 'Sharing Learning Content with a workspace member' }
                )
                await shareDialog.getByRole('button', { name: 'Share' }).click()
                const shareResponse = await shareResponsePromise
                expect(shareResponse.ok(), 'Learning Content Share mutation must succeed').toBe(true)

                const shareBody = shareResponse.request().postDataJSON() as Record<string, unknown>
                expect(shareBody.active, 'Learning Content Share request must activate the relation').toBe(true)
                expect(
                    typeof shareBody.objectCollectionId === 'string' ? shareBody.objectCollectionId : '',
                    'Learning Content Share request must carry the source object collection id'
                ).toBeTruthy()
                expect(shareBody.principalType, 'Learning Content Share request must target a workspace member').toBe('workspaceMember')
                expect(
                    typeof shareBody.principalId === 'string' ? shareBody.principalId : '',
                    'Learning Content Share request must carry the selected workspace member id'
                ).toMatch(/^[0-9a-f-]{36}$/i)
                await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

                if (expectMoveToProjectAction) {
                    await rowAction.click()
                }
            }
            if (expectMoveToProjectAction) {
                const moveAction = page.getByRole('menuitem', { name: 'Move to project' })
                await expect(moveAction, `${label} table row actions must include Move to project`).toBeVisible({ timeout: 30_000 })
                await moveAction.click()

                const moveDialog = page.getByRole('dialog', { name: 'Move to project' })
                await expect(moveDialog, `${label} Move to project dialog must open`).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(moveDialog, { label: `${label} Move to project dialog`, checkUuidSubstrings: true })
                await moveDialog.getByRole('combobox', { name: 'Project' }).click()
                const listbox = page.getByRole('listbox')
                await expect(listbox, `${label} Move to project list must open`).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(listbox, { label: `${label} Move to project list`, checkUuidSubstrings: true })
                const firstProjectOption = listbox.getByRole('option').first()
                await expect(firstProjectOption, `${label} Move to project list must contain a readable project`).toBeVisible({
                    timeout: 30_000
                })
                await firstProjectOption.click()

                const moveResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) =>
                        response.request().method() === 'PATCH' &&
                        response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`),
                    { label: 'Moving Learning Content to a selected project' }
                )
                await moveDialog.getByRole('button', { name: 'Move to project' }).click()
                const moveResponse = await moveResponsePromise
                expect(moveResponse.ok(), 'Learning Content Move to project mutation must succeed').toBe(true)

                const moveBody = moveResponse.request().postDataJSON() as Record<string, unknown>
                const moveData = isRecord(moveBody.data) ? moveBody.data : {}
                const rowId = new URL(moveResponse.url()).pathname.match(/\/runtime\/rows\/([^/]+)$/)?.[1]
                const objectCollectionId = typeof moveBody.objectCollectionId === 'string' ? moveBody.objectCollectionId : ''
                const targetProjectId = typeof moveData.ProjectId === 'string' ? moveData.ProjectId : ''
                expect(rowId, 'Learning Content Move to project response URL must expose the moved row id').toBeTruthy()
                expect(
                    objectCollectionId,
                    'Learning Content Move to project request must carry the source object collection id'
                ).toBeTruthy()
                expect(targetProjectId, 'Learning Content Move to project request must carry the selected project id').toBeTruthy()
                expect(typeof moveBody.expectedVersion, 'Learning Content Move to project request must use expectedVersion').toBe('number')
                if (api && applicationId && workspaceId && rowId) {
                    const movedRow = await waitForApplicationRuntimeRow(api, applicationId, objectCollectionId, rowId, { workspaceId })
                    expect(movedRow?.ProjectId, 'Moved Learning Content row must point to the selected project').toBe(targetProjectId)
                }
                await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
            } else {
                await page.keyboard.press('Escape')
                await expect(page.getByRole('menu')).toHaveCount(0)
            }
            if (label === 'Learning Content library') {
                const gridRowIdsBeforeCopy = await readVisibleGridActionRowIds(rowActionScope)
                expectUniqueRuntimeRowIds(gridRowIdsBeforeCopy, `${label} visible rows before copy`)
                const learningResourcesObjectId =
                    api && applicationId ? await waitForApplicationObjectId(api, applicationId, 'LearningResources') : undefined
                const collectionRowIdsBeforeCopy =
                    api && applicationId && workspaceId && learningResourcesObjectId
                        ? await expectRuntimeCollectionRowIdsUnique(
                              api,
                              applicationId,
                              learningResourcesObjectId,
                              workspaceId,
                              `${label} LearningResources before copy`
                          )
                        : []
                const currentRowAction = page.locator('[data-testid^="grid-row-actions-trigger-"]').first()
                await expect(currentRowAction, `${label} table view must keep row actions after mutations`).toBeVisible({ timeout: 30_000 })
                await currentRowAction.click()
                const currentCopyAction = page.getByRole('menuitem', { name: 'Copy' })
                await expect(currentCopyAction, `${label} table row actions must still include Copy after mutations`).toBeVisible({
                    timeout: 30_000
                })
                await currentCopyAction.click()
                const copyDialog = page
                    .getByRole('dialog', { name: 'Copy element' })
                    .or(page.getByRole('dialog', { name: 'Copy record' }))
                    .first()
                await expect(copyDialog, `${label} Copy dialog must open`).toBeVisible({ timeout: 30_000 })
                await expectNoTechnicalLeakage(copyDialog, { label: `${label} Copy dialog`, checkUuidSubstrings: true })
                const copyResponsePromise = waitForSettledMutationResponse(
                    page,
                    (response) =>
                        response.request().method() === 'POST' &&
                        response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                        response.url().includes('/copy'),
                    { label: 'Copying a Learning Content row' }
                )
                await copyDialog.getByRole('button', { name: 'Copy' }).click()
                const copyResponse = await copyResponsePromise
                expect(copyResponse.ok(), 'Learning Content Copy mutation must succeed').toBe(true)
                const copiedResource = await parseJsonResponse<RuntimeMutationResponse>(copyResponse, 'Copying a Learning Content row')
                await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
                await expect(
                    page
                        .getByRole('grid')
                        .getByText(/\(copy\)/i)
                        .first(),
                    'Copied Learning Content row must appear in the table'
                ).toBeVisible({
                    timeout: 30_000
                })
                const gridRowIdsAfterCopy = await readVisibleGridActionRowIds(rowActionScope)
                if (gridRowIdsAfterCopy.length > 0) {
                    expectUniqueRuntimeRowIds(gridRowIdsAfterCopy, `${label} visible rows after copy`)
                    expect(
                        gridRowIdsAfterCopy.some((rowId) => !gridRowIdsBeforeCopy.includes(rowId)),
                        `${label} copy must allocate a new visible row id`
                    ).toBe(true)
                }
                if (api && applicationId && workspaceId && learningResourcesObjectId && copiedResource.id) {
                    const collectionRowIdsAfterCopy = await expectRuntimeCollectionRowIdsUnique(
                        api,
                        applicationId,
                        learningResourcesObjectId,
                        workspaceId,
                        `${label} LearningResources after copy`
                    )
                    expect(collectionRowIdsBeforeCopy, `${label} copy must allocate a new collection row id`).not.toContain(
                        copiedResource.id
                    )
                    expect(collectionRowIdsAfterCopy, `${label} copy must persist the copied row id`).toContain(copiedResource.id)
                }
                await expectNoTechnicalLeakage(page.getByRole('grid').first(), { label: `${label} after copy`, checkUuidSubstrings: true })
            }
        }
    }

    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectPublishedTrashRestoreTargetFlow(options: {
    page: Page
    api: ApiContext
    applicationId: string
    workspaceId: string
    screenshotPath: string
}): Promise<void> {
    const { page, api, applicationId, workspaceId, screenshotPath } = options
    await clickRuntimeNavigationItem(page, 'Trash')
    await expectRuntimeNavigationItemSelected(page, 'Trash')

    const trashUnionWidget = page.getByTestId('records-union-details-table').first()
    const hasVisibleTrashUnionWidget = await trashUnionWidget.isVisible().catch(() => false)
    const trashSurface = hasVisibleTrashUnionWidget ? trashUnionWidget : page.getByRole('grid').first()
    await expect(trashSurface, 'Learning Content Trash must render a generic runtime surface').toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await expectNoTechnicalLeakage(trashSurface, { label: 'Learning Content Trash before restore', checkUuidSubstrings: true })
    await expectDataGridHorizontalScrollConstrained(page, 'Learning Content Trash before restore')
    await expectNoDataGridTechnicalLeakage(trashSurface, { label: 'Learning Content Trash before restore', checkUuidSubstrings: true })
    const visibleTrashRowIdsBeforeRestore = await readVisibleGridActionRowIds(trashSurface)
    if (visibleTrashRowIdsBeforeRestore.length > 0) {
        expectUniqueRuntimeRowIds(visibleTrashRowIdsBeforeRestore, 'Learning Content Trash visible rows before restore')
    }

    const restoreAction = trashSurface.getByRole('button', { name: 'Restore' }).first()
    await expect(restoreAction, 'Learning Content Trash must expose generic restore actions').toBeVisible({ timeout: 30_000 })
    await restoreAction.click()

    const dialog = page.getByRole('dialog', { name: /Restore to project/i })
    await expect(dialog, 'Learning Content Trash restore target dialog must open').toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(dialog, { label: 'Learning Content Trash restore target dialog', checkUuidSubstrings: true })
    await expect(dialog.getByRole('combobox', { name: 'Project' })).toBeVisible({ timeout: 30_000 })

    await dialog.getByRole('combobox', { name: 'Project' }).click()
    const listbox = page.getByRole('listbox')
    await expect(listbox, 'Learning Content Trash restore target list must open').toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(listbox, { label: 'Learning Content Trash restore target list', checkUuidSubstrings: true })
    const firstProjectOption = listbox.getByRole('option').first()
    await expect(firstProjectOption, 'Learning Content Trash restore target list must contain a human-readable project').toBeVisible({
        timeout: 30_000
    })
    await firstProjectOption.click()
    await expect(dialog.getByRole('combobox', { name: 'Project' })).not.toHaveText(/^[0-9a-f-]{30,}$/i)

    await expectRuntimeUxViewportMatrix(page, 'Learning Content Trash restore target dialog', {
        beforeEachViewport: async () => {
            await expect(dialog).toBeVisible({ timeout: 30_000 })
        }
    })
    await dialog.screenshot({ path: screenshotPath })

    const restoreResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
            response.url().endsWith('/restore'),
        { label: 'Restoring Learning Content from Trash into a selected project' }
    )
    await dialog.getByRole('button', { name: 'Restore' }).click()
    const restoreResponse = await restoreResponsePromise
    expect(restoreResponse.ok(), 'Learning Content restore target mutation must succeed').toBe(true)

    const restoreUrl = new URL(restoreResponse.url())
    const restoredRowId = restoreUrl.pathname.match(/\/runtime\/rows\/([^/]+)\/restore$/)?.[1]
    expect(restoredRowId, 'Learning Content restore response URL must expose the restored row id for API verification').toBeTruthy()

    const restoreBody = restoreResponse.request().postDataJSON() as Record<string, unknown>
    const restoreTarget = isRecord(restoreBody.restoreTarget) ? restoreBody.restoreTarget : {}
    const objectCollectionId = typeof restoreBody.objectCollectionId === 'string' ? restoreBody.objectCollectionId : ''
    const targetRecordId = typeof restoreTarget.targetRecordId === 'string' ? restoreTarget.targetRecordId : ''
    expect(objectCollectionId, 'Learning Content restore request must carry the source object collection id').toBeTruthy()
    expect(targetRecordId, 'Learning Content restore request must carry the selected restore target row id').toBeTruthy()

    await expect(dialog).toHaveCount(0)
    const restoredRow = await waitForApplicationRuntimeRow(api, applicationId, objectCollectionId, restoredRowId!, { workspaceId })
    expect(restoredRow?.ProjectId, 'Restored Learning Content row must point to the selected project').toBe(targetRecordId)
    const collectionRowIdsAfterRestore = await expectRuntimeCollectionRowIdsUnique(
        api,
        applicationId,
        objectCollectionId,
        workspaceId,
        'Learning Content collection after Trash restore'
    )
    expect(collectionRowIdsAfterRestore, 'Learning Content restore must preserve the restored row id').toContain(restoredRowId)

    await clickRuntimeNavigationItem(page, 'Learning Content')
    await expectRuntimeNavigationItemSelected(page, 'Learning Content')
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    const learningContentSurface = page.getByTestId('records-union-details-table').or(page.getByRole('grid')).first()
    await expect(learningContentSurface).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(learningContentSurface, {
        label: 'Learning Content after Trash restore',
        checkUuidSubstrings: true
    })
    const visibleLearningContentRowIdsAfterRestore = await readVisibleGridActionRowIds(learningContentSurface)
    expectUniqueRuntimeRowIds(visibleLearningContentRowIdsAfterRestore, 'Learning Content visible rows after Trash restore')
    expect(visibleLearningContentRowIdsAfterRestore, 'Learning Content restore must return the row to the visible table').toContain(
        restoredRowId
    )
}

async function deleteFirstPublishedLearningContentRowForTrashProof(
    page: Page,
    api: ApiContext,
    applicationId: string,
    workspaceId: string
): Promise<void> {
    await clickRuntimeNavigationItem(page, 'Learning Content')
    await expectRuntimeNavigationItemSelected(page, 'Learning Content')

    const unionWidget = page.getByTestId('records-union-details-table').first()
    await expect(unionWidget, 'Learning Content delete setup must use the generic records.union table').toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

    const rowAction = unionWidget.locator('[data-testid^="grid-row-actions-trigger-"]').first()
    await expect(rowAction, 'Learning Content delete setup must expose row actions').toBeVisible({ timeout: 30_000 })
    const visibleRowIdsBeforeDelete = await readVisibleGridActionRowIds(unionWidget)
    expectUniqueRuntimeRowIds(visibleRowIdsBeforeDelete, 'Learning Content visible rows before delete')
    const deletedRowActionTestId = await rowAction.getAttribute('data-testid')
    const deletedRowId = deletedRowActionTestId?.replace(/^grid-row-actions-trigger-/, '')
    expect(deletedRowId, 'Learning Content delete setup must target a concrete row id').toBeTruthy()
    await rowAction.click()

    const deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' })
    await expect(deleteMenuItem, 'Learning Content row actions must include Delete for Trash setup').toBeVisible({ timeout: 30_000 })
    await deleteMenuItem.click()

    const confirmDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByTestId('confirm-delete-confirm') })
        .first()
    await expect(confirmDialog, 'Learning Content delete confirmation dialog must open').toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(confirmDialog, { label: 'Learning Content delete confirmation dialog', checkUuidSubstrings: true })

    const deleteResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'DELETE' && response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`),
        { label: 'Deleting Learning Content row into Trash' }
    )
    await confirmDialog.getByTestId('confirm-delete-confirm').click()
    const deleteResponse = await deleteResponsePromise
    expect(deleteResponse.ok(), 'Learning Content row delete mutation must succeed before Trash restore').toBe(true)
    const deletedObjectCollectionId = new URL(deleteResponse.url()).searchParams.get('objectCollectionId') ?? ''
    expect(deletedObjectCollectionId, 'Learning Content delete request must carry the source object collection id').toBeTruthy()
    const collectionRowIdsAfterDelete = await expectRuntimeCollectionRowIdsUnique(
        api,
        applicationId,
        deletedObjectCollectionId,
        workspaceId,
        'Learning Content source collection after delete'
    )
    expect(collectionRowIdsAfterDelete, 'Learning Content delete must remove the targeted row from its source collection').not.toContain(
        deletedRowId
    )

    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    if (await unionWidget.isVisible().catch(() => false)) {
        const visibleRowIdsAfterDelete = await readVisibleGridActionRowIds(unionWidget)
        if (visibleRowIdsAfterDelete.length > 0) {
            expectUniqueRuntimeRowIds(visibleRowIdsAfterDelete, 'Learning Content visible rows after delete')
            expect(visibleRowIdsAfterDelete, 'Learning Content delete must remove the targeted row from the visible table').not.toContain(
                deletedRowId
            )
        }
    }
}

async function updateLearningContentSettings(
    api: ApiContext,
    applicationId: string,
    learningContentPatch: Record<string, unknown>
): Promise<void> {
    const application = await getApplication(api, applicationId)
    const settings = isRecord(application?.settings) ? application.settings : {}
    const learningContent = isRecord(settings.learningContent) ? settings.learningContent : {}
    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
        settings: {
            ...settings,
            learningContent: {
                ...learningContent,
                ...learningContentPatch
            }
        }
    })

    if (!response.ok) {
        throw new Error(`Updating Learning Content settings failed with ${response.status}: ${await response.text()}`)
    }
}

async function setLearningContentDefaultView(api: ApiContext, applicationId: string, defaultView: 'table' | 'cards'): Promise<void> {
    await updateLearningContentSettings(api, applicationId, { defaultView })
}

async function waitForLearnerPlayerCompletionResponse(
    page: Page,
    applicationId: string,
    targetObjectCodename: 'CourseItems' | 'TrackSteps'
): Promise<Response> {
    return page.waitForResponse(
        async (response) => {
            if (
                response.request().method() !== 'POST' ||
                !response.url().includes(`/api/v1/applications/${applicationId}/runtime/progress/content`)
            ) {
                return false
            }

            if (!response.ok()) {
                return false
            }

            const payload = await response.json().catch(() => null)
            return (
                payload?.persisted === true &&
                payload?.targetObjectCodename === targetObjectCodename &&
                payload?.progressPercent === 100 &&
                payload?.status === 'completed'
            )
        },
        { timeout: 30_000 }
    )
}

async function expectPublishedLearnerPlayer(options: { page: Page; applicationId: string; screenshotPath: string }): Promise<void> {
    const { page, applicationId, screenshotPath } = options
    await clickRuntimeNavigationItem(page, 'Courses')
    await expectRuntimeNavigationItemSelected(page, 'Courses')
    await page.getByRole('tab', { name: 'Player' }).click()
    await expect(page.getByRole('tab', { name: 'Player' })).toHaveAttribute('aria-selected', 'true')

    const player = page.getByTestId('learner-player')
    await expect(player, 'Course Builder must render the generic learner player').toBeVisible({ timeout: 30_000 })
    await expect(player.getByTestId('learner-player-parent-select'), 'Learner player must expose a generic parent selector').toBeVisible({
        timeout: 30_000
    })
    await player.getByTestId('learner-player-parent-select').click()
    await page.getByRole('option', { name: 'Learner Onboarding Course' }).click()
    await expect(player.getByTestId('learner-player-parent-select')).toContainText('Learner Onboarding Course', { timeout: 30_000 })
    const outline = player.getByTestId('learner-player-outline')
    const content = player.getByTestId('learner-player-content')
    await expect(
        outline.getByRole('button', { name: /Start with the course overview/ }),
        'Learner player must show the first course item in the outline'
    ).toBeVisible({
        timeout: 30_000
    })
    await expect(
        content.getByRole('heading', { name: /Start with the course overview/ }),
        'Learner player must show the current course item in the content pane'
    ).toBeVisible({
        timeout: 30_000
    })
    await expect(
        outline.getByRole('button', { name: /Watch the safety intro/ }),
        'Learner player must show later course items'
    ).toBeVisible({
        timeout: 30_000
    })
    await expect(outline.getByText('Locked').first(), 'Learner player must show sequential lock state').toBeVisible({ timeout: 30_000 })
    await expect(player.getByTestId('resource-preview'), 'Learner player must render the target resource preview').toBeVisible({
        timeout: 30_000
    })
    await expectNoTechnicalLeakage(player, { label: 'Course learner player', checkUuidSubstrings: true })

    const progressResponsePromise = waitForLearnerPlayerCompletionResponse(page, applicationId, 'CourseItems')
    await player.getByRole('button', { name: 'Complete' }).click()
    const progressResponse = await progressResponsePromise
    expect(progressResponse.ok(), 'Course item progress persistence must succeed from the generic learner player').toBe(true)
    await expect(progressResponse.json()).resolves.toMatchObject({
        persisted: true,
        targetObjectCodename: 'CourseItems',
        progressPercent: 100,
        status: 'completed'
    })
    await expect(player.getByText('1 of 2 completed'), 'Learner player must update local completion progress').toBeVisible({
        timeout: 30_000
    })
    await expectNoTechnicalLeakage(player, { label: 'Course learner player after completion', checkUuidSubstrings: true })

    await page.reload()
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    await clickRuntimeNavigationItem(page, 'Courses')
    await expectRuntimeNavigationItemSelected(page, 'Courses')
    await page.getByRole('tab', { name: 'Player' }).click()
    await expect(page.getByRole('tab', { name: 'Player' })).toHaveAttribute('aria-selected', 'true')
    const reloadedPlayer = page.getByTestId('learner-player')
    await reloadedPlayer.getByTestId('learner-player-parent-select').click()
    await page.getByRole('option', { name: 'Learner Onboarding Course' }).click()
    await expect(
        reloadedPlayer.getByText('1 of 2 completed'),
        'Learner player must derive completion count from persisted progress after reload'
    ).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(reloadedPlayer, { label: 'Reloaded course learner player', checkUuidSubstrings: true })

    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectPublishedTrackLearnerPlayer(options: { page: Page; applicationId: string; screenshotPath: string }): Promise<void> {
    const { page, applicationId, screenshotPath } = options
    await clickRuntimeNavigationItem(page, 'Tracks')
    await expectRuntimeNavigationItemSelected(page, 'Tracks')
    await page.getByRole('tab', { name: 'Player' }).click()
    await expect(page.getByRole('tab', { name: 'Player' })).toHaveAttribute('aria-selected', 'true')

    const player = page.getByTestId('learner-player')
    await expect(player, 'Track Builder must render the generic learner player').toBeVisible({ timeout: 30_000 })
    await player.getByTestId('learner-player-parent-select').click()
    await page.getByRole('option', { name: 'New learner onboarding track' }).click()
    await expect(player.getByTestId('learner-player-parent-select')).toContainText('New learner onboarding track', { timeout: 30_000 })

    const outline = player.getByTestId('learner-player-outline')
    const content = player.getByTestId('learner-player-content')
    await expect(
        outline.getByRole('button', { name: /Start onboarding/ }),
        'Track player must show the first track step in the outline'
    ).toBeVisible({
        timeout: 30_000
    })
    await expect(
        content.getByRole('heading', { name: /Start onboarding/ }),
        'Track player must show the current track step in the content pane'
    ).toBeVisible({
        timeout: 30_000
    })
    await expect(outline.getByRole('button', { name: /Compliance essentials/ }), 'Track player must show later track steps').toBeVisible({
        timeout: 30_000
    })
    await expect(outline.getByText('Locked').first(), 'Track player must show sequential lock state').toBeVisible({ timeout: 30_000 })
    await expect(
        player.getByText('This content item does not have a previewable source yet.'),
        'Track player must safely handle course targets without a direct media source'
    ).toBeVisible({
        timeout: 30_000
    })
    await expectNoTechnicalLeakage(player, { label: 'Track learner player', checkUuidSubstrings: true })

    const progressResponsePromise = waitForLearnerPlayerCompletionResponse(page, applicationId, 'TrackSteps')
    await player.getByRole('button', { name: 'Complete' }).click()
    const progressResponse = await progressResponsePromise
    expect(progressResponse.ok(), 'Track step progress persistence must succeed from the generic learner player').toBe(true)
    await expect(progressResponse.json()).resolves.toMatchObject({
        persisted: true,
        targetObjectCodename: 'TrackSteps',
        progressPercent: 100,
        status: 'completed'
    })
    await expect(player.getByText('1 of 2 completed'), 'Track player must update local completion progress').toBeVisible({
        timeout: 30_000
    })
    await expectNoTechnicalLeakage(player, { label: 'Track learner player after completion', checkUuidSubstrings: true })

    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectPublishedBuilderRelationScope(options: {
    page: Page
    navigationItem: string
    label: string
    initialParent: string
    initialChildren: string[]
    nextParent: string
    nextChildren: string[]
    screenshotPath: string
}): Promise<void> {
    const { page, navigationItem, label, initialParent, initialChildren, nextParent, nextChildren, screenshotPath } = options
    await clickRuntimeNavigationItem(page, navigationItem)
    await expectRuntimeNavigationItemSelected(page, navigationItem)
    await page.getByRole('tab', { name: 'Outline' }).click()

    const builder = page.getByTestId('runtime-relation-builder')
    await expect(builder, `${label} must render the generic relationBuilder outline`).toBeVisible({ timeout: 30_000 })
    await expectNoTechnicalLeakage(builder, { label: `${label} relation builder`, checkUuidSubstrings: true })
    await expect(builder.getByTestId('runtime-relation-builder-parent-select')).toContainText(initialParent, { timeout: 30_000 })
    for (const child of initialChildren) {
        await expect(builder.getByText(child).first(), `${label} must show ${child} for ${initialParent}`).toBeVisible({
            timeout: 30_000
        })
    }

    await builder.getByTestId('runtime-relation-builder-parent-select').click()
    await page.getByRole('option', { name: nextParent }).click()
    await expect(builder.getByTestId('runtime-relation-builder-parent-select')).toContainText(nextParent, { timeout: 30_000 })
    for (const child of nextChildren) {
        await expect(builder.getByText(child).first(), `${label} must show ${child} for ${nextParent}`).toBeVisible({ timeout: 30_000 })
    }
    for (const child of initialChildren) {
        await expect(builder.getByText(child), `${label} must hide ${child} after switching to ${nextParent}`).toHaveCount(0)
    }

    await expectNoTechnicalLeakage(builder, { label: `${label} relation builder after parent switch`, checkUuidSubstrings: true })
    await assertNoHorizontalOverflowWithScreenshots(page, `${label} relation builder`, screenshotPath)
    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectPublishedBuilderEnrollmentWarning(options: {
    page: Page
    navigationItem: string
    label: string
    parentName: string
    warningText: string
    screenshotPath: string
}): Promise<void> {
    const { page, navigationItem, label, parentName, warningText, screenshotPath } = options
    await clickRuntimeNavigationItem(page, navigationItem)
    await expectRuntimeNavigationItemSelected(page, navigationItem)
    await page.getByRole('tab', { name: 'Enrollments' }).click()

    const builder = page.getByTestId('runtime-relation-builder')
    await expect(builder, `${label} enrollments must render the generic relationBuilder surface`).toBeVisible({ timeout: 30_000 })
    await expect(builder.getByTestId('runtime-relation-builder-parent-select')).toContainText(parentName, { timeout: 30_000 })
    await expect(builder.getByText(warningText), `${label} must warn about active enrollments`).toBeVisible({ timeout: 30_000 })
    await expect(
        page.getByRole('grid').filter({ hasText: parentName }).last(),
        `${label} enrollments must render a generic detailsTable list`
    ).toBeVisible({
        timeout: 30_000
    })
    await page.screenshot({ path: screenshotPath, fullPage: true })
}

async function expectPublishedEnrollmentWizard(options: {
    page: Page
    navigationItem: string
    label: string
    panelId: string
    screenshotPath: string
}): Promise<void> {
    const { page, navigationItem, label, panelId, screenshotPath } = options
    await clickRuntimeNavigationItem(page, navigationItem)
    await expectRuntimeNavigationItemSelected(page, navigationItem)
    await page.getByRole('tab', { name: 'Enrollments' }).click()

    const panel = page.getByTestId(`runtime-relation-panel-${panelId}`)
    await expect(panel, `${label} enrollments must expose a metadata-driven relation panel`).toBeVisible({ timeout: 30_000 })
    await panel.getByRole('button', { name: 'Create' }).click()

    const dialog = page.getByRole('dialog', { name: 'Create related record' })
    await expect(dialog, `${label} enrollment wizard dialog must open from the generic create action`).toBeVisible({
        timeout: 30_000
    })
    await expect(dialog.getByText('Content'), `${label} enrollment wizard must include the content step`).toBeVisible()
    await expect(dialog.getByText('Learners'), `${label} enrollment wizard must include the learners step`).toBeVisible()
    await expect(dialog.getByText('Parameters'), `${label} enrollment wizard must include the parameters step`).toBeVisible()
    await expect(dialog.getByText(/selected .* is used as the enrollment target/i)).toBeVisible()
    await expectNoTechnicalLeakage(dialog, { label: `${label} enrollment wizard dialog`, checkUuidSubstrings: true })
    await expectSemanticFieldControls(dialog, {
        forbiddenEditableIdLabels: ['ProjectId', 'CourseId', 'TrackId', 'TargetRecordId', 'UserId', 'PrincipalId']
    })

    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog.getByText('Select the learner and class context for this enrollment.')).toBeVisible()
    await expectNoTechnicalLeakage(dialog, { label: `${label} enrollment wizard learner step`, checkUuidSubstrings: true })
    await dialog.screenshot({ path: screenshotPath })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
}

function readRuntimeRowValue(
    row: Record<string, unknown>,
    columns: Array<{ field?: unknown; codename?: unknown }>,
    ...keys: string[]
): unknown {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            return row[key]
        }
    }

    for (const column of columns) {
        if (typeof column.field !== 'string' || typeof column.codename !== 'string' || !keys.includes(column.codename)) {
            continue
        }

        if (Object.prototype.hasOwnProperty.call(row, column.field)) {
            return row[column.field]
        }
    }

    return undefined
}

async function createWorkflowRuntimeRow(
    api: ApiContext,
    applicationId: string,
    workspaceId: string,
    objectCollectionId: string,
    data: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const created = await createRuntimeRow(api, applicationId, {
        workspaceId,
        objectCollectionId,
        data
    })
    if (typeof created?.id !== 'string') {
        throw new Error(`Runtime row creation did not return an id for ${objectCollectionId}`)
    }

    const version = Number(created.version ?? created._upl_version ?? 1)
    return {
        id: created.id,
        ...data,
        ...(Number.isInteger(version) && version > 0 ? { _upl_version: version } : { _upl_version: 1 })
    }
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
    const rowActions = await getVisibleRuntimeRowActions(page, rowId)
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

    const updatedRow = await getRuntimeRow(api, applicationId, rowId, { objectCollectionId, workspaceId })
    expect(updatedRow?.id, `Browser workflow action ${actionCodename} must leave the runtime row fetchable`).toBe(rowId)
    const updatedVersion = Number(updatedRow?.version ?? updatedRow?.data?._upl_version)
    expect(updatedVersion, `${actionCodename} must persist the row version through UI`).toBe(expectedVersion + 1)
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    return {
        id: rowId,
        ...row,
        ...(updatedRow?.data ?? {}),
        Status: expectedToStatus,
        _upl_version: expectedVersion + 1
    }
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
        test.setTimeout(1_800_000)
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
        expect((menuWidgetConfig as Record<string, unknown>).maxPrimaryItems).toBe(12)
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
            learningResourcesObjectId,
            quizzesObjectId,
            accessLinksObjectId,
            studentsObjectId,
            quizResponsesObjectId,
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
            contentProgressObjectId,
            courseItemsObjectId,
            trackStepsObjectId,
            learnerHomePageId,
            progressLedgerId
        ] = await Promise.all([
            waitForApplicationObjectId(api, applicationId, 'LearningResources'),
            waitForApplicationObjectId(api, applicationId, 'Quizzes'),
            waitForApplicationObjectId(api, applicationId, 'AccessLinks'),
            waitForApplicationObjectId(api, applicationId, 'Students'),
            waitForApplicationObjectId(api, applicationId, 'Quiz Responses'),
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
            waitForApplicationObjectId(api, applicationId, 'ContentProgress'),
            waitForApplicationObjectId(api, applicationId, 'CourseItems'),
            waitForApplicationObjectId(api, applicationId, 'TrackSteps'),
            waitForApplicationObjectId(api, applicationId, 'LearnerHome'),
            waitForApplicationLedgerId(api, applicationId, 'ProgressLedger')
        ])

        const workspaces = await listApplicationWorkspaces(api, applicationId)
        const workspaceItems = Array.isArray(workspaces?.items) ? workspaces.items : []
        expect(workspaceItems.filter((workspace) => workspace?.workspaceType === 'shared' || workspace?.type === 'shared')).toHaveLength(0)
        const mainWorkspaceId = workspaceItems.find(
            (workspace) => workspace?.isDefault === true || workspace?.workspaceType === 'personal' || workspace?.type === 'personal'
        )?.id
        if (typeof mainWorkspaceId !== 'string' || mainWorkspaceId.length === 0) {
            throw new Error('Main application workspace was not found for runtime verification')
        }

        const [contentTypeEnumerationId, resourceTypeEnumerationId, publicationStatusEnumerationId, questionTypeEnumerationId] =
            await Promise.all([
                waitForMetahubEnumerationId(api, importedId, 'Content Type'),
                waitForMetahubEnumerationId(api, importedId, 'Resource Type'),
                waitForMetahubEnumerationId(api, importedId, 'Publication Status'),
                waitForMetahubEnumerationId(api, importedId, 'Question Type')
            ])
        const [textValueId, quizRefValueId, pageResourceTypeValueId, publishedPublicationStatusValueId, singleChoiceValueId] =
            await Promise.all([
                waitForOptionValueId(api, importedId, contentTypeEnumerationId, 'Text'),
                waitForOptionValueId(api, importedId, contentTypeEnumerationId, 'QuizRef'),
                waitForOptionValueId(api, importedId, resourceTypeEnumerationId, 'Page'),
                waitForOptionValueId(api, importedId, publicationStatusEnumerationId, 'Published'),
                waitForOptionValueId(api, importedId, questionTypeEnumerationId, 'SingleChoice')
            ])

        const publicWorkspaceResponse = await sendWithCsrf(api, 'POST', `/api/v1/applications/${applicationId}/runtime/workspaces`, {
            name: createLocalizedContent('en', `E2E ${runManifest.runId} LMS Public Guest Workspace`)
        })
        if (!publicWorkspaceResponse.ok) {
            throw new Error(`Creating LMS public guest shared workspace failed with ${publicWorkspaceResponse.status}`)
        }
        const publicWorkspace = await publicWorkspaceResponse.json()
        const publicGuestWorkspaceId = publicWorkspace?.id
        if (typeof publicGuestWorkspaceId !== 'string' || publicGuestWorkspaceId.length === 0) {
            throw new Error('LMS public guest shared workspace creation did not return an id')
        }

        await seedSharedPublicGuestContent({
            api,
            page,
            applicationId,
            workspaceId: publicGuestWorkspaceId,
            learningResourcesObjectId,
            quizzesObjectId,
            accessLinksObjectId,
            textValueId,
            quizRefValueId,
            pageResourceTypeValueId,
            publishedPublicationStatusValueId,
            singleChoiceValueId
        })

        const restoreMainWorkspaceResponse = await sendWithCsrf(
            api,
            'PATCH',
            `/api/v1/applications/${applicationId}/runtime/workspaces/${mainWorkspaceId}/default`,
            {}
        )
        if (!restoreMainWorkspaceResponse.ok) {
            throw new Error(`Restoring LMS main workspace as default failed with ${restoreMainWorkspaceResponse.status}`)
        }

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Learning' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: LMS_WELCOME_PAGE.title.en })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.en)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByRole('heading', { name: LMS_WELCOME_PAGE.howToStartTitle.en })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.en)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Enrollments' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Certificates' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Department Progress' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Assignment Scores' })).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.getByTestId('runtime-page-blocks'), {
            label: 'LMS dashboard page player blocks',
            checkUuidSubstrings: true
        })
        await expect(page.getByRole('tab', { name: 'My Courses' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('tab', { name: 'My Courses' }).click()
        await expect(page.getByText('Compliance Refresh Course')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('tab', { name: 'My Tracks' }).click()
        await expect(page.getByText('Compliance refresh track')).toBeVisible({ timeout: 30_000 })
        await expectVerticalGapBetween(page.getByRole('grid').first(), page.getByTestId('runtime-page-blocks'), {
            min: 12,
            max: 96,
            label: 'LMS dashboard table-to-content module spacing'
        })
        await expect(page.getByRole('link', { name: 'Workspaces' }).first()).toBeVisible()
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Learning portal stats')).toHaveCount(0)
        await expect(page.getByText('Dashboard preview of the canonical learning lesson')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-progress')).toContainText('Reading progress 0%', { timeout: 30_000 })
        const pageProgressResponsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/progress/content`),
            { timeout: 30_000 }
        )
        await page.getByRole('button', { name: 'Mark complete' }).click()
        const pageProgressResponse = await pageProgressResponsePromise
        expect(pageProgressResponse.ok(), 'Page progress persistence must succeed from the published app page player').toBe(true)
        await expect(pageProgressResponse.json()).resolves.toMatchObject({
            persisted: true,
            targetObjectCodename: 'LearnerHome',
            targetRecordId: learnerHomePageId,
            progressPercent: 100,
            status: 'completed'
        })
        await expect(page.getByTestId('runtime-page-progress')).toContainText('Reading progress 100%', { timeout: 30_000 })
        await expect
            .poll(
                async () => {
                    const runtime = await getApplicationRuntime(api, applicationId, {
                        objectId: contentProgressObjectId,
                        workspaceId: mainWorkspaceId
                    })
                    const columns = Array.isArray(runtime.columns)
                        ? (runtime.columns as Array<{ field?: unknown; codename?: unknown }>)
                        : []
                    const rows = Array.isArray(runtime.rows) ? (runtime.rows as Array<Record<string, unknown>>) : []
                    return rows.some((row) => {
                        const targetObjectCodename = readRuntimeRowValue(row, columns, 'TargetObjectCodename', 'target_object_codename')
                        const targetRecordId = readRuntimeRowValue(row, columns, 'TargetRecordId', 'target_record_id')
                        const progressStatus = readRuntimeRowValue(row, columns, 'ProgressStatus', 'progress_status')
                        const progressPercent = Number(readRuntimeRowValue(row, columns, 'ProgressPercent', 'progress_percent'))
                        return (
                            targetObjectCodename === 'LearnerHome' &&
                            targetRecordId === learnerHomePageId &&
                            progressStatus === 'completed' &&
                            progressPercent === 100
                        )
                    })
                },
                { timeout: 30_000, intervals: [500, 1_000, 2_000] }
            )
            .toBe(true)
        await assertNoHorizontalOverflow(page, 'LMS dashboard')
        await assertElementFitsViewport(page, 'runtime-page-blocks', 'LMS dashboard page block surface')
        await page.screenshot({ path: testInfo.outputPath('lms-page-player-progress-complete-en.png'), fullPage: true })
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-en.png'), fullPage: true })

        await updateLearningContentSettings(api, applicationId, {
            defaultView: 'table',
            courseCompletionPolicy: {
                navigationMode: 'sequential',
                completionCondition: 'selectedItems',
                statusFormat: 'passedFailed'
            },
            trackOrderPolicy: {
                orderMode: 'byDays'
            }
        })
        await page.goto(`/a/${applicationId}`)
        await expectPublishedLearningContentView({
            page,
            api,
            applicationId,
            workspaceId: mainWorkspaceId,
            navigationItem: 'Learning Content',
            label: 'Learning Content library',
            screenshotPath: testInfo.outputPath('lms-learning-content-library-en.png'),
            captureViewportScreenshots: true,
            expectCreateMenu: true,
            expectRowActions: true,
            expectShareWithMemberAction: true,
            expectMoveToProjectAction: true
        })
        await setLearningContentDefaultView(api, applicationId, 'cards')
        await page.goto(`/a/${applicationId}`)
        await expectPublishedLearningContentView({
            page,
            navigationItem: 'Learning Content',
            label: 'Learning Content library card default',
            expectedDefaultView: 'card',
            screenshotPath: testInfo.outputPath('lms-learning-content-library-card-default-en.png'),
            cardScreenshotPath: testInfo.outputPath('lms-learning-content-library-card-default-en.png'),
            expectRowActions: true
        })
        await setLearningContentDefaultView(api, applicationId, 'table')
        await page.goto(`/a/${applicationId}`)
        await expectPublishedLearningContentView({
            page,
            navigationItem: 'Recent',
            label: 'Recent Learning Content',
            screenshotPath: testInfo.outputPath('lms-learning-content-recent-en.png')
        })
        await expectPublishedLearningContentView({
            page,
            navigationItem: 'Starred',
            label: 'Starred Learning Content',
            screenshotPath: testInfo.outputPath('lms-learning-content-starred-en.png')
        })
        await expectPublishedLearningContentView({
            page,
            navigationItem: 'Shared with me',
            label: 'Shared Learning Content',
            screenshotPath: testInfo.outputPath('lms-learning-content-shared-en.png')
        })
        await deleteFirstPublishedLearningContentRowForTrashProof(page, api, applicationId, mainWorkspaceId)
        await expectPublishedLearningContentView({
            page,
            navigationItem: 'Trash',
            label: 'Learning Content Trash',
            screenshotPath: testInfo.outputPath('lms-learning-content-trash-en.png')
        })
        await expectPublishedTrashRestoreTargetFlow({
            page,
            api,
            applicationId,
            workspaceId: mainWorkspaceId,
            screenshotPath: testInfo.outputPath('lms-learning-content-trash-restore-target-en.png')
        })

        await expectPublishedBuilderTabs({
            page,
            navigationItem: 'Courses',
            label: 'Course Builder',
            tabNames: ['Outline', 'General', 'Completion', 'Player', 'Enrollments', 'Reports'],
            screenshotPath: testInfo.outputPath('lms-course-builder-tabs-en.png')
        })
        await expectPublishedLearnerPlayer({
            page,
            applicationId,
            screenshotPath: testInfo.outputPath('lms-course-builder-learner-player-en.png')
        })
        await expectPublishedBuilderRelationScope({
            page,
            navigationItem: 'Courses',
            label: 'Course Builder',
            initialParent: 'Compliance Refresh Course',
            initialChildren: ['Read the certificate policy'],
            nextParent: 'Learner Onboarding Course',
            nextChildren: ['Start with the course overview', 'Watch the safety intro'],
            screenshotPath: testInfo.outputPath('lms-course-builder-outline-scope-en.png')
        })
        await expectPublishedBuilderEnrollmentWarning({
            page,
            navigationItem: 'Courses',
            label: 'Course Builder',
            parentName: 'Compliance Refresh Course',
            warningText: 'This course already has enrollments. Review learner impact before changing the outline.',
            screenshotPath: testInfo.outputPath('lms-course-builder-enrollments-warning-en.png')
        })
        await expectPublishedEnrollmentWizard({
            page,
            navigationItem: 'Courses',
            label: 'Course Builder',
            panelId: 'course-enrollments',
            screenshotPath: testInfo.outputPath('lms-course-builder-enrollment-wizard-en.png')
        })
        await expectPublishedBuilderTabs({
            page,
            navigationItem: 'Tracks',
            label: 'Learning Track Builder',
            tabNames: ['Outline', 'General', 'Completion', 'Player', 'Enrollments', 'Reports'],
            screenshotPath: testInfo.outputPath('lms-track-builder-tabs-en.png')
        })
        await expectPublishedTrackLearnerPlayer({
            page,
            applicationId,
            screenshotPath: testInfo.outputPath('lms-track-builder-learner-player-en.png')
        })
        await expectPublishedBuilderRelationScope({
            page,
            navigationItem: 'Tracks',
            label: 'Learning Track Builder',
            initialParent: 'Compliance refresh track',
            initialChildren: ['Refresh compliance'],
            nextParent: 'New learner onboarding track',
            nextChildren: ['Start onboarding', 'Compliance essentials'],
            screenshotPath: testInfo.outputPath('lms-track-builder-outline-scope-en.png')
        })
        await expectPublishedBuilderEnrollmentWarning({
            page,
            navigationItem: 'Tracks',
            label: 'Learning Track Builder',
            parentName: 'Compliance refresh track',
            warningText: 'This track already has enrollments. Review learner impact before changing stages or steps.',
            screenshotPath: testInfo.outputPath('lms-track-builder-enrollments-warning-en.png')
        })

        await expectPublishedOutlineReorder({
            page,
            api,
            applicationId,
            objectId: courseItemsObjectId,
            workspaceId: mainWorkspaceId,
            label: 'CourseItems outline',
            screenshotPath: testInfo.outputPath('lms-course-items-outline-ordering-en.png')
        })
        await expectPublishedOutlineReorder({
            page,
            api,
            applicationId,
            objectId: trackStepsObjectId,
            workspaceId: mainWorkspaceId,
            label: 'TrackSteps outline',
            screenshotPath: testInfo.outputPath('lms-track-steps-outline-ordering-en.png')
        })

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
        await expectNoTechnicalLeakage(createArticleDialog, {
            label: 'Published app create article dialog',
            checkUuidSubstrings: true
        })
        await expectSemanticFieldControls(createArticleDialog, {
            forbiddenEditableIdLabels: ['ProjectId', 'OwnerId', 'UserId', 'FolderId', 'TargetRecordId']
        })
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
        await expectNoTechnicalLeakage(editArticleDialog, {
            label: 'Published app edit article dialog',
            checkUuidSubstrings: true
        })
        await expectSemanticFieldControls(editArticleDialog, {
            forbiddenEditableIdLabels: ['ProjectId', 'OwnerId', 'UserId', 'FolderId', 'TargetRecordId']
        })
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
        const learningContentSummarySurface = page.getByTestId('runtime-report-details-table').first()
        await expect(
            learningContentSummarySurface,
            'Reports section must render the primary Learning Content summary report through the generic report table'
        ).toBeVisible({ timeout: 30_000 })
        await expect(learningContentSummarySurface.getByRole('columnheader', { name: 'Type' })).toBeVisible({ timeout: 30_000 })
        await expect(learningContentSummarySurface.getByRole('columnheader', { name: 'Title' })).toBeVisible({ timeout: 30_000 })
        await expect(learningContentSummarySurface.getByRole('columnheader', { name: 'Status' })).toBeVisible({ timeout: 30_000 })
        await expect(learningContentSummarySurface.getByRole('gridcell', { name: 'Learner Onboarding Course' })).toBeVisible({
            timeout: 30_000
        })
        await expect(learningContentSummarySurface.getByRole('gridcell', { name: 'New learner onboarding track' })).toBeVisible({
            timeout: 30_000
        })
        await expect(learningContentSummarySurface.getByRole('gridcell', { name: 'Safety intro video' })).toBeVisible({
            timeout: 30_000
        })
        await expect(learningContentSummarySurface.getByRole('gridcell', { name: 'All active learners' })).toHaveCount(0)
        await expectNoTechnicalLeakage(learningContentSummarySurface, {
            label: 'Reports Learning Content summary report',
            checkUuidSubstrings: true
        })
        await expectReportCsvExport(page, learningContentSummarySurface, 'Reports Learning Content summary report')
        await expectNoTechnicalLeakage(page.locator('main').first(), {
            label: 'Reports navigation surface',
            checkUuidSubstrings: true
        })
        await expectDataGridHorizontalScrollConstrained(page, 'Reports Learning Content summary report')
        await expectNoDataGridTechnicalLeakage(learningContentSummarySurface, {
            label: 'Reports Learning Content summary report',
            checkUuidSubstrings: true
        })
        await assertNoHorizontalOverflowWithScreenshots(
            page,
            'Reports Learning Content summary report',
            testInfo.outputPath('lms-reports-learning-content-summary-viewport.png')
        )
        await assertHomeDashboardWidgetsHidden()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/a/${applicationId}`)

        await expect(page.getByText('Access Links', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Ссылки доступа', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Обучение' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'More' })).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-blocks')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: LMS_WELCOME_PAGE.title.ru })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.intro.ru)).toBeVisible({
            timeout: 30_000
        })
        await expect(page.getByRole('heading', { name: LMS_WELCOME_PAGE.howToStartTitle.ru })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText(LMS_WELCOME_PAGE.workspaceGuidance.ru)).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Учащиеся' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Назначения' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Сертификаты' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Прогресс подразделений' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('heading', { name: 'Оценки заданий' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Нет данных для отображения', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Learners', { exact: true })).toHaveCount(0)
        await expect(page.getByText('No data to display', { exact: true })).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Рабочие пространства' }).first()).toBeVisible()
        await expect(page.getByText('Module access QR')).toHaveCount(0)
        await expect(page.getByText('Статистика учебного портала')).toHaveCount(0)
        await expect(page.getByTestId('runtime-page-progress')).toContainText('Прогресс чтения 100%', { timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('main').first(), {
            label: 'RU LMS dashboard',
            checkUuidSubstrings: true
        })
        await expectNoRussianLmsFallbackText(page.locator('main').first(), 'RU LMS dashboard')
        await assertNoHorizontalOverflow(page, 'RU LMS dashboard')
        await page.screenshot({ path: testInfo.outputPath('lms-dashboard-ru.png'), fullPage: true })

        await clickRuntimeNavigationItem(page, 'Учебный контент')
        const ruLearningContentSurface = page.getByTestId('records-union-details-table').first()
        await expect(ruLearningContentSurface, 'RU Learning Content runtime surface must load').toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(ruLearningContentSurface, {
            label: 'RU Learning Content runtime surface',
            checkUuidSubstrings: true
        })
        await expectNoDataGridTechnicalLeakage(ruLearningContentSurface, {
            label: 'RU Learning Content runtime surface',
            checkUuidSubstrings: true
        })
        await expectNoRussianLmsFallbackText(ruLearningContentSurface, 'RU Learning Content runtime surface')
        await assertNoHorizontalOverflow(page, 'RU Learning Content runtime surface')
        await ruLearningContentSurface.getByTestId('records-union-create-target-menu-button').click()
        await page.getByRole('menuitem', { name: 'Ссылка', exact: true }).click()
        const ruLinkDialog = page.getByRole('dialog').first()
        await expect(ruLinkDialog, 'RU Link create dialog must open from the generic create menu').toBeVisible({ timeout: 30_000 })
        await ruLinkDialog.getByLabel('URL источника *', { exact: true }).fill('javascript:alert(1)')
        await expect(ruLinkDialog.getByText('Введите абсолютный URL http или https.')).toBeVisible({ timeout: 30_000 })
        await expectLocalizedValidation(ruLinkDialog, 'ru', { label: 'RU Learning Content link validation' })
        await expectNoRussianLmsFallbackText(ruLinkDialog, 'RU Learning Content link validation')
        await ruLinkDialog.screenshot({ path: testInfo.outputPath('lms-learning-content-link-validation-ru.png') })
        await ruLinkDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(ruLinkDialog).toHaveCount(0)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SAMPLE_LINK.slug}`)

        await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Snapshot LMS public guest start page',
            checkUuidSubstrings: true
        })
        await page.getByLabel('Your name').fill('Learning guest learner')
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Start learning' }), 'Start learning')

        await expect(page.getByText(LMS_DEMO_CONTENT_NODE.title.en)).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Snapshot LMS public guest content page',
            checkUuidSubstrings: true
        })
        await expect(page.getByText(LMS_DEMO_CONTENT_NODE.contentItems.en[0].itemContent)).toBeVisible({ timeout: 30_000 })
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Next' }), 'Next content item')
        await expect(page.getByText(LMS_DEMO_CONTENT_NODE.contentItems.en[1].itemTitle)).toBeVisible({ timeout: 30_000 })
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Open quiz' }), 'Open quiz')

        await expect(page.getByText(LMS_DEMO_QUIZ.questions.en[0].prompt)).toBeVisible({ timeout: 30_000 })
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[0].options[0].label, 'en')
        await checkQuizOption(page, LMS_DEMO_QUIZ.questions.en[1].options[0].label, 'en')
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Submit quiz' }), 'Submit quiz')
        await expect(page.getByText('Score 2 / 2')).toBeVisible({ timeout: 30_000 })
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Back to content' }), 'Back to content')
        await activateButtonByKeyboard(page, page.getByRole('button', { name: 'Complete content' }), 'Complete content')
        await expect(page.getByText('Content complete. Progress has been recorded for this session.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey.png'), fullPage: true })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/public/a/${applicationId}/links/${LMS_SECONDARY_LINK.slug}?locale=ru`)

        await expect(page.getByLabel('Ваше имя')).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Snapshot LMS public guest start page RU',
            checkUuidSubstrings: true
        })
        await expectNoRussianLmsFallbackText(page.locator('body'), 'Snapshot LMS public guest start page RU')
        await assertNoHorizontalOverflow(page, 'Snapshot LMS public guest start page RU')
        await page.getByLabel('Ваше имя').fill('Русский гость')
        await page.getByRole('button', { name: 'Начать обучение' }).click()

        const secondaryContent = LMS_DEMO_CONTENT_NODES.find((content) => content.accessLinkSlug === LMS_SECONDARY_LINK.slug)
        if (!secondaryContent) {
            throw new Error('LMS fixture contract is missing the secondary public content definition')
        }

        await expect(page.getByText(secondaryContent.title.ru)).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Snapshot LMS public guest content page RU',
            checkUuidSubstrings: true
        })
        await expectNoRussianLmsFallbackText(page.locator('body'), 'Snapshot LMS public guest content page RU')
        await assertNoHorizontalOverflow(page, 'Snapshot LMS public guest content page RU')
        await expect(page.getByText(secondaryContent.contentItems.ru[0].itemContent ?? '')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Далее' }).click()
        await expect(page.getByText(secondaryContent.contentItems.ru[1].itemTitle)).toBeVisible({ timeout: 30_000 })
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
        await page.getByRole('button', { name: 'Назад к контенту' }).click()
        await expect(page.getByRole('button', { name: 'Завершить контент' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Завершить контент' }).click()
        await expect(page.getByText('Контент завершён. Прогресс записан для этой сессии.')).toBeVisible({ timeout: 30_000 })
        await page.screenshot({ path: testInfo.outputPath('lms-guest-journey-ru.png'), fullPage: true })

        await expectPublicRuntimeSecurityEdges(page, applicationId)
        await expectRegistrarOnlyLedgerRejectsManualWrite(api, applicationId, progressLedgerId, mainWorkspaceId)

        const enrollmentRows = await waitForApplicationRuntimeRowCount(
            api,
            applicationId,
            enrollmentsObjectId,
            LMS_DEMO_ENROLLMENTS.length + 2,
            {
                workspaceId: mainWorkspaceId
            }
        )
        const enrollmentToPost = enrollmentRows.find((row) => row?._app_record_state !== 'posted') ?? enrollmentRows[0]
        if (typeof enrollmentToPost?.id !== 'string') {
            throw new Error('LMS posting proof could not find an enrollment runtime row')
        }

        await page.goto(`/a/${applicationId}/${encodeURIComponent(enrollmentsObjectId)}`)
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

        const expectedContentProgressRuntimeRows =
            LMS_DEMO_CONTENT_PROGRESS.length +
            1 + // page completion progress
            2 + // course item progress plus course aggregate
            2 + // track step progress plus track aggregate
            1 // learner-player preview view progress before explicit completion

        const [
            studentRows,
            quizResponseRows,
            contentProgressRows,
            publicGuestStudentRows,
            publicGuestQuizResponseRows,
            publicGuestContentProgressRows
        ] = await Promise.all([
            waitForApplicationRuntimeRowCount(api, applicationId, studentsObjectId, LMS_DEMO_STUDENTS.length, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, quizResponsesObjectId, LMS_DEMO_QUIZ_RESPONSES.length, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, contentProgressObjectId, expectedContentProgressRuntimeRows, {
                workspaceId: mainWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, studentsObjectId, 2, {
                workspaceId: publicGuestWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, quizResponsesObjectId, 4, {
                workspaceId: publicGuestWorkspaceId
            }),
            waitForApplicationRuntimeRowCount(api, applicationId, contentProgressObjectId, 2, {
                workspaceId: publicGuestWorkspaceId
            })
        ])

        expect(studentRows).toHaveLength(LMS_DEMO_STUDENTS.length)
        expect(quizResponseRows).toHaveLength(LMS_DEMO_QUIZ_RESPONSES.length)
        expect(contentProgressRows).toHaveLength(expectedContentProgressRuntimeRows)
        expect(new Set(contentProgressRows.map((row) => requireRuntimeRowId(row, 'ContentProgress'))).size).toBe(contentProgressRows.length)
        expect(publicGuestStudentRows).toHaveLength(2)
        expect(publicGuestQuizResponseRows).toHaveLength(4)
        expect(publicGuestContentProgressRows).toHaveLength(2)
        expect(new Set(publicGuestContentProgressRows.map((row) => requireRuntimeRowId(row, 'Public ContentProgress'))).size).toBe(
            publicGuestContentProgressRows.length
        )
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

        const assignmentRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, assignmentsObjectId, {
            Title: 'Operational workflow assignment',
            TargetType: 'content'
        })
        const trainingEventRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, trainingEventsObjectId, {
            Title: 'Operational workflow training event',
            StartsAt: '2026-05-15T09:00:00.000Z',
            EndsAt: '2026-05-15T10:00:00.000Z',
            Capacity: 12
        })
        const certificateRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, certificatesObjectId, {
            CertificateNumber: 'CERT-E2E-WORKFLOW',
            StudentId: primaryStudentId,
            IssuedAt: '2026-05-15T10:00:00.000Z'
        })
        const assignmentRowId = requireRuntimeRowId(assignmentRow, 'Operational workflow assignment')
        const trainingEventRowId = requireRuntimeRowId(trainingEventRow, 'Operational workflow training event')
        const certificateRowId = requireRuntimeRowId(certificateRow, 'Operational workflow certificate')

        let browserGatedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, assignmentSubmissionsObjectId, {
            AssignmentId: assignmentRowId,
            StudentId: primaryStudentId,
            SubmittedAt: '2026-05-15T10:30:00.000Z',
            Status: 'Submitted',
            Score: 0
        })
        const browserGatedSubmissionRowId = requireRuntimeRowId(browserGatedSubmissionRow, 'Browser-gated workflow submission')
        const browserGatedSubmissionVersion = requireRuntimeRowVersion(browserGatedSubmissionRow, 'Browser-gated workflow submission')

        await page.goto(`/a/${applicationId}/${encodeURIComponent(assignmentSubmissionsObjectId)}`)
        const hiddenCapabilityRowActions = await getVisibleRuntimeRowActions(page, browserGatedSubmissionRowId)
        await hiddenCapabilityRowActions.click()
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
        const visibleCapabilityRowActions = await getVisibleRuntimeRowActions(page, browserGatedSubmissionRowId)
        await visibleCapabilityRowActions.click()
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
            browserGatedSubmissionRowId,
            { workspaceId: mainWorkspaceId }
        )
        expect(browserGatedSubmissionRow.Status).toBe('PendingReview')
        await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

        let acceptedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, assignmentSubmissionsObjectId, {
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

        let declinedSubmissionRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, assignmentSubmissionsObjectId, {
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

        let attendedRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, trainingAttendanceObjectId, {
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

        const noShowRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, trainingAttendanceObjectId, {
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

        let certificateIssueRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, certificateIssuesObjectId, {
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

        let developmentTaskRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, developmentPlanTasksObjectId, {
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

        const sentNotificationRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, notificationOutboxObjectId, {
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

        let failedNotificationRow = await createWorkflowRuntimeRow(api, applicationId, mainWorkspaceId, notificationOutboxObjectId, {
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
        expect(Number(reportPayload.total)).toBeGreaterThanOrEqual(LMS_DEMO_CONTENT_PROGRESS.length)
        expect(typeof reportPayload.aggregations?.AverageProgress).toBe('number')

        const learningContentSummaryReport = LMS_DEMO_REPORTS.find((report) => report.codename === 'LearningContentSummary')
        if (!learningContentSummaryReport) {
            throw new Error('LMS fixture contract is missing the Learning Content summary report definition')
        }

        const summaryReportResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(mainWorkspaceId)}`,
            {
                reportCodename: learningContentSummaryReport.codename,
                limit: 10,
                offset: 0
            }
        )
        if (!summaryReportResponse.ok) {
            throw new Error(
                `Saved LMS Learning Content summary report execution failed with ${
                    summaryReportResponse.status
                }: ${await summaryReportResponse.text()}`
            )
        }

        const summaryReportPayload = await summaryReportResponse.json()
        expect(summaryReportPayload.definition?.codename).toBe(learningContentSummaryReport.codename)
        expect(Array.isArray(summaryReportPayload.rows)).toBe(true)
        expect(Number(summaryReportPayload.total)).toBeGreaterThanOrEqual(3)
        expect(summaryReportPayload.aggregations).toEqual({})
        for (const row of summaryReportPayload.rows as Array<Record<string, unknown>>) {
            expect(Object.keys(row).sort()).toEqual(['Instructor', 'project', 'status', 'title', 'type'])
            expect(typeof row.type).toBe('string')
            expect(typeof row.title).toBe('string')
            expect(typeof row.status === 'string' || row.status === null).toBe(true)
            expect(typeof row.Instructor === 'string' || row.Instructor === null).toBe(true)
            expect(typeof row.project === 'string' || row.project === null).toBe(true)
        }
        const summaryReportRowsText = JSON.stringify(summaryReportPayload.rows)
        expect(summaryReportRowsText).not.toContain('__runtime')
        expect(summaryReportRowsText).not.toContain('TargetObjectCodename')
        expect(summaryReportRowsText).not.toContain('TargetRecordId')
        expect(summaryReportRowsText).not.toMatch(UUID_SUBSTRING_PATTERN)

        for (const reportCodename of ['CourseBuilderOutline', 'TrackBuilderOutline']) {
            const builderReport = LMS_DEMO_REPORTS.find((report) => report.codename === reportCodename)
            if (!builderReport) {
                throw new Error(`LMS fixture contract is missing the ${reportCodename} report definition`)
            }

            const builderReportResponse = await sendWithCsrf(
                api,
                'POST',
                `/api/v1/applications/${applicationId}/runtime/reports/run?workspaceId=${encodeURIComponent(mainWorkspaceId)}`,
                {
                    reportCodename: builderReport.codename,
                    limit: 10,
                    offset: 0
                }
            )
            if (!builderReportResponse.ok) {
                throw new Error(
                    `Saved LMS ${reportCodename} report execution failed with ${
                        builderReportResponse.status
                    }: ${await builderReportResponse.text()}`
                )
            }

            const builderReportPayload = await builderReportResponse.json()
            expect(builderReportPayload.definition?.codename).toBe(reportCodename)
            expect(builderReportPayload.definition?.datasource?.kind).toBe('records.list')
            expect(Array.isArray(builderReportPayload.rows)).toBe(true)
        }

        expectNoBrowserRuntimeIssues(browserIssues, 'LMS snapshot runtime flow')
    })
})
