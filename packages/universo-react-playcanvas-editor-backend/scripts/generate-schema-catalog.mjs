#!/usr/bin/env node

// Deterministic generator for the versioned PlayCanvas Editor schema catalog
// (`{ version: 1, documents, assetData }`) consumed by the vendored Editor
// v2.30.4 `src/editor-api/schema.ts`. The catalog is derived by converting the
// legacy Universo `$`-keyword tree that used to live in buildDefaultEditorSchema:
//
//   $type -> type | $default -> default | $enum -> enum
//   $scope -> x-scope    | $of -> additionalProperties (vendor open-map lookup)
//
// Unknown `$`-keys fail closed so the catalog can never silently drift from the
// legacy semantics. Run from the package root: node scripts/generate-schema-catalog.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA_CATALOG_VERSION = 1

const legacyUniversoEditorSchema = {
    asset: { type: { $enum: ['script', 'texture', 'material', 'model', 'json', 'template'] } },
    animstategraphData: {},
    materialData: {
        name: { $type: 'string', $default: 'Untitled Material' },
        shader: { $type: 'string', $default: 'blinn' },
        diffuse: { $type: 'array', $default: [1, 1, 1] },
        opacity: { $type: 'number', $default: 1 },
        alphaTest: { $type: 'number', $default: 0 },
        blendType: { $type: 'number', $default: 0 },
        depthTest: { $type: 'boolean', $default: true },
        depthWrite: { $type: 'boolean', $default: true },
        emissive: { $type: 'array', $default: [0, 0, 0] },
        emissiveIntensity: { $type: 'number', $default: 1 },
        useFog: { $type: 'boolean', $default: true },
        useLighting: { $type: 'boolean', $default: true },
        useSkybox: { $type: 'boolean', $default: true },
        cull: { $type: 'number', $default: 1 }
    },
    scene: {
        entities: {
            $of: {
                components: {
                    camera: { enabled: { $type: 'boolean', $default: true } },
                    light: { enabled: { $type: 'boolean', $default: true } },
                    render: {
                        enabled: { $type: 'boolean', $default: true },
                        type: { $type: 'string', $default: 'box' },
                        asset: { $default: null },
                        materialAssets: { $type: 'array', $default: [null] },
                        layers: { $type: 'array', $default: [0] },
                        castShadows: { $type: 'boolean', $default: true },
                        receiveShadows: { $type: 'boolean', $default: true },
                        castShadowsLightmap: { $type: 'boolean', $default: true },
                        lightmapped: { $type: 'boolean', $default: false },
                        isStatic: { $type: 'boolean', $default: false },
                        batchGroupId: { $default: null },
                        rootBone: { $default: null }
                    },
                    script: {
                        enabled: { $type: 'boolean', $default: true },
                        scripts: { $type: 'array', $default: [] },
                        order: { $type: 'array', $default: [] }
                    }
                }
            }
        },
        settings: { physics: {}, render: {} }
    },
    settings: {
        width: { $type: 'number', $default: 1280, $scope: 'project' },
        height: { $type: 'number', $default: 720, $scope: 'project' },
        useLegacyScripts: { $type: 'boolean', $default: false, $scope: 'project' },
        editor: {
            gridDivisions: { $type: 'number', $default: 8, $scope: 'projectUser' },
            gridDivisionSize: { $type: 'number', $default: 1, $scope: 'projectUser' },
            snapIncrement: { $type: 'number', $default: 1, $scope: 'projectUser' },
            cameraGrabDepth: { $type: 'boolean', $default: false, $scope: 'projectUser' },
            cameraGrabColor: { $type: 'boolean', $default: false, $scope: 'projectUser' },
            cameraNearClip: { $type: 'number', $default: 0.0001, $scope: 'projectUser' },
            cameraFarClip: { $type: 'number', $default: 10000, $scope: 'projectUser' },
            cameraClearColor: { $type: 'array', $default: [0.118, 0.118, 0.118, 1], $scope: 'projectUser' },
            cameraToneMapping: { $type: 'number', $default: 0, $scope: 'projectUser' },
            cameraGammaCorrection: { $type: 'number', $default: 1, $scope: 'projectUser' },
            showFog: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            locale: { $type: 'string', $default: 'en-US', $scope: 'projectUser' },
            renameDuplicatedEntities: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            lightmapperAutoBake: { $type: 'boolean', $default: true, $scope: 'projectUser' },
            codeEditor: { $type: 'string', $default: 'web', $scope: 'projectUser' },
            zoomSensitivity: { $type: 'number', $default: 1, $scope: 'user' },
            gizmoSize: { $type: 'number', $default: 1, $scope: 'user' },
            gizmoPreset: { $type: 'string', $default: 'default', $scope: 'user' },
            showViewCube: { $type: 'boolean', $default: true, $scope: 'user' },
            viewCubeSize: { $type: 'number', $default: 1, $scope: 'user' },
            iconSize: { $type: 'number', $default: 32, $scope: 'user' },
            showSkeleton: { $type: 'boolean', $default: true, $scope: 'user' }
        }
    }
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const LEGACY_KEYWORDS = new Set(['$type', '$default', '$enum', '$of', '$scope', '$minItems', '$maxItems'])

const convertLegacyEditorSchemaNode = (node, nodePath) => {
    if (!isPlainObject(node)) {
        throw new Error(`Legacy schema node at '${nodePath}' must be an object`)
    }

    for (const key of Object.keys(node)) {
        if (key.startsWith('$') && !LEGACY_KEYWORDS.has(key)) {
            throw new Error(`Unknown legacy schema keyword '${key}' at '${nodePath}'`)
        }
    }

    const result = {}
    if (typeof node.$type === 'string') result.type = node.$type
    if (Object.hasOwn(node, '$default')) result.default = structuredClone(node.$default)
    if (Array.isArray(node.$enum)) result.enum = [...node.$enum]
    if (typeof node.$scope === 'string') result['x-scope'] = node.$scope
    if (Number.isInteger(node.$minItems)) result.minItems = node.$minItems
    if (Number.isInteger(node.$maxItems)) result.maxItems = node.$maxItems

    const childKeys = Object.keys(node).filter((key) => !key.startsWith('$'))
    if (isPlainObject(node.$of)) {
        if (childKeys.length > 0) {
            throw new Error(`Legacy open-map node at '${nodePath}' must not mix '$of' with child fields`)
        }
        result.type = result.type ?? 'object'
        result.additionalProperties = convertLegacyEditorSchemaNode(node.$of, `${nodePath}.*`)
        return result
    }

    const hasScalarKeywords = 'type' in result || 'default' in result || 'enum' in result
    if (childKeys.length > 0 || !hasScalarKeywords) {
        result.type = result.type ?? 'object'
        result.properties = Object.fromEntries(
            childKeys.map((key) => [key, convertLegacyEditorSchemaNode(node[key], `${nodePath}.${key}`)])
        )
    }
    return result
}

const deriveEditorSchemaCatalogFromLegacy = (legacyTree) => {
    const documentNames = ['asset', 'scene', 'settings']
    const assetDataByType = {}
    for (const [key, value] of Object.entries(legacyTree)) {
        if (documentNames.includes(key)) continue
        if (!key.endsWith('Data')) {
            throw new Error(`Unexpected legacy top-level schema document '${key}'`)
        }
        const assetType = key.slice(0, -'Data'.length).toLowerCase()
        assetDataByType[assetType] = convertLegacyEditorSchemaNode(value, key)
    }

    return {
        version: SCHEMA_CATALOG_VERSION,
        documents: Object.fromEntries(documentNames.map((name) => [name, convertLegacyEditorSchemaNode(legacyTree[name], name)])),
        assetData: assetDataByType
    }
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = path.join(packageRoot, 'src', 'config', 'generated-schema-catalog.json')

const catalog = deriveEditorSchemaCatalogFromLegacy(legacyUniversoEditorSchema)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 4)}\n`, 'utf8')
console.log(`[generate-schema-catalog] wrote ${path.relative(packageRoot, outputPath)} (version ${catalog.version})`)
