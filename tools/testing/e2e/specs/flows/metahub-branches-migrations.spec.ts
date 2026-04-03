import type { Locator, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import {
    createMetahubBranch,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getMetahubBranch,
    listMetahubBranchOptions,
    listMetahubBranches,
    listMetahubMigrations,
    planMetahubMigrations
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors,
    metahubMigrationsSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'

type EntityRecord = {
    id?: string
}

type ListPayload<T> = {
    items?: T[]
    meta?: {
        activeBranchId?: string | null
        defaultBranchId?: string | null
    }
}

type BranchRecord = {
    id?: string
    codename?: string | { locales?: Record<string, { content?: string }> } | null
    name?: string | { locales?: Record<string, { content?: string }> } | null
    isActive?: boolean
    isDefault?: boolean
}

const METAHUB_MIGRATION_GUARD_LOADING_TEXT = 'Checking metahub migration status...'

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function fillNameAndCodename(dialog: Locator, values: { name: string; codename: string }) {
    await dialog.getByLabel('Name').first().fill(values.name)
    await dialog.getByLabel('Codename').first().fill(values.codename)
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

async function waitForEntityAbsence<T extends { id?: string }>(loader: () => Promise<ListPayload<T>>, expectedId: string, label: string) {
    await expect
        .poll(
            async () => {
                const payload = await loader()
                return payload.items?.some((item) => item.id === expectedId) ?? false
            },
            {
                message: `Waiting for ${label} ${expectedId} to disappear from backend list`,
                timeout: 30_000
            }
        )
        .toBe(false)
}

async function waitForBranchMeta(
    loader: () => Promise<ListPayload<BranchRecord>>,
    matcher: (meta: { activeBranchId?: string | null; defaultBranchId?: string | null }) => boolean,
    label: string
) {
    await expect
        .poll(
            async () => {
                const payload = await loader()
                return matcher(payload.meta ?? {})
            },
            { message: `Waiting for branch options metadata: ${label}` }
        )
        .toBe(true)
}

async function waitForMetahubRouteHeading(page: { getByRole: Function; getByText: Function }, headingName: string) {
    const heading = page.getByRole('heading', { name: headingName })
    const guardLoading = page.getByText(METAHUB_MIGRATION_GUARD_LOADING_TEXT)

    await Promise.race([
        heading.waitFor({ state: 'visible', timeout: 15_000 }),
        guardLoading.waitFor({ state: 'visible', timeout: 15_000 })
    ])

    if (await guardLoading.isVisible()) {
        await expect(guardLoading).toHaveCount(0, { timeout: 30_000 })
    }

    await expect(heading).toBeVisible()
}

test('@flow @combined metahub branches support browser create copy default activate and delete with backend persistence', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} branches`
    const metahubCodename = `${runManifest.runId}-branches`
    const branchName = `Branch ${runManifest.runId}`
    const branchCodename = `${runManifest.runId}-branch`
    const copiedBranchName = `Branch ${runManifest.runId} Copy`
    const copiedBranchCodename = `${runManifest.runId}-branch-copy`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for branch coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await page.goto(`/metahub/${metahub.id}/branches`)
        await waitForMetahubRouteHeading(page, 'Branches')

        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const createDialog = page.getByRole('dialog', { name: 'Create Branch' })
        await expect(createDialog).toBeVisible()
        await fillNameAndCodename(createDialog, { name: branchName, codename: branchCodename })

        const createBranchResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/branches`),
            { timeout: 90_000 }
        )
        await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(createDialog).toHaveCount(0)

        const createdBranch = await parseJsonResponse<EntityRecord>(await createBranchResponse, 'Creating branch')
        if (!createdBranch.id) {
            throw new Error('Create branch response did not contain an id')
        }

        await expect(page.getByText(branchName, { exact: true })).toBeVisible()
        await waitForListEntity(() => listMetahubBranches(api, metahub.id, { limit: 100, offset: 0 }), createdBranch.id, 'branch')
        expect((await getMetahubBranch(api, metahub.id, createdBranch.id)).id).toBe(createdBranch.id)

        await page.getByTestId(buildEntityMenuTriggerSelector('branch', createdBranch.id)).click()
        const setDefaultResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/branch/${createdBranch.id}/default`)
        )
        await page.getByTestId(buildEntityMenuItemSelector('branch', 'setDefault', createdBranch.id)).click()
        const setDefaultResult = await setDefaultResponse
        expect(setDefaultResult.ok()).toBe(true)

        await waitForBranchMeta(
            () => listMetahubBranchOptions(api, metahub.id),
            (meta) => meta.defaultBranchId === createdBranch.id,
            'default branch update'
        )

        await page.getByTestId(buildEntityMenuTriggerSelector('branch', createdBranch.id)).click()
        const activateResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/branch/${createdBranch.id}/activate`)
        )
        await page.getByTestId(buildEntityMenuItemSelector('branch', 'activate', createdBranch.id)).click()
        const activateResult = await activateResponse
        expect(activateResult.ok()).toBe(true)

        await waitForBranchMeta(
            () => listMetahubBranchOptions(api, metahub.id),
            (meta) => meta.activeBranchId === createdBranch.id,
            'active branch update'
        )

        const persistedBranch = await getMetahubBranch(api, metahub.id, createdBranch.id)
        expect(persistedBranch.isDefault).toBe(true)
        expect(persistedBranch.isActive).toBe(true)

        await page.getByTestId(buildEntityMenuTriggerSelector('branch', createdBranch.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('branch', 'copy', createdBranch.id)).click()

        const copyDialog = page.getByRole('dialog', { name: 'Copying Branch' })
        await expect(copyDialog).toBeVisible()
        await fillNameAndCodename(copyDialog, { name: copiedBranchName, codename: copiedBranchCodename })

        const copyBranchResponse = page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/branches`),
            { timeout: 90_000 }
        )
        await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(copyDialog).toHaveCount(0)

        const copiedBranchResponse = await parseJsonResponse<EntityRecord>(await copyBranchResponse, 'Copying branch')
        if (!copiedBranchResponse.id) {
            throw new Error('Copy branch response did not contain an id')
        }

        await expect(page.getByText(copiedBranchName, { exact: true })).toBeVisible()
        const copiedBranch = await waitForListEntity(
            () => listMetahubBranches(api, metahub.id, { limit: 100, offset: 0 }),
            copiedBranchResponse.id,
            'copied branch'
        )

        await page.getByTestId(buildEntityMenuTriggerSelector('branch', copiedBranch.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('branch', 'delete', copiedBranch.id)).click()

        const deleteDialog = page.getByRole('dialog', { name: 'Delete branch' })
        await expect(deleteDialog).toBeVisible()
        const deleteBranchResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/branch/${copiedBranch.id}`)
        )
        await deleteDialog.getByRole('button', { name: 'Delete' }).click()

        const deleteBranchResult = await deleteBranchResponse
        expect(deleteBranchResult.ok()).toBe(true)

        await expect(page.getByText(copiedBranchName, { exact: true })).toHaveCount(0)
        await waitForEntityAbsence(() => listMetahubBranches(api, metahub.id, { limit: 100, offset: 0 }), copiedBranch.id, 'branch')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @combined metahub migrations page shows branch-aware plan and keeps apply disabled when no upgrade is pending', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} branch migrations`
    const metahubCodename = `${runManifest.runId}-branch-migrations`
    const branchName = `Branch ${runManifest.runId}`
    const branchCodename = `${runManifest.runId}-branch`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for migration coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const branchOptions = await listMetahubBranchOptions(api, metahub.id)
        const defaultBranchId = branchOptions.meta?.defaultBranchId
        if (!defaultBranchId) {
            throw new Error('Default branch id is required for metahub migration coverage')
        }

        const createdBranch = await createMetahubBranch(api, metahub.id, {
            name: { en: branchName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', branchCodename),
            sourceBranchId: defaultBranchId
        })
        if (!createdBranch?.id) {
            throw new Error('Branch creation did not return an id for metahub migration coverage')
        }

        const expectedMigrations = await listMetahubMigrations(api, metahub.id, { limit: 100, offset: 0, branchId: createdBranch.id })
        const expectedCount = expectedMigrations.items?.length ?? 0

        await page.goto(`/metahub/${metahub.id}/migrations`)
        await expect(page.getByRole('heading', { name: 'Migrations' })).toBeVisible()
        await expect(page.getByText('Migration plan')).toBeVisible()

        const branchSelect = page.getByTestId(metahubMigrationsSelectors.branchSelect)
        await branchSelect.click()
        await page.getByRole('option', { name: new RegExp(branchName, 'i') }).click()

        await expect
            .poll(async () => {
                const response = await listMetahubMigrations(api, metahub.id, { limit: 100, offset: 0, branchId: createdBranch.id })
                return response.items?.length ?? 0
            })
            .toBe(expectedCount)

        await expect(page.getByText('Structure up to date')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply migrations' })).toBeDisabled()

        const plan = await planMetahubMigrations(api, metahub.id, { branchId: createdBranch.id })
        expect(plan.structureUpgradeRequired).toBe(false)
        expect(plan.branchId).toBe(createdBranch.id)
    } finally {
        await disposeApiContext(api)
    }
})
