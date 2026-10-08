import type { PlayCanvasProjectSnapshot } from './mmoommAppFixtureContract.shared.ts'
import { MMOOMM_AUTHORING_PROJECT_NAME } from './mmoommAppFixtureContract.shared.ts'
import {
    assertUniqueStrings,
    decodeBase64,
    requireNonEmptyString,
    requireRecord,
    requireSha256,
    sha256
} from './mmoommAppFixtureContract.shared.ts'
import { requirePlayCanvasProjectByName } from './mmoommPlaycanvasSceneContract.ts'

type ScriptAssetContract = {
    id: string
    assetId: string
    scriptName: string
    scriptKind: string
}

type GeneratedArtifactContract = {
    id: string
    scriptAssetId: string
    scriptName: string
    scriptKind: string
    outputHash: string
    outputBytes: Buffer
}

type SceneScriptBindingContract = {
    id: string
    sceneId: string
    scriptAssetId: string
    scriptName: string
    sceneEntityStableId: string
    enabled: boolean
    sortOrder: number
}

const readDataUrlBytes = (value: unknown, label: string): Buffer => {
    const prefix = 'data:text/javascript;base64,'
    if (typeof value !== 'string' || !value.startsWith(prefix)) {
        throw new Error(`MMOOMM app fixture ${label} must carry a text/javascript artifact URL`)
    }
    return decodeBase64(value.slice(prefix.length), `${label} artifact URL`)
}

const readSceneEntityIds = (scene: NonNullable<PlayCanvasProjectSnapshot['scenes']>[number] | undefined, label: string): Set<string> => {
    const entities = scene?.payload?.entities
    if (!Array.isArray(entities)) {
        throw new Error(`MMOOMM app fixture ${label} scene must carry an entity payload`)
    }
    const ids = entities.map((entity, index) => requireNonEmptyString(entity.id, `${label} scene entity ${index} id`))
    assertUniqueStrings(ids, `${label} scene entity ids`)
    return new Set(ids)
}

export const assertScriptAssets = (playcanvasProjects: PlayCanvasProjectSnapshot): Map<string, ScriptAssetContract> => {
    const scriptAssets = playcanvasProjects.scriptAssets
    if (!Array.isArray(scriptAssets) || scriptAssets.length === 0) {
        throw new Error('MMOOMM app fixture must include PlayCanvas script assets')
    }
    const assets = playcanvasProjects.assets
    if (!Array.isArray(assets) || assets.length === 0) {
        throw new Error('MMOOMM app fixture must include source assets for PlayCanvas script assets')
    }
    assertUniqueStrings(
        assets.map((asset) => requireNonEmptyString(asset.id, 'PlayCanvas source asset id')),
        'PlayCanvas source asset ids'
    )
    const sourceAssetById = new Map(assets.map((asset) => [requireNonEmptyString(asset.id, 'PlayCanvas source asset id'), asset]))
    const contracts = scriptAssets.map((candidate, index): ScriptAssetContract => {
        const record = requireRecord(candidate, `PlayCanvas script asset ${index}`)
        const id = requireNonEmptyString(record.id, `PlayCanvas script asset ${index} id`)
        const assetId = requireNonEmptyString(record.assetId, `PlayCanvas script asset ${id} source asset id`)
        const scriptName = requireNonEmptyString(record.scriptName, `PlayCanvas script asset ${id} name`)
        const scriptKind = requireNonEmptyString(record.scriptKind, `PlayCanvas script asset ${id} kind`)
        if (record.parseStatus !== 'ready') {
            throw new Error(`MMOOMM app fixture PlayCanvas script asset ${scriptName} must be ready`)
        }
        const sourceAsset = sourceAssetById.get(assetId)
        if (!sourceAsset || sourceAsset.type !== 'script') {
            throw new Error(`MMOOMM app fixture PlayCanvas script asset ${scriptName} must reference a script source asset`)
        }
        return { id, assetId, scriptName, scriptKind }
    })
    assertUniqueStrings(
        contracts.map((asset) => asset.id),
        'PlayCanvas script asset ids'
    )
    assertUniqueStrings(
        contracts.map((asset) => asset.scriptName),
        'PlayCanvas script asset names'
    )
    const requiredScriptNames = ['flightControl', 'followCamera', 'remoteShips']
    for (const scriptName of requiredScriptNames) {
        if (!contracts.some((asset) => asset.scriptName === scriptName)) {
            throw new Error(`MMOOMM app fixture must include a ready "${scriptName}" script asset`)
        }
    }
    return new Map(contracts.map((asset) => [asset.id, asset]))
}

export const assertGeneratedArtifacts = (
    playcanvasProjects: PlayCanvasProjectSnapshot,
    scriptAssets: Map<string, ScriptAssetContract>
): Map<string, GeneratedArtifactContract> => {
    const generatedArtifacts = playcanvasProjects.generatedArtifacts
    if (!Array.isArray(generatedArtifacts) || generatedArtifacts.length === 0) {
        throw new Error('MMOOMM app fixture must include generated ESM script artifacts')
    }
    if (generatedArtifacts.length !== scriptAssets.size) {
        throw new Error('MMOOMM app fixture must have exactly one generated artifact for every PlayCanvas script asset')
    }
    const contracts = generatedArtifacts.map((candidate, index): GeneratedArtifactContract => {
        const record = requireRecord(candidate, `PlayCanvas generated artifact ${index}`)
        const id = requireNonEmptyString(record.id, `PlayCanvas generated artifact ${index} id`)
        const scriptAssetId = requireNonEmptyString(record.scriptAssetId, `PlayCanvas generated artifact ${id} script asset id`)
        const scriptAsset = scriptAssets.get(scriptAssetId)
        if (!scriptAsset) {
            throw new Error(`MMOOMM app fixture generated artifact ${id} must reference an existing script asset`)
        }
        const scriptName = requireNonEmptyString(record.scriptName, `PlayCanvas generated artifact ${id} script name`)
        const scriptKind = requireNonEmptyString(record.scriptKind, `PlayCanvas generated artifact ${id} script kind`)
        if (scriptName !== scriptAsset.scriptName || scriptKind !== scriptAsset.scriptKind) {
            throw new Error(`MMOOMM app fixture generated artifact ${id} must match its script asset metadata`)
        }
        if (record.parseStatus !== 'ready') {
            throw new Error(`MMOOMM app fixture generated artifact ${id} must be ready`)
        }
        const outputFile = requireRecord(record.outputFile, `PlayCanvas generated artifact ${id} output file`)
        if (outputFile.status !== 'ready' || outputFile.mime !== 'text/javascript') {
            throw new Error('MMOOMM app fixture generated artifacts must carry ready text/javascript output files')
        }
        const outputHash = requireSha256(outputFile.hash, `PlayCanvas generated artifact ${id} output file`)
        const outputBytes = decodeBase64(outputFile.snapshotContentBase64, `PlayCanvas generated artifact ${id} output file`)
        if (sha256(outputBytes) !== outputHash) {
            throw new Error(`MMOOMM app fixture generated artifact ${id} output file hash does not match its decoded bytes`)
        }
        if (outputFile.size !== undefined && outputFile.size !== outputBytes.length) {
            throw new Error(`MMOOMM app fixture generated artifact ${id} output file size does not match its decoded bytes`)
        }
        return { id, scriptAssetId, scriptName, scriptKind, outputHash, outputBytes }
    })
    assertUniqueStrings(
        contracts.map((artifact) => artifact.id),
        'PlayCanvas generated artifact ids'
    )
    assertUniqueStrings(
        contracts.map((artifact) => artifact.scriptAssetId),
        'PlayCanvas generated artifact script asset mappings'
    )
    assertUniqueStrings(
        contracts.map((artifact) => artifact.scriptName),
        'PlayCanvas generated artifact script names'
    )
    const artifactsByScriptAssetId = new Map(contracts.map((artifact) => [artifact.scriptAssetId, artifact]))
    for (const scriptAssetId of scriptAssets.keys()) {
        if (!artifactsByScriptAssetId.has(scriptAssetId)) {
            throw new Error(`MMOOMM app fixture script asset ${scriptAssetId} must have exactly one generated artifact`)
        }
    }
    return artifactsByScriptAssetId
}

const assertSceneScriptBindings = (
    playcanvasProjects: PlayCanvasProjectSnapshot,
    authoringManifest: { sceneId?: unknown },
    scriptAssets: Map<string, ScriptAssetContract>,
    authoringSceneEntityIds: Set<string>
): Map<string, SceneScriptBindingContract> => {
    const bindings = playcanvasProjects.sceneScriptBindings
    if (!Array.isArray(bindings)) {
        throw new Error('MMOOMM app fixture must include PlayCanvas scene script bindings')
    }
    const authoringSceneId = requireNonEmptyString(authoringManifest.sceneId, 'authoring runtime manifest scene id')
    const sceneIds = new Set(
        (playcanvasProjects.scenes ?? []).map((scene, index) => requireNonEmptyString(scene.id, `PlayCanvas scene ${index} id`))
    )
    const contracts = bindings.map((candidate, index): SceneScriptBindingContract => {
        const record = requireRecord(candidate, `PlayCanvas scene script binding ${index}`)
        const id = requireNonEmptyString(record.id, `PlayCanvas scene script binding ${index} id`)
        const sceneId = requireNonEmptyString(record.sceneId, `PlayCanvas scene script binding ${id} scene id`)
        const scriptAssetId = requireNonEmptyString(record.scriptAssetId, `PlayCanvas scene script binding ${id} script asset id`)
        const scriptAsset = scriptAssets.get(scriptAssetId)
        if (!scriptAsset) {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must reference an existing script asset`)
        }
        if (!sceneIds.has(sceneId)) {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must reference an existing scene`)
        }
        const scriptName = requireNonEmptyString(record.scriptName, `PlayCanvas scene script binding ${id} script name`)
        if (scriptName !== scriptAsset.scriptName) {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must match its script asset name`)
        }
        const sceneEntityStableId = requireNonEmptyString(
            record.sceneEntityStableId,
            `PlayCanvas scene script binding ${id} scene entity stable id`
        )
        if (sceneId === authoringSceneId && !authoringSceneEntityIds.has(sceneEntityStableId)) {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must target an authored scene entity`)
        }
        if (record.bindingSchemaVersion !== '1') {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must use binding schema version 1`)
        }
        if (typeof record.enabled !== 'boolean') {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must declare enabled state`)
        }
        if (!Number.isInteger(record.sortOrder)) {
            throw new Error(`MMOOMM app fixture scene script binding ${id} must declare an integer sort order`)
        }
        return {
            id,
            sceneId,
            scriptAssetId,
            scriptName,
            sceneEntityStableId,
            enabled: record.enabled,
            sortOrder: record.sortOrder as number
        }
    })
    assertUniqueStrings(
        contracts.map((binding) => binding.id),
        'PlayCanvas scene script binding ids'
    )
    const seenSceneSortOrders = new Set<string>()
    for (const binding of contracts) {
        const key = `${binding.sceneId}:${binding.sortOrder}`
        if (seenSceneSortOrders.has(key)) {
            throw new Error(`MMOOMM app fixture scene script binding sort orders must be unique: ${key}`)
        }
        seenSceneSortOrders.add(key)
    }
    const enabledBindings = contracts.filter((binding) => binding.enabled)
    const enabledByScriptAssetId = new Map<string, SceneScriptBindingContract>()
    for (const binding of enabledBindings) {
        if (binding.sceneId !== authoringSceneId) {
            throw new Error('MMOOMM app fixture enabled MMOOMM script bindings must target the authoring runtime scene')
        }
        if (enabledByScriptAssetId.has(binding.scriptAssetId)) {
            throw new Error(`MMOOMM app fixture must have exactly one enabled binding per script asset: ${binding.scriptAssetId}`)
        }
        enabledByScriptAssetId.set(binding.scriptAssetId, binding)
    }
    if (enabledByScriptAssetId.size !== scriptAssets.size) {
        throw new Error('MMOOMM app fixture must have exactly one enabled scene binding for every PlayCanvas script asset')
    }
    for (const scriptAssetId of scriptAssets.keys()) {
        if (!enabledByScriptAssetId.has(scriptAssetId)) {
            throw new Error(`MMOOMM app fixture script asset ${scriptAssetId} must have an enabled scene binding`)
        }
    }
    return enabledByScriptAssetId
}

export const assertRuntimeScripts = (
    playcanvasProjects: PlayCanvasProjectSnapshot,
    scriptAssets: Map<string, ScriptAssetContract>,
    generatedArtifacts: Map<string, GeneratedArtifactContract>
): void => {
    const authoringProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_AUTHORING_PROJECT_NAME)
    const authoringManifest = (playcanvasProjects.runtimeManifests ?? []).find((manifest) => manifest.projectId === authoringProject.id)
    if (!authoringManifest || !Array.isArray(authoringManifest.scripts) || authoringManifest.scripts.length === 0) {
        throw new Error('MMOOMM app fixture authoring runtime manifest must carry published scripts[]')
    }
    const scripts = authoringManifest.scripts
    if (scripts.length !== scriptAssets.size) {
        throw new Error('MMOOMM app fixture authoring runtime manifest must publish every PlayCanvas script asset exactly once')
    }
    const authoringScene = playcanvasProjects.scenes?.find(
        (scene) => scene.id === authoringManifest.sceneId && scene.projectId === authoringProject.id
    )
    const authoringSceneEntityIds = readSceneEntityIds(authoringScene, 'authoring')
    const sceneObjectIds = new Set(
        ((authoringManifest.metadata?.mmoomm as { scene?: { objects?: Array<{ id?: unknown }> } | null })?.scene?.objects ?? []).map(
            (object) => object?.id
        )
    )
    const bindingsByScriptAssetId = assertSceneScriptBindings(playcanvasProjects, authoringManifest, scriptAssets, authoringSceneEntityIds)
    const seenScriptIds = new Set<string>()
    const seenScriptNames = new Set<string>()
    for (const script of scripts) {
        const record = requireRecord(script, 'authoring runtime manifest script')
        const scriptAssetId = requireNonEmptyString(record.id, 'authoring runtime manifest script id')
        const scriptAsset = scriptAssets.get(scriptAssetId)
        if (!scriptAsset) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptAssetId} must reference a PlayCanvas script asset`)
        }
        if (seenScriptIds.has(scriptAssetId)) {
            throw new Error(`MMOOMM app fixture manifest scripts must be unique: ${scriptAssetId}`)
        }
        seenScriptIds.add(scriptAssetId)
        const scriptName = requireNonEmptyString(record.scriptName, `authoring runtime manifest script ${scriptAssetId} name`)
        if (scriptName !== scriptAsset.scriptName) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptAssetId} must match its script asset name`)
        }
        if (seenScriptNames.has(scriptName)) {
            throw new Error(`MMOOMM app fixture manifest scripts must be unique: ${scriptName}`)
        }
        seenScriptNames.add(scriptName)
        const scriptKind = requireNonEmptyString(record.scriptKind, `authoring runtime manifest script ${scriptAssetId} kind`)
        if (scriptKind !== scriptAsset.scriptKind) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} must match its script asset kind`)
        }
        const artifact = generatedArtifacts.get(scriptAssetId)
        if (!artifact) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} must reference a generated artifact`)
        }
        const artifactHash = requireSha256(record.artifactHash, `authoring runtime manifest script ${scriptName} artifact`)
        if (artifactHash !== artifact.outputHash) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} hash must match its generated artifact output file`)
        }
        const artifactBytes = readDataUrlBytes(record.artifactUrl, `authoring runtime manifest script ${scriptName}`)
        if (sha256(artifactBytes) !== artifactHash || !artifactBytes.equals(artifact.outputBytes)) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} artifact URL bytes must match its generated artifact`)
        }
        const binding = bindingsByScriptAssetId.get(scriptAssetId)
        if (!binding || binding.scriptName !== scriptName) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} must have a matching enabled scene binding`)
        }
        const sceneEntityStableId = requireNonEmptyString(
            record.sceneEntityStableId,
            `authoring runtime manifest script ${scriptName} scene entity stable id`
        )
        if (sceneEntityStableId !== binding.sceneEntityStableId) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} must match its scene binding entity`)
        }
        if (!sceneObjectIds.has(sceneEntityStableId)) {
            throw new Error(`MMOOMM app fixture manifest script ${scriptName} must bind to a scene object id`)
        }
    }
    for (const scriptAssetId of scriptAssets.keys()) {
        if (!seenScriptIds.has(scriptAssetId)) {
            throw new Error(`MMOOMM app fixture authoring manifest is missing script asset ${scriptAssetId}`)
        }
    }
    for (const scriptName of ['flightControl', 'followCamera', 'remoteShips']) {
        if (!seenScriptNames.has(scriptName)) {
            throw new Error(`MMOOMM app fixture authoring manifest must publish the ${scriptName} script`)
        }
    }
}
