import type {
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset,
    PlayCanvasSourceFile,
    VersionedLocalizedContent
} from '@universo-react/types'
import { PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS, playCanvasProjectMetadataSchema } from '@universo-react/types'

export interface PlayCanvasProjectRow {
    id: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    packageName: string
    packageVersion: string | null
    compatibilityStatus: PlayCanvasProjectSummary['compatibilityStatus']
    compatibilityNotes: Record<string, unknown>
    schemaVersion: string
    settings: Record<string, unknown>
    defaultSceneId: string | null
    publicationConfig: Record<string, unknown>
    version: number
}

export interface CreatePlayCanvasProjectRowInput {
    id?: string
    codename: VersionedLocalizedContent<string>
    displayName: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    packageVersion?: string | null
    settings?: Record<string, unknown>
}

export interface UpdatePlayCanvasProjectRowInput {
    displayName?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    settings?: Record<string, unknown>
    defaultSceneId?: string | null
    expectedVersion?: number
}

export type UpsertPlayCanvasSceneInput = Omit<PlayCanvasScene, 'projectId'> & { expectedVersion?: number }
export interface PlayCanvasAssetLifecycleMetadataInput {
    editorDocumentId?: number
    editorDocumentKey?: string
}

export type UpsertPlayCanvasAssetInput = Omit<PlayCanvasAsset, 'projectId'> & {
    expectedVersion?: number
    /** Server-only lifecycle fields; generic asset callers must not provide them in metadata. */
    lifecycleMetadata?: PlayCanvasAssetLifecycleMetadataInput
}
export type UpsertPlayCanvasScriptAssetInput = PlayCanvasScriptAsset & { expectedVersion?: number }
export type UpsertPlayCanvasSceneScriptBindingInput = PlayCanvasSceneScriptBinding & { expectedVersion?: number }
export type UpsertPlayCanvasGeneratedArtifactInput = PlayCanvasGeneratedArtifact & { expectedVersion?: number }
export type UpsertPlayCanvasSourceFileInput = Omit<PlayCanvasSourceFile, 'projectId'> & { expectedVersion?: number }

export interface ReplacePlayCanvasPublicationManifestsInput {
    projectIds: readonly string[]
    manifests: readonly PlayCanvasRuntimeManifest[]
    userId: string
    replaceScope?: 'branch' | 'projects'
}

export const normalizePlayCanvasAssetMetadata = (input: UpsertPlayCanvasAssetInput): Record<string, unknown> => {
    const metadata = playCanvasProjectMetadataSchema.parse(input.metadata) as Record<string, unknown>
    const suppliedLifecycleKeys = PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS.filter((key) =>
        Object.prototype.hasOwnProperty.call(metadata, key)
    )
    if (suppliedLifecycleKeys.length > 0) {
        throw new Error(`PlayCanvas asset lifecycle metadata is reserved: ${suppliedLifecycleKeys.join(', ')}`)
    }

    const lifecycle = input.lifecycleMetadata
    if (lifecycle?.editorDocumentId !== undefined) {
        if (
            !Number.isSafeInteger(lifecycle.editorDocumentId) ||
            lifecycle.editorDocumentId <= 0 ||
            lifecycle.editorDocumentId > 2_147_483_647
        ) {
            throw new Error('PlayCanvas asset editor document id is outside the supported integer range')
        }
        metadata.editorDocumentId = lifecycle.editorDocumentId
    }
    if (lifecycle?.editorDocumentKey !== undefined) {
        if (lifecycle.editorDocumentKey.length === 0 || lifecycle.editorDocumentKey.length > 200) {
            throw new Error('PlayCanvas asset editor document key is outside the supported length range')
        }
        metadata.editorDocumentKey = lifecycle.editorDocumentKey
    }
    return metadata
}

export const projectSelect = `
    id,
    codename,
    display_name AS "displayName",
    description,
    package_name AS "packageName",
    package_version AS "packageVersion",
    compatibility_status AS "compatibilityStatus",
    compatibility_notes AS "compatibilityNotes",
    schema_version AS "schemaVersion",
    settings,
    default_scene_id AS "defaultSceneId",
    publication_config AS "publicationConfig",
    _upl_version AS "version"
`

export const sceneSelect = `
    id,
    project_id AS "projectId",
    codename,
    display_name AS "displayName",
    payload_schema_version AS "payloadSchemaVersion",
    payload,
    payload_file AS "payloadFile",
    checksum,
    sort_order AS "sortOrder",
    publish,
    _upl_version AS "version"
`

export const assetSelect = `
    id,
    project_id AS "projectId",
    stable_asset_id AS "stableAssetId",
    asset_type AS type,
    name,
    virtual_path AS "virtualPath",
    file_ref AS file,
    metadata,
    publish,
    _upl_version AS "version"
`

export const scriptAssetSelect = `
    id,
    asset_id AS "assetId",
    module_id AS "moduleId",
    module_codename AS "moduleCodename",
    module_source_path AS "moduleSourcePath",
    script_name AS "scriptName",
    script_kind AS "scriptKind",
    parsed_attributes AS "parsedAttributes",
    parse_status AS "parseStatus",
    parse_diagnostics AS "parseDiagnostics",
    _upl_version AS "version"
`

export const scriptAssetSelectWithSource = `
    sa.id,
    sa.asset_id AS "assetId",
    sa.module_id AS "moduleId",
    sa.module_codename AS "moduleCodename",
    sa.module_source_path AS "moduleSourcePath",
    sa.script_name AS "scriptName",
    sa.script_kind AS "scriptKind",
    sa.parsed_attributes AS "parsedAttributes",
    sa.parse_status AS "parseStatus",
    sa.parse_diagnostics AS "parseDiagnostics",
    sa._upl_version AS "version"
`

export const scriptAssetSelectWithAlias = `
    sa.id,
    sa.asset_id AS "assetId",
    sa.module_id AS "moduleId",
    sa.module_codename AS "moduleCodename",
    sa.module_source_path AS "moduleSourcePath",
    sa.script_name AS "scriptName",
    sa.script_kind AS "scriptKind",
    sa.parsed_attributes AS "parsedAttributes",
    sa.parse_status AS "parseStatus",
    sa.parse_diagnostics AS "parseDiagnostics",
    sa._upl_version AS "version"
`

export const bindingSelect = `
    id,
    scene_id AS "sceneId",
    scene_entity_stable_id AS "sceneEntityStableId",
    script_asset_id AS "scriptAssetId",
    script_name AS "scriptName",
    attribute_values AS "attributeValues",
    binding_schema_version AS "bindingSchemaVersion",
    platformo_entity_id AS "platformoEntityId",
    sort_order AS "sortOrder",
    enabled,
    _upl_version AS "version"
`

export const generatedArtifactSelect = `
    id,
    script_asset_id AS "scriptAssetId",
    source_module_id AS "sourceModuleId",
    source_module_codename AS "sourceModuleCodename",
    source_module_path AS "sourceModulePath",
    source_checksum AS "sourceChecksum",
    (
        COALESCE(output_file, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object('path', output_path, 'hash', output_checksum, 'mime', output_mime))
    ) AS "outputFile",
    script_name AS "scriptName",
    module_export_name AS "moduleExportName",
    script_kind AS "scriptKind",
    parse_status AS "parseStatus",
    generated_at AS "generatedAt",
    parsed_at AS "parsedAt",
    _upl_version AS "version"
`

export const sourceFileSelect = `
    id,
    project_id AS "projectId",
    stable_sourcefile_id AS "stableSourceFileId",
    name,
    virtual_path AS "virtualPath",
    (
        COALESCE(file_ref, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
            'path', file_path,
            'hash', file_hash,
            'mime', file_mime,
            'size', file_size,
            'status', status
        ))
    ) AS file,
    script_kind AS "scriptKind",
    file_hash AS checksum,
    parsed_attributes AS "parsedAttributes",
    parse_status AS "parseStatus",
    parse_diagnostics AS "parseDiagnostics",
    publish,
    _upl_version AS "version"
`
