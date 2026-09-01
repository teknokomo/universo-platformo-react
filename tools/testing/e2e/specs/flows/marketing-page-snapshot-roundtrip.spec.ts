import fs from 'node:fs/promises'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { createLocalizedContent } from '@universo-react/utils'
import { marketingPageTemplate } from '../../../../../packages/universo-react-metahubs-backend/dist/domains/templates/data/marketing-page.template.js'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getMarketingPageRuntime,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { assertMarketingPageRuntimeMaterialization } from '../../support/marketingPageRuntimeMaterialization.ts'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'
import { toolbarSelectors } from '../../support/selectors/contracts'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const readLocalizedText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

    const localized = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primaryLocale = typeof localized._primary === 'string' ? localized._primary : 'en'
    const primary = localized.locales?.[primaryLocale]?.content
    if (typeof primary === 'string' && primary.length > 0) return primary

    const english = localized.locales?.en?.content
    return typeof english === 'string' ? english : ''
}

const readCookieHeader = (api: ApiContext): string =>
    Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')

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

function assertMarketingSnapshotRoundtrip(source: Record<string, unknown>, imported: Record<string, unknown>) {
    const sourceSnapshot = readSnapshot(source)
    const importedSnapshot = readSnapshot(imported)

    expect(imported.kind).toBe('metahub_snapshot_bundle')
    expect(imported.bundleVersion).toBe(1)
    expect(imported.snapshotHash).toEqual(expect.any(String))
    expect(importedSnapshot.version).toBe(sourceSnapshot.version)
    expect(importedSnapshot.versionEnvelope).toEqual(sourceSnapshot.versionEnvelope)
    expect(readSnapshotEntityCodenames(importedSnapshot)).toEqual(readSnapshotEntityCodenames(sourceSnapshot))

    const importedSerialized = JSON.stringify(importedSnapshot)
    for (const expectedCopy of ['Our latest products', 'Trusted by the best companies', 'Frequently asked questions', 'Material UI']) {
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

    try {
        const sourceName = `E2E ${runManifest.runId} marketing snapshot source`
        const sourceCodename = `${runManifest.runId}-marketing-snapshot-source`
        const source = await createMetahub(api, {
            name: { en: sourceName, ru: `Источник маркетингового snapshot ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', sourceCodename),
            templateCodename: 'marketing-page'
        })
        expect(typeof source?.id).toBe('string')
        await recordCreatedMetahub({ id: source.id, name: sourceName, codename: sourceCodename })

        const sourceEnvelope = await getMetahubExport(api, source.id)
        const sourcePath = testInfo.outputPath('marketing-page-source-export.json')
        await fs.writeFile(sourcePath, JSON.stringify(sourceEnvelope, null, 2), 'utf8')

        const imported = await importSnapshotThroughUi(page, sourcePath)
        await recordCreatedMetahub({ id: imported.metahubId, name: imported.metahubName || sourceName })
        await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId })
        expect(imported.metahubName).toBe(sourceName)

        const importedEnvelope = await getMetahubExport(api, imported.metahubId)
        assertMarketingSnapshotRoundtrip(sourceEnvelope, importedEnvelope)

        const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: `E2E ${runManifest.runId} imported marketing application` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: false
        })
        const applicationId = linkedApplication?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId, slug: linkedApplication.application.slug })

        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')

        const runtimePayload = await getMarketingPageRuntime(api, applicationId, 'en')
        assertMarketingPageRuntimeMaterialization(runtimePayload, marketingPageTemplate)

        const localMedia = await installMarketingPageLocalMedia(page)
        await page.goto(`/a/${applicationId}`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Our latest products' })).toBeVisible()
        await expect(page.locator('#pricing .MuiCard-root')).toHaveCount(3)
        await expect(page.locator('#faq .MuiAccordion-root')).toHaveCount(4)
        await localMedia.assertLoaded(page)

        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])
    } finally {
        await disposeApiContext(api)
    }
})
