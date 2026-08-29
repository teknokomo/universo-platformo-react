/**
 * Pure snapshot normalization and validation helpers shared by export and restore flows.
 *
 * Keeping these helpers outside the persistence facade makes their security invariants
 * independently reviewable while preserving the service's public API.
 */
import { createHash } from 'crypto'
import { computePlayCanvasRuntimeManifestChecksum } from '@universo-react/applications-backend/shared/playCanvasRuntimeManifest'
import { serialization } from '@universo-react/utils'
import {
    PLAYCANVAS_PROJECT_FILE_ROOT,
    PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES,
    PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
    isPortablePlayCanvasRuntimeDataUrl,
    normalizeMmoommRuntimeMetadata,
    type PlayCanvasAsset,
    type PlayCanvasFileReference,
    type PlayCanvasGeneratedArtifact,
    type PlayCanvasProject,
    type PlayCanvasProjectSnapshotSection,
    type PlayCanvasRuntimeManifest,
    type PlayCanvasRuntimeScriptManifest,
    type PlayCanvasScene,
    type PlayCanvasSceneScriptBinding,
    type PlayCanvasScriptAsset,
    type PlayCanvasSourceFile
} from '@universo-react/types'
import { MetahubValidationError } from '../../shared/domainErrors'
import { assertSafeRelativePlayCanvasProjectPath } from './PlayCanvasProjectFileService'

type JsonRecord = Record<string, unknown>
export const asRecord = (value: unknown): JsonRecord =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
export const asNullableRecord = (value: unknown): JsonRecord | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
export const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const mergeFileStatus = (
    file: PlayCanvasFileReference | null | undefined,
    status: unknown
): PlayCanvasFileReference | null | undefined => {
    if (!file || typeof status !== 'string' || status.length === 0) return file
    return { ...file, status: status as PlayCanvasFileReference['status'] }
}

export const stripSnapshotFileContent = (file: PlayCanvasFileReference | null | undefined): PlayCanvasFileReference | null => {
    if (!file) return null
    const { snapshotContentBase64: _snapshotContentBase64, ...rest } = file
    return rest
}

export const remapLocalProjectFilePath = (path: string, oldProjectId: string, newProjectId: string): string => {
    const safePath = assertSafeRelativePlayCanvasProjectPath(path)
    const prefix = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${oldProjectId}/`
    if (!safePath.startsWith(prefix)) {
        throw new MetahubValidationError('PlayCanvas project file path does not belong to the imported project', {
            messageCode: 'playcanvas.files.path.projectMismatch'
        })
    }
    return `${PLAYCANVAS_PROJECT_FILE_ROOT}/${newProjectId}/${safePath.slice(prefix.length)}`
}

const assertPortableRuntimeManifestUrl = (value: string | null | undefined, expectedProjectId?: string): void => {
    if (!value) return
    if (value.startsWith(`${PLAYCANVAS_PROJECT_FILE_ROOT}/`)) {
        const safePath = assertSafeRelativePlayCanvasProjectPath(value)
        if (expectedProjectId && !safePath.startsWith(`${PLAYCANVAS_PROJECT_FILE_ROOT}/${expectedProjectId}/`)) {
            throw new MetahubValidationError('PlayCanvas runtime manifest file path does not belong to its project', {
                messageCode: 'playcanvas.files.path.projectMismatch',
                projectId: expectedProjectId,
                sourcePath: safePath
            })
        }
        return
    }

    if (!isPortablePlayCanvasRuntimeDataUrl(value)) {
        throw new MetahubValidationError('PlayCanvas runtime manifest URL must be a portable base64 data URL', {
            messageCode: 'playcanvas.runtime.manifestUrlUnsupported'
        })
    }
}

export const remapOptionalRuntimePath = (path: string | null | undefined, oldProjectId: string, _newProjectId: string): string | null => {
    if (!path) return path ?? null
    if (path.startsWith(`${PLAYCANVAS_PROJECT_FILE_ROOT}/`)) {
        assertPortableRuntimeManifestUrl(path, oldProjectId)
        return null
    }
    assertPortableRuntimeManifestUrl(path)
    return path
}

const runtimeFileUrl = (file: PlayCanvasFileReference | null | undefined): string | null => {
    if (!isRuntimeReadyLocalFile(file)) return null
    if (!file.snapshotContentBase64) return null
    // Script artifacts must carry a JavaScript MIME so the runtime can import
    // them as ES modules; octet-stream data URLs are rejected by module loaders.
    // The extension fallback covers artifact rows persisted before output_mime
    // was populated.
    const isScriptPath = /\.(mjs|js)$/i.test(file.path ?? '')
    const mime =
        file.mime && PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES.includes(file.mime as (typeof PLAYCANVAS_PROJECT_SCRIPT_MIME_TYPES)[number])
            ? 'text/javascript'
            : isScriptPath
            ? 'text/javascript'
            : file.mime ?? 'application/octet-stream'
    return `data:${mime};base64,${file.snapshotContentBase64}`
}

const requireRuntimeFileUrl = (file: PlayCanvasFileReference | null | undefined, messageCode: string): string => {
    const url = runtimeFileUrl(file)
    if (!url) {
        throw new MetahubValidationError('PlayCanvas runtime manifest requires a resolved runtime file URL', {
            messageCode
        })
    }
    return url
}

const isRuntimeReadyLocalFile = (file: PlayCanvasFileReference | null | undefined): file is PlayCanvasFileReference & { path: string } =>
    file?.provider === 'local' &&
    typeof file.path === 'string' &&
    file.path.length > 0 &&
    typeof file.hash === 'string' &&
    file.hash.length > 0 &&
    (file.status === undefined || file.status === 'ready')

const isReadyStatus = (value: unknown): boolean => value === undefined || value === null || value === 'ready'
const COMPATIBILITY_SETTINGS_KEY = 'playCanvasEditorCompatibility'
const REALTIME_SETTINGS_KEY = 'playCanvasEditorRealtime'

export const stripPlayCanvasEditorPrivateUserData = (settings: JsonRecord): JsonRecord => {
    const realtimeSettings = asRecord(settings[REALTIME_SETTINGS_KEY])
    if (Object.keys(realtimeSettings).length === 0) return settings
    const { userDataDocuments: _legacyUserData, userDataDocumentsByScene: _userDataByScene, ...portableRealtimeSettings } = realtimeSettings
    return {
        ...settings,
        [REALTIME_SETTINGS_KEY]: portableRealtimeSettings
    }
}

const readMmoommRuntimeSceneMetadata = (scene: Record<string, unknown>): Record<string, unknown> | null => {
    const payload = asNullableRecord(scene.payload)
    const metadata = asNullableRecord(payload?.metadata)
    const mmoomm = asNullableRecord(metadata?.mmoomm)
    if (!mmoomm) return null
    return normalizeMmoommRuntimeMetadata(mmoomm)
}

export const remapCompatibilitySettingsDocumentIds = (settings: JsonRecord, oldProjectId: string, newProjectId: string): JsonRecord => {
    const compatibilitySettings = asRecord(settings[COMPATIBILITY_SETTINGS_KEY])
    const settingsDocuments = asRecord(compatibilitySettings.settingsDocuments)
    if (Object.keys(settingsDocuments).length === 0) {
        return settings
    }

    const remappedDocuments: JsonRecord = {}
    for (const [documentId, value] of Object.entries(settingsDocuments)) {
        let nextDocumentId = documentId
        if (documentId.startsWith(`project_${oldProjectId}_`)) {
            continue
        } else if (documentId === `project-private_${oldProjectId}`) {
            nextDocumentId = `project-private_${newProjectId}`
        } else if (documentId.startsWith('user_')) {
            continue
        }
        if (Object.prototype.hasOwnProperty.call(remappedDocuments, nextDocumentId)) {
            throw new MetahubValidationError('PlayCanvas project snapshot contains duplicate compatibility settings documents', {
                messageCode: 'playcanvas.snapshot.duplicateCompatibilitySettingsDocument',
                documentId: nextDocumentId
            })
        }
        const document = asRecord(value)
        remappedDocuments[nextDocumentId] = typeof document.documentId === 'string' ? { ...document, documentId: nextDocumentId } : value
    }

    return {
        ...settings,
        [COMPATIBILITY_SETTINGS_KEY]: {
            ...compatibilitySettings,
            settingsDocuments: remappedDocuments
        }
    }
}

const assertRuntimeReadyFileRef = (
    file: PlayCanvasFileReference | null | undefined,
    messageCode: string,
    details: Record<string, unknown> = {}
): void => {
    if (isRuntimeReadyLocalFile(file) && typeof file.snapshotContentBase64 === 'string' && file.snapshotContentBase64.length > 0) {
        return
    }

    throw new MetahubValidationError('PlayCanvas runtime manifest requires resolved runtime-ready local files', {
        messageCode,
        ...details
    })
}

const assertUniqueIds = <T extends { id: string }>(items: T[], label: string): void => {
    const seen = new Set<string>()
    for (const item of items) {
        if (seen.has(item.id)) {
            throw new MetahubValidationError('PlayCanvas project snapshot contains duplicate ids', {
                messageCode: 'playcanvas.snapshot.duplicateId',
                section: label,
                sourceId: item.id
            })
        }
        seen.add(item.id)
    }
}

const assertSetHas = (set: Set<string>, value: string, messageCode: string): void => {
    if (!set.has(value)) {
        throw new MetahubValidationError('PlayCanvas project snapshot contains an unresolved reference', {
            messageCode,
            sourceId: value
        })
    }
}

export const validateExportedProjectOwnership = (
    projects: PlayCanvasProject[],
    scenes: PlayCanvasScene[],
    assets: PlayCanvasAsset[],
    scripts: PlayCanvasScriptAsset[],
    bindings: PlayCanvasSceneScriptBinding[],
    artifacts: PlayCanvasGeneratedArtifact[],
    sourceFiles: PlayCanvasSourceFile[] = []
): void => {
    const projectIds = new Set(projects.map((project) => project.id))
    const sceneProjectById = new Map(scenes.map((scene) => [scene.id, scene.projectId]))
    const assetProjectById = new Map(assets.map((asset) => [asset.id, asset.projectId]))
    const scriptProjectById = new Map<string, string>()

    for (const scene of scenes) {
        assertSetHas(projectIds, scene.projectId, 'playcanvas.snapshot.missingProjectReference')
    }
    for (const asset of assets) {
        assertSetHas(projectIds, asset.projectId, 'playcanvas.snapshot.missingProjectReference')
    }
    for (const sourceFile of sourceFiles) {
        assertSetHas(projectIds, sourceFile.projectId, 'playcanvas.snapshot.missingProjectReference')
    }
    for (const script of scripts) {
        const projectId = assetProjectById.get(script.assetId)
        if (!projectId) {
            throw new MetahubValidationError('PlayCanvas project snapshot contains a script without an exported asset owner', {
                messageCode: 'playcanvas.snapshot.missingAssetReference',
                sourceId: script.assetId
            })
        }
        scriptProjectById.set(script.id, projectId)
    }
    for (const binding of bindings) {
        const sceneProjectId = sceneProjectById.get(binding.sceneId)
        const scriptProjectId = scriptProjectById.get(binding.scriptAssetId)
        if (!sceneProjectId || !scriptProjectId || sceneProjectId !== scriptProjectId) {
            throw new MetahubValidationError('PlayCanvas project snapshot binding crosses exported project boundaries', {
                messageCode: 'playcanvas.snapshot.bindingProjectMismatch',
                sceneId: binding.sceneId,
                scriptAssetId: binding.scriptAssetId
            })
        }
    }
    for (const artifact of artifacts) {
        if (!scriptProjectById.has(artifact.scriptAssetId)) {
            throw new MetahubValidationError('PlayCanvas project snapshot contains an artifact without an exported script owner', {
                messageCode: 'playcanvas.snapshot.missingScriptReference',
                sourceId: artifact.scriptAssetId
            })
        }
    }
}

export const assertSnapshotLocalFileReference = (
    file: PlayCanvasFileReference | null | undefined,
    expectedProjectId?: string
): string | null => {
    if (!file) return null
    if (file.provider !== 'local') {
        throw new MetahubValidationError('PlayCanvas project snapshot file provider is not supported', {
            messageCode: 'playcanvas.files.provider.unsupported',
            provider: file.provider
        })
    }
    if (file.root !== PLAYCANVAS_PROJECT_FILE_ROOT) {
        throw new MetahubValidationError('PlayCanvas project snapshot file root is not supported', {
            messageCode: 'playcanvas.files.path.namespaceRequired',
            root: file.root
        })
    }
    const safePath = assertSafeRelativePlayCanvasProjectPath(file.path)
    if (expectedProjectId && !safePath.startsWith(`${PLAYCANVAS_PROJECT_FILE_ROOT}/${expectedProjectId}/`)) {
        throw new MetahubValidationError('PlayCanvas project file path does not belong to the imported project', {
            messageCode: 'playcanvas.files.path.projectMismatch',
            projectId: expectedProjectId,
            sourcePath: safePath
        })
    }
    return safePath
}

const assertSnapshotLocalFileIsBundled = (file: PlayCanvasFileReference | null | undefined, expectedProjectId?: string): void => {
    const safePath = assertSnapshotLocalFileReference(file, expectedProjectId)
    if (!file || !safePath) return
    if (file.status === 'missing') return
    if (!file.snapshotContentBase64) {
        throw new MetahubValidationError('PlayCanvas project snapshot local file content is required', {
            messageCode: 'playcanvas.snapshot.fileContentRequired',
            sourcePath: safePath
        })
    }
    if (!file.hash) {
        throw new MetahubValidationError('PlayCanvas project snapshot file content must include a checksum', {
            messageCode: 'playcanvas.snapshot.fileHashRequired',
            sourcePath: safePath
        })
    }
}

export const readBundledScenePayload = (file: PlayCanvasFileReference | null | undefined): JsonRecord | null => {
    if (!file?.snapshotContentBase64) return null
    try {
        const parsed = JSON.parse(Buffer.from(file.snapshotContentBase64, 'base64').toString('utf8'))
        return asNullableRecord(parsed)
    } catch {
        throw new MetahubValidationError('PlayCanvas project scene payload file must contain valid JSON object content', {
            messageCode: 'playcanvas.snapshot.scenePayloadFileInvalidJson',
            sourcePath: file.path
        })
    }
}

const readSceneEntityStableIds = (scene: Record<string, unknown>, payloadFile: PlayCanvasFileReference | null): Set<string> => {
    const payload = asNullableRecord(scene.payload) ?? readBundledScenePayload(payloadFile)
    const entities = payload?.entities
    const ids = new Set<string>()
    if (Array.isArray(entities)) {
        for (const entity of entities) {
            const entityRecord = asNullableRecord(entity)
            if (typeof entityRecord?.id === 'string' && entityRecord.id.trim()) ids.add(entityRecord.id.trim())
        }
        return ids
    }
    if (entities && typeof entities === 'object') {
        for (const [key, value] of Object.entries(entities)) {
            const entityRecord = asNullableRecord(value)
            const id = typeof entityRecord?.id === 'string' && entityRecord.id.trim() ? entityRecord.id.trim() : key.trim()
            if (id) ids.add(id)
        }
    }
    return ids
}

const assertScenePayloadFileMatchesInlinePayload = (scene: PlayCanvasScene): void => {
    const inlinePayload = asNullableRecord(scene.payload)
    if (!inlinePayload) return

    const bundledPayload = readBundledScenePayload(scene.payloadFile)
    if (!bundledPayload) return

    if (serialization.stableStringify(inlinePayload) === serialization.stableStringify(bundledPayload)) {
        return
    }

    throw new MetahubValidationError('PlayCanvas project scene inline payload and bundled payload file differ', {
        messageCode: 'playcanvas.snapshot.scenePayloadFileMismatch',
        sceneId: scene.id,
        projectId: scene.projectId
    })
}

export const validateSnapshotReferencesBeforeRestore = (
    section: PlayCanvasProjectSnapshotSection,
    moduleIdMap: Map<string, string>,
    entityIdMap: Map<string, string>
): void => {
    assertUniqueIds(section.projects, 'projects')
    assertUniqueIds(section.scenes, 'scenes')
    assertUniqueIds(section.assets, 'assets')
    assertUniqueIds(section.scriptAssets, 'scriptAssets')
    assertUniqueIds(section.sceneScriptBindings, 'sceneScriptBindings')
    assertUniqueIds(section.generatedArtifacts, 'generatedArtifacts')
    assertUniqueIds(section.sourceFiles ?? [], 'sourceFiles')

    const projectIds = new Set(section.projects.map((project) => project.id))
    const sceneIds = new Set(section.scenes.map((scene) => scene.id))
    const assetIds = new Set(section.assets.map((asset) => asset.id))
    const scriptAssetIds = new Set(section.scriptAssets.map((script) => script.id))
    const sceneProjectById = new Map(section.scenes.map((scene) => [scene.id, scene.projectId]))
    const assetProjectById = new Map(section.assets.map((asset) => [asset.id, asset.projectId]))
    const scriptAssetById = new Map(section.scriptAssets.map((script) => [script.id, script.assetId]))

    for (const project of section.projects) {
        if (project.defaultSceneId) {
            assertSetHas(sceneIds, project.defaultSceneId, 'playcanvas.snapshot.missingSceneReference')
            if (sceneProjectById.get(project.defaultSceneId) !== project.id) {
                throw new MetahubValidationError('PlayCanvas project default scene belongs to another project', {
                    messageCode: 'playcanvas.snapshot.defaultSceneProjectMismatch',
                    projectId: project.id,
                    sceneId: project.defaultSceneId
                })
            }
        }
    }

    for (const scene of section.scenes) {
        assertSetHas(projectIds, scene.projectId, 'playcanvas.snapshot.missingProjectReference')
        assertSnapshotLocalFileIsBundled(scene.payloadFile, scene.projectId)
        assertScenePayloadFileMatchesInlinePayload(scene)
    }

    for (const asset of section.assets) {
        assertSetHas(projectIds, asset.projectId, 'playcanvas.snapshot.missingProjectReference')
        assertSnapshotLocalFileIsBundled(asset.file, asset.projectId)
    }

    for (const sourceFile of section.sourceFiles ?? []) {
        assertSetHas(projectIds, sourceFile.projectId, 'playcanvas.snapshot.missingProjectReference')
        assertSnapshotLocalFileIsBundled(sourceFile.file, sourceFile.projectId)
    }

    for (const script of section.scriptAssets) {
        assertSetHas(assetIds, script.assetId, 'playcanvas.snapshot.missingAssetReference')
        if (script.moduleId && !moduleIdMap.has(script.moduleId)) {
            throw new MetahubValidationError('PlayCanvas project snapshot references a missing module', {
                messageCode: 'playcanvas.snapshot.missingModuleReference',
                sourceId: script.moduleId
            })
        }
    }

    for (const binding of section.sceneScriptBindings) {
        assertSetHas(sceneIds, binding.sceneId, 'playcanvas.snapshot.missingSceneReference')
        assertSetHas(scriptAssetIds, binding.scriptAssetId, 'playcanvas.snapshot.missingScriptReference')
        const scriptAssetId = scriptAssetById.get(binding.scriptAssetId)
        const scriptProjectId = scriptAssetId ? assetProjectById.get(scriptAssetId) : undefined
        if (scriptProjectId && sceneProjectById.get(binding.sceneId) !== scriptProjectId) {
            throw new MetahubValidationError('PlayCanvas scene script binding crosses project boundaries', {
                messageCode: 'playcanvas.snapshot.bindingProjectMismatch',
                sceneId: binding.sceneId,
                scriptAssetId: binding.scriptAssetId
            })
        }
        if (binding.platformoEntityId && !entityIdMap.has(binding.platformoEntityId)) {
            throw new MetahubValidationError('PlayCanvas project snapshot references a missing entity', {
                messageCode: 'playcanvas.snapshot.missingEntityReference',
                sourceId: binding.platformoEntityId
            })
        }
    }

    for (const artifact of section.generatedArtifacts) {
        assertSetHas(scriptAssetIds, artifact.scriptAssetId, 'playcanvas.snapshot.missingScriptReference')
        if (artifact.sourceModuleId && !moduleIdMap.has(artifact.sourceModuleId)) {
            throw new MetahubValidationError('PlayCanvas project snapshot references a missing module', {
                messageCode: 'playcanvas.snapshot.missingModuleReference',
                sourceId: artifact.sourceModuleId
            })
        }
        const artifactAssetId = scriptAssetById.get(artifact.scriptAssetId)
        const artifactProjectId = artifactAssetId ? assetProjectById.get(artifactAssetId) : undefined
        assertSnapshotLocalFileIsBundled(artifact.outputFile, artifactProjectId)
    }

    for (const manifest of section.runtimeManifests ?? []) {
        assertSetHas(projectIds, manifest.projectId, 'playcanvas.snapshot.missingProjectReference')
        if (manifest.sceneId) {
            assertSetHas(sceneIds, manifest.sceneId, 'playcanvas.snapshot.missingSceneReference')
            if (sceneProjectById.get(manifest.sceneId) !== manifest.projectId) {
                throw new MetahubValidationError('PlayCanvas runtime manifest scene belongs to another project', {
                    messageCode: 'playcanvas.snapshot.manifestSceneProjectMismatch',
                    projectId: manifest.projectId,
                    sceneId: manifest.sceneId
                })
            }
        }
        for (const asset of manifest.assets) {
            assertPortableRuntimeManifestUrl(asset.url, manifest.projectId)
        }
        for (const script of manifest.scripts) {
            assertSetHas(scriptAssetIds, script.id, 'playcanvas.snapshot.missingScriptReference')
            if (script.moduleId && !moduleIdMap.has(script.moduleId)) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing module', {
                    messageCode: 'playcanvas.snapshot.missingModuleReference',
                    sourceId: script.moduleId
                })
            }
            assertPortableRuntimeManifestUrl(script.artifactUrl, manifest.projectId)
        }
    }
}

export const buildGeneratedRuntimeManifests = (
    projects: Record<string, unknown>[],
    scenes: Record<string, unknown>[],
    assets: Record<string, unknown>[],
    scriptAssets: Record<string, unknown>[],
    generatedArtifacts: Record<string, unknown>[],
    sceneScriptBindings: Record<string, unknown>[] = []
): PlayCanvasRuntimeManifest[] => {
    const scenesByProject = new Map<string, Record<string, unknown>[]>()
    const assetsByProject = new Map<string, Record<string, unknown>[]>()
    const assetsById = new Map<string, Record<string, unknown>>()
    const scriptByAsset = new Map<string, Record<string, unknown>[]>()
    const artifactByScript = new Map<string, Record<string, unknown>[]>()
    const bindingsByScript = new Map<string, Record<string, unknown>[]>()

    for (const scene of scenes) {
        if (scene.publish === false) continue
        const projectId = String(scene.projectId)
        const list = scenesByProject.get(projectId) ?? []
        list.push(scene)
        scenesByProject.set(projectId, list)
    }
    for (const asset of assets) {
        if (asset.publish === false) continue
        const projectId = String(asset.projectId)
        const list = assetsByProject.get(projectId) ?? []
        list.push(asset)
        assetsByProject.set(projectId, list)
        assetsById.set(String(asset.id), asset)
    }
    for (const script of scriptAssets) {
        const assetId = String(script.assetId)
        const list = scriptByAsset.get(assetId) ?? []
        list.push(script)
        scriptByAsset.set(assetId, list)
    }
    for (const artifact of generatedArtifacts) {
        const scriptAssetId = String(artifact.scriptAssetId)
        const list = artifactByScript.get(scriptAssetId) ?? []
        list.push(artifact)
        artifactByScript.set(scriptAssetId, list)
    }
    for (const binding of sceneScriptBindings) {
        if (binding.enabled === false) continue
        const scriptAssetId = String(binding.scriptAssetId)
        const list = bindingsByScript.get(scriptAssetId) ?? []
        list.push(binding)
        bindingsByScript.set(scriptAssetId, list)
    }

    return projects.flatMap((project): PlayCanvasRuntimeManifest[] => {
        const projectId = String(project.id)
        const publishedScenes = scenesByProject.get(projectId) ?? []
        const selectedScene = project.defaultSceneId
            ? publishedScenes.find((scene) => scene.id === project.defaultSceneId)
            : [...publishedScenes]
                  .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
                  .find((scene) => {
                      const file = asNullableRecord(scene.payloadFile) as PlayCanvasFileReference | null
                      return (
                          isRuntimeReadyLocalFile(file) &&
                          typeof file.snapshotContentBase64 === 'string' &&
                          file.snapshotContentBase64.length > 0
                      )
                  })
        if (!selectedScene) {
            if (project.defaultSceneId) {
                throw new MetahubValidationError('PlayCanvas runtime manifest default scene is not publishable', {
                    messageCode: 'playcanvas.runtime.defaultSceneNotPublishable',
                    projectId,
                    sceneId: project.defaultSceneId
                })
            }
            throw new MetahubValidationError('PlayCanvas runtime manifest requires a publishable scene', {
                messageCode: 'playcanvas.runtime.publishableSceneRequired',
                projectId
            })
        }

        const projectAssets = assetsByProject.get(projectId) ?? []
        const scenePayloadFile = asNullableRecord(selectedScene.payloadFile) as PlayCanvasFileReference | null
        assertRuntimeReadyFileRef(scenePayloadFile, 'playcanvas.runtime.sceneFileNotReady', {
            projectId,
            sceneId: selectedScene.id
        })
        const sceneEntityStableIds = readSceneEntityStableIds(selectedScene, scenePayloadFile)
        const runtimeAssets = [
            ...(scenePayloadFile
                ? [
                      {
                          id: `scene:${String(selectedScene.id)}`,
                          type: 'scene' as const,
                          name: `scene:${String(selectedScene.id)}`,
                          url: requireRuntimeFileUrl(scenePayloadFile, 'playcanvas.runtime.sceneFileUrlRequired'),
                          hash: scenePayloadFile.hash ?? null,
                          mime: scenePayloadFile.mime ?? 'application/json',
                          size: typeof scenePayloadFile.size === 'number' ? scenePayloadFile.size : null
                      }
                  ]
                : []),
            ...projectAssets.flatMap((asset) => {
                const file = asNullableRecord(asset.file) as PlayCanvasFileReference | null
                if (!file) {
                    return []
                }
                assertRuntimeReadyFileRef(file, 'playcanvas.runtime.assetFileNotReady', {
                    projectId,
                    assetId: asset.id
                })
                return [
                    {
                        id: String(asset.stableAssetId ?? asset.id),
                        type: asset.type as PlayCanvasAsset['type'],
                        name: String(asset.name),
                        url: requireRuntimeFileUrl(file, 'playcanvas.runtime.assetFileUrlRequired'),
                        hash: file.hash ?? null,
                        mime: file.mime ?? null,
                        size: typeof file.size === 'number' ? file.size : null
                    }
                ]
            })
        ]
        const runtimeScriptNames = new Set<string>()
        const runtimeScripts: PlayCanvasRuntimeScriptManifest[] = projectAssets.flatMap((asset) =>
            (scriptByAsset.get(String(asset.id)) ?? []).map((script) => {
                const scriptName = typeof script.scriptName === 'string' ? script.scriptName.trim() : ''
                if (!scriptName || scriptName !== script.scriptName) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script name is invalid', {
                        messageCode: 'playcanvas.runtime.scriptNameInvalid',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id
                    })
                }
                if (runtimeScriptNames.has(scriptName)) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest contains duplicate script names', {
                        messageCode: 'playcanvas.runtime.duplicateScriptName',
                        projectId,
                        scriptName
                    })
                }
                runtimeScriptNames.add(scriptName)
                if (!isReadyStatus(script.parseStatus)) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script asset is not ready', {
                        messageCode: 'playcanvas.runtime.scriptAssetNotReady',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id
                    })
                }
                const sourceAsset = assetsById.get(String(script.assetId))
                const sourceFile = asNullableRecord(sourceAsset?.file)
                const sourceChecksum = typeof sourceFile?.hash === 'string' ? sourceFile.hash : null
                const matchingArtifacts = (artifactByScript.get(String(script.id)) ?? []).filter(
                    (candidate) => sourceChecksum !== null && candidate.sourceChecksum === sourceChecksum
                )
                if (matchingArtifacts.length > 1) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest contains duplicate script artifacts', {
                        messageCode: 'playcanvas.runtime.duplicateScriptArtifact',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id,
                        artifactIds: matchingArtifacts.map((candidate) => candidate.id).filter((id): id is string => typeof id === 'string')
                    })
                }
                const artifact = matchingArtifacts[0]
                const outputFile = asNullableRecord(artifact?.outputFile) as PlayCanvasFileReference | null
                if (!artifact || !isReadyStatus(artifact.parseStatus)) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script artifact is not ready', {
                        messageCode: 'playcanvas.runtime.scriptArtifactNotReady',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id,
                        artifactId: artifact?.id
                    })
                }
                assertRuntimeReadyFileRef(outputFile, 'playcanvas.runtime.scriptArtifactFileNotReady', {
                    projectId,
                    assetId: asset.id,
                    scriptAssetId: script.id,
                    artifactId: artifact.id
                })
                if (String(artifact.scriptName).trim() !== scriptName || artifact.scriptKind !== script.scriptKind) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script artifact does not match its script asset', {
                        messageCode: 'playcanvas.runtime.scriptArtifactMismatch',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id,
                        artifactId: artifact.id
                    })
                }
                const sceneBindings = (bindingsByScript.get(String(script.id)) ?? []).filter(
                    (candidate) => String(candidate.sceneId) === String(selectedScene.id)
                )
                if (sceneBindings.length !== 1) {
                    throw new MetahubValidationError(
                        sceneBindings.length > 1
                            ? 'PlayCanvas runtime manifest has duplicate script bindings'
                            : 'PlayCanvas runtime manifest script has no enabled binding on the selected scene',
                        {
                            messageCode:
                                sceneBindings.length > 1
                                    ? 'playcanvas.runtime.duplicateScriptBinding'
                                    : 'playcanvas.runtime.scriptBindingRequired',
                            projectId,
                            sceneId: selectedScene.id,
                            scriptAssetId: script.id,
                            bindingIds: sceneBindings.map((candidate) => candidate.id).filter((id): id is string => typeof id === 'string')
                        }
                    )
                }
                const binding = sceneBindings[0]
                if (String(binding.scriptName ?? '').trim() !== scriptName) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest binding does not match its script asset', {
                        messageCode: 'playcanvas.runtime.scriptBindingMismatch',
                        projectId,
                        sceneId: selectedScene.id,
                        scriptAssetId: script.id,
                        bindingId: binding.id
                    })
                }
                const sceneEntityStableId = typeof binding.sceneEntityStableId === 'string' ? binding.sceneEntityStableId.trim() : ''
                if (!sceneEntityStableId) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script binding requires an entity', {
                        messageCode: 'playcanvas.runtime.scriptEntityRequired',
                        projectId,
                        sceneId: selectedScene.id,
                        scriptAssetId: script.id,
                        bindingId: binding.id
                    })
                }
                if (!sceneEntityStableIds.has(sceneEntityStableId)) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script binding references a missing scene entity', {
                        messageCode: 'playcanvas.runtime.scriptEntityMissing',
                        projectId,
                        sceneId: selectedScene.id,
                        scriptAssetId: script.id,
                        bindingId: binding.id,
                        sceneEntityStableId
                    })
                }
                return {
                    id: String(script.id),
                    scriptName,
                    scriptKind: script.scriptKind === 'classic' ? 'classic' : 'esm',
                    artifactUrl: requireRuntimeFileUrl(outputFile, 'playcanvas.runtime.scriptArtifactUrlRequired'),
                    artifactHash: outputFile?.hash ?? (typeof artifact?.sourceChecksum === 'string' ? artifact.sourceChecksum : null),
                    moduleId: typeof script.moduleId === 'string' ? script.moduleId : null,
                    moduleCodename: typeof script.moduleCodename === 'string' ? script.moduleCodename : null,
                    attributes: asRecord(script.parsedAttributes),
                    attributeValues: asRecord(binding?.attributeValues),
                    sceneEntityStableId
                }
            })
        )
        const mmoommMetadata = readMmoommRuntimeSceneMetadata(selectedScene)
        const manifestWithoutChecksum: Omit<PlayCanvasRuntimeManifest, 'checksum'> = {
            schemaVersion: PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
            projectId,
            sceneId: String(selectedScene.id),
            assets: runtimeAssets,
            scripts: runtimeScripts,
            metadata: {
                generatedFrom: 'playcanvasProjectStorageModel',
                sourceProjectChecksum: createHash('sha256')
                    .update(serialization.stableStringify({ project, selectedScene, runtimeAssets, runtimeScripts }))
                    .digest('hex'),
                ...(mmoommMetadata ? { mmoomm: mmoommMetadata } : {})
            }
        }

        return [
            {
                ...manifestWithoutChecksum,
                checksum: computePlayCanvasRuntimeManifestChecksum(manifestWithoutChecksum)
            }
        ]
    })
}
