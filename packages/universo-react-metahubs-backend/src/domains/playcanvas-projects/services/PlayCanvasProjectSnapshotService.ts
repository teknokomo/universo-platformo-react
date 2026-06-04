import { createHash } from 'crypto'
import { qSchemaTable } from '@universo-react/database'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
    PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
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
    playCanvasProjectSnapshotSectionSchema
} from '@universo-react/types'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubValidationError } from '../../shared/domainErrors'
import { PlayCanvasProjectFileService } from './PlayCanvasProjectFileService'

type JsonRecord = Record<string, unknown>
interface PlayCanvasSnapshotExportOptions {
    includeRuntimeManifests?: boolean
    projectIds?: readonly string[]
}

type SnapshotRestoreTransaction = {
    withSchema(schemaName: string): {
        from(tableName: string): { del(): Promise<unknown> }
        into(tableName: string): { insert(row: Record<string, unknown>): Promise<unknown> }
    }
}

export interface RestoredPlayCanvasProjectFileBackup {
    sourcePath: string
    previousContent: Buffer | null
    writtenChecksum: string
    mime: string | null
}

export interface StalePlayCanvasProjectFileCandidate {
    sourcePath: string
    checksum: string | null
}

const asRecord = (value: unknown): JsonRecord => (value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {})
const asNullableRecord = (value: unknown): JsonRecord | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const mergeFileStatus = (file: PlayCanvasFileReference | null | undefined, status: unknown): PlayCanvasFileReference | null | undefined => {
    if (!file || typeof status !== 'string' || status.length === 0) return file
    return { ...file, status: status as PlayCanvasFileReference['status'] }
}

const stripSnapshotFileContent = (file: PlayCanvasFileReference | null | undefined): PlayCanvasFileReference | null => {
    if (!file) return null
    const { snapshotContentBase64: _snapshotContentBase64, ...rest } = file
    return rest
}

const remapLocalProjectFilePath = (path: string, oldProjectId: string, newProjectId: string): string => {
    const prefix = `playcanvas-projects/${oldProjectId}/`
    if (!path.startsWith(prefix)) {
        throw new MetahubValidationError('PlayCanvas project file path does not belong to the imported project', {
            messageCode: 'playcanvas.files.path.projectMismatch'
        })
    }
    return `playcanvas-projects/${newProjectId}/${path.slice(prefix.length)}`
}

const remapOptionalRuntimePath = (path: string | null | undefined, _oldProjectId: string, _newProjectId: string): string | null => {
    if (!path) return path ?? null
    if (path.startsWith('playcanvas-projects/')) {
        return null
    }
    return path
}

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`
    }
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`
}

const createRuntimeManifestChecksum = (manifest: Omit<PlayCanvasRuntimeManifest, 'checksum'>): string =>
    createHash('sha256').update(stableStringify(manifest)).digest('hex')

const runtimeFileUrl = (file: PlayCanvasFileReference | null | undefined): string | null => {
    if (!isRuntimeReadyLocalFile(file)) return null
    if (!file.snapshotContentBase64) return null
    return `data:${file.mime ?? 'application/octet-stream'};base64,${file.snapshotContentBase64}`
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

const validateExportedProjectOwnership = (
    projects: PlayCanvasProject[],
    scenes: PlayCanvasScene[],
    assets: PlayCanvasAsset[],
    scripts: PlayCanvasScriptAsset[],
    bindings: PlayCanvasSceneScriptBinding[],
    artifacts: PlayCanvasGeneratedArtifact[]
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

const assertSnapshotLocalFileIsBundled = (file: PlayCanvasFileReference | null | undefined): void => {
    if (!file || file.provider !== 'local') return
    if (file.status === 'missing') return
    if (!file.snapshotContentBase64) {
        throw new MetahubValidationError('PlayCanvas project snapshot local file content is required', {
            messageCode: 'playcanvas.snapshot.fileContentRequired',
            sourcePath: file.path
        })
    }
    if (!file.hash) {
        throw new MetahubValidationError('PlayCanvas project snapshot file content must include a checksum', {
            messageCode: 'playcanvas.snapshot.fileHashRequired',
            sourcePath: file.path
        })
    }
}

const validateSnapshotReferencesBeforeRestore = (
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
        assertSnapshotLocalFileIsBundled(scene.payloadFile)
    }

    for (const asset of section.assets) {
        assertSetHas(projectIds, asset.projectId, 'playcanvas.snapshot.missingProjectReference')
        assertSnapshotLocalFileIsBundled(asset.file)
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
        assertSnapshotLocalFileIsBundled(artifact.outputFile)
    }

    for (const manifest of section.runtimeManifests ?? []) {
        assertSetHas(projectIds, manifest.projectId, 'playcanvas.snapshot.missingProjectReference')
        if (manifest.sceneId) {
            assertSetHas(sceneIds, manifest.sceneId, 'playcanvas.snapshot.missingSceneReference')
        }
        for (const script of manifest.scripts) {
            assertSetHas(scriptAssetIds, script.id, 'playcanvas.snapshot.missingScriptReference')
            if (script.moduleId && !moduleIdMap.has(script.moduleId)) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing module', {
                    messageCode: 'playcanvas.snapshot.missingModuleReference',
                    sourceId: script.moduleId
                })
            }
        }
    }
}

const buildGeneratedRuntimeManifests = (
    projects: Record<string, unknown>[],
    scenes: Record<string, unknown>[],
    assets: Record<string, unknown>[],
    scriptAssets: Record<string, unknown>[],
    generatedArtifacts: Record<string, unknown>[],
    sceneScriptBindings: Record<string, unknown>[] = []
): PlayCanvasRuntimeManifest[] => {
    const scenesByProject = new Map<string, Record<string, unknown>[]>()
    const assetsByProject = new Map<string, Record<string, unknown>[]>()
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
        const runtimeScripts: PlayCanvasRuntimeScriptManifest[] = projectAssets.flatMap((asset) =>
            (scriptByAsset.get(String(asset.id)) ?? []).map((script) => {
                if (!isReadyStatus(script.parseStatus)) {
                    throw new MetahubValidationError('PlayCanvas runtime manifest script asset is not ready', {
                        messageCode: 'playcanvas.runtime.scriptAssetNotReady',
                        projectId,
                        assetId: asset.id,
                        scriptAssetId: script.id
                    })
                }
                const artifact = (artifactByScript.get(String(script.id)) ?? [])[0]
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
                const binding = (bindingsByScript.get(String(script.id)) ?? []).find(
                    (candidate) => String(candidate.sceneId) === String(selectedScene.id)
                )
                return {
                    id: String(script.id),
                    scriptName: String(script.scriptName),
                    scriptKind: script.scriptKind === 'classic' ? 'classic' : 'esm',
                    artifactUrl: requireRuntimeFileUrl(outputFile, 'playcanvas.runtime.scriptArtifactUrlRequired'),
                    artifactHash: outputFile?.hash ?? (typeof artifact?.sourceChecksum === 'string' ? artifact.sourceChecksum : null),
                    moduleId: typeof script.moduleId === 'string' ? script.moduleId : null,
                    moduleCodename: typeof script.moduleCodename === 'string' ? script.moduleCodename : null,
                    attributes: asRecord(script.parsedAttributes),
                    attributeValues: asRecord(binding?.attributeValues),
                    sceneEntityStableId: typeof binding?.sceneEntityStableId === 'string' ? String(binding.sceneEntityStableId) : null
                }
            })
        )
        const manifestWithoutChecksum: Omit<PlayCanvasRuntimeManifest, 'checksum'> = {
            schemaVersion: PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
            projectId,
            sceneId: String(selectedScene.id),
            assets: runtimeAssets,
            scripts: runtimeScripts,
            metadata: {
                generatedFrom: 'playcanvasProjectStorageModel',
                sourceProjectChecksum: createHash('sha256')
                    .update(stableStringify({ project, selectedScene, runtimeAssets, runtimeScripts }))
                    .digest('hex')
            }
        }

        return [
            {
                ...manifestWithoutChecksum,
                checksum: createRuntimeManifestChecksum(manifestWithoutChecksum)
            }
        ]
    })
}

export class PlayCanvasProjectSnapshotService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly fileService = new PlayCanvasProjectFileService()
    ) {}

    async exportSnapshot(
        metahubId: string,
        options: PlayCanvasSnapshotExportOptions = {}
    ): Promise<PlayCanvasProjectSnapshotSection | undefined> {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        return this.exportSnapshotFromSchema(metahubId, schemaName, options)
    }

    async exportProjectSnapshot(metahubId: string, projectId: string): Promise<PlayCanvasProjectSnapshotSection | undefined> {
        const schemaName = await this.schemaService.ensureSchema(metahubId)
        return this.exportSnapshotFromSchema(metahubId, schemaName, {
            includeRuntimeManifests: true,
            projectIds: [projectId]
        })
    }

    async exportSnapshotFromSchema(
        metahubId: string,
        schemaName: string,
        options: PlayCanvasSnapshotExportOptions = {}
    ): Promise<PlayCanvasProjectSnapshotSection | undefined> {
        const scope = { metahubId, branchSlug: schemaName }
        if (!(await this.hasPlayCanvasProjectStorage(schemaName))) {
            return undefined
        }
        const projectIds = options.projectIds?.map((id) => id.trim()).filter(Boolean)
        const projectFilter = projectIds?.length ? ' AND p.id::text = ANY($1::text[])' : ''
        const projectParams = projectIds?.length ? [projectIds] : []
        const projects = await this.exec.query<Record<string, unknown>>(
            `SELECT p.id, p.codename, p.display_name AS "displayName", p.description, p.package_name AS "packageName",
                    p.package_version AS "packageVersion", p.compatibility_status AS "compatibilityStatus",
                    p.compatibility_notes AS "compatibilityNotes", p.schema_version AS "schemaVersion",
                    p.settings, p.default_scene_id AS "defaultSceneId", p.publication_config AS "publicationConfig"
               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p
              WHERE p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY p._upl_updated_at ASC, p.id ASC`,
            projectParams
        )

        if (projectIds?.length) {
            const foundProjectIds = new Set(projects.map((project) => String(project.id)))
            const missingProjectIds = [...new Set(projectIds)].filter((projectId) => !foundProjectIds.has(projectId))
            if (missingProjectIds.length > 0) {
                throw new MetahubValidationError('Requested PlayCanvas project was not found in the metahub branch', {
                    messageCode: 'playcanvas.snapshot.projectNotFound',
                    metahubId,
                    schemaName,
                    projectIds: missingProjectIds
                })
            }
        }

        if (projects.length === 0) {
            return undefined
        }

        const scenes = await this.exec.query<Record<string, unknown>>(
            `SELECT s.id, s.project_id AS "projectId", s.codename, s.display_name AS "displayName",
                    s.payload_schema_version AS "payloadSchemaVersion", s.payload, s.payload_file AS "payloadFile",
                    s.checksum, s.sort_order AS "sortOrder", s.publish, s.status
              FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p ON p.id = s.project_id
              WHERE s._upl_deleted = false AND s._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY s.project_id ASC, s.sort_order ASC, s.id ASC`,
            projectParams
        )
        const assets = await this.exec.query<Record<string, unknown>>(
            `SELECT a.id, a.project_id AS "projectId", a.stable_asset_id AS "stableAssetId", a.asset_type AS type, a.name,
                    a.virtual_path AS "virtualPath", a.file_ref AS file, a.metadata, a.publish, a.status
               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p ON p.id = a.project_id
              WHERE a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY a.project_id ASC, a.name ASC, a.id ASC`,
            projectParams
        )
        const scriptAssets = await this.exec.query<Record<string, unknown>>(
            `SELECT sa.id, sa.asset_id AS "assetId", sa.module_id AS "moduleId", sa.module_codename AS "moduleCodename",
                    sa.module_source_path AS "moduleSourcePath", sa.script_name AS "scriptName", sa.script_kind AS "scriptKind",
                    sa.parsed_attributes AS "parsedAttributes", sa.parse_status AS "parseStatus", sa.parse_diagnostics AS "parseDiagnostics"
               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p ON p.id = a.project_id
              WHERE sa._upl_deleted = false AND sa._mhb_deleted = false
                AND a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY sa.asset_id ASC, sa.script_name ASC, sa.id ASC`,
            projectParams
        )
        const bindings = await this.exec.query<Record<string, unknown>>(
            `SELECT b.id, b.scene_id AS "sceneId", b.scene_entity_stable_id AS "sceneEntityStableId",
                    b.script_asset_id AS "scriptAssetId", b.script_name AS "scriptName",
                    b.attribute_values AS "attributeValues", b.binding_schema_version AS "bindingSchemaVersion",
                    b.platformo_entity_id AS "platformoEntityId", b.sort_order AS "sortOrder", b.enabled
               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_scene_script_bindings')} b
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_scenes')} s ON s.id = b.scene_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = b.script_asset_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p ON p.id = s.project_id AND p.id = a.project_id
              WHERE b._upl_deleted = false AND b._mhb_deleted = false
                AND s._upl_deleted = false AND s._mhb_deleted = false
                AND sa._upl_deleted = false AND sa._mhb_deleted = false
                AND a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY b.scene_id ASC, b.sort_order ASC, b.id ASC`,
            projectParams
        )
        const generatedArtifacts = await this.exec.query<Record<string, unknown>>(
            `SELECT ga.id, ga.script_asset_id AS "scriptAssetId", ga.source_module_id AS "sourceModuleId",
                    ga.source_module_codename AS "sourceModuleCodename", ga.source_module_path AS "sourceModulePath",
                    ga.source_checksum AS "sourceChecksum", ga.output_file AS "outputFile", ga.script_name AS "scriptName",
                    ga.module_export_name AS "moduleExportName", ga.script_kind AS "scriptKind", ga.parse_status AS "parseStatus",
                    ga.generated_at AS "generatedAt", ga.parsed_at AS "parsedAt"
               FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_generated_artifacts')} ga
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
               JOIN ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')} p ON p.id = a.project_id
              WHERE ga._upl_deleted = false AND ga._mhb_deleted = false
                AND sa._upl_deleted = false AND sa._mhb_deleted = false
                AND a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false${projectFilter}
              ORDER BY ga.script_asset_id ASC, ga.id ASC`,
            projectParams
        )
        const withFilePayload = async (file: unknown): Promise<PlayCanvasFileReference | null> => {
            const fileRef = asNullableRecord(file) as PlayCanvasFileReference | null
            if (!fileRef || fileRef.provider !== 'local' || typeof fileRef.path !== 'string') {
                return fileRef
            }
            if (fileRef.status === 'missing') {
                return {
                    ...fileRef,
                    snapshotContentBase64: null
                }
            }
            try {
                const read = await this.fileService.read(scope, fileRef.path)
                if (fileRef.hash && fileRef.hash !== read.checksum) {
                    throw new MetahubValidationError('PlayCanvas project file checksum does not match stored metadata', {
                        messageCode: 'playcanvas.files.path.checksumMismatch',
                        sourcePath: fileRef.path,
                        expectedChecksum: fileRef.hash,
                        actualChecksum: read.checksum
                    })
                }
                return {
                    ...fileRef,
                    hash: read.checksum,
                    size: read.size,
                    snapshotContentBase64: read.content.toString('base64')
                }
            } catch (error) {
                if (error instanceof MetahubValidationError) {
                    throw error
                }
                throw new MetahubValidationError('PlayCanvas project file is missing from local storage', {
                    messageCode: 'playcanvas.files.path.missing',
                    sourcePath: fileRef.path
                })
            }
        }
        const snapshotProjects = projects.map(
            (row): PlayCanvasProject => ({
                schemaVersion: String(row.schemaVersion ?? PLAYCANVAS_PROJECT_SCHEMA_VERSION) as typeof PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                id: String(row.id),
                codename: row.codename as PlayCanvasProject['codename'],
                displayName: row.displayName as PlayCanvasProject['displayName'],
                description: (row.description as PlayCanvasProject['description']) ?? null,
                packageRef: {
                    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                    version: typeof row.packageVersion === 'string' ? row.packageVersion : null,
                    compatibilityStatus:
                        row.compatibilityStatus === 'compatible'
                            ? 'compatible'
                            : (row.compatibilityStatus as PlayCanvasProject['packageRef']['compatibilityStatus']),
                    compatibilityNotes: asRecord(row.compatibilityNotes)
                },
                settings: asRecord(row.settings),
                defaultSceneId: typeof row.defaultSceneId === 'string' ? row.defaultSceneId : null,
                publicationConfig: asRecord(row.publicationConfig)
            })
        )
        const snapshotScenes = await Promise.all(
            scenes.map(
                async (row): Promise<PlayCanvasScene> => ({
                    id: String(row.id),
                    projectId: String(row.projectId),
                    codename: row.codename as PlayCanvasScene['codename'],
                    displayName: row.displayName as PlayCanvasScene['displayName'],
                    payloadSchemaVersion: String(row.payloadSchemaVersion ?? '1'),
                    payload: asNullableRecord(row.payload),
                    payloadFile:
                        options.includeRuntimeManifests && row.publish === false
                            ? mergeFileStatus(asNullableRecord(row.payloadFile) as PlayCanvasFileReference | null, row.status) ?? null
                            : mergeFileStatus(await withFilePayload(row.payloadFile), row.status) ?? null,
                    checksum: typeof row.checksum === 'string' ? row.checksum : null,
                    sortOrder: Number(row.sortOrder ?? 0),
                    publish: row.publish !== false
                })
            )
        )
        const snapshotAssets = await Promise.all(
            assets.map(
                async (row): Promise<PlayCanvasAsset> => ({
                    id: String(row.id),
                    projectId: String(row.projectId),
                    stableAssetId: String(row.stableAssetId),
                    type: row.type as PlayCanvasAsset['type'],
                    name: String(row.name),
                    virtualPath: asStringArray(row.virtualPath),
                    file:
                        options.includeRuntimeManifests && row.publish === false
                            ? mergeFileStatus(asNullableRecord(row.file) as PlayCanvasFileReference | null, row.status) ?? null
                            : mergeFileStatus(await withFilePayload(row.file), row.status) ?? null,
                    metadata: asRecord(row.metadata),
                    publish: row.publish !== false
                })
            )
        )
        const snapshotScriptAssets = scriptAssets.map(
            (row): PlayCanvasScriptAsset => ({
                id: String(row.id),
                assetId: String(row.assetId),
                moduleId: typeof row.moduleId === 'string' ? row.moduleId : null,
                moduleCodename: typeof row.moduleCodename === 'string' ? row.moduleCodename : null,
                moduleSourcePath: typeof row.moduleSourcePath === 'string' ? row.moduleSourcePath : null,
                scriptName: String(row.scriptName),
                scriptKind: row.scriptKind === 'classic' ? 'classic' : 'esm',
                parsedAttributes: asRecord(row.parsedAttributes),
                parseStatus: (row.parseStatus as PlayCanvasScriptAsset['parseStatus']) ?? 'ready',
                parseDiagnostics: asNullableRecord(row.parseDiagnostics)
            })
        )
        const publishableScriptAssetIds = new Set(
            snapshotScriptAssets
                .filter((script) => {
                    const asset = snapshotAssets.find((item) => item.id === script.assetId)
                    return asset?.publish !== false && asset?.type === 'script'
                })
                .map((script) => script.id)
        )
        const snapshotSceneScriptBindings = bindings.map(
            (row): PlayCanvasSceneScriptBinding => ({
                id: String(row.id),
                sceneId: String(row.sceneId),
                sceneEntityStableId: String(row.sceneEntityStableId),
                scriptAssetId: String(row.scriptAssetId),
                scriptName: String(row.scriptName),
                attributeValues: asRecord(row.attributeValues),
                bindingSchemaVersion: String(row.bindingSchemaVersion ?? '1'),
                platformoEntityId: typeof row.platformoEntityId === 'string' ? row.platformoEntityId : null,
                sortOrder: Number(row.sortOrder ?? 0),
                enabled: row.enabled !== false
            })
        )
        const snapshotGeneratedArtifacts = await Promise.all(
            generatedArtifacts.map(
                async (row): Promise<PlayCanvasGeneratedArtifact> => ({
                    id: String(row.id),
                    scriptAssetId: String(row.scriptAssetId),
                    sourceModuleId: typeof row.sourceModuleId === 'string' ? row.sourceModuleId : null,
                    sourceModuleCodename: typeof row.sourceModuleCodename === 'string' ? row.sourceModuleCodename : null,
                    sourceModulePath: typeof row.sourceModulePath === 'string' ? row.sourceModulePath : null,
                    sourceChecksum: typeof row.sourceChecksum === 'string' ? row.sourceChecksum : null,
                    outputFile:
                        options.includeRuntimeManifests && !publishableScriptAssetIds.has(String(row.scriptAssetId))
                            ? (asRecord(row.outputFile) as unknown as PlayCanvasFileReference)
                            : (await withFilePayload(row.outputFile)) ?? (asRecord(row.outputFile) as unknown as PlayCanvasFileReference),
                    scriptName: String(row.scriptName),
                    moduleExportName: typeof row.moduleExportName === 'string' ? row.moduleExportName : null,
                    scriptKind: row.scriptKind === 'classic' ? 'classic' : 'esm',
                    parseStatus: (row.parseStatus as PlayCanvasGeneratedArtifact['parseStatus']) ?? 'ready',
                    generatedAt:
                        row.generatedAt instanceof Date ? row.generatedAt.toISOString() : (row.generatedAt as string | null) ?? null,
                    parsedAt: row.parsedAt instanceof Date ? row.parsedAt.toISOString() : (row.parsedAt as string | null) ?? null
                })
            )
        )
        validateExportedProjectOwnership(
            snapshotProjects,
            snapshotScenes,
            snapshotAssets,
            snapshotScriptAssets,
            snapshotSceneScriptBindings,
            snapshotGeneratedArtifacts
        )

        const snapshot: PlayCanvasProjectSnapshotSection = {
            schemaVersion: PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION,
            projects: snapshotProjects,
            scenes: snapshotScenes,
            assets: snapshotAssets,
            scriptAssets: snapshotScriptAssets,
            sceneScriptBindings: snapshotSceneScriptBindings,
            generatedArtifacts: snapshotGeneratedArtifacts
        }
        if (options.includeRuntimeManifests) {
            snapshot.runtimeManifests = buildGeneratedRuntimeManifests(
                snapshotProjects as unknown as Record<string, unknown>[],
                snapshotScenes as unknown as Record<string, unknown>[],
                snapshotAssets as unknown as Record<string, unknown>[],
                snapshotScriptAssets as unknown as Record<string, unknown>[],
                snapshotGeneratedArtifacts as unknown as Record<string, unknown>[],
                snapshotSceneScriptBindings as unknown as Record<string, unknown>[]
            )
        }
        return snapshot
    }

    private async hasPlayCanvasProjectStorage(schemaName: string): Promise<boolean> {
        const rows = await this.exec.query<{ exists: boolean | string | number }>(
            `SELECT EXISTS (
                 SELECT 1
                   FROM information_schema.tables
                  WHERE table_schema = $1
                    AND table_name = $2
             ) AS "exists"`,
            [schemaName, '_mhb_playcanvas_projects']
        )
        const exists = rows[0]?.exists
        return exists === true || exists === 't' || exists === 'true' || exists === 1
    }

    async collectStoredLocalFileCandidates(
        metahubId: string,
        schemaName?: string
    ): Promise<Map<string, StalePlayCanvasProjectFileCandidate>> {
        const resolvedSchemaName = schemaName ?? (await this.schemaService.ensureSchema(metahubId))
        const rows = await this.exec.query<{ fileRef: unknown }>(
            `SELECT s.payload_file AS "fileRef"
               FROM ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_scenes')} s
               JOIN ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_projects')} p ON p.id = s.project_id
              WHERE s._upl_deleted = false AND s._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false
                AND s.payload_file IS NOT NULL
             UNION ALL
             SELECT a.file_ref AS "fileRef"
               FROM ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_assets')} a
               JOIN ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_projects')} p ON p.id = a.project_id
              WHERE a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false
                AND a.file_ref IS NOT NULL
             UNION ALL
             SELECT ga.output_file AS "fileRef"
               FROM ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_generated_artifacts')} ga
               JOIN ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_script_assets')} sa ON sa.id = ga.script_asset_id
               JOIN ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_assets')} a ON a.id = sa.asset_id
               JOIN ${qSchemaTable(resolvedSchemaName, '_mhb_playcanvas_projects')} p ON p.id = a.project_id
              WHERE ga._upl_deleted = false AND ga._mhb_deleted = false
                AND sa._upl_deleted = false AND sa._mhb_deleted = false
                AND a._upl_deleted = false AND a._mhb_deleted = false
                AND p._upl_deleted = false AND p._mhb_deleted = false
                AND ga.output_file IS NOT NULL`,
            []
        )
        const scope = { metahubId, branchSlug: resolvedSchemaName }
        const candidates = new Map<string, StalePlayCanvasProjectFileCandidate>()
        for (const row of rows) {
            const file = asNullableRecord(row.fileRef) as PlayCanvasFileReference | null
            if (!file || file.provider !== 'local' || typeof file.path !== 'string' || candidates.has(file.path)) {
                continue
            }
            const stat = await this.fileService.stat(scope, file.path)
            candidates.set(file.path, {
                sourcePath: file.path,
                checksum: stat.checksum
            })
        }
        return candidates
    }

    async restoreSnapshot(params: {
        trx: SnapshotRestoreTransaction
        metahubId: string
        schemaName: string
        snapshot: PlayCanvasProjectSnapshotSection | undefined
        moduleIdMap: Map<string, string>
        entityIdMap: Map<string, string>
        userId: string
        restoredFileBackups?: RestoredPlayCanvasProjectFileBackup[]
    }): Promise<Map<string, string>> {
        let section = params.snapshot
        if (!section) {
            return new Map()
        }

        const parsed = playCanvasProjectSnapshotSectionSchema.safeParse(section)
        if (!parsed.success || section.schemaVersion !== PLAYCANVAS_PROJECT_SNAPSHOT_SCHEMA_VERSION) {
            throw new MetahubValidationError('Unsupported PlayCanvas project snapshot section', {
                messageCode: 'playcanvas.snapshot.unsupportedVersion',
                schemaVersion: section.schemaVersion
            })
        }
        section = parsed.data
        validateSnapshotReferencesBeforeRestore(section, params.moduleIdMap, params.entityIdMap)

        const scope = { metahubId: params.metahubId, branchSlug: params.schemaName }
        const now = new Date()
        const projectIdMap = new Map(section.projects.map((project) => [project.id, generateUuidV7()]))
        const sceneIdMap = new Map(section.scenes.map((scene) => [scene.id, generateUuidV7()]))
        const assetIdMap = new Map(section.assets.map((asset) => [asset.id, generateUuidV7()]))
        const scriptAssetIdMap = new Map(section.scriptAssets.map((script) => [script.id, generateUuidV7()]))
        const bindingIdMap = new Map(section.sceneScriptBindings.map((binding) => [binding.id, generateUuidV7()]))
        const artifactIdMap = new Map(section.generatedArtifacts.map((artifact) => [artifact.id, generateUuidV7()]))

        const requireMapped = (map: Map<string, string>, value: string, messageCode: string): string => {
            const mapped = map.get(value)
            if (!mapped) {
                throw new MetahubValidationError('PlayCanvas project snapshot contains an unresolved reference', {
                    messageCode,
                    sourceId: value
                })
            }
            return mapped
        }
        const remapExternalModuleId = (value: string | null | undefined): string | null => {
            if (!value) return null
            const mapped = params.moduleIdMap.get(value)
            if (!mapped) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing module', {
                    messageCode: 'playcanvas.snapshot.missingModuleReference',
                    sourceId: value
                })
            }
            return mapped
        }
        const remapExternalEntityId = (value: string | null | undefined): string | null => {
            if (!value) return null
            const mapped = params.entityIdMap.get(value)
            if (!mapped) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing entity', {
                    messageCode: 'playcanvas.snapshot.missingEntityReference',
                    sourceId: value
                })
            }
            return mapped
        }
        const remapFile = (
            file: PlayCanvasFileReference | null | undefined,
            oldProjectId: string,
            newProjectId: string
        ): PlayCanvasFileReference | null => {
            if (!file) return null
            return {
                ...file,
                path: file.provider === 'local' ? remapLocalProjectFilePath(file.path, oldProjectId, newProjectId) : file.path
            }
        }

        const writeFile = async (file: PlayCanvasFileReference | null | undefined): Promise<PlayCanvasFileReference | null> => {
            if (!file) return null
            if (file.provider === 'local' && file.path) {
                if (file.status === 'missing') {
                    return stripSnapshotFileContent(file)
                }
                if (!file.snapshotContentBase64) {
                    throw new MetahubValidationError('PlayCanvas project snapshot local file content is required', {
                        messageCode: 'playcanvas.snapshot.fileContentRequired',
                        sourcePath: file.path
                    })
                }
                if (!file.hash) {
                    throw new MetahubValidationError('PlayCanvas project snapshot file content must include a checksum', {
                        messageCode: 'playcanvas.snapshot.fileHashRequired'
                    })
                }
                const buffer = Buffer.from(file.snapshotContentBase64, 'base64')
                const previous = await this.fileService.read(scope, file.path).catch((error: NodeJS.ErrnoException) => {
                    if (error.code === 'ENOENT') return null
                    throw error
                })
                const written = await this.fileService.write(scope, file.path, buffer, {
                    expectedChecksum: file.hash ?? undefined,
                    mime: file.mime ?? null
                })
                params.restoredFileBackups?.push({
                    sourcePath: file.path,
                    previousContent: previous?.content ?? null,
                    writtenChecksum: written.checksum,
                    mime: file.mime ?? null
                })
            }
            return stripSnapshotFileContent(file)
        }

        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_publication_manifests').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_generated_artifacts').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_scene_script_bindings').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_script_assets').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_assets').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_scenes').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_package_compatibility').del()
        await params.trx.withSchema(params.schemaName).from('_mhb_playcanvas_projects').del()

        for (const project of section.projects) {
            const projectId = requireMapped(projectIdMap, project.id, 'playcanvas.snapshot.missingProjectReference')
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_projects')
                .insert({
                    id: projectId,
                    codename: project.codename,
                    display_name: project.displayName,
                    description: project.description ?? null,
                    package_name: project.packageRef.packageName,
                    package_version: project.packageRef.version,
                    compatibility_status: project.packageRef.compatibilityStatus,
                    compatibility_notes: project.packageRef.compatibilityNotes ?? {},
                    schema_version: project.schemaVersion,
                    settings: project.settings,
                    default_scene_id: project.defaultSceneId
                        ? requireMapped(sceneIdMap, project.defaultSceneId, 'playcanvas.snapshot.missingSceneReference')
                        : null,
                    publication_config: project.publicationConfig,
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const scene of section.scenes) {
            const oldProjectId = scene.projectId
            const projectId = requireMapped(projectIdMap, oldProjectId, 'playcanvas.snapshot.missingProjectReference')
            const sceneId = requireMapped(sceneIdMap, scene.id, 'playcanvas.snapshot.missingSceneReference')
            const payloadFile = remapFile(scene.payloadFile, oldProjectId, projectId)
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_scenes')
                .insert({
                    id: sceneId,
                    project_id: projectId,
                    codename: scene.codename,
                    display_name: scene.displayName,
                    payload_schema_version: scene.payloadSchemaVersion,
                    payload: scene.payload ?? null,
                    payload_file: await writeFile(payloadFile),
                    checksum: scene.checksum ?? null,
                    sort_order: scene.sortOrder,
                    publish: scene.publish,
                    status: payloadFile?.status ?? 'ready',
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const asset of section.assets) {
            const oldProjectId = asset.projectId
            const projectId = requireMapped(projectIdMap, oldProjectId, 'playcanvas.snapshot.missingProjectReference')
            const file = await writeFile(remapFile(asset.file, oldProjectId, projectId))
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_assets')
                .insert({
                    id: requireMapped(assetIdMap, asset.id, 'playcanvas.snapshot.missingAssetReference'),
                    project_id: projectId,
                    stable_asset_id: asset.stableAssetId,
                    asset_type: asset.type,
                    name: asset.name,
                    virtual_path: asset.virtualPath,
                    file_ref: file,
                    file_hash: file?.hash ?? null,
                    mime: file?.mime ?? null,
                    size: file?.size ?? null,
                    provider: file?.provider ?? 'local',
                    metadata: asset.metadata,
                    publish: asset.publish,
                    status: file?.status ?? 'ready',
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const script of section.scriptAssets) {
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_script_assets')
                .insert({
                    id: requireMapped(scriptAssetIdMap, script.id, 'playcanvas.snapshot.missingScriptReference'),
                    asset_id: requireMapped(assetIdMap, script.assetId, 'playcanvas.snapshot.missingAssetReference'),
                    module_id: remapExternalModuleId(script.moduleId),
                    module_codename: script.moduleCodename ?? null,
                    module_source_path: script.moduleSourcePath ?? null,
                    script_name: script.scriptName,
                    script_kind: script.scriptKind,
                    parsed_attributes: script.parsedAttributes,
                    parse_status: script.parseStatus,
                    parse_diagnostics: script.parseDiagnostics ?? null,
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const binding of section.sceneScriptBindings) {
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_scene_script_bindings')
                .insert({
                    id: requireMapped(bindingIdMap, binding.id, 'playcanvas.snapshot.missingBindingReference'),
                    scene_id: requireMapped(sceneIdMap, binding.sceneId, 'playcanvas.snapshot.missingSceneReference'),
                    scene_entity_stable_id: binding.sceneEntityStableId,
                    script_asset_id: requireMapped(scriptAssetIdMap, binding.scriptAssetId, 'playcanvas.snapshot.missingScriptReference'),
                    script_name: binding.scriptName,
                    attribute_values: binding.attributeValues,
                    binding_schema_version: binding.bindingSchemaVersion,
                    platformo_entity_id: remapExternalEntityId(binding.platformoEntityId),
                    sort_order: binding.sortOrder,
                    enabled: binding.enabled,
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const artifact of section.generatedArtifacts) {
            const scriptSource = section.scriptAssets.find((script) => script.id === artifact.scriptAssetId)
            if (!scriptSource) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing script asset', {
                    messageCode: 'playcanvas.snapshot.missingScriptReference',
                    sourceId: artifact.scriptAssetId
                })
            }
            const assetSource = section.assets.find((asset) => asset.id === scriptSource.assetId)
            if (!assetSource) {
                throw new MetahubValidationError('PlayCanvas project snapshot references a missing asset', {
                    messageCode: 'playcanvas.snapshot.missingAssetReference',
                    sourceId: scriptSource.assetId
                })
            }
            const outputFile = await writeFile(
                remapFile(
                    artifact.outputFile,
                    assetSource.projectId,
                    requireMapped(projectIdMap, assetSource.projectId, 'playcanvas.snapshot.missingProjectReference')
                )
            )
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_generated_artifacts')
                .insert({
                    id: requireMapped(artifactIdMap, artifact.id, 'playcanvas.snapshot.missingArtifactReference'),
                    script_asset_id: requireMapped(scriptAssetIdMap, artifact.scriptAssetId, 'playcanvas.snapshot.missingScriptReference'),
                    source_module_id: remapExternalModuleId(artifact.sourceModuleId),
                    source_module_codename: artifact.sourceModuleCodename ?? null,
                    source_module_path: artifact.sourceModulePath ?? null,
                    source_checksum: artifact.sourceChecksum ?? null,
                    output_file: outputFile ?? {},
                    output_path: outputFile?.path ?? '',
                    output_checksum: outputFile?.hash ?? '',
                    output_mime: outputFile?.mime ?? null,
                    script_name: artifact.scriptName,
                    module_export_name: artifact.moduleExportName ?? null,
                    script_kind: artifact.scriptKind,
                    parse_status: artifact.parseStatus,
                    generated_at: artifact.generatedAt ? new Date(artifact.generatedAt) : null,
                    parsed_at: artifact.parsedAt ? new Date(artifact.parsedAt) : null,
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        for (const manifest of section.runtimeManifests ?? []) {
            const { checksum: _originalChecksum, ...manifestWithoutChecksum } = manifest
            const remappedProjectId = requireMapped(projectIdMap, manifest.projectId, 'playcanvas.snapshot.missingProjectReference')
            const remappedManifestWithoutChecksum: Omit<PlayCanvasRuntimeManifest, 'checksum'> = {
                ...manifestWithoutChecksum,
                projectId: remappedProjectId,
                sceneId: manifest.sceneId ? requireMapped(sceneIdMap, manifest.sceneId, 'playcanvas.snapshot.missingSceneReference') : null,
                assets: manifest.assets.map((asset) => ({
                    ...asset,
                    url: remapOptionalRuntimePath(asset.url, manifest.projectId, remappedProjectId)
                })),
                scripts: manifest.scripts.map((script) => ({
                    ...script,
                    id: requireMapped(scriptAssetIdMap, script.id, 'playcanvas.snapshot.missingScriptReference'),
                    artifactUrl: remapOptionalRuntimePath(script.artifactUrl, manifest.projectId, remappedProjectId),
                    moduleId: remapExternalModuleId(script.moduleId)
                }))
            }
            const remappedManifest: PlayCanvasRuntimeManifest = {
                ...remappedManifestWithoutChecksum,
                checksum: createRuntimeManifestChecksum(remappedManifestWithoutChecksum)
            }
            await params.trx
                .withSchema(params.schemaName)
                .into('_mhb_playcanvas_publication_manifests')
                .insert({
                    project_id: remappedManifest.projectId,
                    selected_scene_id: remappedManifest.sceneId ?? null,
                    manifest_schema_version: remappedManifest.schemaVersion ?? PLAYCANVAS_RUNTIME_MANIFEST_SCHEMA_VERSION,
                    runtime_manifest: remappedManifest,
                    manifest_checksum: remappedManifest.checksum,
                    source_project_checksum: remappedManifest.metadata?.sourceProjectChecksum ?? null,
                    published: true,
                    _upl_created_at: now,
                    _upl_created_by: params.userId,
                    _upl_updated_at: now,
                    _upl_updated_by: params.userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }

        return projectIdMap
    }
}
