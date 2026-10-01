import fs from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Knex } from 'knex'
import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { marketingPageTemplate } from '../../../../../packages/universo-react-metahubs-backend/dist/domains/templates/data/marketing-page.template.js'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getApplicationEffectiveLayout,
    getApplicationLayout,
    getLayout,
    getMarketingPageRuntime,
    listApplicationLayouts,
    listLayouts,
    createPublicationVersion,
    resetApplicationLayoutZoneSetting,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    updateApplicationLayout,
    updateApplicationLayoutZoneSetting,
    updateLayoutZoneSetting,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { assertMarketingPageRuntimeMaterialization } from '../../support/marketingPageRuntimeMaterialization.ts'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'
import { toolbarSelectors } from '../../support/selectors/contracts'
import { loadLocalSupabaseDatabaseUrl } from '../../../backend/localSupabaseEnv.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const readLocalizedText = (value: unknown, locale?: string): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

    const localized = value as {
        locales?: Record<string, { content?: unknown }>
        _primary?: unknown
        [locale: string]: unknown
    }
    if (locale) {
        const content = localized.locales?.[locale]?.content
        if (typeof content === 'string' && content.length > 0) return content
        const flatLocale = localized[locale]
        return typeof flatLocale === 'string' ? flatLocale : ''
    }
    const primaryLocale = typeof localized._primary === 'string' ? localized._primary : 'en'
    const primary = localized.locales?.[primaryLocale]?.content
    if (typeof primary === 'string' && primary.length > 0) return primary

    const english = localized.locales?.en?.content
    if (typeof english === 'string' && english.length > 0) return english

    const flatPrimary = localized[primaryLocale]
    if (typeof flatPrimary === 'string' && flatPrimary.length > 0) return flatPrimary
    return typeof localized.en === 'string' ? localized.en : ''
}

const readCookieHeader = (api: ApiContext): string =>
    Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')

async function readApiResponsePayload(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text()
    if (!text) return {}
    try {
        const payload: unknown = JSON.parse(text)
        return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
    } catch {
        return { raw: text }
    }
}

async function withHeldApplicationLayoutMutationLock<T>(
    knex: Knex,
    schemaName: string,
    startRequests: () => Promise<T>,
    assertWhileHeld: () => Promise<void>
): Promise<T> {
    const transaction = await knex.transaction()
    let requests: Promise<T> | undefined
    try {
        const backendPidResult = await transaction.raw('SELECT pg_backend_pid() AS pid')
        const backendPid = Number(backendPidResult.rows?.[0]?.pid)
        if (!Number.isInteger(backendPid) || backendPid <= 0) throw new Error('The PostgreSQL lock barrier did not return its backend pid')

        await transaction.raw('SELECT pg_advisory_xact_lock(hashtextextended(?::text, 0))', [`${schemaName}:application-layout-mutations`])
        requests = startRequests()
        await expect
            .poll(
                async () => {
                    const result = await knex.raw(
                        `
                        SELECT COUNT(*)::int AS count
                        FROM pg_stat_activity
                        WHERE pid <> ?
                          AND wait_event_type = 'Lock'
                          AND ? = ANY(pg_blocking_pids(pid))
                          AND POSITION('pg_advisory_xact_lock(hashtextextended' IN query) > 0
                        `,
                        [backendPid, backendPid]
                    )
                    return Number(result.rows?.[0]?.count ?? 0)
                },
                { timeout: 30_000, message: 'Waiting for a concurrent layout operation to queue on the held mutation-family lock' }
            )
            .toBeGreaterThan(0)

        await assertWhileHeld()
        await transaction.commit()
        return await requests
    } finally {
        if (!transaction.isCompleted()) await transaction.rollback()
        if (requests) await Promise.allSettled([requests])
    }
}

async function getMetahubExport(api: ApiContext, metahubId: string): Promise<Record<string, unknown>> {
    const response = await fetch(new URL(`/api/v1/metahub/${metahubId}/export`, api.baseURL as string), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Cookie: readCookieHeader(api)
        }
    })

    expect(response.ok, `Exporting metahub ${metahubId} returned HTTP ${response.status}`).toBe(true)
    return (await response.json()) as Record<string, unknown>
}

function readSnapshot(envelope: Record<string, unknown>): Record<string, unknown> {
    const snapshot = envelope.snapshot
    expect(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)).toBe(true)
    return snapshot as Record<string, unknown>
}

function readSnapshotEntityCodenames(snapshot: Record<string, unknown>): string[] {
    const entities = snapshot.entities
    if (!entities || typeof entities !== 'object' || Array.isArray(entities)) return []

    return Object.values(entities as Record<string, { codename?: unknown }>)
        .map((entity) => readLocalizedText(entity.codename))
        .filter(Boolean)
        .sort()
}

function readPricingBenefitTierRelations(snapshot: Record<string, unknown>): Array<{ benefitKey: string; tierKey: string }> {
    const entities = snapshot.entities
    const elements = snapshot.elements
    expect(entities && typeof entities === 'object' && !Array.isArray(entities)).toBe(true)
    expect(elements && typeof elements === 'object' && !Array.isArray(elements)).toBe(true)

    const entityEntries = Object.entries(entities as Record<string, Record<string, unknown>>)
    const pricingEntity = entityEntries.find(([, entity]) => readLocalizedText(entity.codename) === 'MarketingPagePricing')
    const benefitsEntity = entityEntries.find(([, entity]) => readLocalizedText(entity.codename) === 'MarketingPagePricingBenefit')
    expect(pricingEntity).toBeDefined()
    expect(benefitsEntity).toBeDefined()

    const rowsByEntity = elements as Record<string, unknown>
    const pricingRows = rowsByEntity[pricingEntity![0]]
    const benefitsRows = rowsByEntity[benefitsEntity![0]]
    expect(Array.isArray(pricingRows)).toBe(true)
    expect(Array.isArray(benefitsRows)).toBe(true)

    const tierKeysById = new Map<string, string>()
    for (const row of pricingRows as Array<Record<string, unknown>>) {
        const data = row.data as Record<string, unknown> | undefined
        expect(isUuidV7(row.id)).toBe(true)
        expect(typeof data?.TierKey).toBe('string')
        tierKeysById.set(row.id as string, data!.TierKey as string)
    }

    return (benefitsRows as Array<Record<string, unknown>>)
        .map((row) => {
            const data = row.data as Record<string, unknown> | undefined
            expect(isUuidV7(row.id)).toBe(true)
            expect(isUuidV7(data?.TierRef)).toBe(true)
            const tierKey = tierKeysById.get(data?.TierRef as string)
            expect(tierKey).toBeDefined()
            return { benefitKey: String(data?.BenefitKey ?? ''), tierKey: tierKey! }
        })
        .sort((left, right) => left.benefitKey.localeCompare(right.benefitKey))
}

function readMarketingHeroCopy(snapshot: Record<string, unknown>) {
    const entities = snapshot.entities
    if (!entities || typeof entities !== 'object' || Array.isArray(entities)) {
        throw new Error('Marketing snapshot does not contain its Entity definitions')
    }

    const heroEntity = Object.entries(entities as Record<string, { codename?: unknown }>).find(
        ([, entity]) => readLocalizedText(entity.codename, 'en') === 'MarketingPageHero'
    )
    if (!heroEntity) throw new Error('Marketing snapshot does not contain the MarketingPageHero Entity')

    const elements = snapshot.elements
    const heroRecords =
        elements && typeof elements === 'object' && !Array.isArray(elements)
            ? (elements as Record<string, unknown>)[heroEntity[0]]
            : undefined
    if (!Array.isArray(heroRecords)) throw new Error('Marketing snapshot does not contain MarketingPageHero records')

    const defaultHero = heroRecords.find((record) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return false
        const data = (record as { data?: unknown }).data
        return Boolean(data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string, unknown>).HeroKey === 'default')
    }) as { data?: Record<string, unknown> } | undefined
    if (!defaultHero?.data) throw new Error('Marketing snapshot does not contain the default Hero Entity record')

    return {
        titleEn: readLocalizedText(defaultHero.data.Title, 'en'),
        titleRu: readLocalizedText(defaultHero.data.Title, 'ru'),
        accentEn: readLocalizedText(defaultHero.data.Accent, 'en'),
        accentRu: readLocalizedText(defaultHero.data.Accent, 'ru')
    }
}

function assertMarketingSnapshotRoundtrip(source: Record<string, unknown>, imported: Record<string, unknown>) {
    const sourceSnapshot = readSnapshot(source)
    const importedSnapshot = readSnapshot(imported)

    expect(imported.kind).toBe('metahub_snapshot_bundle')
    expect(imported.bundleVersion).toBe(1)
    expect(imported.snapshotHash).toEqual(expect.any(String))
    expect(importedSnapshot.version).toBe(sourceSnapshot.version)
    expect(importedSnapshot.versionEnvelope).toEqual(sourceSnapshot.versionEnvelope)
    expect(readSnapshotEntityCodenames(importedSnapshot)).toEqual(readSnapshotEntityCodenames(sourceSnapshot))
    const sourceTierRelations = readPricingBenefitTierRelations(sourceSnapshot)
    expect(sourceTierRelations).toHaveLength(14)
    expect(readPricingBenefitTierRelations(importedSnapshot)).toEqual(sourceTierRelations)

    const sourceHeroCopy = readMarketingHeroCopy(sourceSnapshot)
    expect(readMarketingHeroCopy(importedSnapshot)).toEqual(sourceHeroCopy)
    expect(sourceHeroCopy).toEqual({
        titleEn: 'Our latest',
        titleRu: 'Наши новые',
        accentEn: 'products',
        accentRu: 'продукты'
    })

    const importedSerialized = JSON.stringify(importedSnapshot)
    for (const expectedCopy of ['Trusted by the best companies', 'Frequently asked questions', 'Material UI']) {
        expect(importedSerialized, `Imported marketing snapshot is missing ${expectedCopy}`).toContain(expectedCopy)
    }
}

async function importSnapshotThroughUi(page: import('@playwright/test').Page, filePath: string) {
    await page.goto('/metahubs')

    const primaryAction = page.getByTestId(toolbarSelectors.primaryAction)
    await expect(primaryAction).toBeVisible({ timeout: 30_000 })
    await page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`).click()

    const importOption = page.getByRole('menuitem', { name: /import|импорт/i })
    await expect(importOption).toBeVisible({ timeout: 30_000 })
    await importOption.click()

    const dialog = page.getByRole('dialog', { name: /import|импорт/i })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog.locator('input[type="file"]').setInputFiles(filePath)
    await expect(dialog.getByText(path.basename(filePath), { exact: true })).toBeVisible()

    const responsePromise = page.waitForResponse(
        (response) => response.request().method() === 'POST' && /\/api\/v1\/metahubs\/import(?:\?|$)/.test(response.url()),
        { timeout: 420_000 }
    )
    await dialog
        .getByRole('button', { name: /import|импорт/i })
        .last()
        .click()
    const response = await responsePromise
    expect(response.status(), `Snapshot import returned HTTP ${response.status()}`).toBe(201)

    const body = (await response.json()) as {
        metahub?: { id?: unknown; name?: unknown }
        publication?: { id?: unknown; activeVersionId?: unknown }
    }
    const metahubId = body.metahub?.id
    const publicationId = body.publication?.id
    expect(typeof metahubId).toBe('string')
    expect(typeof publicationId).toBe('string')
    await expect(dialog).toHaveCount(0)
    await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000, message: 'Waiting for imported metahub navigation' })
        .toMatch(/^\/metahub\/[0-9a-f-]+$/i)

    return {
        metahubId: metahubId as string,
        publicationId: publicationId as string,
        metahubName: readLocalizedText(body.metahub?.name)
    }
}

test('@flow @marketing-page @snapshot verifies marketing-page export/import roundtrip and runtime materialization', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let raceDatabase: Knex | undefined
    let raceWriterA: ApiContext | undefined
    let raceWriterB: ApiContext | undefined

    try {
        const sourceName = `E2E ${runManifest.runId} marketing snapshot source`
        const retrySuffix = testInfo.retry === 0 ? '' : `-r${testInfo.retry}`
        const sourceCodename = `${runManifest.runId}-marketing-snapshot-source${retrySuffix}`
        const source = await createMetahub(api, {
            name: { en: sourceName, ru: `Источник маркетингового snapshot ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', sourceCodename),
            templateCodename: 'marketing-page'
        })
        expect(typeof source?.id).toBe('string')
        await recordCreatedMetahub({ id: source.id, name: sourceName, codename: sourceCodename })

        const sourceLayouts = await listLayouts(api, source.id, { limit: 100, offset: 0 })
        const sourceMarketingLayout = sourceLayouts.items?.find((layout) => layout.templateKey === 'marketing-page')
        if (!sourceMarketingLayout?.id || typeof sourceMarketingLayout.version !== 'number') {
            throw new Error('The snapshot source did not expose a versioned marketing layout')
        }
        const sourceMarketingDetail = await getLayout(api, source.id, sourceMarketingLayout.id)
        const sourceRendererConfig = { ...(sourceMarketingDetail.config ?? {}) }
        const flowSourceLayout = await updateLayoutZoneSetting(
            api,
            source.id,
            sourceMarketingLayout.id,
            'marketing-header',
            'position',
            'flow',
            sourceMarketingDetail.version
        )
        expect(flowSourceLayout.config).toEqual(sourceRendererConfig)
        expect(flowSourceLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const sourceEnvelope = await getMetahubExport(api, source.id)
        const sourcePath = testInfo.outputPath('marketing-page-source-export.json')
        await fs.writeFile(sourcePath, JSON.stringify(sourceEnvelope, null, 2), 'utf8')

        const imported = await importSnapshotThroughUi(page, sourcePath)
        await recordCreatedMetahub({ id: imported.metahubId, name: imported.metahubName || sourceName })
        await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId })
        expect(imported.metahubName).toBe(sourceName)

        const importedEnvelope = await getMetahubExport(api, imported.metahubId)
        assertMarketingSnapshotRoundtrip(sourceEnvelope, importedEnvelope)
        const importedLayouts = await listLayouts(api, imported.metahubId, { limit: 100, offset: 0 })
        const importedMarketingLayout = importedLayouts.items?.find((layout) => layout.templateKey === 'marketing-page')
        if (!importedMarketingLayout?.id) throw new Error('The imported snapshot did not expose a marketing layout')
        const importedMarketingDetail = await getLayout(api, imported.metahubId, importedMarketingLayout.id)
        expect(importedMarketingDetail.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: `E2E ${runManifest.runId} imported marketing application` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: false
        })
        const importedApplicationId = linkedApplication?.application?.id
        expect(typeof importedApplicationId).toBe('string')
        await recordCreatedApplication({ id: importedApplicationId })

        await syncApplicationSchema(api, importedApplicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect.poll(async () => (await getApplication(api, importedApplicationId))?.schemaStatus).toBe('synced')

        const applicationLayouts = await listApplicationLayouts(api, importedApplicationId, { limit: 100, offset: 0 })
        const applicationMarketingLayout = applicationLayouts.items?.find((layout) => layout.templateKey === 'marketing-page')
        if (!applicationMarketingLayout?.id) throw new Error('The imported application did not expose a marketing layout')
        const applicationMarketingDetail = await getApplicationLayout(api, importedApplicationId, applicationMarketingLayout.id)
        expect(applicationMarketingDetail.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'flow' })
        const effectiveApplicationLayout = await getApplicationEffectiveLayout(api, importedApplicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        expect(effectiveApplicationLayout.layout.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const sourcePublication = await createPublication(api, source.id, {
            name: { en: `E2E ${runManifest.runId} source marketing publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        expect(typeof sourcePublication?.id).toBe('string')
        await recordCreatedPublication({ id: sourcePublication.id, metahubId: source.id, schemaName: sourcePublication.schemaName })
        await createPublicationVersion(api, source.id, sourcePublication.id, {
            name: { en: `E2E ${runManifest.runId} source marketing v1` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, source.id, sourcePublication.id)
        await waitForPublicationReady(api, source.id, sourcePublication.id)

        const sourceLinkedApplication = await createPublicationLinkedApplication(api, source.id, sourcePublication.id, {
            name: { en: `E2E ${runManifest.runId} source marketing application` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: false
        })
        const applicationId = sourceLinkedApplication?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')

        const sourceApplicationLayouts = await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })
        const sourceApplicationMarketingLayout = sourceApplicationLayouts.items?.find((layout) => layout.templateKey === 'marketing-page')
        if (!sourceApplicationMarketingLayout?.id) throw new Error('The source application did not expose a marketing layout')
        const sourceApplicationMarketingDetail = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
        expect(sourceApplicationMarketingDetail.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const localFlowOverride = await updateApplicationLayoutZoneSetting(
            api,
            applicationId,
            sourceApplicationMarketingLayout.id,
            'marketing-header',
            'position',
            'flow',
            sourceApplicationMarketingDetail.item.version
        )
        expect(localFlowOverride.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })
        expect(localFlowOverride.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

        const localLayoutName = `E2E ${runManifest.runId} locally customized marketing layout`
        const localLayoutCustomizationResponse = await updateApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id, {
            name: { en: localLayoutName },
            expectedVersion: localFlowOverride.version
        })
        const localLayoutCustomization = localLayoutCustomizationResponse?.item ?? localLayoutCustomizationResponse
        expect(readLocalizedText(localLayoutCustomization?.name)).toBe(localLayoutName)

        const currentSourceDetail = await getLayout(api, source.id, sourceMarketingLayout.id)
        const fixedSourceLayout = await updateLayoutZoneSetting(
            api,
            source.id,
            sourceMarketingLayout.id,
            'marketing-header',
            'position',
            'fixed',
            currentSourceDetail.version
        )
        expect(fixedSourceLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })

        await createPublicationVersion(api, source.id, sourcePublication.id, {
            name: { en: `E2E ${runManifest.runId} imported marketing snapshot v2` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, source.id, sourcePublication.id)
        await waitForPublicationReady(api, source.id, sourcePublication.id)

        const applicationDetails = await getApplication(api, applicationId)
        const applicationSchemaName = applicationDetails?.schemaName
        if (typeof applicationSchemaName !== 'string' || !applicationSchemaName) {
            throw new Error('The application did not expose its schema name for the real-PostgreSQL race barrier')
        }
        const knexModule = await import('knex')
        raceDatabase = knexModule.default({
            client: 'pg',
            connection: loadLocalSupabaseDatabaseUrl().databaseUrl,
            pool: { min: 0, max: 3 }
        })
        raceWriterA = await createLoggedInApiContext(runManifest.testUser)
        raceWriterB = await createLoggedInApiContext(runManifest.testUser)
        if (!raceWriterA || !raceWriterB) throw new Error('The application race writers could not be initialized')
        const syncWriter = raceWriterA
        const updateWriter = raceWriterB

        const applicationBeforeSourceSync = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
        const competingSyncVersion = applicationBeforeSourceSync.item?.version
        if (typeof competingSyncVersion !== 'number') {
            throw new Error('The application layout did not expose a version before the publication sync race')
        }
        const competingZoneSettingPath = `/api/v1/applications/${applicationId}/layouts/${sourceApplicationMarketingLayout.id}/zone-settings/marketing-header/position`
        const [sourceSync, sourceSyncUpdateResponse] = await withHeldApplicationLayoutMutationLock(
            raceDatabase,
            applicationSchemaName,
            () =>
                Promise.all([
                    syncApplicationSchema(syncWriter, applicationId, {
                        layoutResolutionPolicy: { default: 'keep_local' }
                    }),
                    sendWithCsrf(updateWriter, 'PATCH', competingZoneSettingPath, { value: 'fixed', expectedVersion: competingSyncVersion })
                ]),
            async () => {
                const applicationLayoutWhileLocked = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
                expect(applicationLayoutWhileLocked.item.version).toBe(competingSyncVersion)
                expect(applicationLayoutWhileLocked.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual(
                    applicationBeforeSourceSync.item.neutral?.sourceZoneSettings?.['marketing-header']
                )
            }
        )
        expect(sourceSync).toBeDefined()
        expect([200, 409]).toContain(sourceSyncUpdateResponse.status)
        const sourceSyncUpdatePayload = await readApiResponsePayload(sourceSyncUpdateResponse)
        if (sourceSyncUpdateResponse.status === 409) {
            expect(sourceSyncUpdatePayload.error).toBe('APPLICATION_LAYOUT_VERSION_CONFLICT')
        }

        const keptLocalLayout = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
        expect(readLocalizedText(keptLocalLayout.item.name)).toBe(localLayoutName)
        expect(keptLocalLayout.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })
        const keptLocalEffectiveLayout = await getApplicationEffectiveLayout(api, applicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        const expectedAfterSyncPosition = sourceSyncUpdateResponse.status === 200 ? 'fixed' : 'flow'
        expect(keptLocalEffectiveLayout.layout.zoneSettings?.['marketing-header']).toEqual({ position: expectedAfterSyncPosition })

        const resetRaceVersion = keptLocalLayout.item.version
        const [resetRaceResponse, updateRaceResponse] = await withHeldApplicationLayoutMutationLock(
            raceDatabase,
            applicationSchemaName,
            () =>
                Promise.all([
                    sendWithCsrf(syncWriter, 'POST', `${competingZoneSettingPath}/reset`, { expectedVersion: resetRaceVersion }),
                    sendWithCsrf(updateWriter, 'PATCH', competingZoneSettingPath, {
                        value: 'flow',
                        expectedVersion: resetRaceVersion
                    })
                ]),
            async () => {
                const applicationLayoutWhileLocked = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
                expect(applicationLayoutWhileLocked.item.version).toBe(resetRaceVersion)
                expect(applicationLayoutWhileLocked.item.neutral?.zoneSettings?.['marketing-header']).toEqual(
                    keptLocalLayout.item.neutral?.zoneSettings?.['marketing-header']
                )
                expect(applicationLayoutWhileLocked.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual(
                    keptLocalLayout.item.neutral?.sourceZoneSettings?.['marketing-header']
                )
            }
        )
        expect([resetRaceResponse.status, updateRaceResponse.status].sort((left, right) => left - right)).toEqual([200, 409])
        const [resetRacePayload, updateRacePayload] = await Promise.all([
            readApiResponsePayload(resetRaceResponse),
            readApiResponsePayload(updateRaceResponse)
        ])
        const conflictPayload = resetRaceResponse.status === 409 ? resetRacePayload : updateRacePayload
        expect(conflictPayload.error).toBe('APPLICATION_LAYOUT_VERSION_CONFLICT')

        const layoutAfterResetRace = await getApplicationLayout(api, applicationId, sourceApplicationMarketingLayout.id)
        expect(layoutAfterResetRace.item.version).toBe(resetRaceVersion + 1)
        expect(layoutAfterResetRace.item.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })
        const resetRaceEffectiveLayout = await getApplicationEffectiveLayout(api, applicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        const expectedAfterResetRace = resetRaceResponse.status === 200 ? 'fixed' : 'flow'
        expect(resetRaceEffectiveLayout.layout.zoneSettings?.['marketing-header']).toEqual({ position: expectedAfterResetRace })

        const resetLocalLayout = await resetApplicationLayoutZoneSetting(
            api,
            applicationId,
            sourceApplicationMarketingLayout.id,
            'marketing-header',
            'position',
            layoutAfterResetRace.item.version
        )
        expect(resetLocalLayout.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()
        expect(resetLocalLayout.neutral?.sourceZoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })
        const resetLocalEffectiveLayout = await getApplicationEffectiveLayout(api, applicationId, {
            locale: 'en',
            themeVariant: 'light'
        })
        expect(resetLocalEffectiveLayout.layout.zoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })

        const runtimePayload = await getMarketingPageRuntime(api, applicationId, 'en')
        assertMarketingPageRuntimeMaterialization(runtimePayload, marketingPageTemplate)

        const localMedia = await installMarketingPageLocalMedia(page)
        await page.goto(`/a/${applicationId}`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Our latest products' })).toBeVisible()
        await expect(page.getByTestId('marketing-header-shell')).toHaveClass(/MuiAppBar-positionFixed/)
        await expect(page.getByTestId('marketing-header-spacer')).toHaveCount(0)
        const fixedInitialTop = await page.getByTestId('marketing-header-shell').evaluate((element) => element.getBoundingClientRect().top)
        await page.evaluate(() => window.scrollTo({ top: 640, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY > 0)
        const fixedScrolledTop = await page.getByTestId('marketing-header-shell').evaluate((element) => element.getBoundingClientRect().top)
        expect(Math.abs(fixedScrolledTop - fixedInitialTop)).toBeLessThan(1)
        await page.screenshot({
            path: testInfo.outputPath('marketing-page-snapshot-fixed-runtime.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.waitForFunction(() => window.scrollY === 0)
        await expect(page.getByTestId('marketing-pricing-card')).toHaveCount(3)
        await expect(page.locator('#faq .MuiAccordion-root')).toHaveCount(4)
        await expect(page.locator('#footer img')).toHaveCount(1)
        await localMedia.assertLoaded(page)

        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])
    } finally {
        try {
            await raceDatabase?.destroy()
        } finally {
            await Promise.all([disposeApiContext(raceWriterA), disposeApiContext(raceWriterB), disposeApiContext(api)])
        }
    }
})
