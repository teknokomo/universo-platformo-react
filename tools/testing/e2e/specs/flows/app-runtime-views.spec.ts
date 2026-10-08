import { createLocalizedContent } from '@universo-react/utils'
import { test, expect } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForLayoutId } from '../../support/appRuntimeViewsTestSupport'

test.describe('Application Runtime View Settings', () => {
    test('@flow layout details page shows view settings panel', async ({ page, runManifest }) => {
        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const metahubName = `E2E ${runManifest.runId} runtime views`
        const metahubCodename = `${runManifest.runId}-runtime-views`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error('Metahub creation did not return an id for runtime view settings coverage')
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            const layoutId = await waitForLayoutId(api, metahub.id)

            await page.goto(`/metahub/${metahub.id}/resources/layouts/${layoutId}`)
            await page.waitForURL(`**/metahub/${metahub.id}/resources/layouts/${layoutId}`)

            // The runtime settings panel must render real controls, not an empty shell.
            const runtimeSettingsPanel = page.getByTestId('layout-runtime-settings-panel')
            await expect(runtimeSettingsPanel).toBeVisible({ timeout: 10_000 })
            await expect(runtimeSettingsPanel.getByText('Default entity runtime behavior', { exact: true })).toBeVisible()
            await expect(runtimeSettingsPanel.getByRole('switch').first()).toBeVisible()
        } finally {
            await disposeApiContext(api)
        }
    })
})
