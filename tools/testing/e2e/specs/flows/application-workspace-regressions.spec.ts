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
    createComponent,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    getAssignableRoles,
    listApplicationMembers,
    listComponents,
    listObjectCollections,
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
    objectCollection?: {
        id?: string
    }
    rows?: Array<Record<string, unknown> & { id?: string }>
}

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const record = value as Record<string, unknown>
    const content = record.content
    if (content && typeof content === 'object') {
        const localized = (content as Record<string, unknown>)[locale]
        if (typeof localized === 'string') {
            return localized
        }
    }

    const localized = record[locale]
    return typeof localized === 'string' ? localized : undefined
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

async function waitForObjectId(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string) {
    let objectCollectionId: string | undefined

    await expect
        .poll(async () => {
            const payload = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
            objectCollectionId = payload.items?.[0]?.id
            return typeof objectCollectionId === 'string'
        })
        .toBe(true)

    if (!objectCollectionId) {
        throw new Error(`Metahub ${metahubId} did not expose a default objectCollection`)
    }

    return objectCollectionId
}

async function waitForRuntimeRows(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    applicationId: string,
    objectCollectionId: string,
    expectedCount: number
) {
    let runtimeState: RuntimeState | null = null

    await expect
        .poll(async () => {
            runtimeState = (await getApplicationRuntime(api, applicationId, { objectCollectionId })) as RuntimeState
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
            runtimeState = (await getApplicationRuntime(api, applicationId, { objectCollectionId: fallbackCatalogId })) as RuntimeState
            return typeof runtimeState?.objectCollection?.id === 'string'
        })
        .toBe(true)

    return runtimeState?.objectCollection?.id ?? fallbackCatalogId
}

async function ensureTitleComponent(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, metahubId: string, objectCollectionId: string) {
    const components = await listComponents(api, metahubId, objectCollectionId, { limit: 100, offset: 0, includeShared: true })
    const hasTitleField = (components.items ?? []).some(
        (item: { codename?: unknown; name?: unknown }) =>
            readLocalizedText(item.codename, 'en') === 'title' || readLocalizedText(item.name, 'en') === 'Title'
    )

    if (hasTitleField) {
        return { id: 'existing-title-field' }
    }

    try {
        return await createComponent(api, metahubId, objectCollectionId, {
            name: { en: 'Title' },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', 'title'),
            dataType: 'STRING',
            isRequired: false
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('Field definition with this codename already exists')) {
            return { id: 'existing-title-field' }
        }
        throw error
    }
}

async function createRuntimeRowViaBrowser(page: Page, value: string) {
    const createButton = page.getByTestId(applicationSelectors.runtimeCreateButton).or(page.getByRole('button', { name: 'Create' })).first()
    await expect(createButton).toBeEnabled({ timeout: 30_000 })
    await createButton.click()

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

        const objectCollectionId = await waitForObjectId(ownerApi, metahub.id)

        const component = await ensureTitleComponent(ownerApi, metahub.id, objectCollectionId)

        if (!component?.id) {
            throw new Error('Component creation did not return an id for workspace isolation coverage')
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
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Workspace-enabled linked application did not return an id')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(ownerApi, applicationId, {
            schemaOptions: {
                workspaceModeRequested: 'enabled',
                acknowledgeIrreversibleWorkspaceEnablement: true
            }
        })

        const resolvedCatalogId = await waitForRuntimeCatalogId(ownerApi, applicationId, objectCollectionId)

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

test('@flow application without workspaces shares runtime rows between application users', async ({ browser, page, runManifest }) => {
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

        const objectCollectionId = await waitForObjectId(ownerApi, metahub.id)
        const component = await ensureTitleComponent(ownerApi, metahub.id, objectCollectionId)

        if (!component?.id) {
            throw new Error('Component creation did not return an id for shared-row coverage')
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
            createApplicationSchema: false
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

        const resolvedCatalogId = await waitForRuntimeCatalogId(ownerApi, applicationId, objectCollectionId)
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
            role: 'editor'
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
