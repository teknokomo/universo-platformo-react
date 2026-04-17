import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getAdminDashboardStats,
    getApplication,
    getInstanceStats,
    getMetahubBoardSummary,
    listConnectors,
    listInstances,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { loadE2eEnvironment } from '../../support/env/load-e2e-env.mjs'
import { buildStatCardSelector } from '../../support/selectors/contracts'

type AdminDashboardStats = {
    totalGlobalUsers?: number
    totalRoles?: number
    totalApplications?: number
    totalMetahubs?: number
}

type ApplicationSummary = {
    id?: string
    name?: unknown
    connectorsCount?: number
    membersCount?: number
}

type MetahubBoardSummary = {
    metahubId?: string
    branchesCount?: number
    entityCounts?: Record<string, number>
    membersCount?: number
    publicationsCount?: number
    publicationVersionsCount?: number
    applicationsCount?: number
}

type ConnectorListResponse = {
    items?: Array<{ id?: string }>
}

type InstanceSummary = {
    id?: string
    is_local?: boolean
    status?: string
}

type InstanceStats = {
    available?: boolean
    totalUsers?: number
    globalAccessUsers?: number
    totalRoles?: number
    message?: string
}

function extractLocalizedText(value: unknown): string | null {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return null
    }

    const primaryLocale = '_primary' in value && typeof value._primary === 'string' ? value._primary : null
    const locales = 'locales' in value && value.locales && typeof value.locales === 'object' ? value.locales : null
    const primaryEntry =
        primaryLocale && locales && primaryLocale in locales && locales[primaryLocale] && typeof locales[primaryLocale] === 'object'
            ? locales[primaryLocale]
            : null

    return primaryEntry && 'content' in primaryEntry && typeof primaryEntry.content === 'string' ? primaryEntry.content : null
}

async function waitForApplicationBoardData(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, applicationId: string) {
    let application: ApplicationSummary | null = null

    await expect
        .poll(async () => {
            const connectors = (await listConnectors(api, applicationId)) as ConnectorListResponse
            application = (await getApplication(api, applicationId)) as ApplicationSummary
            return {
                connectorCount: connectors.items?.length ?? 0,
                applicationConnectorsCount: application?.connectorsCount ?? 0,
                applicationMembersCount: application?.membersCount ?? 0
            }
        })
        .toMatchObject({
            connectorCount: 1,
            applicationConnectorsCount: 1,
            applicationMembersCount: 1
        })

    if (!application?.id) {
        throw new Error(`Application ${applicationId} did not become ready for board coverage`)
    }

    return application
}

async function waitForMetahubBoardData(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let summary: MetahubBoardSummary | null = null

    await expect
        .poll(async () => {
            summary = (await getMetahubBoardSummary(api, metahubId)) as MetahubBoardSummary
            return {
                hasPublication: (summary?.publicationsCount ?? 0) >= 1,
                hasPublicationVersion: (summary?.publicationVersionsCount ?? 0) >= 1,
                hasApplication: (summary?.applicationsCount ?? 0) >= 1
            }
        })
        .toMatchObject({
            hasPublication: true,
            hasPublicationVersion: true,
            hasApplication: true
        })

    if (summary?.metahubId !== metahubId) {
        throw new Error(`Metahub board summary did not resolve for ${metahubId}`)
    }

    return summary
}

async function waitForAdminDashboardStats(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    expectedMinimums: Pick<Required<AdminDashboardStats>, 'totalApplications' | 'totalMetahubs'>
) {
    let stats: AdminDashboardStats | null = null

    await expect
        .poll(async () => {
            stats = (await getAdminDashboardStats(api)) as AdminDashboardStats
            return {
                totalApplications: stats?.totalApplications ?? 0,
                totalMetahubs: stats?.totalMetahubs ?? 0
            }
        })
        .toMatchObject(expectedMinimums)

    return stats ?? {}
}

async function expectStatCardValue(page: import('@playwright/test').Page, testId: string, value: number) {
    const card = page.getByTestId(testId)
    await expect(card).toBeVisible()
    await expect(card.getByText(String(value), { exact: true })).toBeVisible()
}

test('@flow board routes show backend-backed overview counters for metahub, application, admin, and instance surfaces', async ({
    page,
    browser,
    runManifest
}) => {
    test.setTimeout(300_000)

    loadE2eEnvironment()
    const userApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const adminApi = await createLoggedInApiContext({
        email: process.env.BOOTSTRAP_SUPERUSER_EMAIL || '',
        password: process.env.BOOTSTRAP_SUPERUSER_PASSWORD || ''
    })

    const adminStatsBefore = (await getAdminDashboardStats(adminApi)) as AdminDashboardStats
    const metahubName = `E2E ${runManifest.runId} board metahub`
    const metahubCodename = `${runManifest.runId}-board-metahub`
    const publicationName = `E2E ${runManifest.runId} board publication`
    const applicationName = `E2E ${runManifest.runId} board application`

    let adminContext: import('@playwright/test').BrowserContext | null = null

    try {
        const metahub = await createMetahub(userApi, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for board coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const publication = await createPublication(userApi, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for board coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(userApi, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} board version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(userApi, metahub.id, publication.id)
        await waitForPublicationReady(userApi, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(userApi, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for board coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(userApi, applicationId)

        const [metahubSummary, applicationSummary, adminStatsAfter, instances] = await Promise.all([
            waitForMetahubBoardData(userApi, metahub.id),
            waitForApplicationBoardData(userApi, applicationId),
            waitForAdminDashboardStats(adminApi, {
                totalApplications: (adminStatsBefore.totalApplications ?? 0) + 1,
                totalMetahubs: (adminStatsBefore.totalMetahubs ?? 0) + 1
            }),
            listInstances(adminApi)
        ])

        const targetInstance = ((instances as InstanceSummary[]).find((instance) => instance.is_local) ??
            (instances as InstanceSummary[]).find((instance) => instance.status === 'active') ??
            (instances as InstanceSummary[])[0]) as InstanceSummary | undefined

        if (!targetInstance?.id) {
            throw new Error('No admin instance was available for board coverage')
        }

        const instanceStats = (await getInstanceStats(adminApi, targetInstance.id)) as InstanceStats

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByRole('heading', { name: metahubName })).toBeVisible()
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'branches'), metahubSummary.branchesCount ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'applications'), metahubSummary.applicationsCount ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'members'), metahubSummary.membersCount ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'hubs'), metahubSummary.entityCounts?.hub ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'catalogs'), metahubSummary.entityCounts?.catalog ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'publications'), metahubSummary.publicationsCount ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('metahub-board', 'versions'), metahubSummary.publicationVersionsCount ?? 0)

        await page.goto(`/a/${applicationId}/admin`)
        await expect(page.getByRole('heading', { name: applicationName })).toBeVisible()
        await expectStatCardValue(page, buildStatCardSelector('application-board', 'connectors'), applicationSummary.connectorsCount ?? 0)
        await expectStatCardValue(page, buildStatCardSelector('application-board', 'migrations'), 0)
        await expectStatCardValue(page, buildStatCardSelector('application-board', 'members'), applicationSummary.membersCount ?? 0)

        const adminBrowser = await createLoggedInBrowserContext(browser, {
            email: process.env.BOOTSTRAP_SUPERUSER_EMAIL || '',
            password: process.env.BOOTSTRAP_SUPERUSER_PASSWORD || ''
        })
        adminContext = adminBrowser.context

        await adminBrowser.page.goto('/admin/board')
        await expectStatCardValue(
            adminBrowser.page,
            buildStatCardSelector('admin-board', 'total-users'),
            adminStatsAfter.totalGlobalUsers ?? 0
        )
        await expectStatCardValue(adminBrowser.page, buildStatCardSelector('admin-board', 'roles'), adminStatsAfter.totalRoles ?? 0)
        await expectStatCardValue(
            adminBrowser.page,
            buildStatCardSelector('admin-board', 'applications'),
            adminStatsAfter.totalApplications ?? 0
        )
        await expectStatCardValue(adminBrowser.page, buildStatCardSelector('admin-board', 'metahubs'), adminStatsAfter.totalMetahubs ?? 0)

        await adminBrowser.page.goto(`/admin/instance/${targetInstance.id}/board`)
        await expect(adminBrowser.page.getByRole('heading', { level: 1 })).toBeVisible()

        if (instanceStats.available === false) {
            await expect(adminBrowser.page.getByRole('alert')).toContainText(instanceStats.message || 'Statistics not available')
        }

        await expectStatCardValue(
            adminBrowser.page,
            buildStatCardSelector('instance-board', 'total-users'),
            instanceStats.available ? instanceStats.totalUsers ?? 0 : 0
        )
        await expectStatCardValue(
            adminBrowser.page,
            buildStatCardSelector('instance-board', 'superusers'),
            instanceStats.available ? instanceStats.globalAccessUsers ?? 0 : 0
        )
        await expectStatCardValue(adminBrowser.page, buildStatCardSelector('instance-board', 'roles'), instanceStats.totalRoles ?? 0)

        expect(extractLocalizedText(applicationSummary.name)).toBe(applicationName)
    } finally {
        if (adminContext) {
            await adminContext.close()
        }

        await disposeApiContext(adminApi)
        await disposeApiContext(userApi)
    }
})
