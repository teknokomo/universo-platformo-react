import { test, expect } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, listMetahubs } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'
import type { Locator } from '@playwright/test'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function ensureMetahubVisible(page: import('@playwright/test').Page, expectedName: string) {
    const metahubName = page.getByText(expectedName, { exact: true }).first()

    if ((await metahubName.count()) === 0) {
        await page.reload()
    }

    await expect(metahubName).toBeVisible()
}

test('@flow metahub can be created from the browser', async ({ page, runManifest }) => {
    const metahubName = `E2E ${runManifest.runId} browser metahub`
    const metahubCodename = `${runManifest.runId}-browser-metahub`

    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog')

    await fillMetahubForm(dialog, {
        name: metahubName,
        codename: metahubCodename
    })
    await dialog.getByTestId(entityDialogSelectors.submitButton).click()
    await expect(dialog).toHaveCount(0)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const persistedMetahub = await waitForMetahubByName(api, metahubName)
        expect(typeof persistedMetahub.id).toBe('string')
        await ensureMetahubVisible(page, metahubName)

        await recordCreatedMetahub({
            id: persistedMetahub.id,
            name: metahubName,
            codename: metahubCodename
        })
    } finally {
        await disposeApiContext(api)
    }
})
