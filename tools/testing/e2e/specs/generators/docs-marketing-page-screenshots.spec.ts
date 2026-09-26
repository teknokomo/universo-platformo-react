import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    listApplicationWorkspaces,
    listPublicationApplications,
    setApplicationPublicEntryWorkspace,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'
import { readPngDimensions } from '../../support/pngDimensions.mjs'

type Locale = 'en' | 'ru'
type ScreenshotEntry = {
    id: string
    locale: Locale
    path: string
    requiredVisibleText: string
    forbiddenVisibleText: string
}
type ScreenshotManifest = {
    version: number
    routePattern: string
    scope: string
    browser: string
    theme: string
    viewport: { width: number; height: number }
    fullPage: boolean
    screenshots: ScreenshotEntry[]
}
type ScreenshotCapture = {
    id: string
    locale: Locale
    route: string
    scope: string
    browser: string
    theme: string
    captureMethod: string
    viewport: ScreenshotManifest['viewport']
    path: string
    sha256: string
    dimensions: { width: number; height: number }
}

const manifestPath = path.join(repoRoot, 'tools/docs/marketing-page-screenshot-manifest.json')
const provenancePath = path.join(repoRoot, 'tools/docs/marketing-page-screenshot-provenance.json')
const generatorPath = path.join(repoRoot, 'tools/testing/e2e/specs/generators/docs-marketing-page-screenshots.spec.ts')
const sourceTemplatePath = path.join(
    repoRoot,
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts'
)
const seedInputPaths = [
    'packages/universo-react-metahubs-backend/src/domains/templates/data/basic.template.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.hero.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.layouts.ts',
    'packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.seed-helpers.ts'
]
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ScreenshotManifest

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex')

function normalizeRoute(pageUrl: string, locale: Locale): string {
    const url = new URL(pageUrl)
    const route = url.pathname.replace(/^\/a\/[^/]+$/, '/a/{applicationId}')
    expect(url.searchParams.get('locale')).toBe(locale)
    expect(url.searchParams.get('themeVariant')).toBe('light')
    return `${route}?locale={locale}&themeVariant=light`
}

async function getLinkedApplicationId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string, publicationId: string) {
    let applicationId: string | undefined
    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            const linkedApplication = (response?.items ?? [])[0]
            applicationId = typeof linkedApplication?.id === 'string' ? linkedApplication.id : undefined
            return Boolean(applicationId)
        })
        .toBe(true)

    if (!applicationId) throw new Error('Marketing-page documentation publication did not create an application')
    return applicationId
}

async function writeScreenshotProvenance(captures: ScreenshotCapture[]): Promise<void> {
    const manifestBytes = await fs.readFile(manifestPath)
    const generatorBytes = await fs.readFile(generatorPath)
    const sourceTemplateBytes = await fs.readFile(sourceTemplatePath)
    const seedInputs = await Promise.all(
        seedInputPaths.map(async (inputPath) => ({
            path: inputPath,
            sha256: sha256(await fs.readFile(path.join(repoRoot, inputPath)))
        }))
    )
    const assets = captures.map(({ id, locale, path: assetPath, sha256: assetSha256, dimensions }) => ({
        id,
        locale,
        path: assetPath,
        sha256: assetSha256,
        dimensions
    }))

    await fs.writeFile(
        provenancePath,
        `${JSON.stringify(
            {
                version: 3,
                generatedAt: new Date().toISOString(),
                generator: path.relative(repoRoot, generatorPath),
                generatorSha256: sha256(generatorBytes),
                manifest: path.relative(repoRoot, manifestPath),
                manifestSha256: sha256(manifestBytes),
                sourceTemplate: path.relative(repoRoot, sourceTemplatePath),
                sourceTemplateSha256: sha256(sourceTemplateBytes),
                seedInputs,
                routePattern: manifest.routePattern,
                scope: manifest.scope,
                browser: manifest.browser,
                theme: manifest.theme,
                viewport: manifest.viewport,
                captureMethod: 'playwright.page.screenshot',
                captures,
                assets
            },
            null,
            4
        )}\n`,
        'utf8'
    )
}

test('@generator marketing page GitBook screenshot generator captures the published runtime in English and Russian', async ({
    browser,
    runManifest
}) => {
    test.setTimeout(300_000)
    const api = await createLoggedInApiContext(runManifest.testUser)
    let browserContext: Awaited<ReturnType<typeof browser.newContext>> | undefined
    try {
        browserContext = await browser.newContext({
            locale: 'en-US',
            colorScheme: 'light',
            viewport: manifest.viewport
        })
        const page = await browserContext.newPage()
        const metahubName = `Marketing Docs ${runManifest.runId}`
        const codenameToken = String(runManifest.runId)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        const metahubCodename = `marketing-docs-${codenameToken}`
        const metahub = await createMetahub(api, {
            name: { en: metahubName, ru: `Документация marketing-page ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (!metahub?.id) throw new Error('Marketing-page documentation metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const publication = await createPublication(api, metahub.id, {
            name: { en: `Marketing Docs Publication ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `Marketing Docs Application ${runManifest.runId}` },
            applicationNamePrimaryLocale: 'en',
            applicationIsPublic: true,
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (!publication?.id) throw new Error('Marketing-page documentation publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const applicationId = await getLinkedApplicationId(api, metahub.id, publication.id)
        await recordCreatedApplication({ id: applicationId })
        await syncApplicationSchema(api, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })
        await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')

        const workspaces = await listApplicationWorkspaces(api, applicationId)
        const sharedWorkspace = (workspaces?.items ?? []).find(
            (workspace: Record<string, unknown>) => workspace?.workspaceType !== 'personal' && !workspace?.personalUserId
        )
        const publicEntryWorkspaceId =
            (sharedWorkspace as { id?: string } | undefined)?.id ??
            (
                await createApplicationWorkspace(api, applicationId, {
                    name: createLocalizedContent('en', 'Public entry workspace'),
                    description: createLocalizedContent('en', 'Workspace used for anonymous documentation screenshots')
                })
            )?.id
        if (typeof publicEntryWorkspaceId !== 'string') {
            throw new Error('Marketing-page documentation generator could not prepare the public entry workspace')
        }
        await setApplicationPublicEntryWorkspace(api, applicationId, publicEntryWorkspaceId)

        const localMedia = await installMarketingPageLocalMedia(page)
        const captures: ScreenshotCapture[] = []
        for (const screenshot of manifest.screenshots) {
            const { locale } = screenshot
            await applyBrowserPreferences(page, { language: locale, isDarkMode: false })
            await page.goto(`/a/${applicationId}?locale=${locale}&themeVariant=light`)
            await expect(page).not.toHaveURL(/\/auth(?:\/|$)/)
            await expect(page.locator('#marketing-page-main')).toBeVisible()
            await expect(page.locator('html')).toHaveAttribute('lang', locale)
            await expect(page.getByRole('heading', { name: screenshot.requiredVisibleText, exact: true })).toBeVisible()
            await expect(page.getByRole('heading', { name: screenshot.forbiddenVisibleText, exact: true })).toHaveCount(0)

            const bodyText = await page.locator('body').innerText()
            expect(bodyText).not.toContain('[object Object]')
            expect(bodyText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)
            const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
            expect(scrollWidth).toBeLessThanOrEqual(viewportWidth)
            await localMedia.assertLoaded(page)
            await page.evaluate(() => window.scrollTo(0, 0))

            const outputPath = path.join(repoRoot, screenshot.path)
            await fs.mkdir(path.dirname(outputPath), { recursive: true })
            const screenshotBytes = await page.screenshot({
                path: outputPath,
                fullPage: manifest.fullPage,
                animations: 'disabled',
                caret: 'hide'
            })
            const dimensions = readPngDimensions(screenshotBytes)
            expect(dimensions.width).toBe(manifest.viewport.width)
            expect(dimensions.height).toBeGreaterThanOrEqual(manifest.viewport.height)
            const route = normalizeRoute(page.url(), locale)
            expect(route).toBe(manifest.routePattern)

            captures.push({
                id: screenshot.id,
                locale,
                route,
                scope: manifest.scope,
                browser: manifest.browser,
                theme: manifest.theme,
                captureMethod: 'playwright.page.screenshot',
                viewport: manifest.viewport,
                path: screenshot.path,
                sha256: sha256(screenshotBytes),
                dimensions
            })
        }

        await writeScreenshotProvenance(captures)
    } finally {
        if (browserContext) await browserContext.close()
        await disposeApiContext(api)
    }
})
