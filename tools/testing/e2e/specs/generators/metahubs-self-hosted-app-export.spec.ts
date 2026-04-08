import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    createLayout,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    syncApplicationSchema,
    toggleLayoutZoneWidgetActive,
    disposeApiContext,
    getLayout,
    listLayouts,
    listLayoutZoneWidgets,
    sendWithCsrf,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub, recordCreatedApplication } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { SHARED_OBJECT_KINDS } from '@universo/types'
import { buildVLC, createLocalizedContent, validateSnapshotEnvelope } from '@universo/utils'
import {
    SELF_HOSTED_APP_CANONICAL_METAHUB,
    SELF_HOSTED_APP_FIXTURE_FILENAME,
    SELF_HOSTED_APP_LAYOUT,
    SELF_HOSTED_APP_PUBLICATION,
    SELF_HOSTED_APP_SCREENSHOTS_DIRNAME,
    SELF_HOSTED_APP_SECTIONS,
    SELF_HOSTED_APP_SHARED_ENTITIES,
    SELF_HOSTED_APP_SETTINGS_LAYOUT,
    SELF_HOSTED_APP_SETTINGS_BASELINE,
    assertSelfHostedAppEnvelopeContract,
    buildSelfHostedAppLiveMetahubCodename,
    buildSelfHostedAppLiveMetahubName,
    getSelfHostedAppCatalogAttributes
} from '../../support/selfHostedAppFixtureContract.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type SelfHostedAppSection = (typeof SELF_HOSTED_APP_SECTIONS)[number]

async function waitForDefaultLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            const items = Array.isArray(response?.items) ? response.items : []
            layoutId = items.find((layout) => layout?.isDefault)?.id ?? items[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function applyEnhancedLayoutConfig(api: ApiContext, metahubId: string) {
    const layoutId = await waitForDefaultLayoutId(api, metahubId)
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
        name: SELF_HOSTED_APP_LAYOUT.name,
        namePrimaryLocale: 'en',
        description: SELF_HOSTED_APP_LAYOUT.description,
        descriptionPrimaryLocale: 'en',
        config: {
            ...currentConfig,
            ...SELF_HOSTED_APP_LAYOUT.runtimeConfig
        }
    })

    expect(response.ok).toBe(true)
    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    const zoneWidgetItems = Array.isArray(zoneWidgets?.items) ? zoneWidgets.items : []
    const menuWidgets = zoneWidgetItems.filter((widget) => widget?.widgetKey === 'menuWidget')
    const primaryMenuWidget = menuWidgets[0]

    if (primaryMenuWidget?.id) {
        const menuWidgetResponse = await sendWithCsrf(
            api,
            'PATCH',
            `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${primaryMenuWidget.id}/config`,
            {
                config: {
                    ...(primaryMenuWidget.config && typeof primaryMenuWidget.config === 'object' ? primaryMenuWidget.config : {}),
                    autoShowAllCatalogs: true,
                    showTitle: true,
                    title: buildVLC(SELF_HOSTED_APP_LAYOUT.menuTitle.en, SELF_HOSTED_APP_LAYOUT.menuTitle.ru)
                }
            }
        )
        expect(menuWidgetResponse.ok).toBe(true)
    } else {
        const menuWidgetResponse = await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
            zone: 'left',
            widgetKey: 'menuWidget',
            config: {
                autoShowAllCatalogs: true,
                showTitle: true,
                title: buildVLC(SELF_HOSTED_APP_LAYOUT.menuTitle.en, SELF_HOSTED_APP_LAYOUT.menuTitle.ru)
            }
        })
        expect(menuWidgetResponse.ok).toBe(true)
    }

    for (const widget of menuWidgets.slice(1)) {
        const removeResponse = await sendWithCsrf(
            api,
            'DELETE',
            `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`
        )
        expect(removeResponse.status).toBe(204)
    }

    const detailsTableResponse = await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget`, {
        zone: 'center',
        widgetKey: 'detailsTable'
    })
    expect(detailsTableResponse.ok).toBe(true)

    const updatedLayout = await getLayout(api, metahubId, layoutId)
    expect(updatedLayout?.config).toMatchObject(SELF_HOSTED_APP_LAYOUT.runtimeConfig)

    return layoutId
}

async function createSettingsCatalogLayoutOverride(api: ApiContext, metahubId: string, catalogId: string, baseLayoutId: string) {
    const created = await createLayout(api, metahubId, {
        catalogId,
        baseLayoutId,
        templateKey: 'dashboard',
        name: SELF_HOSTED_APP_SETTINGS_LAYOUT.name,
        namePrimaryLocale: 'en',
        description: SELF_HOSTED_APP_SETTINGS_LAYOUT.description,
        descriptionPrimaryLocale: 'en',
        config: {
            ...SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig,
            catalogBehavior: SELF_HOSTED_APP_SETTINGS_LAYOUT.catalogBehavior
        },
        isActive: true,
        isDefault: true
    })

    expect(created?.catalogId ?? created?.data?.catalogId).toBe(catalogId)
    expect(created?.baseLayoutId ?? created?.data?.baseLayoutId).toBe(baseLayoutId)

    const settingsLayoutId = created?.id ?? created?.data?.id
    const settingsLayoutWidgets = await listLayoutZoneWidgets(api, metahubId, settingsLayoutId)
    const settingsLayoutWidgetItems = Array.isArray(settingsLayoutWidgets?.items) ? settingsLayoutWidgets.items : []
    const detailsTitleWidget = settingsLayoutWidgetItems.find(
        (widget) => widget?.widgetKey === 'detailsTitle' && widget?.isActive !== false
    )

    if (detailsTitleWidget?.id) {
        const toggleResponse = await toggleLayoutZoneWidgetActive(api, metahubId, settingsLayoutId, detailsTitleWidget.id, false)
        expect(toggleResponse?.item?.isActive).toBe(false)
    }

    const updatedSettingsLayout = await getLayout(api, metahubId, settingsLayoutId)
    expect(updatedSettingsLayout?.config).toMatchObject({
        showViewToggle: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showViewToggle,
        defaultViewMode: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.defaultViewMode,
        showFilterBar: SELF_HOSTED_APP_SETTINGS_LAYOUT.runtimeConfig.showFilterBar,
        catalogBehavior: SELF_HOSTED_APP_SETTINGS_LAYOUT.catalogBehavior
    })

    return settingsLayoutId
}

/* ────── Helper: raw GET via cookies ────── */

async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

/* ────── Self-hosted fixture catalog definitions ────── */

const getSectionCreatePath = (metahubId: string, section: SelfHostedAppSection): string => {
    if (section.kind === 'hub') return `/api/v1/metahub/${metahubId}/hubs`
    if (section.kind === 'set') return `/api/v1/metahub/${metahubId}/sets`
    if (section.kind === 'enumeration') return `/api/v1/metahub/${metahubId}/enumerations`
    return `/api/v1/metahub/${metahubId}/catalogs`
}

const buildSectionCreatePayload = (section: SelfHostedAppSection, hubId?: string) => {
    const payload: Record<string, unknown> = {
        codename: buildVLC(section.name.en, section.name.ru),
        name: section.name,
        namePrimaryLocale: 'en',
        description: section.description,
        descriptionPrimaryLocale: 'en'
    }

    if ((section.kind === 'set' || section.kind === 'enumeration') && hubId) {
        payload.hubIds = [hubId]
        payload.isSingleHub = true
    }

    return payload
}

async function seedSettingsBaseline(api: ApiContext, metahubId: string, catalogId: string) {
    for (const row of SELF_HOSTED_APP_SETTINGS_BASELINE) {
        const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/catalog/${catalogId}/elements`, {
            data: row,
        })
        expect(response.ok).toBe(true)
    }
}

async function ensureSharedContainers(api: ApiContext, metahubId: string) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/shared-containers/ensure`)
    expect(response.ok).toBe(true)
    const payload = await response.json()
    return Array.isArray(payload?.items) ? payload.items : []
}

async function seedSharedEntities(api: ApiContext, metahubId: string, sectionMap: Record<string, string>) {
    const sharedContainers = await ensureSharedContainers(api, metahubId)
    const sharedCatalogContainerId = sharedContainers.find((item) => item?.kind === SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL)?.objectId
    const sharedSetContainerId = sharedContainers.find((item) => item?.kind === SHARED_OBJECT_KINDS.SHARED_SET_POOL)?.objectId
    const sharedEnumerationContainerId = sharedContainers.find((item) => item?.kind === SHARED_OBJECT_KINDS.SHARED_ENUM_POOL)?.objectId

    expect(typeof sharedCatalogContainerId).toBe('string')
    expect(typeof sharedSetContainerId).toBe('string')
    expect(typeof sharedEnumerationContainerId).toBe('string')

    const sharedAttribute = await createMetahubAttribute(api, metahubId, sharedCatalogContainerId, {
        codename: buildVLC(
            SELF_HOSTED_APP_SHARED_ENTITIES.attribute.codename.en,
            SELF_HOSTED_APP_SHARED_ENTITIES.attribute.codename.ru
        ),
        name: SELF_HOSTED_APP_SHARED_ENTITIES.attribute.name,
        namePrimaryLocale: 'en',
        dataType: 'STRING',
        isRequired: false
    })

    const sharedAttributeId = sharedAttribute?.data?.id ?? sharedAttribute?.id
    expect(typeof sharedAttributeId).toBe('string')

    const sharedConstantResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/set/${sharedSetContainerId}/constants`, {
        codename: buildVLC(
            SELF_HOSTED_APP_SHARED_ENTITIES.constant.codename.en,
            SELF_HOSTED_APP_SHARED_ENTITIES.constant.codename.ru
        ),
        name: SELF_HOSTED_APP_SHARED_ENTITIES.constant.name,
        namePrimaryLocale: 'en',
        dataType: 'STRING',
        value: 'shared-fixture-value'
    })
    expect(sharedConstantResponse.status).toBeLessThan(300)

    const sharedValueResponse = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/metahub/${metahubId}/enumeration/${sharedEnumerationContainerId}/values`,
        {
            codename: buildVLC(
                SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.codename.en,
                SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.codename.ru
            ),
            name: SELF_HOSTED_APP_SHARED_ENTITIES.enumerationValue.name,
            namePrimaryLocale: 'en',
            isDefault: false
        }
    )
    expect(sharedValueResponse.status).toBeLessThan(300)

    const overrideResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/shared-entity-overrides`, {
        entityKind: 'attribute',
        sharedEntityId: sharedAttributeId,
        targetObjectId: sectionMap[SELF_HOSTED_APP_SHARED_ENTITIES.attribute.excludedCatalogSectionCodename],
        isExcluded: true
    })
    expect(overrideResponse.status).toBeLessThan(300)
}

/* ────── Constants ────── */

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const SCREENSHOTS_DIR = path.resolve(repoRoot, 'test-results', SELF_HOSTED_APP_SCREENSHOTS_DIRNAME)

/* ────── Test ────── */

test.describe('Metahubs Self-Hosted App Export', () => {
    let api: ApiContext

    test('@generator create metahubs self-hosted app, publish application, export snapshot', async ({ page, runManifest }) => {
        test.setTimeout(300_000)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password,
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

        /* ── 1. Create metahub ── */
        const liveMetahubName = buildSelfHostedAppLiveMetahubName(runManifest.runId)
        const metahubCodename = buildSelfHostedAppLiveMetahubCodename(runManifest.runId)
        const metahubResp = await createMetahub(api, {
            name: liveMetahubName,
            namePrimaryLocale: 'en',
            codename: metahubCodename,
            description: SELF_HOSTED_APP_CANONICAL_METAHUB.description,
            descriptionPrimaryLocale: 'en',
        })
        const metahubId = metahubResp?.data?.id ?? metahubResp?.id
        expect(metahubId).toBeTruthy()
        await recordCreatedMetahub({
            id: metahubId,
            name: liveMetahubName.en,
            codename: SELF_HOSTED_APP_CANONICAL_METAHUB.codename.en,
        })

        /* ── 2. Create the planned self-hosted sections ── */
        const sectionMap: Record<string, string> = {}
        let hubSectionId: string | undefined
        let enumerationSectionId: string | undefined

        for (const sectionDef of SELF_HOSTED_APP_SECTIONS) {
            const sectionResp = await sendWithCsrf(
                api,
                'POST',
                getSectionCreatePath(metahubId, sectionDef),
                buildSectionCreatePayload(sectionDef, hubSectionId)
            )
            expect(sectionResp.status).toBeLessThan(300)
            const sectionBody = await sectionResp.json()
            const sectionId = sectionBody?.data?.id ?? sectionBody?.id
            expect(sectionId).toBeTruthy()
            sectionMap[sectionDef.codename] = sectionId

            if (sectionDef.kind === 'hub') {
                hubSectionId = sectionId
            }
            if (sectionDef.kind === 'enumeration') {
                enumerationSectionId = sectionId
            }

            const attrs = sectionDef.kind === 'catalog' ? getSelfHostedAppCatalogAttributes(sectionDef.codename) : []
            if (attrs.length > 0) {
                const catalogId = sectionId
                for (const attr of attrs) {
                    await createMetahubAttribute(api, metahubId, catalogId, {
                        codename: createLocalizedContent('en', attr.codename),
                        name: attr.name,
                        namePrimaryLocale: 'en',
                        dataType: attr.dataType,
                        isRequired: attr.isRequired ?? false,
                    })
                }
            }

            if (sectionDef.codename === 'settings') {
                await seedSettingsBaseline(api, metahubId, sectionId)
            }
        }

        if (enumerationSectionId) {
            const valueResp = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/enumeration/${enumerationSectionId}/values`, {
                codename: createLocalizedContent('en', 'active'),
                name: { en: 'Active' },
                namePrimaryLocale: 'en',
                isDefault: true,
            })
            expect(valueResp.status).toBeLessThan(300)
        }

        expect(Object.keys(sectionMap).length).toBe(SELF_HOSTED_APP_SECTIONS.length)

        await seedSharedEntities(api, metahubId, sectionMap)

        const defaultLayoutId = await applyEnhancedLayoutConfig(api, metahubId)

        if (sectionMap.settings) {
            const settingsLayoutId = await createSettingsCatalogLayoutOverride(api, metahubId, sectionMap.settings, defaultLayoutId)
            expect(typeof settingsLayoutId).toBe('string')
        }

        /* ── 3. Screenshot: metahub catalogs in UI ── */
        try {
            await page.goto(`/metahub/${metahubId}/catalogs`)
            await page.waitForLoadState('networkidle', { timeout: 15_000 })
            await page.waitForTimeout(2000)
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, '01-metahub-overview.png'),
                fullPage: true,
            })
        } catch (e) {
            console.warn(`Screenshot 01 skipped: ${(e as Error).message}`)
        }

        /* ── 4. Create publication ── */
        const pubResp = await createPublication(api, metahubId, {
            name: SELF_HOSTED_APP_PUBLICATION.name,
            namePrimaryLocale: 'en',
        })
        const publicationId = pubResp?.data?.id ?? pubResp?.id
        expect(publicationId).toBeTruthy()

        /* ── 5. Create linked application ── */
        let applicationId: string | undefined
        try {
            const appResp = await createPublicationLinkedApplication(api, metahubId, publicationId, {
                name: SELF_HOSTED_APP_PUBLICATION.applicationName,
                namePrimaryLocale: 'en',
            })
            applicationId = appResp?.data?.id ?? appResp?.id
            if (applicationId) {
                await recordCreatedApplication({ id: applicationId, name: SELF_HOSTED_APP_PUBLICATION.applicationName.en })
            }
        } catch (e) {
            // Application creation may not be available in all setups
            console.warn(`Could not create linked application: ${(e as Error).message}`)
        }

        /* ── 6. Sync and create publication version ── */
        try {
            const syncResp = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/publication/${publicationId}/sync`, {})
            if (syncResp.ok) {
                await waitForPublicationReady(api, metahubId, publicationId, { timeoutMs: 30_000 })
            }
        } catch {
            // Sync may not be needed for every publication type
        }

        const versionResp = await createPublicationVersion(api, metahubId, publicationId, {
            name: SELF_HOSTED_APP_PUBLICATION.versionName,
            namePrimaryLocale: 'en',
            description: SELF_HOSTED_APP_PUBLICATION.versionDescription,
            descriptionPrimaryLocale: 'en',
        })
        const versionId = versionResp?.data?.id ?? versionResp?.id
        expect(versionId).toBeTruthy()

        /* ── 7. Sync application schema if created ── */
        if (applicationId) {
            try {
                await syncApplicationSchema(api, applicationId, {})
            } catch {
                // Non-critical
            }
        }

        /* ── 8. Screenshot: publication page ── */
        try {
            await page.goto(`/metahub/${metahubId}/publications`)
            await page.waitForLoadState('networkidle', { timeout: 15_000 })
            await page.waitForTimeout(2000)
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, '02-publication-list.png'),
                fullPage: true,
            })
        } catch (e) {
            console.warn(`Screenshot 02 skipped: ${(e as Error).message}`)
        }

        /* ── 9. Screenshot: application (if available) ── */
        if (applicationId) {
            try {
                await page.goto(`/applications/${applicationId}`)
                await page.waitForLoadState('networkidle', { timeout: 15_000 })
                await page.waitForTimeout(3000)
                await page.screenshot({
                    path: path.join(SCREENSHOTS_DIR, '03-application-runtime.png'),
                    fullPage: true,
                })
            } catch (e) {
                console.warn(`Screenshot 03 skipped: ${(e as Error).message}`)
            }
        }

        /* ── 10. Export metahub snapshot via API ── */
        const exportResp = await apiGet(api, `/api/v1/metahub/${metahubId}/export`)
        expect(exportResp.ok).toBe(true)
        const envelope = await exportResp.json() as Record<string, unknown>
        expect(envelope.kind).toBe('metahub_snapshot_bundle')
        expect(envelope.bundleVersion).toBe(1)
        expect(typeof envelope.snapshotHash).toBe('string')
        expect((envelope.snapshotHash as string).length).toBe(64)
        expect(envelope.snapshot).toBeTruthy()

        validateSnapshotEnvelope(envelope)
        assertSelfHostedAppEnvelopeContract(envelope)

        /* ── 11. Save snapshot to fixtures (persists after test cleanup) ── */
        const fixturePath = path.join(FIXTURES_DIR, SELF_HOSTED_APP_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')
        expect(fs.existsSync(fixturePath)).toBe(true)

        const stats = fs.statSync(fixturePath)
        expect(stats.size).toBeGreaterThan(100)

        /* ── 12. Final screenshot: metahub catalogs page ── */
        try {
            await page.goto(`/metahub/${metahubId}/catalogs`)
            await page.waitForLoadState('networkidle', { timeout: 15_000 })
            await page.waitForTimeout(1500)
            await page.screenshot({
                path: path.join(SCREENSHOTS_DIR, '04-catalogs-page.png'),
                fullPage: true,
            })
        } catch (e) {
            console.warn(`Screenshot 04 skipped: ${(e as Error).message}`)
        }

        /* ── Summary log ── */
        console.log('\n─── Metahubs Self-Hosted App Export Complete ───')
        console.log(`Metahub ID:    ${metahubId}`)
        console.log(`Publication:   ${publicationId}`)
        console.log(`Version:       ${versionId}`)
        console.log(`Application:   ${applicationId ?? 'N/A'}`)
        console.log(`Sections:      ${Object.keys(sectionMap).length}`)
        console.log(`Fixture:       ${fixturePath}`)
        console.log(`Screenshots:   ${SCREENSHOTS_DIR}/`)
        console.log(`Fixture size:  ${(stats.size / 1024).toFixed(1)} KB`)
    })
})
