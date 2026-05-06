/**
 * Full-lifecycle E2E spec: covers the complete user journey
 * Create metahub → create entities → author metadata → copy entity →
 * publish → sync application → verify runtime sections.
 */
import type { Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createFieldDefinition,
    createFixedValue,
    createOptionValue,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    listFieldDefinitions,
    listFixedValues,
    listLinkedCollections,
    listOptionLists,
    listOptionValues,
    listTreeEntities,
    listValueGroups,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

type EntityRecord = {
    id?: string
    codename?: string | unknown
    description?: unknown
    name?: unknown
    data?: Record<string, unknown>
}

type ListPayload<T> = {
    items?: T[]
}

type RuntimeSectionRecord = {
    id?: string
    name?: string
}

type RuntimeState = {
    sections?: RuntimeSectionRecord[]
    activeSectionId?: string | null
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function buildSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

async function waitForListEntity<T extends { id?: string }>(
    loader: () => Promise<ListPayload<T>>,
    expectedId: string,
    label: string
): Promise<T> {
    let matched: T | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                matched = payload.items?.find((item) => item.id === expectedId)
                return Boolean(matched?.id)
            },
            { message: `Waiting for ${label} ${expectedId} to appear in backend list` }
        )
        .toBe(true)

    if (!matched) {
        throw new Error(`${label} ${expectedId} did not appear in backend list`)
    }

    return matched
}

async function openEntityDialog(page: import('@playwright/test').Page, dialogName: string) {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    return dialog
}

async function fillNameAndCodename(dialog: import('@playwright/test').Locator, values: { name?: string; codename: string }) {
    if (typeof values.name === 'string') {
        await dialog.getByLabel('Name').first().fill(values.name)
    }

    await dialog.getByLabel('Codename').first().fill(values.codename)
}

test('@flow @combined full entity lifecycle: create, author metadata, copy, publish, verify runtime', async ({ page, runManifest }) => {
    test.setTimeout(360_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const suffix = buildSuffix(runManifest.runId)
    const metahubName = `E2E ${runManifest.runId} full lifecycle`
    const metahubCodename = `${runManifest.runId}-full-lifecycle`
    const treeEntityName = `LC Tree ${suffix}`
    const treeEntityCodename = `lc-tree-${suffix}`
    const linkedCollectionName = `LC Collection ${suffix}`
    const linkedCollectionCodename = `lc-collection-${suffix}`
    const copiedLinkedCollectionCodename = `lc-collection-copy-${suffix}`
    const attributeName = `Title ${suffix}`
    const attributeCodename = `title-${suffix}`
    const publicationName = `Pub ${suffix}`
    const applicationName = `App ${suffix}`

    try {
        // ─── Step 1: Create metahub ──────────────────────────────
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id')
        }

        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        // ─── Step 2: Create hub via browser ──────────────
        await page.goto(`/metahub/${metahub.id}/entities/hub/instances`)
        await expect(page.getByRole('heading', { name: 'Hubs' })).toBeVisible()

        const treeEntityDialog = await openEntityDialog(page, 'Create Hub')
        await fillNameAndCodename(treeEntityDialog, { name: treeEntityName, codename: treeEntityCodename })

        const createTreeEntityResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/hub/instances`),
            { label: 'Creating hub' }
        )
        await treeEntityDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdTreeEntity = await parseJsonResponse<EntityRecord>(await createTreeEntityResponse, 'Creating hub')
        if (!createdTreeEntity.id) throw new Error('Hub creation did not return an id')

        await expect(page.getByText(treeEntityName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listTreeEntities(api, metahub.id, { limit: 100, offset: 0 }), createdTreeEntity.id, 'hub')

        // ─── Step 3: Create catalog via browser ────────
        await page.goto(`/metahub/${metahub.id}/entities/catalog/instances`)
        await expect(page.getByRole('heading', { name: 'Catalogs' })).toBeVisible()

        const linkedCollectionDialog = await openEntityDialog(page, 'Create Catalog')
        await fillNameAndCodename(linkedCollectionDialog, { name: linkedCollectionName, codename: linkedCollectionCodename })

        const createLinkedCollectionResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instances`),
            { label: 'Creating catalog' }
        )
        await linkedCollectionDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdLinkedCollection = await parseJsonResponse<EntityRecord>(await createLinkedCollectionResponse, 'Creating catalog')
        if (!createdLinkedCollection.id) throw new Error('Catalog creation did not return an id')

        await expect(page.getByText(linkedCollectionName, { exact: true })).toBeVisible()
        await waitForListEntity(
            () => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }),
            createdLinkedCollection.id,
            'catalog'
        )

        // ─── Step 4: Author metadata — add field definition to catalog ──
        const fieldDef = await createFieldDefinition(api, metahub.id, createdLinkedCollection.id, {
            name: { en: attributeName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', attributeCodename),
            dataType: 'STRING',
            isRequired: false
        })

        if (!fieldDef?.id) throw new Error('Field definition creation failed')

        await waitForListEntity(
            () => listFieldDefinitions(api, metahub.id, createdLinkedCollection.id, { limit: 100, offset: 0 }),
            fieldDef.id,
            'field definition'
        )

        // ─── Step 5: Copy catalog via browser ──────────
        await page.goto(`/metahub/${metahub.id}/entities/catalog/instances`)
        await expect(page.getByText(linkedCollectionName, { exact: true })).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('catalog', createdLinkedCollection.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('catalog', 'copy', createdLinkedCollection.id)).click()

        const copyLinkedCollectionDialog = page.getByRole('dialog', { name: 'Copying Catalog' })
        await expect(copyLinkedCollectionDialog).toBeVisible()
        await fillNameAndCodename(copyLinkedCollectionDialog, { codename: copiedLinkedCollectionCodename })

        const copyLinkedCollectionResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities/catalog/instance/${createdLinkedCollection.id}/copy`),
            { label: 'Copying catalog' }
        )
        await copyLinkedCollectionDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedLinkedCollection = await parseJsonResponse<EntityRecord>(await copyLinkedCollectionResponse, 'Copying catalog')
        if (!copiedLinkedCollection.id) throw new Error('Catalog copy did not return an id')

        await waitForListEntity(
            () => listLinkedCollections(api, metahub.id, { limit: 100, offset: 0 }),
            copiedLinkedCollection.id,
            'copied catalog'
        )

        // Verify copied catalog inherited the field definition
        const copiedFieldDefs = await listFieldDefinitions(api, metahub.id, copiedLinkedCollection.id, {
            limit: 100,
            offset: 0
        })
        expect(copiedFieldDefs.items?.length).toBeGreaterThanOrEqual(1)

        // ─── Step 6: Publish metahub ─────────────────────────────
        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) throw new Error('Publication creation failed')

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${suffix} Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        // ─── Step 7: Create application and sync ─────────────────
        const linkedApp = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApp?.application?.id
        if (typeof applicationId !== 'string') throw new Error('Application creation failed')

        await recordCreatedApplication({ id: applicationId, slug: linkedApp.application.slug })

        await syncApplicationSchema(api, applicationId)

        // ─── Step 8: Verify runtime sections exist ───────────────
        const runtime = (await getApplicationRuntime(api, applicationId)) as RuntimeState
        expect(runtime.sections).toBeDefined()
        expect(runtime.sections!.length).toBeGreaterThan(0)

        // Navigate to application runtime page
        await page.goto(`/application/${applicationId}`)

        // Verify the application page loads (may show section list or redirect to active section)
        await expect(page.locator('body')).not.toHaveText(/500|Internal Server Error/)
    } finally {
        await disposeApiContext(api)
    }
})
