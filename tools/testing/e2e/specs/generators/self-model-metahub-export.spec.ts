import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    syncApplicationSchema,
    disposeApiContext,
    getLayout,
    listLayouts,
    sendWithCsrf,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub, recordCreatedApplication } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { createLocalizedContent } from '@universo/utils'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function applyEnhancedLayoutConfig(api: ApiContext, metahubId: string) {
    const layoutId = await waitForLayoutId(api, metahubId)
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}

    const response = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
        config: {
            ...currentConfig,
            showOverviewTitle: false,
            showOverviewCards: false,
            showSessionsChart: false,
            showPageViewsChart: false,
            showDetailsTitle: true,
            showDetailsTable: true,
            showFooter: false,
            showViewToggle: true,
            defaultViewMode: 'card',
            showFilterBar: true,
            enableRowReordering: true,
            cardColumns: 2,
            rowHeight: 'auto'
        }
    })

    expect(response.ok).toBe(true)
    const updatedLayout = await response.json()
    expect(updatedLayout?.config).toMatchObject({
        showViewToggle: true,
        showFilterBar: true,
        defaultViewMode: 'card',
        enableRowReordering: true,
        cardColumns: 2,
        rowHeight: 'auto'
    })
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

/* ────── Self-Model catalog definitions ────── */

const SELF_MODEL_SECTIONS = [
    { codename: 'metahubs', name: 'Metahubs', kind: 'catalog' },
    { codename: 'catalogs', name: 'Catalogs', kind: 'catalog' },
    { codename: 'attributes', name: 'Attributes', kind: 'catalog' },
    { codename: 'elements', name: 'Elements', kind: 'catalog' },
    { codename: 'hubs', name: 'Hubs', kind: 'hub' },
    { codename: 'sets', name: 'Sets', kind: 'set' },
    { codename: 'enumerations', name: 'Enumerations', kind: 'enumeration' },
    { codename: 'enum_values', name: 'Enum Values', kind: 'catalog' },
    { codename: 'constants', name: 'Constants', kind: 'catalog' },
    { codename: 'branches', name: 'Branches', kind: 'catalog' },
    { codename: 'publications', name: 'Publications', kind: 'catalog' },
    { codename: 'layouts', name: 'Layouts', kind: 'catalog' },
    { codename: 'settings', name: 'Settings', kind: 'catalog' },
] as const

type SelfModelSection = (typeof SELF_MODEL_SECTIONS)[number]

function getAttributesForCatalog(codename: string) {
    const defs: Record<string, Array<{ codename: string; name: string; dataType: string; isRequired?: boolean }>> = {
        metahubs: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'description', name: 'Description', dataType: 'STRING' },
            { codename: 'slug', name: 'Slug', dataType: 'STRING', isRequired: true },
        ],
        catalogs: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'codename', name: 'Codename', dataType: 'STRING', isRequired: true },
            { codename: 'kind', name: 'Kind', dataType: 'STRING' },
        ],
        attributes: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'codename', name: 'Codename', dataType: 'STRING', isRequired: true },
            { codename: 'data_type', name: 'Data Type', dataType: 'STRING', isRequired: true },
            { codename: 'is_required', name: 'Is Required', dataType: 'BOOLEAN' },
        ],
        elements: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'sort_order', name: 'Sort Order', dataType: 'NUMBER' },
        ],
        enum_values: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'codename', name: 'Codename', dataType: 'STRING', isRequired: true },
            { codename: 'sort_order', name: 'Sort Order', dataType: 'NUMBER' },
        ],
        constants: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'codename', name: 'Codename', dataType: 'STRING', isRequired: true },
            { codename: 'data_type', name: 'Data Type', dataType: 'STRING' },
        ],
        branches: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'codename', name: 'Codename', dataType: 'STRING', isRequired: true },
            { codename: 'is_default', name: 'Is Default', dataType: 'BOOLEAN' },
        ],
        publications: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'version_number', name: 'Version Number', dataType: 'NUMBER' },
            { codename: 'is_active', name: 'Is Active', dataType: 'BOOLEAN' },
        ],
        layouts: [
            { codename: 'name', name: 'Name', dataType: 'STRING', isRequired: true },
            { codename: 'template_key', name: 'Template Key', dataType: 'STRING' },
            { codename: 'is_default', name: 'Is Default', dataType: 'BOOLEAN' },
        ],
        settings: [
            { codename: 'key', name: 'Key', dataType: 'STRING', isRequired: true },
            { codename: 'value', name: 'Value', dataType: 'STRING' },
            { codename: 'category', name: 'Category', dataType: 'STRING' },
        ],
    }
    return defs[codename] ?? []
}

const getSectionCreatePath = (metahubId: string, section: SelfModelSection): string => {
    if (section.kind === 'hub') return `/api/v1/metahub/${metahubId}/hubs`
    if (section.kind === 'set') return `/api/v1/metahub/${metahubId}/sets`
    if (section.kind === 'enumeration') return `/api/v1/metahub/${metahubId}/enumerations`
    return `/api/v1/metahub/${metahubId}/catalogs`
}

const buildSectionCreatePayload = (section: SelfModelSection, hubId?: string) => {
    const payload: Record<string, unknown> = {
        codename: createLocalizedContent('en', section.codename),
        name: { en: section.name },
        namePrimaryLocale: 'en',
    }

    if ((section.kind === 'set' || section.kind === 'enumeration') && hubId) {
        payload.hubIds = [hubId]
        payload.isSingleHub = true
    }

    return payload
}

/* ────── Constants ────── */

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const SCREENSHOTS_DIR = path.resolve(repoRoot, 'test-results', 'self-model')
const FIXTURE_FILENAME = 'self-model-metahub-snapshot.json'

/* ────── Test ────── */

test.describe('Self-Model Metahub Creation & Export', () => {
    let api: ApiContext

    test('@generator create self-model metahub, publish application, export snapshot', async ({ page, runManifest }) => {
        test.setTimeout(300_000)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password,
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

        /* ── 1. Create metahub ── */
        const metahubCodename = `self-model-${runManifest.runId}`
        const metahubResp = await createMetahub(api, {
            name: { en: `Self-Model ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            description: 'A metahub that models its own complete structure — demonstrates self-referential capability.',
            descriptionPrimaryLocale: 'en',
        })
        const metahubId = metahubResp?.data?.id ?? metahubResp?.id
        expect(metahubId).toBeTruthy()
        await recordCreatedMetahub({ id: metahubId, name: `Self-Model ${runManifest.runId}`, codename: metahubCodename })

        /* ── 2. Create the planned 13 self-model sections ── */
        const sectionMap: Record<string, string> = {}
        let hubSectionId: string | undefined
        let enumerationSectionId: string | undefined

        for (const sectionDef of SELF_MODEL_SECTIONS) {
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

            const attrs = sectionDef.kind === 'catalog' ? getAttributesForCatalog(sectionDef.codename) : []
            if (attrs.length > 0) {
                const catalogId = sectionId
                for (const attr of attrs) {
                    await createMetahubAttribute(api, metahubId, catalogId, {
                        codename: createLocalizedContent('en', attr.codename),
                        name: { en: attr.name },
                        namePrimaryLocale: 'en',
                        dataType: attr.dataType,
                        isRequired: attr.isRequired ?? false,
                    })
                }
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

        expect(Object.keys(sectionMap).length).toBe(SELF_MODEL_SECTIONS.length)

        await applyEnhancedLayoutConfig(api, metahubId)

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
            name: { en: 'Self-Model Publication' },
            namePrimaryLocale: 'en',
        })
        const publicationId = pubResp?.data?.id ?? pubResp?.id
        expect(publicationId).toBeTruthy()

        /* ── 5. Create linked application ── */
        let applicationId: string | undefined
        try {
            const appResp = await createPublicationLinkedApplication(api, metahubId, publicationId, {
                name: { en: 'Self-Model App' },
                namePrimaryLocale: 'en',
            })
            applicationId = appResp?.data?.id ?? appResp?.id
            if (applicationId) {
                await recordCreatedApplication({ id: applicationId, name: 'Self-Model App' })
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
            name: { en: 'Initial self-model snapshot v1' },
            namePrimaryLocale: 'en',
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

        /* ── 11. Save snapshot to fixtures (persists after test cleanup) ── */
        const fixturePath = path.join(FIXTURES_DIR, FIXTURE_FILENAME)
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
        console.log('\n─── Self-Model Metahub Export Complete ───')
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
