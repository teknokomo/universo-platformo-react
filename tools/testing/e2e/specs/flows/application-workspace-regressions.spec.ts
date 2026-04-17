import type { Page } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    addApplicationMember,
    createAdminUser,
    createApplication,
    createLoggedInApiContext,
    createMetahub,
    createFieldDefinition,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    getAssignableRoles,
    listApplicationMembers,
    listLinkedCollections,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { applicationSelectors, entityDialogSelectors } from '../../support/selectors/contracts'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'

type ListedMember = {
    id: string
    userId: string
}

type RuntimeState = {
    catalog?: {
        id?: string
    }
    rows?: Array<Record<string, unknown> & { id?: string }>
}

function resolveGlobalRoleIds(roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }

    return roleIds
}

function getListedMembers(payload: { items?: ListedMember[]; members?: ListedMember[] } | null | undefined): ListedMember[] {
    if (Array.isArray(payload?.items)) {
        return payload.items
    }

    if (Array.isArray(payload?.members)) {
        return payload.members
    }

    return []
}

async function waitForBrowserLoginReadiness(credentials: { email: string; password: string }) {
    await expect
        .poll(async () => {
            try {
                const api = await createLoggedInApiContext(credentials)
                await disposeApiContext(api)
                return true
            } catch {
                return false
            }
        })
        .toBe(true)
}

async function waitForCatalogId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let catalogId: string | undefined

    await expect
        .poll(async () => {
            const payload = await listLinkedCollections(api, metahubId, { limit: 100, offset: 0 })
            catalogId = payload.items?.[0]?.id
            return typeof catalogId === 'string'
        })
        .toBe(true)

    if (!catalogId) {
        throw new Error(`Metahub ${metahubId} did not expose a default catalog`)
    }

    return catalogId
}

async function waitForRuntimeRows(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    catalogId: string,
    expectedCount: number
) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId })) as RuntimeState
            return runtimeState.rows?.length ?? 0
        })
        .toBe(expectedCount)

    return runtimeState
}

async function waitForRuntimeCatalogId(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    fallbackCatalogId: string
) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { catalogId: fallbackCatalogId })) as RuntimeState
            return typeof runtimeState?.catalog?.id === 'string'
        })
        .toBe(true)

    return runtimeState?.catalog?.id ?? fallbackCatalogId
}

async function createRuntimeRowViaBrowser(page: Page, value: string) {
    await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeEnabled({ timeout: 30_000 })
    await page.getByTestId(applicationSelectors.runtimeCreateButton).click()

    const createDialog = page.getByRole('dialog', { name: 'Create element' })
    await expect(createDialog).toBeVisible()
    await createDialog.getByLabel('Title').first().fill(value)
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(page.getByText(value, { exact: true })).toBeVisible()
}

test('@flow application settings show an info state before schema creation and workspace-enabled apps isolate runtime rows by user', async ({
    browser,
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.workspace-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    let memberApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const preSchemaApplication = await createApplication(ownerApi, {
            name: { en: `E2E ${runManifest.runId} No Schema App` },
            namePrimaryLocale: 'en',
            workspacesEnabled: true,
            isPublic: false
        })

        if (!preSchemaApplication?.id) {
            throw new Error('Application creation did not return an id for pre-schema settings coverage')
        }

        await recordCreatedApplication({
            id: preSchemaApplication.id,
            slug: preSchemaApplication.slug
        })

        await page.goto(`/a/${preSchemaApplication.id}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible()
        await page.getByRole('tab', { name: 'Limits' }).click()
        await expect(page.getByText('Limits settings will become available after the application schema is created.')).toBeVisible()
        await expect(page.getByText('Failed to load limits')).toHaveCount(0)

        const metahub = await createMetahub(ownerApi, {
            name: { en: `E2E ${runManifest.runId} Workspace Metahub` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-workspace-metahub`)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for workspace isolation coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: `E2E ${runManifest.runId} Workspace Metahub`,
            codename: `${runManifest.runId}-workspace-metahub`
        })

        const catalogId = await waitForCatalogId(ownerApi, metahub.id)

        const attribute = await createFieldDefinition(ownerApi, metahub.id, catalogId, {
            name: { en: 'Title' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'title'),
            dataType: 'STRING',
            isRequired: false
        })

        if (!attribute?.id) {
            throw new Error('Attribute creation did not return an id for workspace isolation coverage')
        }

        const publication = await createPublication(ownerApi, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Workspace Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for workspace isolation coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(ownerApi, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Workspace Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(ownerApi, metahub.id, publication.id)
        await waitForPublicationReady(ownerApi, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(ownerApi, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Workspace App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: true
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Workspace-enabled linked application did not return an id')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(ownerApi, applicationId)

        const resolvedCatalogId = await waitForRuntimeCatalogId(ownerApi, applicationId, catalogId)

        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for workspace isolation coverage ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({ email: memberEmail, password: memberPassword })

        await addApplicationMember(ownerApi, applicationId, {
            email: memberEmail,
            role: 'member'
        })

        let memberRecord: ListedMember | null = null
        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, applicationId)
                memberRecord = getListedMembers(payload).find((member) => member.userId === createdUser.userId) ?? null
                return Boolean(memberRecord?.id)
            })
            .toBe(true)

        memberApi = await createLoggedInApiContext({
            email: memberEmail,
            password: memberPassword
        })
        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const ownerRowTitle = `Owner Row ${runManifest.runId}`
        const memberRowTitle = `Member Row ${runManifest.runId}`

        await page.goto(`/a/${applicationId}`)
        await createRuntimeRowViaBrowser(page, ownerRowTitle)
        await waitForRuntimeRows(ownerApi, applicationId, resolvedCatalogId, 1)

        await expect(page.getByText(ownerRowTitle, { exact: true })).toBeVisible()
        await expect(page.getByText(memberRowTitle, { exact: true })).toHaveCount(0)

        const memberPage = memberSession.page
        await memberPage.goto(`/a/${applicationId}`)
        await expect(memberPage.getByText(ownerRowTitle, { exact: true })).toHaveCount(0)

        await createRuntimeRowViaBrowser(memberPage, memberRowTitle)
        await waitForRuntimeRows(memberApi, applicationId, resolvedCatalogId, 1)

        await memberPage.reload()
        await expect(memberPage.getByText(memberRowTitle, { exact: true })).toBeVisible()
        await expect(memberPage.getByText(ownerRowTitle, { exact: true })).toHaveCount(0)

        await page.reload()
        await expect(page.getByText(ownerRowTitle, { exact: true })).toBeVisible()
        await expect(page.getByText(memberRowTitle, { exact: true })).toHaveCount(0)
    } finally {
        await memberSession?.context.close().catch(() => undefined)
        if (memberApi) {
            await disposeApiContext(memberApi)
        }
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})

test('@flow application without workspaces shares runtime rows between members', async ({ browser, page, runManifest }) => {
    test.setTimeout(300_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.shared-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

    let memberApi: Awaited<ReturnType<typeof createLoggedInApiContext>> | null = null
    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const metahub = await createMetahub(ownerApi, {
            name: { en: `E2E ${runManifest.runId} Shared Metahub` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', `${runManifest.runId}-shared-metahub`)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for shared-row coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: `E2E ${runManifest.runId} Shared Metahub`,
            codename: `${runManifest.runId}-shared-metahub`
        })

        const catalogId = await waitForCatalogId(ownerApi, metahub.id)
        const attribute = await createFieldDefinition(ownerApi, metahub.id, catalogId, {
            name: { en: 'Title' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'title'),
            dataType: 'STRING',
            isRequired: false
        })

        if (!attribute?.id) {
            throw new Error('Attribute creation did not return an id for shared-row coverage')
        }

        const publication = await createPublication(ownerApi, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Shared Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for shared-row coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(ownerApi, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(ownerApi, metahub.id, publication.id)
        await waitForPublicationReady(ownerApi, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(ownerApi, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Shared App` },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Non-workspace linked application did not return an id')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(ownerApi, applicationId)

        const resolvedCatalogId = await waitForRuntimeCatalogId(ownerApi, applicationId, catalogId)
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for shared-row coverage ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })
        await waitForBrowserLoginReadiness({ email: memberEmail, password: memberPassword })

        await addApplicationMember(ownerApi, applicationId, {
            email: memberEmail,
            role: 'member'
        })

        let memberRecord: ListedMember | null = null
        await expect
            .poll(async () => {
                const payload = await listApplicationMembers(ownerApi, applicationId)
                memberRecord = getListedMembers(payload).find((member) => member.userId === createdUser.userId) ?? null
                return Boolean(memberRecord?.id)
            })
            .toBe(true)

        memberApi = await createLoggedInApiContext({
            email: memberEmail,
            password: memberPassword
        })
        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const ownerRowTitle = `Shared Owner Row ${runManifest.runId}`
        const memberRowTitle = `Shared Member Row ${runManifest.runId}`

        await page.goto(`/a/${applicationId}`)
        await createRuntimeRowViaBrowser(page, ownerRowTitle)
        await waitForRuntimeRows(ownerApi, applicationId, resolvedCatalogId, 1)

        const memberPage = memberSession.page
        await memberPage.goto(`/a/${applicationId}`)
        await expect(memberPage.getByText(ownerRowTitle, { exact: true })).toBeVisible()
        await expect(memberPage.getByText(memberRowTitle, { exact: true })).toHaveCount(0)

        await createRuntimeRowViaBrowser(memberPage, memberRowTitle)
        await waitForRuntimeRows(memberApi, applicationId, resolvedCatalogId, 2)

        await memberPage.reload()
        await expect(memberPage.getByText(ownerRowTitle, { exact: true })).toBeVisible()
        await expect(memberPage.getByText(memberRowTitle, { exact: true })).toBeVisible()

        await page.reload()
        await expect(page.getByText(ownerRowTitle, { exact: true })).toBeVisible()
        await expect(page.getByText(memberRowTitle, { exact: true })).toBeVisible()
        await waitForRuntimeRows(ownerApi, applicationId, resolvedCatalogId, 2)
    } finally {
        await memberSession?.context.close().catch(() => undefined)
        if (memberApi) {
            await disposeApiContext(memberApi)
        }
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
