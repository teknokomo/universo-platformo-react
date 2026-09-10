import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, waitForLayoutFrame } from '../../support/browser/runtimeUx'
import {
    createApplicationLayout,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    getApplicationLayout,
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
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)

    const ownerApi = await createLoggedInApiContext(runManifest.testUser)
    let writerA: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let writerB: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null

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
        await recordCreatedApplication({ id: applicationId, slug: typeof application.slug === 'string' ? application.slug : undefined })
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
    } finally {
        await disposeApiContext(writerA)
        await disposeApiContext(writerB)
        await disposeApiContext(ownerApi)
    }
})
