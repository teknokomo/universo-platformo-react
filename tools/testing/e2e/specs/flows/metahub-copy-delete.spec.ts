import { test, expect } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, listMetahubs } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import {
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    confirmDeleteSelectors,
    entityDialogSelectors,
    toolbarSelectors
} from '../../support/selectors/contracts'
import type { Locator } from '@playwright/test'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function fillMetahubForm(dialog: Locator, values: { name: string; codename: string }) {
    await dialog.getByLabel('Name').first().fill(values.name)
    await dialog.getByLabel('Codename').first().fill(values.codename)
}

async function waitForMetahubByName(api: Awaited<ReturnType<typeof createLoggedInApiContext>>, expectedName: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        const response = await listMetahubs(api, { limit: 100, offset: 0 })
        const item = (response.items ?? []).find((entry: { id?: string; name?: { locales?: Record<string, { content?: string }> } }) =>
            Object.values(entry.name?.locales ?? {}).some((localeValue) => localeValue?.content === expectedName)
        )

        if (item) {
            return item
        }

        await sleep(500)
    }

    throw new Error(`Metahub ${expectedName} was not found within ${timeoutMs}ms`)
}

async function ensureMetahubActionMenuVisible(page: import('@playwright/test').Page, metahubId: string, expectedName: string) {
    const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('metahub', metahubId))

    if ((await menuTrigger.count()) === 0) {
        await page.reload()
    }

    await expect(menuTrigger).toBeVisible()
    await expect(page.getByText(expectedName)).toBeVisible()
}

test('@flow metahub can be copied and deleted from browser action menu', async ({ page, runManifest }) => {
    const originalName = `E2E ${runManifest.runId} copy source`
    const originalCodename = `${runManifest.runId}-copy-source`
    const copiedName = `E2E ${runManifest.runId} copied metahub`
    const copiedCodename = `${runManifest.runId}-copied-metahub`

    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const createDialog = page.getByRole('dialog')

    await fillMetahubForm(createDialog, {
        name: originalName,
        codename: originalCodename
    })
    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(createDialog).toHaveCount(0)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const createdPayload = await waitForMetahubByName(api, originalName)
        if (!createdPayload.id) {
            throw new Error('Created source metahub did not contain an id after browser creation')
        }

        await ensureMetahubActionMenuVisible(page, createdPayload.id, originalName)

        await recordCreatedMetahub({
            id: createdPayload.id,
            name: originalName,
            codename: originalCodename
        })

        await page.getByTestId(buildEntityMenuTriggerSelector('metahub', createdPayload.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('metahub', 'copy', createdPayload.id)).click()

        const copyDialog = page.getByRole('dialog')

        await fillMetahubForm(copyDialog, {
            name: copiedName,
            codename: copiedCodename
        })
        await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()
        await expect(copyDialog).toHaveCount(0)

        await expect(page.getByText(copiedName)).toBeVisible()

        const copiedMetahub = await waitForMetahubByName(api, copiedName)
        if (!copiedMetahub.id) {
            throw new Error('Copied metahub did not contain an id after browser copy')
        }

        await ensureMetahubActionMenuVisible(page, copiedMetahub.id, copiedName)
        const copiedMetahubCodename = extractLocalizedText(copiedMetahub.codename)

        expect(copiedMetahub.id).not.toBe(createdPayload.id)
        expect(copiedMetahubCodename).toBeTruthy()

        await recordCreatedMetahub({
            id: copiedMetahub.id,
            name: copiedName,
            codename: copiedCodename
        })

        await page.getByTestId(buildEntityMenuTriggerSelector('metahub', copiedMetahub.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('metahub', 'delete', copiedMetahub.id)).click()

        const deleteRequest = page.waitForResponse(
            (response) => response.request().method() === 'DELETE' && /\/api\/v1\/metahub\//.test(response.url()) && response.ok()
        )

        await page.getByTestId(confirmDeleteSelectors.confirmButton).click()
        await deleteRequest

        await expect(page.getByText(copiedName)).toHaveCount(0)

        const deletedMetahubResponse = await listMetahubs(api, { limit: 100, offset: 0 })
        const deletedMetahub = (deletedMetahubResponse.items ?? []).find((entry: { id?: string }) => entry.id === copiedMetahub.id)

        expect(deletedMetahub).toBeUndefined()
    } finally {
        await disposeApiContext(api)
    }
})
