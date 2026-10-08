import { test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import type { ApiContext } from '../../support/mmoomm-app-export/shared'
import { generateMmoommAppExport, prepareMmoommAppExport } from '../../support/mmoomm-app-export/generate-mmoomm-app-export'

test.describe('MMOOMM PlayCanvas Editor fixture generator', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical mmoomm app through browser PlayCanvas Editor and export snapshot fixture', async ({
        page,
        runManifest
    }, testInfo) => {
        // This UI-first generator exercises Editor authoring, publication, two runtime
        // proofs, and a responsive viewport matrix. GitHub runners regularly need
        // about ten minutes for the successful path, so keep headroom for normal CI
        // variance without weakening any of the individual runtime assertions.
        test.setTimeout(1_200_000)
        const shouldUpdateTrackedFixture = await prepareMmoommAppExport(page)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        await generateMmoommAppExport(page, api, runManifest, testInfo, shouldUpdateTrackedFixture)
    })
})
