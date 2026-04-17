import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'
import { createLocalizedContent } from '@universo/utils'
import {
    SELF_HOSTED_APP_CANONICAL_METAHUB,
    SELF_HOSTED_APP_FIXTURE_FILENAME,
    SELF_HOSTED_APP_SHARED_ENTITIES,
    SELF_HOSTED_APP_SETTINGS_LAYOUT,
    assertSelfHostedAppEnvelopeContract,
    findSelfHostedAppSection
} from '../../support/selfHostedAppFixtureContract.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

type SnapshotFixture = {
    metahub?: {
        name?: unknown
    }
    snapshot?: {
        entities?: Record<string, { kind?: string; codename?: unknown; presentation?: { name?: unknown } }>
    }
}

async function apiGet(api: ApiContext, path: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(path, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

async function readBrowserResponseJsonSafe(response: { text(): Promise<string> }): Promise<Record<string, unknown> | null> {
    const text = await response.text()
    if (!text) {
        return null
    }

    try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
        return null
    }
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

function matchesSectionDefinition(
    entity: { name?: unknown; codename?: unknown; presentation?: { name?: unknown } } | undefined,
    section?: { name?: { en?: string } } | null
) {
    const expectedText = section?.name?.en
    if (!expectedText) {
        return false
    }

    return (
        readLocalizedText(entity?.name) === expectedText ||
        readLocalizedText(entity?.presentation?.name) === expectedText ||
        readLocalizedText(entity?.codename) === expectedText
    )
}

async function loadSelfHostedAppFixture(): Promise<{
    fixturePath: string
    metahubName: string
    expectedCounts: { hubs: number; catalogs: number; sets: number; enumerations: number }
    expectedCatalogNames: string[]
    sharedAttributeName: string
    sharedConstantName: string
    sharedEnumerationValueName: string
}> {
    const fixturePath = path.join(process.cwd(), 'tools', 'fixtures', SELF_HOSTED_APP_FIXTURE_FILENAME)
    const rawFixture = await fs.readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(rawFixture) as SnapshotFixture
    assertSelfHostedAppEnvelopeContract(fixture)
    const entities = Object.values(fixture.snapshot?.entities ?? {})

    const metahubName = readLocalizedText(fixture.metahub?.name)
    if (!metahubName) {
        throw new Error('Self-hosted app snapshot fixture does not contain a metahub name')
    }
    if (metahubName !== SELF_HOSTED_APP_CANONICAL_METAHUB.name.en) {
        throw new Error(`Unexpected self-hosted app fixture name: ${metahubName}`)
    }

    const expectedCatalogNames = entities
        .filter((entity) => entity.kind === 'catalog')
        .map((entity) => readLocalizedText(entity.presentation?.name))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .slice(0, 3)

    return {
        fixturePath,
        metahubName,
        expectedCounts: {
            hubs: entities.filter((entity) => entity.kind === 'hub').length,
            catalogs: entities.filter((entity) => entity.kind === 'catalog').length,
            sets: entities.filter((entity) => entity.kind === 'set').length,
            enumerations: entities.filter((entity) => entity.kind === 'enumeration').length
        },
        expectedCatalogNames,
        sharedAttributeName: SELF_HOSTED_APP_SHARED_ENTITIES.attribute.name.en,
        sharedConstantName: SELF_HOSTED_APP_SHARED_ENTITIES.constant.name.en,
        sharedEnumerationValueName: SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.name.en
    }
}

async function waitForSelfHostedAppExportContract(api: ApiContext, metahubId: string) {
    await expect
        .poll(
            async () => {
                const exportResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/export`)
                if (!exportResponse.ok) {
                    return `export status ${exportResponse.status}`
                }

                try {
                    const envelope = (await exportResponse.json()) as Record<string, unknown>
                    assertSelfHostedAppEnvelopeContract(envelope)
                    return 'ok'
                } catch (error) {
                    return error instanceof Error ? error.message : String(error)
                }
            },
            {
                message: 'Waiting for imported self-hosted app export metadata to satisfy the canonical fixture contract',
                timeout: 60_000,
                intervals: [1_000, 2_000, 5_000]
            }
        )
        .toBe('ok')
}

test.describe('Snapshot Export/Import Flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) await disposeApiContext(api)
    })

    test('@flow metahub list shows import option in toolbar dropdown', async ({ page }) => {
        await page.goto('/metahubs')

        const primaryActionBtn = page.getByTestId(toolbarSelectors.primaryAction)
        await expect(primaryActionBtn).toBeVisible({ timeout: 15_000 })

        const dropdownArrow = page.getByTestId(`${toolbarSelectors.primaryAction}-menu-trigger`)
        if (await dropdownArrow.isVisible().catch(() => false)) {
            await dropdownArrow.click()
            const importOption = page.getByRole('menuitem', { name: /import/i })
            await expect(importOption).toBeVisible()
            await page.keyboard.press('Escape')
        }
    })

    test('@flow snapshot export returns valid envelope and reimport succeeds', async ({ runManifest }) => {
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password,
        })
        const created = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} snapshot-export` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `e2e-${runManifest.runId}-snapshot-export`),
            description: 'Test metahub for snapshot export',
            descriptionPrimaryLocale: 'en'
        })
        const metahubId = created?.data?.id ?? created?.id
        expect(metahubId).toBeTruthy()
        await recordCreatedMetahub({ id: metahubId, name: `E2E ${runManifest.runId} snapshot-export`, codename: `e2e-${runManifest.runId}-snapshot-export` })

        const exportResp = await apiGet(api, `/api/v1/metahub/${metahubId}/export`)
        expect(exportResp.ok).toBe(true)
        const envelope = await exportResp.json() as Record<string, unknown>
        expect(envelope.kind).toBe('metahub_snapshot_bundle')
        expect(envelope.bundleVersion).toBe(1)
        expect(envelope.snapshot).toBeTruthy()
        expect(typeof envelope.snapshotHash).toBe('string')
        expect((envelope.snapshotHash as string).length).toBeGreaterThan(0)

        const importResp = await sendWithCsrf(api, 'POST', '/api/v1/metahubs/import', envelope)
        expect(importResp.status).toBeLessThan(300)

        const importBody = await importResp.json()
        const importedId = importBody?.metahub?.id ?? importBody?.data?.id ?? importBody?.id
        if (importedId) {
            await recordCreatedMetahub({ id: importedId, name: 'reimported-snapshot' })
        }
    })

    test('@flow rejects tampered snapshot on import', async ({ runManifest }) => {
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password,
        })
        const created = await createMetahub(api, {
            name: { en: `E2E ${runManifest.runId} tampered-test` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `e2e-${runManifest.runId}-tampered-test`),
        })
        const metahubId = created?.data?.id ?? created?.id
        expect(metahubId).toBeTruthy()
        await recordCreatedMetahub({ id: metahubId, name: `E2E ${runManifest.runId} tampered-test`, codename: `e2e-${runManifest.runId}-tampered-test` })

        const exportResp = await apiGet(api, `/api/v1/metahub/${metahubId}/export`)
        expect(exportResp.ok).toBe(true)
        const envelope = await exportResp.json() as Record<string, unknown>
        expect(envelope.kind).toBe('metahub_snapshot_bundle')

        const tampered = { ...envelope, snapshotHash: 'a'.repeat(64) }
        const importResp = await sendWithCsrf(api, 'POST', '/api/v1/metahubs/import', tampered)
        expect(importResp.status).toBe(400)
    })

    test('@flow self-hosted app snapshot fixture imports through the browser UI and restores MVP structure', async ({ page, runManifest }) => {
        test.setTimeout(180_000)

        const fixture = await loadSelfHostedAppFixture()

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password,
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
        await expect(dialog.getByText(SELF_HOSTED_APP_FIXTURE_FILENAME)).toBeVisible()

        const importResponsePromise = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/metahubs/import'),
            { timeout: 120_000 }
        )
        await dialog.getByRole('button', { name: /import/i }).last().click()

        const importResponse = await importResponsePromise
        expect(importResponse.status()).toBe(201)

        const importBody = await readBrowserResponseJsonSafe(importResponse)
        await expect(dialog).toHaveCount(0)
        await expect
            .poll(
                () => new URL(page.url()).pathname,
                {
                    timeout: 15_000,
                    message: 'Waiting for imported metahub board navigation after snapshot import'
                }
            )
            .toMatch(/^\/metahub\/[0-9a-f-]+$/)

        const importedIdFromResponse =
            typeof importBody?.metahub === 'object' && importBody.metahub && 'id' in importBody.metahub
                ? (importBody.metahub as { id?: unknown }).id
                : importBody?.data && typeof importBody.data === 'object' && 'id' in importBody.data
                  ? (importBody.data as { id?: unknown }).id
                  : importBody?.id
        const importedId = typeof importedIdFromResponse === 'string'
            ? importedIdFromResponse
            : new URL(page.url()).pathname.match(/^\/metahub\/([^/]+)$/)?.[1]
        expect(typeof importedId).toBe('string')

        await recordCreatedMetahub({ id: importedId, name: fixture.metahubName, codename: 'self-hosted-app-imported-fixture' })
        await expect(page.getByText(fixture.metahubName, { exact: true }).first()).toBeVisible({ timeout: 15_000 })

        await waitForSelfHostedAppExportContract(api, importedId)

        const exportResponse = await apiGet(api, `/api/v1/metahub/${importedId}/export`)
        expect(exportResponse.ok).toBe(true)
        const importedEnvelope = (await exportResponse.json()) as Record<string, unknown>
        assertSelfHostedAppEnvelopeContract(importedEnvelope)

        const importedSnapshot =
            importedEnvelope.snapshot && typeof importedEnvelope.snapshot === 'object'
                ? (importedEnvelope.snapshot as Record<string, unknown>)
                : {}
        const importedEntities = Object.values(
            importedSnapshot.entities && typeof importedSnapshot.entities === 'object'
                ? (importedSnapshot.entities as Record<
                      string,
                      { id?: string; kind?: string; codename?: unknown; presentation?: { name?: unknown } }
                  >)
                : {}
        )
        const importedSharedAttributes = Array.isArray(importedSnapshot.sharedFieldDefinitions)
            ? importedSnapshot.sharedFieldDefinitions
            : Array.isArray(importedSnapshot.sharedAttributes)
                ? importedSnapshot.sharedAttributes
                : []
        const importedSharedConstants = Array.isArray(importedSnapshot.sharedFixedValues)
            ? importedSnapshot.sharedFixedValues
            : Array.isArray(importedSnapshot.sharedConstants)
                ? importedSnapshot.sharedConstants
                : []
        const importedSharedEnumerationValues = Array.isArray(importedSnapshot.sharedEnumerationValues)
            ? importedSnapshot.sharedEnumerationValues
            : Array.isArray(importedSnapshot.sharedOptionValues)
                ? importedSnapshot.sharedOptionValues
                : []
        const importedSharedEntityOverrides = Array.isArray(importedSnapshot.sharedEntityOverrides)
            ? importedSnapshot.sharedEntityOverrides
            : []
        const importedCatalogLayouts = Array.isArray(importedSnapshot.catalogLayouts) ? importedSnapshot.catalogLayouts : []
        const importedLayoutZoneWidgets = Array.isArray(importedSnapshot.layoutZoneWidgets) ? importedSnapshot.layoutZoneWidgets : []
        const importedCatalogLayoutWidgetOverrides = Array.isArray(importedSnapshot.catalogLayoutWidgetOverrides)
            ? importedSnapshot.catalogLayoutWidgetOverrides
            : []

        expect(importedEntities.filter((entity) => entity.kind === 'catalog')).toHaveLength(fixture.expectedCounts.catalogs)
        expect(importedEntities.filter((entity) => entity.kind === 'hub')).toHaveLength(fixture.expectedCounts.hubs)
        expect(importedEntities.filter((entity) => entity.kind === 'set')).toHaveLength(fixture.expectedCounts.sets)
        expect(importedEntities.filter((entity) => entity.kind === 'enumeration')).toHaveLength(fixture.expectedCounts.enumerations)

        const settingsCatalog = importedEntities.find(
            (entity) => entity.kind === 'catalog' && readLocalizedText(entity?.presentation?.name) === 'Settings'
        )
        expect(typeof settingsCatalog?.id).toBe('string')

        const includedCatalogSection = findSelfHostedAppSection(
            SELF_HOSTED_APP_SHARED_ENTITIES.attribute.includedCatalogSectionCodename
        )
        const importedSharedCatalog = importedEntities.find(
            (entity) => entity.kind === 'catalog' && matchesSectionDefinition(entity, includedCatalogSection)
        )
        expect(typeof importedSharedCatalog?.id).toBe('string')

        const targetSetSection = findSelfHostedAppSection(SELF_HOSTED_APP_SHARED_ENTITIES.constant.targetSetSectionCodename)
        const importedSetSection = importedEntities.find(
            (entity) => entity.kind === 'set' && matchesSectionDefinition(entity, targetSetSection)
        )
        expect(typeof importedSetSection?.id).toBe('string')

        const targetEnumerationSection = findSelfHostedAppSection(
            SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.targetEnumerationSectionCodename
        )
        const importedEnumerationSection = importedEntities.find(
            (entity) => entity.kind === 'enumeration' && matchesSectionDefinition(entity, targetEnumerationSection)
        )
        expect(typeof importedEnumerationSection?.id).toBe('string')

        expect(
            importedSharedAttributes.some(
                (attribute) => readLocalizedText(attribute?.presentation?.name) === fixture.sharedAttributeName
            )
        ).toBe(true)
        expect(
            importedSharedEntityOverrides.some(
                (override) =>
                    override?.targetObjectId === settingsCatalog.id &&
                    override?.isExcluded === true
            )
        ).toBe(true)
        expect(
            importedSharedConstants.some(
                (constant) => readLocalizedText(constant?.presentation?.name) === fixture.sharedConstantName
            )
        ).toBe(true)
        expect(
            importedSharedEnumerationValues.some(
                (value) => readLocalizedText(value?.presentation?.name) === fixture.sharedEnumerationValueName
            )
        ).toBe(true)

        const settingsLayouts = importedCatalogLayouts.filter(
            (layout) => (layout?.linkedCollectionId ?? layout?.catalogId) === settingsCatalog?.id
        )
        expect(settingsLayouts).toHaveLength(1)
        const settingsLayout = settingsLayouts[0]
        expect(readLocalizedText(settingsLayout?.name)).toBe(SELF_HOSTED_APP_SETTINGS_LAYOUT.name.en)
        expect(settingsLayout?.config).toMatchObject({
            showViewToggle: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showViewToggle,
            defaultViewMode: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.defaultViewMode,
            showFilterBar: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showFilterBar,
            catalogBehavior: SELF_HOSTED_APP_SETTINGS_LAYOUT.catalogBehavior
        })
        expect(typeof settingsLayout?.baseLayoutId).toBe('string')

        const baseDetailsTitleWidget = importedLayoutZoneWidgets.find(
            (widget) => widget?.layoutId === settingsLayout?.baseLayoutId && widget?.widgetKey === 'detailsTitle'
        )
        expect(typeof baseDetailsTitleWidget?.id).toBe('string')
        const detailsTitleWidgetOverride = importedCatalogLayoutWidgetOverrides.find(
            (widget) => widget?.catalogLayoutId === settingsLayout?.id && widget?.baseWidgetId === baseDetailsTitleWidget?.id
        )
        expect(detailsTitleWidgetOverride?.isActive).toBe(false)

        await page.goto(`/metahub/${importedId}/entities/catalog/instances`)
        await expect(page.getByRole('heading', { name: 'Catalogs' })).toBeVisible()

        for (const catalogName of fixture.expectedCatalogNames) {
            await expect(page.getByText(catalogName, { exact: true }).first()).toBeVisible()
        }
    })
})
