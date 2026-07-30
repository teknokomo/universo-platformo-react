// Interpretation Network product fixture generator.
//
// The generator:
//   1. Logs into a fresh e2e API context
//   2. Creates a metahub from the `interpretation-network` template, which seeds the
//      full interpretation-network model
//   3. Exports the metahub to `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
//      and re-wraps it with `runtimePolicy.workspaceMode: 'required'`
//   4. Canonicalizes product metadata so the committed fixture never
//      carries the transient E2E run id
//   5. Validates the strict Interpretation Network fixture contract

import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    listLayouts,
    listLayoutZoneWidgets,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildSnapshotEnvelope, buildVLC, createLocalizedContent, validateSnapshotEnvelope } from '@universo-react/utils'
import {
    assertInterpretationNetworkFixtureEnvelopeContract,
    buildInterpretationNetworkLiveMetahubCodename,
    buildInterpretationNetworkLiveMetahubName,
    INTERPRETATION_NETWORK_CANONICAL_METAHUB,
    INTERPRETATION_NETWORK_FIXTURE_FILENAME
} from '../../support/interpretationNetworkFixtureContract'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const explicitFixtureOutputPath = process.env.INTERPRETATION_NETWORK_FIXTURE_OUTPUT_PATH
const resolveFixtureOutputPath = () =>
    explicitFixtureOutputPath
        ? path.resolve(repoRoot, explicitFixtureOutputPath)
        : path.join(FIXTURES_DIR, INTERPRETATION_NETWORK_FIXTURE_FILENAME)

const configureInterpretationNetworkProductFixture = async (api: ApiContext, metahubId: string) => {
    const layoutsPayload = await listLayouts(api, metahubId, { limit: 100, offset: 0 })
    const layouts = Array.isArray(layoutsPayload?.items) ? layoutsPayload.items : []
    const layout = layouts.find((candidate) => candidate?.isDefault === true) ?? layouts[0]
    expect(layout?.id).toBeTruthy()

    const widgetsPayload = await listLayoutZoneWidgets(api, metahubId, layout.id)
    const widgets = Array.isArray(widgetsPayload?.items) ? widgetsPayload.items : []
    const workspaceWidget = widgets.find((candidate) => candidate?.widgetKey === 'interpretationNetworkWorkspace')
    expect(workspaceWidget?.id).toBeTruthy()

    const response = await sendWithCsrf(
        api,
        'PATCH',
        `/api/v1/metahub/${metahubId}/layout/${layout.id}/zone-widget/${workspaceWidget.id}/config`,
        {
            config: {
                ...(workspaceWidget.config && typeof workspaceWidget.config === 'object' ? workspaceWidget.config : {}),
                structureMode: 'singleSystem',
                templatePanel: { showInStructureList: true, showInMatrix: true }
            }
        }
    )
    expect(response.ok).toBe(true)
}

test.describe('Metahubs Interpretation Network App Export', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical interpretation-network metahub and export snapshot fixture', async ({ runManifest }) => {
        test.setTimeout(600_000)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })

        const metahubName = buildInterpretationNetworkLiveMetahubName(runManifest.runId)
        const metahubCodename = buildInterpretationNetworkLiveMetahubCodename(runManifest.runId)
        const metahub = await createMetahub(api, {
            name: metahubName,
            namePrimaryLocale: 'en',
            codename: metahubCodename,
            description: INTERPRETATION_NETWORK_CANONICAL_METAHUB.description,
            descriptionPrimaryLocale: 'en',
            templateCodename: 'interpretation-network'
        })

        if (!metahub?.id) {
            throw new Error('Interpretation Network metahub generator did not receive a metahub id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName.en,
            codename: INTERPRETATION_NETWORK_CANONICAL_METAHUB.codename.en
        })

        // Configure the metahub through its real authoring API before export. This
        // proves that the committed fixture is a valid product round trip instead
        // of a post-export JSON mutation.
        await configureInterpretationNetworkProductFixture(api, metahub.id)

        const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
            .map(([name, value]: [string, string]) => `${name}=${value}`)
            .join('; ')

        const exportResponse = await fetch(new URL(`/api/v1/metahub/${metahub.id}/export`, api.baseURL as string).toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {})
            }
        })
        expect(exportResponse.ok).toBe(true)

        const exportedEnvelope = validateSnapshotEnvelope((await exportResponse.json()) as Record<string, unknown>)
        const envelope = buildSnapshotEnvelope({
            metahub: {
                ...exportedEnvelope.metahub,
                name: buildVLC(INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en, INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.ru),
                codename: createLocalizedContent('en', INTERPRETATION_NETWORK_CANONICAL_METAHUB.codename.en),
                description: buildVLC(
                    INTERPRETATION_NETWORK_CANONICAL_METAHUB.description.en,
                    INTERPRETATION_NETWORK_CANONICAL_METAHUB.description.ru
                )
            },
            publication: exportedEnvelope.publication,
            sourceInstance: exportedEnvelope.sourceInstance,
            snapshot: {
                ...exportedEnvelope.snapshot,
                runtimePolicy: {
                    workspaceMode: 'required' as const
                }
            }
        })
        validateSnapshotEnvelope(envelope)
        assertInterpretationNetworkFixtureEnvelopeContract(envelope)

        const fixturePath = resolveFixtureOutputPath()
        fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')
    })
})
