import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { playCanvasEditorSchemaCatalogSchema } from '@universo-react/types'
import { SCHEMA_CATALOG_VERSION, buildEditorSchemaCatalog } from './schemaCatalog'

const configRoot = path.resolve(__dirname)
const rawCatalogText = fs.readFileSync(path.join(configRoot, 'generated-schema-catalog.json'), 'utf8')
const rawCatalog = JSON.parse(rawCatalogText) as Record<string, unknown>

type Field = Record<string, unknown>

const isObject = (value: unknown): value is Field => !!value && typeof value === 'object' && !Array.isArray(value)

const jsonValue = (field: unknown) => {
    let value = field
    while (isObject(value) && Array.isArray(value.anyOf)) {
        const next = value.anyOf.find((item) => isObject(item) && item.type !== 'null')
        if (!next) break
        value = next
    }
    return value
}

const collectLegacyKeywordPaths = (value: unknown, base = ''): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap((entry, index) => collectLegacyKeywordPaths(entry, `${base}.${index}`))
    }
    if (!isObject(value)) return []
    const hits = Object.keys(value)
        .filter((key) => key.startsWith('$'))
        .map((key) => `${base}.${key}`)
    return [...hits, ...Object.entries(value).flatMap(([key, entry]) => collectLegacyKeywordPaths(entry, `${base}.${key}`))]
}

const resolveVendorPath = (root: unknown, parts: string[]) => {
    let field = root
    for (const part of parts) {
        if (!isObject(field)) return null
        field = jsonValue(field)
        if (!isObject(field)) return null
        if (field['x-open-map'] === true || isObject(field.additionalProperties)) {
            field = field.additionalProperties
        } else if (field.type === 'array') {
            if (!Number.isInteger(Number(part)) || Number(part) < 0) return null
            field = field.items
        } else if (isObject(field.properties) && Object.hasOwn(field.properties, part)) {
            field = field.properties[part]
            continue
        } else {
            return null
        }
    }
    return field
}

describe('PlayCanvas Editor schema catalog', () => {
    it('exposes a versioned catalog that satisfies the shared Zod contract', () => {
        expect(SCHEMA_CATALOG_VERSION).toBe(1)
        const parsed = playCanvasEditorSchemaCatalogSchema.parse(buildEditorSchemaCatalog())
        expect(parsed.version).toBe(1)
        expect(Object.keys(parsed.documents)).toEqual(['asset', 'scene', 'settings'])
        expect(Object.keys(parsed.assetData)).toEqual(['animstategraph', 'material'])
    })

    it('stays in lockstep with the generated JSON artifact and never emits legacy $-keywords', () => {
        expect(buildEditorSchemaCatalog()).toEqual(rawCatalog)
        expect(collectLegacyKeywordPaths(rawCatalog)).toEqual([])
        expect(rawCatalogText.endsWith('\n')).toBe(true)
    })

    it('serves asset types, scoped settings defaults, component paths, and material asset data like the vendored Schema API', () => {
        const catalog = buildEditorSchemaCatalog()

        const assetTypeField = resolveVendorPath(catalog.documents.asset, ['type']) as Field
        expect(assetTypeField?.enum).toEqual(['script', 'texture', 'material', 'model', 'json', 'template'])

        const settingsDocument = catalog.documents.settings
        const projectDefaults = ['width', 'height', 'useLegacyScripts'].every((key) => {
            const field = resolveVendorPath(settingsDocument, [key]) as Field
            return typeof field?.default === 'number' || typeof field?.default === 'boolean'
        })
        expect(projectDefaults).toBe(true)
        const editorScopeFields = ['gridDivisions', 'cameraClearColor', 'locale'].map((key) =>
            resolveVendorPath(settingsDocument, ['editor', key])
        )
        for (const field of editorScopeFields) {
            expect(field).toMatchObject({ 'x-scope': 'projectUser' })
        }

        const componentsSchema = resolveVendorPath(catalog.documents.scene, ['entities', '*', 'components']) as Field
        expect(Object.keys(componentsSchema?.properties ?? {}).sort()).toEqual(['camera', 'light', 'render', 'script'])

        const materialData = catalog.assetData.material as Field
        expect(materialData.type).toBe('object')
        expect(resolveVendorPath(catalog.assetData.material, ['diffuse'])).toMatchObject({ type: 'array', default: [1, 1, 1] })
    })
})
