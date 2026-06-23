import type { Page } from '@playwright/test'
import { test, expect } from '../../fixtures/test'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getAssignableRoles,
    listPlayCanvasProjects,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { expectLocalizedValidation, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { importMmoommAppSnapshotThroughUi } from '../../support/mmoommAppSnapshotImport'
import {
    expectImportedMmoommSceneThroughFullscreenEditor,
    expectImportedMmoommVisualLinkupLabThroughFullscreenEditor,
    MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME
} from '../../support/mmoommPlaycanvasEditorAuthoring'
import {
    expectMmoommAuthenticatedNonMemberMatchmakeRejected,
    expectMmoommConnectedRuntimeLocale,
    expectMmoommRuntimeReady,
    expectMmoommVisualLinkupLabRuntimeReady,
    expectMmoommSecondClientAndReconnect,
    expectMmoommUnauthenticatedMatchmakeRejected,
    expectMmoommUnauthorizedRuntime
} from '../../support/mmoommRuntimeProof'

type LoggedInApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const APP_RUNTIME_TIMEOUT = 180_000
type BrowserRegressionIssue = {
    source: 'console' | 'pageerror' | 'requestfailed' | 'response'
    text: string
    url?: string
    status?: number
}

const isIgnoredBrowserRegressionIssue = (issue: BrowserRegressionIssue) => {
    if (issue.source === 'requestfailed' && issue.text === 'net::ERR_ABORTED') {
        return true
    }
    return (
        issue.source === 'console' &&
        ((issue.text.includes('WebSocket connection to') && issue.text.includes('net::ERR_INTERNET_DISCONNECTED')) ||
            issue.text === 'Permissions policy violation: xr-spatial-tracking is not allowed in this document.')
    )
}

const isWatchedPlayCanvasEditorResponse = (url: string): boolean =>
    /\/resources\/packages\/playcanvas-editor\/editor\/fullscreen(?:\?|$)/.test(url) ||
    /\/playcanvas\/editor-(?:compatible|bridge)\//.test(url) ||
    /\/playcanvas-editor\/editor-artifact-token\//.test(url)

const watchBrowserRegressionIssues = (page: Page) => {
    const issues: BrowserRegressionIssue[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            const issue = { source: 'console' as const, text: message.text() }
            if (!isIgnoredBrowserRegressionIssue(issue)) {
                issues.push(issue)
            }
        }
    })
    page.on('pageerror', (error) => {
        const issue = { source: 'pageerror' as const, text: error.message }
        if (!isIgnoredBrowserRegressionIssue(issue)) {
            issues.push(issue)
        }
    })
    page.on('requestfailed', (request) => {
        const issue = {
            source: 'requestfailed',
            text: request.failure()?.errorText ?? 'Request failed',
            url: request.url()
        } as const
        if (!isIgnoredBrowserRegressionIssue(issue)) {
            issues.push(issue)
        }
    })
    page.on('response', (response) => {
        const status = response.status()
        const url = response.url()
        if (isWatchedPlayCanvasEditorResponse(url) && (status === 401 || status === 403 || status >= 500)) {
            issues.push({
                source: 'response',
                text: `${status} ${response.statusText()}`,
                url,
                status
            })
        }
    })
    return issues
}

const resolveGlobalRoleIds = (roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) => {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)
    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }
    return roleIds
}

test.describe('MMOOMM PlayCanvas Editor snapshot import runtime', () => {
    let api: LoggedInApiContext | null = null

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
            api = null
        }
    })

    test('@flow @slow imported MMOOMM app snapshot exposes PlayCanvas Editor authored runtime', async ({
        browser,
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(600_000)
        const browserRegressionIssues = watchBrowserRegressionIssues(page)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const imported = await importMmoommAppSnapshotThroughUi(page)
        await recordCreatedMetahub({
            id: imported.metahubId,
            name: imported.metahubName,
            codename: 'UniversoMmoomm'
        })
        await recordCreatedPublication({
            id: imported.publicationId,
            metahubId: imported.metahubId,
            schemaName: null
        })

        await page.goto(`/metahub/${imported.metahubId}/resources`)
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Editor/ })).toBeVisible()
        await expect(page.getByTestId('metahub-packages-tab').getByRole('row', { name: /PlayCanvas Engine/ })).toBeVisible()
        await expect(page.getByTestId('metahub-packages-tab').getByRole('row', { name: /Colyseus Client/ })).toBeVisible()
        await expect(page.getByTestId('metahub-packages-tab').getByRole('row', { name: /Colyseus Server/ })).toBeVisible()
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Imported MMOOMM resources packages table',
            checkUuidSubstrings: true
        })
        await expectLocalizedValidation(page.getByTestId('metahub-packages-tab'), 'en', {
            label: 'Imported MMOOMM resources packages table'
        })
        await expectNoPageHorizontalOverflow(page, 'Imported MMOOMM resources packages table')

        const projectsPayload = (await listPlayCanvasProjects(api, imported.metahubId)) as {
            items?: Array<{ id?: string; displayName?: unknown }>
        }
        const importedAuthoringProject = projectsPayload.items?.find((item) =>
            JSON.stringify(item.displayName ?? {})
                .toLowerCase()
                .includes('mmoomm authoring')
        )
        const importedVisualLabProject = projectsPayload.items?.find((item) =>
            JSON.stringify(item.displayName ?? {})
                .toLowerCase()
                .includes(MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME.toLowerCase())
        )
        expect(importedAuthoringProject?.id).toEqual(expect.any(String))
        expect(importedVisualLabProject?.id).toEqual(expect.any(String))
        await expectImportedMmoommSceneThroughFullscreenEditor(page, imported.metahubId, testInfo, {
            projectId: importedAuthoringProject?.id ?? undefined,
            label: 'Imported MMOOMM Authoring fullscreen PlayCanvas Editor'
        })
        await expectImportedMmoommVisualLinkupLabThroughFullscreenEditor(
            page,
            imported.metahubId,
            importedVisualLabProject?.id ?? '',
            testInfo
        )
        expect(
            browserRegressionIssues,
            `Imported MMOOMM Editor browser regression issues: ${JSON.stringify(browserRegressionIssues)}`
        ).toEqual([])
        browserRegressionIssues.length = 0
        await page.goto('about:blank')

        const applicationName = `MMOOMM App Runtime ${runManifest.runId}`
        const linked = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })
        const applicationId = linked?.application?.id ?? linked?.id
        const applicationSlug = linked?.application?.slug ?? linked?.slug
        if (typeof applicationId !== 'string') {
            throw new Error('MMOOMM app snapshot linked application did not return an application id')
        }
        await recordCreatedApplication({ id: applicationId, slug: applicationSlug })

        await syncApplicationSchema(api, applicationId)
        await expect
            .poll(
                async () => {
                    const persisted = await getApplication(api as LoggedInApiContext, applicationId)
                    return persisted?.schemaStatus ?? null
                },
                { timeout: APP_RUNTIME_TIMEOUT }
            )
            .toBe('synced')

        const bootstrapApi = await createBootstrapApiContext()
        let secondClientCredentials: { email: string; password: string } | null = null
        try {
            const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const memberEmail = `e2e+${runManifest.runId}.mmoomm-non-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
            const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
                .split(',')
                .map((entry) => entry.trim())
                .filter(Boolean)
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const roleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)
            const createdUser = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds,
                comment: `Created for MMOOMM non-member realtime coverage ${runManifest.runId}`
            })
            await recordCreatedGlobalUser({ userId: createdUser.userId, email: createdUser.email ?? memberEmail })
            secondClientCredentials = { email: createdUser.email ?? memberEmail, password: memberPassword }
            await expectMmoommAuthenticatedNonMemberMatchmakeRejected(secondClientCredentials, applicationId)
            await addApplicationMember(api, applicationId, {
                email: secondClientCredentials.email,
                role: 'admin'
            })
        } finally {
            await disposeBootstrapApiContext(bootstrapApi)
        }
        if (!secondClientCredentials) {
            throw new Error('MMOOMM runtime second client credentials were not created')
        }

        await expectMmoommUnauthenticatedMatchmakeRejected(applicationId)
        await expectMmoommUnauthorizedRuntime(
            browser,
            {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            },
            applicationId
        )
        await expectMmoommUnauthorizedRuntime(
            browser,
            {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            },
            applicationId,
            { locale: 'ru' }
        )
        await expectMmoommConnectedRuntimeLocale(
            browser,
            {
                email: runManifest.testUser.email,
                password: runManifest.testUser.password
            },
            applicationId,
            'ru'
        )
        await expectMmoommRuntimeReady(page, applicationId, {
            label: 'MMOOMM app snapshot runtime widget',
            checkViewportMatrix: true
        })
        await expectMmoommVisualLinkupLabRuntimeReady(page, applicationId, {
            label: 'MMOOMM Visual Linkup Lab runtime widget',
            checkViewportMatrix: true
        })
        const primaryRuntime = await expectMmoommRuntimeReady(page, applicationId, {
            label: 'MMOOMM app snapshot runtime widget after Visual Linkup Lab proof'
        })
        await expectMmoommSecondClientAndReconnect(
            browser,
            secondClientCredentials,
            page,
            primaryRuntime.canvas,
            primaryRuntime.widget,
            applicationId
        )
        expect(browserRegressionIssues, `Imported MMOOMM browser regression issues: ${JSON.stringify(browserRegressionIssues)}`).toEqual([])
    })
})
