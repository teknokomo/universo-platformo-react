import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getLayout,
    listLayoutZoneWidgets,
    listLayouts,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { validateSnapshotEnvelope } from '@universo/utils'
import {
    QUIZ_CANONICAL_METAHUB,
    QUIZ_CENTERED_LAYOUT_CONFIG,
    QUIZ_FIXTURE_FILENAME,
    QUIZ_REMOVED_LAYOUT_WIDGET_KEYS,
    QUIZ_SCRIPT_CODENAME,
    QUIZ_WIDGET_SOURCE,
    assertQuizFixtureEnvelopeContract,
    buildQuizLiveMetahubCodename,
    buildQuizLiveMetahubName
} from '../../support/quizFixtureContract'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')

async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

async function waitForLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | undefined

    await expect
        .poll(async () => {
            const response = await listLayouts(api, metahubId, { limit: 20, offset: 0 })
            layoutId = response?.items?.find((layout) => layout?.isDefault)?.id ?? response?.items?.[0]?.id
            return typeof layoutId === 'string'
        })
        .toBe(true)

    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId}`)
    }

    return layoutId
}

async function expectJsonResponse(response: Response, label: string) {
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null

    if (!response.ok) {
        throw new Error(`${label} failed with ${response.status} ${response.statusText}: ${text}`)
    }

    return payload
}

async function applyCenteredQuizLayout(api: ApiContext, metahubId: string, layoutId: string) {
    const layout = await getLayout(api, metahubId, layoutId)
    const currentConfig = layout?.config && typeof layout.config === 'object' ? layout.config : {}
    const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)

    await expectJsonResponse(
        await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}`, {
            name: layout?.name,
            namePrimaryLocale: layout?.name?._primary ?? 'en',
            description: layout?.description,
            descriptionPrimaryLocale: layout?.description?._primary ?? 'en',
            config: {
                ...currentConfig,
                ...QUIZ_CENTERED_LAYOUT_CONFIG
            }
        }),
        'Applying centered quiz layout config'
    )

    const zoneWidgets = await listLayoutZoneWidgets(api, metahubId, layoutId)
    for (const widget of zoneWidgets?.items?.filter((item) => removableWidgetKeys.has(String(item?.widgetKey ?? ''))) ?? []) {
        const removeResponse = await sendWithCsrf(api, 'DELETE', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widget.id}`)
        expect(removeResponse.status).toBe(204)
    }
}

test.describe('Metahubs Quiz App Export', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical quiz metahub and export snapshot fixture', async ({ runManifest }) => {
        test.setTimeout(300_000)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })

        const metahubName = buildQuizLiveMetahubName(runManifest.runId)
        const metahubCodename = buildQuizLiveMetahubCodename(runManifest.runId)
        const metahub = await createMetahub(api, {
            name: metahubName,
            namePrimaryLocale: 'en',
            codename: metahubCodename,
            description: QUIZ_CANONICAL_METAHUB.description,
            descriptionPrimaryLocale: 'en'
        })

        if (!metahub?.id) {
            throw new Error('Quiz metahub generator did not receive a metahub id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName.en,
            codename: QUIZ_CANONICAL_METAHUB.codename.en
        })

        const layoutId = await waitForLayoutId(api, metahub.id)

        await applyCenteredQuizLayout(api, metahub.id, layoutId)

        await expectJsonResponse(
            await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/scripts`, {
                codename: QUIZ_SCRIPT_CODENAME,
                name: 'Space quiz widget',
                description: 'Canonical Space Quiz widget script for snapshot export',
                attachedToKind: 'metahub',
                attachedToId: null,
                moduleRole: 'widget',
                sourceKind: 'embedded',
                capabilities: ['rpc.client'],
                sourceCode: QUIZ_WIDGET_SOURCE,
                isActive: true
            }),
            'Creating quiz widget script'
        )

        await expectJsonResponse(
            await sendWithCsrf(api, 'PUT', `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget`, {
                zone: 'center',
                widgetKey: 'quizWidget',
                config: {
                    attachedToKind: 'metahub',
                    scriptCodename: QUIZ_SCRIPT_CODENAME
                }
            }),
            'Assigning quiz widget to layout'
        )

        const exportResponse = await apiGet(api, `/api/v1/metahub/${metahub.id}/export`)
        expect(exportResponse.ok).toBe(true)

        await expect
            .poll(async () => {
                const response = await listLayoutZoneWidgets(api, metahub.id, layoutId)
                const items = response?.items ?? []
                const quizWidget = items.find(
                    (item) => item.widgetKey === 'quizWidget' && item.config?.scriptCodename === QUIZ_SCRIPT_CODENAME
                )
                const removableWidgetKeys = new Set<string>(QUIZ_REMOVED_LAYOUT_WIDGET_KEYS)
                const hasLegacyWidgets = items.some((item) => removableWidgetKeys.has(String(item?.widgetKey ?? '')))
                const hasRightZoneWidgets = items.some((item) => item.zone === 'right')

                return quizWidget?.zone === 'center' && !hasLegacyWidgets && !hasRightZoneWidgets
            })
            .toBe(true)

        const envelope = (await exportResponse.json()) as Record<string, unknown>
        expect(envelope.kind).toBe('metahub_snapshot_bundle')
        expect(envelope.bundleVersion).toBe(1)
        expect(typeof envelope.snapshotHash).toBe('string')
        expect((envelope.snapshotHash as string).length).toBe(64)
        expect(envelope.snapshot).toBeTruthy()

        validateSnapshotEnvelope(envelope)
        assertQuizFixtureEnvelopeContract(envelope)

        const fixturePath = path.join(FIXTURES_DIR, QUIZ_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')

        expect(fs.existsSync(fixturePath)).toBe(true)
        const stats = fs.statSync(fixturePath)
        expect(stats.size).toBeGreaterThan(100)

        console.log('\n--- Metahubs Quiz App Export Complete ---')
        console.log(`Metahub ID: ${metahub.id}`)
        console.log(`Fixture: ${fixturePath}`)
        console.log(`Fixture size: ${(stats.size / 1024).toFixed(1)} KB`)
    })
})
