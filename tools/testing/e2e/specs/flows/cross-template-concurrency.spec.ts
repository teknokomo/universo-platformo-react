import { createLocalizedContent } from '@universo-react/utils'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { expect, test } from '../../fixtures/test'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoUnexpectedBrowserRuntimeIssues,
    expectStrictRuntimeUxSurface,
    waitForLayoutFrame,
    watchBrowserRuntimeIssues
} from '../../support/browser/runtimeUx'
import {
    createApplicationLayout,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    getApplicationLayout,
    listApplicationLayouts,
    listPublicationApplications,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'

type LayoutRecord = {
    id?: string
    version?: number
    name?: unknown
    templateKey?: string
    scopeEntityId?: string | null
    neutral?: {
        zoneSettings?: Record<string, Record<string, unknown>>
    }
}

const readLocalizedText = (value: unknown, locale = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const localized = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primary = typeof localized._primary === 'string' ? localized._primary : locale
    const primaryContent = localized.locales?.[primary]?.content
    if (typeof primaryContent === 'string') return primaryContent
    const localeContent = localized.locales?.[locale]?.content
    if (typeof localeContent === 'string') return localeContent
    const directContent = (value as Record<string, unknown>)[locale]
    return typeof directContent === 'string' ? directContent : ''
}

const waitForLinkedApplication = async (
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    publicationId: string
) => {
    let application: Record<string, unknown> | null = null
    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            application = (response?.items ?? [])[0] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)

    if (typeof application?.id !== 'string') throw new Error('The concurrency fixture did not expose a linked application')
    return application
}

const waitForApplicationSchema = async (api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string) => {
    await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')
}

const readResponsePayload = async (response: Response): Promise<Record<string, unknown>> => {
    const text = await response.text()
    if (!text) return {}
    try {
        const payload = JSON.parse(text)
        return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
    } catch {
        return { raw: text }
    }
}

const raceLayoutUpdate = async (
    apiA: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    apiB: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    layoutId: string,
    expectedVersion: number,
    names: [string, string]
) => {
    const url = `/api/v1/applications/${applicationId}/layouts/${layoutId}`
    const payloads = names.map((name) => ({
        name: { en: name, ru: name },
        description: { en: `Committed by ${name}`, ru: `Изменено: ${name}` },
        expectedVersion
    }))
    const responses = await Promise.all([sendWithCsrf(apiA, 'PATCH', url, payloads[0]), sendWithCsrf(apiB, 'PATCH', url, payloads[1])])
    const responsePayloads = await Promise.all(responses.map((response) => readResponsePayload(response)))
    return { responses, responsePayloads }
}

test('@flow @combined @cross-template @concurrency commits one winner for two concurrent layout writers', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)
    const primaryBrowserIssues = watchBrowserRuntimeIssues(page)

    const ownerApi = await createLoggedInApiContext(runManifest.testUser)
    let writerA: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let writerB: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let browserSessionA: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let browserSessionB: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const metahubName = `E2E ${runManifest.runId} concurrency metahub`
        const metahub = await createMetahub(ownerApi, {
            name: { en: metahubName, ru: `Метахаб конкурентности ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-concurrency`),
            templateCodename: 'marketing-page'
        })
        if (typeof metahub?.id !== 'string') throw new Error('Concurrency metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName })

        const publication = await createPublication(ownerApi, metahub.id, {
            name: { en: `E2E ${runManifest.runId} concurrency publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} concurrency application` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: { workspaceMode: 'required', requiredWorkspaceModeAcknowledged: true }
        })
        if (typeof publication?.id !== 'string') throw new Error('Concurrency publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(ownerApi, metahub.id, publication.id)
        await waitForPublicationReady(ownerApi, metahub.id, publication.id)

        const application = await waitForLinkedApplication(ownerApi, metahub.id, publication.id)
        const applicationId = application.id
        if (typeof applicationId !== 'string') throw new Error('Concurrency application did not return an id')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(ownerApi, applicationId, {
            schemaOptions: { workspaceModeRequested: 'enabled', acknowledgeIrreversibleWorkspaceEnablement: true }
        })
        await waitForApplicationSchema(ownerApi, applicationId)

        const created = await createApplicationLayout(ownerApi, applicationId, {
            templateKey: 'dashboard',
            scopeEntityId: null,
            name: { en: `Concurrency source ${runManifest.runId}`, ru: `Источник конкурентности ${runManifest.runId}` },
            description: { en: 'Concurrency source layout', ru: 'Исходный макет конкурентности' },
            isActive: true,
            isDefault: false,
            sortOrder: 40,
            config: {}
        })
        const layout = (created?.item ?? created) as LayoutRecord
        if (typeof layout.id !== 'string' || typeof layout.version !== 'number') {
            throw new Error('Concurrency layout creation did not return a versioned layout')
        }

        const expectedVersion = layout.version
        const names: [string, string] = [`Concurrency writer A ${runManifest.runId}`, `Concurrency writer B ${runManifest.runId}`]
        writerA = await createLoggedInApiContext(runManifest.testUser)
        writerB = await createLoggedInApiContext(runManifest.testUser)

        const race = await raceLayoutUpdate(writerA, writerB, applicationId, layout.id, expectedVersion, names)
        const statuses = race.responses.map((response) => response.status).sort((left, right) => left - right)
        expect(statuses).toEqual([200, 409])

        const winnerIndex = race.responses.findIndex((response) => response.status === 200)
        const conflictIndex = race.responses.findIndex((response) => response.status === 409)
        expect(winnerIndex).toBeGreaterThanOrEqual(0)
        expect(conflictIndex).toBeGreaterThanOrEqual(0)
        expect(race.responsePayloads[conflictIndex]?.error).toBe('APPLICATION_LAYOUT_VERSION_CONFLICT')
        expect((race.responsePayloads[winnerIndex]?.item as { version?: unknown } | undefined)?.version).toBe(expectedVersion + 1)

        const persisted = await getApplicationLayout(ownerApi, applicationId, layout.id)
        const persistedLayout = persisted?.item as LayoutRecord | undefined
        expect(persistedLayout?.version).toBe(expectedVersion + 1)
        expect(names).toContain(readLocalizedText(persistedLayout?.name))

        const applicationLayouts = await listApplicationLayouts(ownerApi, applicationId, { limit: 100, offset: 0 })
        const marketingLayoutSummary = (applicationLayouts?.items ?? []).find(
            (item: LayoutRecord) => item.templateKey === 'marketing-page' && item.scopeEntityId == null
        ) as LayoutRecord | undefined
        if (typeof marketingLayoutSummary?.id !== 'string') {
            throw new Error('Concurrency application did not expose its runtime marketing layout')
        }
        const zoneLayoutDetail = await getApplicationLayout(ownerApi, applicationId, marketingLayoutSummary.id)
        const zoneLayout = zoneLayoutDetail?.item as LayoutRecord | undefined
        if (typeof zoneLayout?.id !== 'string' || typeof zoneLayout.version !== 'number') {
            throw new Error('Concurrency runtime marketing layout did not return a versioned layout')
        }
        const zoneSettingPath = `/api/v1/applications/${applicationId}/layouts/${zoneLayout.id}/zone-settings/marketing-header/position`
        const zoneRaceResponses = await Promise.all([
            sendWithCsrf(writerA, 'PATCH', zoneSettingPath, { value: 'flow', expectedVersion: zoneLayout.version }),
            sendWithCsrf(writerB, 'PATCH', zoneSettingPath, { value: 'fixed', expectedVersion: zoneLayout.version })
        ])
        const zoneRacePayloads = await Promise.all(zoneRaceResponses.map((response) => readResponsePayload(response)))
        expect(zoneRaceResponses.map((response) => response.status).sort((left, right) => left - right)).toEqual([200, 409])
        const zoneConflictIndex = zoneRaceResponses.findIndex((response) => response.status === 409)
        expect(zoneRacePayloads[zoneConflictIndex]?.error).toBe('APPLICATION_LAYOUT_VERSION_CONFLICT')
        const persistedZoneLayout = await getApplicationLayout(ownerApi, applicationId, zoneLayout.id)
        expect(persistedZoneLayout?.item?.version).toBe(zoneLayout.version + 1)
        const browserInitialPosition = persistedZoneLayout?.item?.neutral?.zoneSettings?.['marketing-header']?.position
        expect(['flow', 'fixed']).toContain(browserInitialPosition)
        if (browserInitialPosition !== 'flow' && browserInitialPosition !== 'fixed') {
            throw new Error('Concurrent API zone-setting race did not persist a supported header position')
        }

        browserSessionA = await createLoggedInBrowserContext(browser, runManifest.testUser)
        browserSessionB = await createLoggedInBrowserContext(browser, runManifest.testUser)
        const browserIssuesA = watchBrowserRuntimeIssues(browserSessionA.page)
        const browserIssuesB = watchBrowserRuntimeIssues(browserSessionB.page)
        await applyBrowserPreferences(browserSessionA.page, { language: 'en', isDarkMode: false })
        await applyBrowserPreferences(browserSessionB.page, { language: 'ru', isDarkMode: false })
        const browserLayoutPath = `/a/${applicationId}/admin/layouts/${zoneLayout.id}`
        await Promise.all([
            browserSessionA.page.goto(`${browserLayoutPath}?locale=en`),
            browserSessionB.page.goto(`${browserLayoutPath}?locale=ru`)
        ])
        const settingsButtonA = browserSessionA.page.getByTestId('layout-zone-settings-marketing-header')
        const settingsButtonB = browserSessionB.page.getByTestId('layout-zone-settings-marketing-header')
        await expect(settingsButtonA).toBeVisible()
        await expect(settingsButtonB).toBeVisible()
        await settingsButtonA.click()
        await settingsButtonB.click()
        const dialogA = browserSessionA.page.getByRole('dialog')
        const dialogB = browserSessionB.page.getByRole('dialog')
        await expect(dialogA).toBeVisible()
        await expect(dialogB).toBeVisible()
        await expect(dialogA.getByText('Customized for this layout', { exact: true })).toBeVisible()
        await expect(dialogB.getByText('Настроено для этого макета', { exact: true })).toBeVisible()

        const englishLabels = { fixed: 'Fixed on screen', flow: 'Scrolls with page' } as const
        const russianLabels = { fixed: 'Закреплена на экране', flow: 'Прокручивается вместе со страницей' } as const
        await expect(dialogA.getByRole('radio', { name: englishLabels[browserInitialPosition], exact: true })).toBeChecked()
        await expect(dialogB.getByRole('radio', { name: russianLabels[browserInitialPosition], exact: true })).toBeChecked()
        const browserWinnerPosition = browserInitialPosition === 'fixed' ? 'flow' : 'fixed'

        await dialogA.getByRole('radio', { name: englishLabels[browserWinnerPosition], exact: true }).check()
        const browserSaveA = waitForSettledMutationResponse(
            browserSessionA.page,
            (response) =>
                response.request().method() === 'PATCH' &&
                new URL(response.url()).pathname ===
                    `/api/v1/applications/${applicationId}/layouts/${zoneLayout.id}/zone-settings/marketing-header/position`,
            { label: 'Browser context A zone-setting save' }
        )
        await expect(dialogA.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
        await dialogA.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await browserSaveA).status()).toBe(200)
        await expect(dialogA).toHaveCount(0)

        await dialogB.getByRole('radio', { name: russianLabels[browserWinnerPosition], exact: true }).check()
        const browserSaveB = waitForSettledMutationResponse(
            browserSessionB.page,
            (response) =>
                response.request().method() === 'PATCH' &&
                new URL(response.url()).pathname ===
                    `/api/v1/applications/${applicationId}/layouts/${zoneLayout.id}/zone-settings/marketing-header/position`,
            { label: 'Browser context B stale zone-setting save' }
        )
        await dialogB.getByRole('button', { name: 'Сохранить', exact: true }).click()
        expect((await browserSaveB).status()).toBe(409)
        await expect(
            dialogB.getByText('Макет изменился в другой сессии. Перезагрузите его и повторите попытку.', { exact: true })
        ).toBeVisible()
        await expect(dialogB.getByRole('radio', { name: russianLabels[browserInitialPosition], exact: true })).toBeChecked()
        await expectStrictRuntimeUxSurface(dialogB, {
            label: 'Localized browser concurrency conflict',
            locale: 'ru'
        })

        await browserSessionB.page.reload()
        await browserSessionB.page.getByTestId('layout-zone-settings-marketing-header').click()
        const recoveredDialogB = browserSessionB.page.getByRole('dialog')
        await expect(recoveredDialogB.getByText('Настроено для этого макета', { exact: true })).toBeVisible()
        await expect(recoveredDialogB.getByRole('radio', { name: russianLabels[browserWinnerPosition], exact: true })).toBeChecked()
        await recoveredDialogB.getByRole('button', { name: 'Отмена', exact: true }).click()

        const persistedBrowserWinner = await getApplicationLayout(ownerApi, applicationId, zoneLayout.id)
        expect(persistedBrowserWinner?.item?.neutral?.zoneSettings?.['marketing-header']?.position).toBe(browserWinnerPosition)

        await browserSessionB.page.goto(`/a/${applicationId}?locale=ru&themeVariant=light`)
        await expect(browserSessionB.page.locator('#marketing-page-main')).toBeVisible()
        const runtimeHeader = browserSessionB.page.getByTestId('marketing-header-shell')
        const runtimeInitialTop = await runtimeHeader.evaluate((element) => element.getBoundingClientRect().top)
        if (browserWinnerPosition === 'fixed') {
            await expect(runtimeHeader).toHaveClass(/MuiAppBar-positionFixed/)
            await expect(browserSessionB.page.getByTestId('marketing-header-spacer')).toHaveCount(0)
        } else {
            await expect(runtimeHeader).toHaveClass(/MuiAppBar-positionStatic/)
            await expect(browserSessionB.page.getByTestId('marketing-header-spacer')).toHaveCount(0)
        }
        await browserSessionB.page.evaluate(() => window.scrollTo({ top: 480, behavior: 'instant' }))
        await browserSessionB.page.waitForFunction(() => window.scrollY > 0)
        const runtimeScrolledTop = await runtimeHeader.evaluate((element) => element.getBoundingClientRect().top)
        if (browserWinnerPosition === 'fixed') {
            expect(Math.abs(runtimeScrolledTop - runtimeInitialTop)).toBeLessThanOrEqual(1)
        } else {
            expect(runtimeScrolledTop).toBeLessThan(runtimeInitialTop - 100)
        }
        await expectStrictRuntimeUxSurface(browserSessionB.page.locator('body'), {
            label: 'Concurrent runtime winner',
            locale: 'ru'
        })
        await expectNoPageHorizontalOverflow(browserSessionB.page, 'Browser concurrency runtime winner')
        await waitForLayoutFrame(browserSessionB.page)
        await browserSessionB.page.screenshot({
            path: testInfo.outputPath('cross-template-concurrency-runtime-winner-ru.png'),
            fullPage: true
        })

        expectNoUnexpectedBrowserRuntimeIssues(browserIssuesA, 'Browser concurrency writer A')
        expectNoUnexpectedBrowserRuntimeIssues(browserIssuesB, 'Browser concurrency writer B', {
            allowTextPatterns: [/409|Conflict/i]
        })

        await testInfo.attach('concurrency-race.json', {
            body: Buffer.from(
                JSON.stringify(
                    {
                        applicationId,
                        layoutId: layout.id,
                        expectedVersion,
                        statuses: race.responses.map((response) => response.status),
                        winner: names[winnerIndex],
                        conflict: race.responsePayloads[conflictIndex]?.error,
                        persistedVersion: persistedLayout?.version,
                        persistedName: readLocalizedText(persistedLayout?.name)
                    },
                    null,
                    2
                )
            ),
            contentType: 'application/json'
        })

        await page.goto(`/a/${applicationId}/admin/layouts`)
        await expect(page.getByRole('heading', { name: 'Layouts', exact: true })).toBeVisible()
        const winnerCard = page.getByRole('button', { name: /Actions for Concurrency writer [AB]/ })
        await expect(winnerCard).toHaveCount(1)
        const listSurface = page.getByTestId('application-layouts-list-content')
        await expect(listSurface).toBeVisible()
        await expectNoTechnicalLeakage(listSurface, { label: 'Concurrent layout authoring result', checkUuidSubstrings: true })
        await expectNoPageHorizontalOverflow(page, 'Concurrent layout authoring result')
        await waitForLayoutFrame(page)
        await page.screenshot({ path: testInfo.outputPath('cross-template-concurrency-committed-layout.png'), fullPage: true })
        expectNoUnexpectedBrowserRuntimeIssues(primaryBrowserIssues, 'Primary concurrency browser page')
    } finally {
        await browserSessionA?.context.close()
        await browserSessionB?.context.close()
        await disposeApiContext(writerA)
        await disposeApiContext(writerB)
        await disposeApiContext(ownerApi)
    }
})
