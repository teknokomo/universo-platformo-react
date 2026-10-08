import fs from 'fs'
import path from 'path'
import type { Page, TestInfo } from '@playwright/test'
import { generateUuidV7 } from '@universo-react/utils'
import { expect } from '../../fixtures/test'
import { listLayouts, listObjectCollections } from '../backend/api-session.mjs'
import { applyBrowserPreferences } from '../browser/preferences'
import { expectLocalizedValidation, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../browser/runtimeUx'
import { repoRoot } from '../env/load-e2e-env.mjs'
import { resolveFixtureOutputPath } from '../fixtureOutputPath'
import { buildSnapshotEnvelope, createCodenameVLC, validateSnapshotEnvelope } from '@universo-react/utils'
import {
    MMOOMM_APP_CANONICAL_METAHUB,
    MMOOMM_APP_FIXTURE_FILENAME,
    assertMmoommAppFixtureEnvelopeContract
} from '../mmoommAppFixtureContract'
import {
    expectPlayCanvasEditorIframeLoaded,
    fetchPlayCanvasEditorCompatibilityConfig,
    readPlayCanvasEditorCompatibilityScene,
    savePlayCanvasEditorSceneAndExpectReload
} from '../playcanvasEditorAuthoring'
import {
    MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME,
    authorMmoommScriptAssetsThroughEditor,
    authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload,
    authorMmoommSceneThroughPlayCanvasEditorAndExpectReload,
    exportMetahubSnapshotThroughBrowser
} from '../mmoommPlaycanvasEditorAuthoring'
import { SPACE_SECTION_CODENAME, VISUAL_LINKUP_LAB_SECTION_CODENAME, localizedText, serverModuleSource } from '../mmoommAppGeneratorData'
import {
    assertPlayCanvasBuiltinScriptCatalog,
    PLAYCANVAS_BUILTIN_SCRIPT_ASSETS,
    readCanonicalPlayCanvasBuiltinAsset
} from '../playcanvasBuiltinScriptParity'
import {
    apiGet,
    apiSend,
    readCodenameText,
    requirePlayCanvasProjectByName,
    requirePublishedManifestForProject,
    expectFullscreenEditorProject
} from './shared'
import type { PublishedRuntimeManifestSummary } from './shared'
import {
    createMetahubThroughBrowser,
    deleteExistingCanonicalMmoommMetahubs,
    connectPackageThroughBrowser,
    createProjectInstanceAndBindThroughBrowser,
    createObjectCollectionsThroughBrowser,
    createMovementCommandsThroughBrowser,
    createSimulationConstantsThroughBrowser,
    authorWelcomePageThroughBrowser,
    createRuntimeModuleThroughBrowser
} from './metahub-authoring'
import {
    setEditorDefaultProjectThroughBrowser,
    openFullscreenEditorThroughBrowser,
    publishPlayCanvasProjectThroughBrowser,
    createScopedDashboardLayout,
    configureRuntimeLayoutThroughBrowser,
    createAndVerifyPublishedRuntimeBeforeExport
} from './runtime-authoring'
import type { ApiContext } from './shared'

assertPlayCanvasBuiltinScriptCatalog(repoRoot)

const MMOOMM_BUILTIN_SCRIPT_ASSETS = PLAYCANVAS_BUILTIN_SCRIPT_ASSETS.map((asset) => ({
    filename: asset.filename,
    source: readCanonicalPlayCanvasBuiltinAsset(repoRoot, asset.filename)
}))

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')

const explicitFixtureOutputPath = process.env.MMOOMM_APP_FIXTURE_OUTPUT_PATH

export const prepareMmoommAppExport = async (page: Page): Promise<boolean> => {
    const shouldUpdateTrackedFixture = process.env.UPDATE_MMOOMM_APP_FIXTURE === '1'
    if (shouldUpdateTrackedFixture) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })
    }
    await applyBrowserPreferences(page, { language: 'en' })
    return shouldUpdateTrackedFixture
}

export const generateMmoommAppExport = async (
    page: Page,
    api: ApiContext,
    runManifest: { runId: string },
    testInfo: TestInfo,
    shouldUpdateTrackedFixture: boolean
): Promise<void> => {
    await deleteExistingCanonicalMmoommMetahubs(api)
    const metahubId = await createMetahubThroughBrowser(page)
    await page.goto(`/metahub/${metahubId}/resources`)
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
    for (const packageLabel of ['PlayCanvas Editor', 'PlayCanvas Engine', 'Colyseus Client', 'Colyseus Server']) {
        await connectPackageThroughBrowser(page, packageLabel)
    }
    await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
        label: 'MMOOMM resources packages table',
        checkUuidSubstrings: true
    })
    await expectLocalizedValidation(page.getByTestId('metahub-packages-tab'), 'en', {
        label: 'MMOOMM resources packages table'
    })
    const authoringProjectId = await createProjectInstanceAndBindThroughBrowser(page, api, 'MMOOMM Authoring', metahubId)
    const visualLabProjectId = await createProjectInstanceAndBindThroughBrowser(page, api, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME, metahubId)

    expect((await requirePlayCanvasProjectByName(api, metahubId, 'MMOOMM Authoring')).id).toBe(authoringProjectId)
    expect((await requirePlayCanvasProjectByName(api, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)).id).toBe(visualLabProjectId)

    // The fullscreen PlayCanvas Editor host resolves the editor context from the
    // editor package's `playcanvasProject.defaultProjectId`. Without a default
    // project the host renders the "Select a default PlayCanvas project before
    // opening the editor" notice and never mounts the editor iframe.
    await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')

    const editorPage = await openFullscreenEditorThroughBrowser(page, metahubId, authoringProjectId)
    await expectFullscreenEditorProject(editorPage, metahubId, authoringProjectId, 'MMOOMM Authoring Editor')
    await savePlayCanvasEditorSceneAndExpectReload(editorPage, metahubId)
    await authorMmoommSceneThroughPlayCanvasEditorAndExpectReload(editorPage, metahubId)
    await editorPage.close()

    await setEditorDefaultProjectThroughBrowser(page, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    const visualLabEditorPage = await openFullscreenEditorThroughBrowser(page, metahubId, visualLabProjectId)
    await expectFullscreenEditorProject(visualLabEditorPage, metahubId, visualLabProjectId, 'MMOOMM Visual Linkup Lab Editor')
    await authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload(visualLabEditorPage, metahubId)
    await visualLabEditorPage.close()

    await createObjectCollectionsThroughBrowser(page, metahubId, api)
    await createMovementCommandsThroughBrowser(page, metahubId, api)
    await createSimulationConstantsThroughBrowser(page, metahubId, api)
    await authorWelcomePageThroughBrowser(page, api, metahubId)

    // Author the builtin gameplay scripts through the Editor ("+" → Script):
    // createScript uploads the builtin source, the editor parses it through the
    // ESM worker, and the compatibility backend mirrors the parse result into
    // durable script-asset rows — the full user-facing asset loop.
    await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')
    const scriptEditorPage = await openFullscreenEditorThroughBrowser(page, metahubId, authoringProjectId)
    await expectPlayCanvasEditorIframeLoaded(scriptEditorPage)
    const authoringCompatibilityConfig = await fetchPlayCanvasEditorCompatibilityConfig(scriptEditorPage, metahubId)
    const authoringCompatibilityScene = (await readPlayCanvasEditorCompatibilityScene(scriptEditorPage, authoringCompatibilityConfig)) as {
        item?: {
            payload?: {
                entities?: Array<{
                    id?: string
                    name?: string
                    position?: { x?: number; y?: number; z?: number } | number[]
                    scale?: { x?: number; y?: number; z?: number } | number[]
                }>
            } | null
        }
    }
    const authoringCompatibilityEntities = authoringCompatibilityScene.item?.payload?.entities ?? []
    await authorMmoommScriptAssetsThroughEditor(scriptEditorPage, MMOOMM_BUILTIN_SCRIPT_ASSETS)
    await scriptEditorPage.close()

    await createRuntimeModuleThroughBrowser(page, api, metahubId, {
        scope: 'general',
        codename: 'flight-math',
        name: 'Flight Math',
        role: 'library',
        sourceCode: readCanonicalPlayCanvasBuiltinAsset(repoRoot, path.join('libraries', 'flight-math.ts')),
        capabilities: []
    })
    await createRuntimeModuleThroughBrowser(page, api, metahubId, {
        codename: 'fixed-tick-flight-runtime',
        name: 'Fixed Tick Flight Runtime',
        role: 'module',
        sourceCode: serverModuleSource,
        capabilities: ['metadata.read']
    })

    // Bind every authored gameplay script before publishing so the generated
    // runtime manifest is derived from the same Editor-authored scene graph.
    const scriptAssetsResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/script-assets`)
    expect(scriptAssetsResponse.ok).toBe(true)
    const scriptAssetsPayload = (await scriptAssetsResponse.json()) as {
        items?: Array<{ id: string; scriptName: string; parseStatus?: string }>
    }
    const scriptAssetByName = new Map((scriptAssetsPayload.items ?? []).map((item) => [item.scriptName, item]))
    for (const scriptName of ['flightControl', 'followCamera', 'remoteShips']) {
        expect(scriptAssetByName.get(scriptName), `${scriptName} script asset must be mirrored after editor authoring`).toBeDefined()
    }

    const scenesResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/scenes`)
    expect(scenesResponse.ok).toBe(true)
    const scenesPayload = (await scenesResponse.json()) as { items?: Array<{ id: string }> }
    const authoringScene = (scenesPayload.items ?? [])[0]
    expect(authoringScene?.id, 'MMOOMM Authoring project must expose a scene').toBeDefined()

    const sceneDetailResponse = await apiGet(
        api,
        `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/scenes/${authoringScene.id}`
    )
    expect(sceneDetailResponse.ok).toBe(true)
    const sceneDetail = (await sceneDetailResponse.json()) as {
        item?: {
            payload?: {
                entities?: Array<{
                    id?: string
                    name?: string
                    position?: { x?: number; y?: number; z?: number } | number[]
                    scale?: { x?: number; y?: number; z?: number } | number[]
                }>
            } | null
        }
    }
    const sceneEntities = sceneDetail.item?.payload?.entities?.length ? sceneDetail.item.payload.entities : authoringCompatibilityEntities
    const shipEntity = sceneEntities.find((entity) => entity.name === 'MMOOMM Ship')
    const cameraEntity = sceneEntities.find((entity) => entity.name === 'MMOOMM Follow Camera')
    expect(shipEntity?.id, 'MMOOMM Ship entity id is required for the flightControl binding').toBeDefined()
    expect(cameraEntity?.id, 'MMOOMM Follow Camera entity id is required for the followCamera binding').toBeDefined()

    const readVector = (
        value: { x?: number; y?: number; z?: number } | number[] | undefined,
        fallback: { x: number; y: number; z: number }
    ) => {
        if (Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))) {
            return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) }
        }
        if (
            value &&
            Number.isFinite((value as { x?: number; y?: number; z?: number }).x) &&
            Number.isFinite((value as { x?: number; y?: number; z?: number }).y) &&
            Number.isFinite((value as { x?: number; y?: number; z?: number }).z)
        ) {
            return {
                x: Number((value as { x?: number; y?: number; z?: number }).x),
                y: Number((value as { x?: number; y?: number; z?: number }).y),
                z: Number((value as { x?: number; y?: number; z?: number }).z)
            }
        }
        return fallback
    }
    const shipScale = readVector(shipEntity.scale, { x: 12, y: 4, z: 4 })
    const station = sceneEntities.find((entity) => entity.name === 'MMOOMM Station')
    const stationPosition = readVector(station?.position, { x: 72, y: 0, z: -48 })
    const stationScale = readVector(station?.scale, { x: 48, y: 16, z: 16 })
    const guardBoxes = [
        {
            center: stationPosition,
            halfExtents: {
                x: Math.abs(stationScale.x) / 2,
                y: Math.abs(stationScale.y) / 2,
                z: Math.abs(stationScale.z) / 2
            }
        }
    ]
    const commonScriptAttributes = {
        controlledEntityId: shipEntity.id,
        guardBoxes
    }
    const scriptAttributeValues: Record<string, Record<string, unknown>> = {
        flightControl: {
            ...commonScriptAttributes,
            shipHalfExtents: {
                x: Math.abs(shipScale.x) / 2,
                y: Math.abs(shipScale.y) / 2,
                z: Math.abs(shipScale.z) / 2
            }
        },
        followCamera: commonScriptAttributes,
        remoteShips: {
            controlledEntityId: shipEntity.id,
            fallbackScale: shipScale,
            shipHalfExtents: {
                x: Math.abs(shipScale.x) / 2,
                y: Math.abs(shipScale.y) / 2,
                z: Math.abs(shipScale.z) / 2
            }
        }
    }

    const bindings = [
        { scriptName: 'flightControl', sceneEntityStableId: shipEntity.id, sortOrder: 0 },
        { scriptName: 'followCamera', sceneEntityStableId: cameraEntity.id, sortOrder: 1 },
        { scriptName: 'remoteShips', sceneEntityStableId: shipEntity.id, sortOrder: 2 }
    ] as const
    for (const binding of bindings) {
        const scriptAsset = scriptAssetByName.get(binding.scriptName)
        if (!scriptAsset) throw new Error(`Missing mirrored script asset ${binding.scriptName}`)
        const bindingResponse = await apiSend(
            api,
            'PUT',
            `/api/v1/metahub/${metahubId}/playcanvas/projects/${authoringProjectId}/script-bindings/${generateUuidV7()}`,
            {
                sceneId: authoringScene.id,
                sceneEntityStableId: binding.sceneEntityStableId,
                scriptAssetId: scriptAsset.id,
                scriptName: binding.scriptName,
                attributeValues: scriptAttributeValues[binding.scriptName],
                bindingSchemaVersion: '1',
                sortOrder: binding.sortOrder,
                enabled: true
            }
        )
        if (!bindingResponse.ok) {
            const responseBody = await bindingResponse.text()
            throw new Error(
                `${binding.scriptName} binding must persist before publication: ${bindingResponse.status} ${bindingResponse.statusText} ${responseBody}`
            )
        }
    }

    await publishPlayCanvasProjectThroughBrowser(page, api, metahubId, 'MMOOMM Authoring')
    await publishPlayCanvasProjectThroughBrowser(page, api, metahubId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    const publishResponse = await apiGet(api, `/api/v1/metahub/${metahubId}/playcanvas/published-runtime-manifests`)
    expect(publishResponse.ok).toBe(true)
    const publishPayload = (await publishResponse.json()) as {
        items?: PublishedRuntimeManifestSummary[]
    }
    const publishedAuthoringManifest = requirePublishedManifestForProject(publishPayload.items, authoringProjectId, 'MMOOMM Authoring')
    expect(publishedAuthoringManifest.scripts?.map((script) => script.scriptName).sort()).toEqual(
        ['flightControl', 'followCamera', 'remoteShips'].sort()
    )
    const runtimeManifest = {
        ...publishedAuthoringManifest,
        projectName: 'MMOOMM Authoring'
    }
    const visualLabRuntimeManifest = {
        ...requirePublishedManifestForProject(publishPayload.items, visualLabProjectId, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME),
        projectName: MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME
    }

    const layouts = await listLayouts(api, metahubId)
    const layoutItems = Array.isArray(layouts?.items) ? layouts.items : Array.isArray(layouts) ? layouts : []
    const layout = layoutItems.find((item: { isDefault?: unknown }) => item.isDefault === true) ?? layoutItems[0]
    if (!layout?.id) {
        throw new Error('MMOOMM app generator could not find a default layout')
    }
    const objectsResponse = await listObjectCollections(api, metahubId, { limit: 100, offset: 0 })
    const spaceEntity = (objectsResponse.items ?? []).find(
        (item: { codename?: unknown }) => readCodenameText(item.codename) === SPACE_SECTION_CODENAME
    ) as { id?: string } | undefined
    const visualLabEntity = (objectsResponse.items ?? []).find(
        (item: { codename?: unknown }) => readCodenameText(item.codename) === VISUAL_LINKUP_LAB_SECTION_CODENAME
    ) as { id?: string } | undefined
    if (typeof spaceEntity?.id !== 'string' || typeof visualLabEntity?.id !== 'string') {
        throw new Error('MMOOMM scoped Dashboard layouts require the Space and Visual Linkup Lab Object entities')
    }
    const spaceLayoutId = await createScopedDashboardLayout(api, metahubId, layout.id, spaceEntity.id, {
        en: 'Space runtime',
        ru: 'Runtime Космоса'
    })
    const visualLabLayoutId = await createScopedDashboardLayout(api, metahubId, layout.id, visualLabEntity.id, {
        en: 'Visual Linkup Lab runtime',
        ru: 'Runtime визуальной лаборатории'
    })
    await setEditorDefaultProjectThroughBrowser(page, metahubId, 'MMOOMM Authoring')
    await configureRuntimeLayoutThroughBrowser(
        page,
        api,
        metahubId,
        layout.id,
        spaceLayoutId,
        visualLabLayoutId,
        runtimeManifest,
        visualLabRuntimeManifest
    )
    await createAndVerifyPublishedRuntimeBeforeExport(page, api, metahubId, runManifest.runId, [spaceLayoutId, visualLabLayoutId], testInfo)

    const exportedEnvelope = await exportMetahubSnapshotThroughBrowser(
        page,
        metahubId,
        testInfo.outputPath(`${MMOOMM_APP_FIXTURE_FILENAME}.download.json`)
    )
    const envelope = buildSnapshotEnvelope({
        metahub: {
            ...exportedEnvelope.metahub,
            name: localizedText(MMOOMM_APP_CANONICAL_METAHUB.name.en, MMOOMM_APP_CANONICAL_METAHUB.name.ru),
            description: localizedText(MMOOMM_APP_CANONICAL_METAHUB.description.en, MMOOMM_APP_CANONICAL_METAHUB.description.ru),
            codename: createCodenameVLC('en', MMOOMM_APP_CANONICAL_METAHUB.codename.en) as unknown as Record<string, unknown>
        },
        publication: exportedEnvelope.publication,
        sourceInstance: exportedEnvelope.sourceInstance,
        snapshot: exportedEnvelope.snapshot
    } as never)
    validateSnapshotEnvelope(envelope as unknown as Record<string, unknown>)
    assertMmoommAppFixtureEnvelopeContract(envelope as never)

    const fixturePath = explicitFixtureOutputPath
        ? resolveFixtureOutputPath('MMOOMM_APP_FIXTURE_OUTPUT_PATH', MMOOMM_APP_FIXTURE_FILENAME)
        : shouldUpdateTrackedFixture
        ? path.join(FIXTURES_DIR, MMOOMM_APP_FIXTURE_FILENAME)
        : resolveFixtureOutputPath('MMOOMM_APP_FIXTURE_OUTPUT_PATH', MMOOMM_APP_FIXTURE_FILENAME)
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
    fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')
    expect(fs.existsSync(fixturePath)).toBe(true)
    if (!shouldUpdateTrackedFixture && !explicitFixtureOutputPath) {
        expect(fixturePath).not.toBe(path.join(FIXTURES_DIR, MMOOMM_APP_FIXTURE_FILENAME))
    }
    await expectNoPageHorizontalOverflow(page, 'MMOOMM app generator resources page')
}
