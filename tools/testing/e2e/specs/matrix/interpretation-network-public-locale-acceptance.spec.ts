import { test, expect } from '../../fixtures/test'
import { createLocalizedContent } from '@universo-react/utils'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    listApplicationWorkspaces,
    sendWithCsrf,
    setApplicationPublicEntryWorkspace
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    expectPublicDashboardShell,
    expectPublicInterpretationNetworkWorkspace,
    expectPublicMatrixReadOnly
} from '../flows/interpretation-network-public-runtime.helpers'
import {
    createMaterialForCell,
    ensureSystemStructure,
    findMatrixRowByTitle,
    getMatrixRows,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig
} from '../../support/interpretationNetworkFocused'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu
const OPAQUE_RUNTIME_HANDLE_PATTERN = /(?:rh1|pn1)\.[A-Za-z0-9_-]{20,1020}/u

const localizedUi = {
    en: {
        applicationNavigation: 'Application navigation',
        row: 'Row',
        column: 'Column',
        cell: 'Cell',
        materials: 'Materials',
        primaryMaterial: 'Primary Material',
        backToMaterials: 'Back to materials'
    },
    ru: {
        applicationNavigation: 'Навигация приложения',
        row: 'Строка',
        column: 'Столбец',
        cell: 'Ячейка',
        materials: 'Материалы',
        primaryMaterial: 'Основной материал',
        backToMaterials: 'К материалам'
    }
} as const

test('@matrix Interpretation Network locale acceptance proves public anonymous read-only behavior', async ({
    browser,
    runManifest
}, testInfo) => {
    test.skip(
        !['en-light', 'ru-light'].includes(testInfo.project.name),
        'Public locale acceptance runs only in en-light and ru-light projects'
    )
    test.setTimeout(180_000)

    const locale = testInfo.project.name === 'ru-light' ? 'ru' : 'en'
    const browserLocale = locale === 'ru' ? 'ru-RU' : 'en-US'
    const labels = localizedUi[locale]
    const api = await createLoggedInApiContext(runManifest.testUser)
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
    let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | null = null
    let aliasId: string | null = null
    let cleanupFailure: unknown = null

    try {
        const imported = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: `public-locale-${locale}-${runManifest.runId}`,
            isPublic: true
        })
        await recordCreatedMetahub({
            id: imported.metahub.id,
            name: `Interpretation Network public locale acceptance (${locale})`,
            codename: `interpretation-network-public-locale-${locale}-${runManifest.runId}`
        })
        await recordCreatedPublication({ id: imported.publication.id, metahubId: imported.metahub.id })
        await recordCreatedApplication({ id: imported.applicationId })

        await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })

        const workspaceList = await listApplicationWorkspaces(api, imported.applicationId)
        const sharedWorkspace = (workspaceList?.items ?? []).find(
            (workspace: Record<string, unknown>) => workspace?.workspaceType !== 'personal' && !workspace?.personalUserId
        )
        const publicEntryWorkspaceId =
            (sharedWorkspace as { id?: string } | undefined)?.id ??
            (
                await createApplicationWorkspace(api, imported.applicationId, {
                    name: createLocalizedContent('en', 'Interpretation Network public entry'),
                    description: createLocalizedContent('en', 'Workspace used for anonymous public locale acceptance')
                })
            )?.id
        if (typeof publicEntryWorkspaceId !== 'string') {
            throw new Error('The public Interpretation Network locale acceptance could not prepare an entry workspace')
        }
        await setApplicationPublicEntryWorkspace(api, imported.applicationId, publicEntryWorkspaceId)
        const system = await ensureSystemStructure(api, imported.applicationId, publicEntryWorkspaceId)
        const runtimeIds = {
            ...(await resolveRuntimeIds(api, imported.applicationId)),
            workspaceId: publicEntryWorkspaceId
        }
        const rootCell = findMatrixRowByTitle(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Universe'
        )
        const createdMaterial = await createMaterialForCell(api, imported.applicationId, runtimeIds, {
            interpretationId: system.interpretationId,
            cellId: rootCell.cellId,
            title: 'Locale acceptance material',
            description: 'A public material used to verify the anonymous detail view.',
            body: {
                format: 'editorjs',
                data: {
                    time: 0,
                    version: '2.30.8',
                    blocks: [
                        {
                            id: 'locale-acceptance-paragraph',
                            type: 'paragraph',
                            data: { text: 'Public material detail is available without an account.' }
                        }
                    ]
                }
            }
        })
        const rootCellWithMaterial = findMatrixRowByTitle(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Universe'
        )
        const cellVersionBeforePrimaryWrite = rootCellWithMaterial.row._upl_version
        expect(cellVersionBeforePrimaryWrite, 'The root cell exposes its current aggregate version').toEqual(expect.any(Number))
        const primaryMaterialResponse = await sendWithCsrf(
            api,
            'PUT',
            `/api/v1/applications/${
                imported.applicationId
            }/runtime/interpretation-network/materials/primary?workspaceId=${encodeURIComponent(publicEntryWorkspaceId)}`,
            {
                interpretationId: system.interpretationId,
                cellId: rootCell.cellId,
                materialId: createdMaterial.id,
                expectedCellVersion: cellVersionBeforePrimaryWrite
            }
        )
        expect(primaryMaterialResponse.status, 'The public acceptance material is marked primary before publication').toBe(200)
        const cellAfterPrimaryWrite = findMatrixRowByTitle(
            await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
            'Universe'
        ).row
        const expectedCellVersion = cellAfterPrimaryWrite._upl_version
        expect(expectedCellVersion, 'The primary-material write advances the cell to its current aggregate version').toBeGreaterThan(
            cellVersionBeforePrimaryWrite
        )

        bootstrapApi = await createBootstrapApiContext()
        const aliasToken = runManifest.runId
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
            .slice(-36)
        const alias = `network-${locale}-${aliasToken || 'playwright'}`
        const aliasResponse = await sendWithCsrf(bootstrapApi, 'POST', '/api/v1/application-aliases', {
            applicationId: imported.applicationId,
            alias,
            makePrimary: true
        })
        if (!aliasResponse.ok) {
            throw new Error(`Creating the public Interpretation Network locale alias failed with ${aliasResponse.status}`)
        }
        const aliasBody = (await aliasResponse.json()) as { id?: unknown }
        aliasId = typeof aliasBody.id === 'string' ? aliasBody.id : null
        if (!aliasId) throw new Error('Creating the public Interpretation Network locale alias did not return its identifier')

        const baseURL = testInfo.project.use.baseURL
        if (typeof baseURL !== 'string') throw new Error('The locale acceptance project must define the E2E base URL')
        anonymousContext = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
            locale: browserLocale,
            viewport: { width: 1280, height: 900 },
            colorScheme: 'light'
        })
        expect(await anonymousContext.cookies(), 'The public runtime starts with no authenticated browser cookies').toEqual([])
        const page = await anonymousContext.newPage()
        const runtimeApiFailures: string[] = []
        page.on('response', (response) => {
            const url = new URL(response.url())
            const runtimePath = `/api/v1/applications/${imported.applicationId}/runtime`
            if ((url.pathname === runtimePath || url.pathname.startsWith(`${runtimePath}/`)) && response.status() >= 500) {
                runtimeApiFailures.push(`${response.status()} ${url.pathname}`)
            }
        })
        const main = page.getByRole('main')

        const dashboardResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return response.request().method() === 'GET' && /^\/api\/v1\/public\/applications\/[^/]+\/runtime$/u.test(url.pathname)
        })
        const publicStructuresResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname.includes('/runtime/widgets/') &&
                url.pathname.endsWith('/interpretation-network') &&
                url.searchParams.get('view') === 'structures' &&
                url.searchParams.get('locale') === locale
            )
        })
        await page.goto(`/a/${alias}?targetKind=object&entityTypeCodename=Structure&locale=${locale}`, {
            waitUntil: 'domcontentloaded'
        })
        const dashboardResponse = await dashboardResponsePromise
        expect(dashboardResponse.status(), 'Anonymous public dashboard data is available').toBe(200)
        const dashboardPayload = (await page.evaluate(async (url: string) => {
            const response = await fetch(url, { cache: 'no-store', credentials: 'omit' })
            if (!response.ok) throw new Error(`Anonymous dashboard fetch failed with HTTP ${response.status}`)
            return response.json()
        }, dashboardResponse.url())) as { templateKey?: string; route?: Record<string, unknown> }
        expect(dashboardPayload.templateKey).toBe('dashboard')
        expect(dashboardPayload.route).not.toHaveProperty('applicationId')

        const structuresResponse = await publicStructuresResponsePromise
        expect(structuresResponse.status(), 'Anonymous Interpretation Network read endpoint succeeds').toBe(200)
        const structuresPayload = await page.evaluate(async (url: string) => {
            const response = await fetch(url, { cache: 'no-store', credentials: 'omit' })
            if (!response.ok) throw new Error(`Anonymous structures fetch failed with HTTP ${response.status}`)
            return response.json()
        }, structuresResponse.url())
        expect(structuresPayload).toMatchObject({ view: 'structures', locale })
        expect(structuresPayload.items).toHaveLength(1)
        const applicationNavigation = page.getByRole('navigation', { name: labels.applicationNavigation, exact: true })
        await expect(applicationNavigation).toBeVisible()
        await expect(applicationNavigation.getByRole('link').first(), 'Public application navigation remains available').toBeVisible()
        await expect(main, 'The public locale viewer uses the semantic main landmark').toBeVisible()
        await expectPublicInterpretationNetworkWorkspace(page)
        await expect(main.getByTestId('interpretation-network-matrix-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(main.getByTestId('interpretation-network-structure-table')).toHaveCount(0)
        await expect(main.getByRole('list')).toHaveCount(0)

        const expectReadOnlySurface = async (label: string) => {
            await expect(page.getByTestId('runtime-workspace-switcher'), `${label} has no workspace editor`).toHaveCount(0)
            await expectPublicDashboardShell(page)
            await expectNoTechnicalLeakage(page.locator('body'), {
                label,
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            const accessibilityTree = await page.locator('body').ariaSnapshot()
            expect(accessibilityTree, `${label} accessible tree contains no raw UUID`).not.toMatch(UUID_PATTERN)
            expect(accessibilityTree, `${label} accessible tree contains no opaque runtime handle`).not.toMatch(
                OPAQUE_RUNTIME_HANDLE_PATTERN
            )
        }

        const matrix = main.getByTestId('interpretation-network-matrix-workspace')
        await test.step('Open the configured single-system Matrix directly', async () => {
            await expect(matrix).toBeVisible({ timeout: 30_000 })
            const rootCellButton = matrix.getByRole('button', { name: /,\s*Universe$/u })
            await expect(rootCellButton, 'The system Matrix exposes an interactive cell for read-only inspection').toBeVisible()
            await expect(rootCellButton).toHaveAttribute('aria-pressed', 'true')
            await expectPublicMatrixReadOnly(page, matrix)
            await expectReadOnlySurface(`Anonymous ${locale.toUpperCase()} matrix`)
        })

        await test.step('Inspect the matrix at desktop, tablet, and mobile sizes', async () => {
            for (const viewport of [
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await expect(matrix).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Anonymous ${locale.toUpperCase()} matrix at ${viewport.width}px`)
                await testInfo.attach(`interpretation-network-public-${locale}-matrix-${viewport.name}`, {
                    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                    contentType: 'image/png'
                })
            }
            await page.setViewportSize({ width: 1280, height: 900 })
            await page.screenshot({
                path: testInfo.outputPath(`interpretation-network-public-${locale}-matrix.png`),
                fullPage: true,
                animations: 'disabled'
            })
        })

        await test.step('Open the primary material and return to its list', async () => {
            await expect(main.getByRole('heading', { name: 'Locale acceptance material', exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(main.getByText(labels.primaryMaterial, { exact: true })).toBeVisible()
            await expect(main.getByRole('button', { name: labels.backToMaterials, exact: true })).toBeVisible()
            await expect(main.getByText('Public material detail is available without an account.', { exact: true })).toBeVisible()
            await expectReadOnlySurface(`Anonymous ${locale.toUpperCase()} material detail`)
            for (const viewport of [
                { name: 'wide-desktop', width: 1920, height: 1080 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await expect(main.getByRole('heading', { name: 'Locale acceptance material', exact: true })).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Anonymous ${locale.toUpperCase()} material detail at ${viewport.width}px`)
                await testInfo.attach(`interpretation-network-public-${locale}-material-${viewport.name}`, {
                    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                    contentType: 'image/png'
                })
            }
            await page.setViewportSize({ width: 1280, height: 900 })
            await page.screenshot({
                path: testInfo.outputPath(`interpretation-network-public-${locale}-material-detail.png`),
                fullPage: true,
                animations: 'disabled'
            })

            const backToMaterials = main.getByRole('button', { name: labels.backToMaterials, exact: true })
            await backToMaterials.focus()
            await expect(backToMaterials).toBeFocused()
            await page.keyboard.press('Enter')
            await expect(main.getByRole('heading', { name: labels.materials, exact: true })).toBeVisible()
            await expect(main.getByText('Locale acceptance material', { exact: true })).toBeVisible()
            await expectReadOnlySurface(`Anonymous ${locale.toUpperCase()} materials list`)
        })

        await test.step('Reject an anonymous material mutation', async () => {
            const persistedCellBeforeDeniedMutation = findMatrixRowByTitle(
                await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
                'Universe'
            ).row
            expect(persistedCellBeforeDeniedMutation._upl_version).toBe(expectedCellVersion)
            await anonymousContext.clearCookies()
            expect(await anonymousContext.cookies(), 'The direct write probe also has no cookies').toEqual([])
            const mutationResponse = await anonymousContext.request.put(
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/materials/primary?workspaceId=${encodeURIComponent(publicEntryWorkspaceId)}`,
                {
                    data: {
                        interpretationId: system.interpretationId,
                        cellId: rootCell.cellId,
                        materialId: createdMaterial.id,
                        expectedCellVersion
                    }
                }
            )
            expect([401, 403, 419], 'An anonymous request cannot mutate Interpretation Network material settings').toContain(
                mutationResponse.status()
            )
            const persistedCellAfterDeniedMutation = findMatrixRowByTitle(
                await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
                'Universe'
            ).row
            expect(persistedCellAfterDeniedMutation).toEqual(persistedCellBeforeDeniedMutation)
        })

        expect(runtimeApiFailures, 'The public runtime flow must not produce failed application runtime responses').toEqual([])
    } finally {
        try {
            if (anonymousContext) await anonymousContext.close()
            if (bootstrapApi && aliasId) {
                const releaseResponse = await sendWithCsrf(bootstrapApi, 'DELETE', `/api/v1/application-aliases/${aliasId}`)
                if (!releaseResponse.ok && releaseResponse.status !== 404) {
                    cleanupFailure = new Error(`Releasing the temporary public alias failed with ${releaseResponse.status}`)
                }
            }
        } catch (error) {
            cleanupFailure = error
        } finally {
            try {
                if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            } catch (error) {
                cleanupFailure ??= error
            } finally {
                try {
                    await disposeApiContext(api)
                } catch (error) {
                    cleanupFailure ??= error
                }
            }
        }
    }

    if (cleanupFailure) throw cleanupFailure
})
