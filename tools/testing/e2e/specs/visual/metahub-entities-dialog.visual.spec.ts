import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { toolbarSelectors } from '../../support/selectors/contracts'

test('@visual metahub entities create dialog remains stable with a seeded preset', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} entities visual`
    const metahubCodename = `${runManifest.runId}-entities-visual`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entities visual coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/entities`)
        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const dialog = page.getByRole('dialog', { name: 'Create Entity Type' })
        await expect(dialog.getByLabel('Select template')).toBeVisible()

        await dialog.getByLabel('Select template').click()
        await page.getByRole('option', { name: /Catalogs V2/i }).click()

        await expect.poll(async () => dialog.getByLabel('Kind key').inputValue()).toBe('custom.catalog-v2')
        await dialog.click({ position: { x: 32, y: 24 } })
        await expect(dialog.getByLabel('Select template')).not.toBeFocused()
        await expect(dialog.getByRole('progressbar')).toHaveCount(0)
        await expect(dialog).toHaveScreenshot('metahub-entities-create-dialog.png', {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixels: 160
        })
    } finally {
        await disposeApiContext(api)
    }
})