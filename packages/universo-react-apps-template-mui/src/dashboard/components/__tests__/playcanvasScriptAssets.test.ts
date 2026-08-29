import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Script, type AppBase } from '@universo-react/playcanvas-engine'
import type { PlayCanvasRuntimeScriptManifest } from '@universo-react/types'
import {
    attachManifestScripts,
    computeScriptArtifactDigest,
    loadManifestScripts,
    ManifestScriptAssetError,
    rewritePlayCanvasModuleSpecifier
} from '../playcanvasScriptAssets'

const encoder = new TextEncoder()
const scriptBaseGlobal = '__playCanvasTestScriptBase'
const scriptArtifactUrl = 'data:text/javascript;base64,AA=='

const scriptSource = (scriptName = 'flightControl', attributes = '') =>
    `export class ${scriptName === 'flightControl' ? 'FlightControl' : 'PublishedScript'} extends globalThis.${scriptBaseGlobal} {
    static scriptName = '${scriptName}'${attributes}
}`

const createScriptManifest = (overrides: Partial<PlayCanvasRuntimeScriptManifest> = {}): PlayCanvasRuntimeScriptManifest => ({
    id: 'script-asset-1',
    scriptName: 'flightControl',
    scriptKind: 'script',
    artifactUrl: scriptArtifactUrl,
    artifactHash: null,
    moduleId: null,
    moduleCodename: null,
    attributes: {},
    attributeValues: {},
    sceneEntityStableId: 'ship-1',
    ...overrides
})

const createApp = (add = vi.fn(), addSchema = vi.fn()) =>
    ({
        scripts: { add, addSchema }
    } as unknown as AppBase)

const responseFor = (source: string): Response =>
    ({
        ok: true,
        arrayBuffer: async () => encoder.encode(source).buffer
    } as Response)

afterEach(() => {
    vi.unstubAllGlobals()
})

beforeEach(() => {
    vi.stubGlobal(scriptBaseGlobal, Script)
})

describe('loadManifestScripts', () => {
    it('rewrites the external PlayCanvas import for blob modules using the document import map', () => {
        vi.stubGlobal('document', {
            baseURI: 'http://localhost:3100/a/demo',
            querySelector: vi.fn(() => ({ textContent: JSON.stringify({ imports: { playcanvas: '/vendor/playcanvas/playcanvas.mjs' } }) }))
        })

        expect(rewritePlayCanvasModuleSpecifier('import { Script } from "playcanvas"')).toBe(
            'import { Script } from "http://localhost:3100/vendor/playcanvas/playcanvas.mjs"'
        )
    })

    it('fails closed before import when an artifact hash does not match', async () => {
        const source = scriptSource()
        const add = vi.fn()
        const createObjectUrl = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() })

        await expect(loadManifestScripts(createApp(add), [createScriptManifest({ artifactHash: '0'.repeat(64) })])).rejects.toMatchObject<
            Partial<ManifestScriptAssetError>
        >({ code: 'scriptHashMismatch', scriptName: 'flightControl' })
        expect(createObjectUrl).not.toHaveBeenCalled()
        expect(add).not.toHaveBeenCalled()
    })

    it('fetches, hash-verifies, imports and registers script classes through an object URL', async () => {
        const source = `${scriptSource()}
export const helper = 42`
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        const add = vi.fn()
        const revokeObjectUrl = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: revokeObjectUrl
        })

        await expect(loadManifestScripts(createApp(add), [createScriptManifest({ artifactHash: checksum })])).resolves.toEqual([
            'flightControl'
        ])
        expect(add).toHaveBeenCalledTimes(1)
        expect((add.mock.calls[0]?.[0] as { scriptName?: string })?.scriptName).toBe('flightControl')
        expect(revokeObjectUrl).toHaveBeenCalledWith(moduleUrl)
    })

    it('registers static ESM attributes as an app script schema', async () => {
        const source = scriptSource(
            'flightControl',
            "\n    static attributes = { controlledEntityId: { type: 'string', default: 'controlled' } }"
        )
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        const add = vi.fn()
        const addSchema = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await loadManifestScripts(createApp(add, addSchema), [createScriptManifest({ artifactHash: checksum })])

        expect(addSchema).toHaveBeenCalledWith('flightControl', {
            attributes: { controlledEntityId: { type: 'string', default: 'controlled' } }
        })
    })

    it('preserves the PlayCanvas script registry context while adding a schema', async () => {
        const source = scriptSource(
            'flightControl',
            "\n    static attributes = { controlledEntityId: { type: 'string', default: 'controlled' } }"
        )
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        const schemas: Record<string, unknown> = {}
        const scripts = {
            add: vi.fn(),
            addSchema(this: typeof scripts, name: string, schema: unknown) {
                schemas[name] = schema
                expect(this).toBe(scripts)
            }
        }
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await loadManifestScripts({ scripts } as unknown as AppBase, [createScriptManifest({ artifactHash: checksum })])

        expect(schemas.flightControl).toEqual({
            attributes: { controlledEntityId: { type: 'string', default: 'controlled' } }
        })
    })

    it('maps unavailable artifacts to a typed fetch failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false } as Response))
        )

        await expect(loadManifestScripts(createApp(), [createScriptManifest()])).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({
            code: 'scriptFetchFailed',
            scriptName: 'flightControl'
        })
    })

    it('rejects external artifact URLs before making a network request', async () => {
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)

        await expect(
            loadManifestScripts(createApp(), [createScriptManifest({ artifactUrl: 'https://attacker.example/script.mjs' })])
        ).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({
            code: 'scriptFetchFailed',
            scriptName: 'flightControl'
        })
        expect(fetch).not.toHaveBeenCalled()
    })

    it('maps artifact body read failures to a typed fetch failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('body stream aborted')
            })
        )

        await expect(loadManifestScripts(createApp(), [createScriptManifest()])).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({
            code: 'scriptFetchFailed',
            scriptName: 'flightControl'
        })
    })

    it('maps app-scoped registry failures to a typed registration failure and revokes the URL', async () => {
        const source = scriptSource()
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        const revokeObjectUrl = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: revokeObjectUrl
        })

        await expect(
            loadManifestScripts(
                createApp(
                    vi.fn(() => {
                        throw new Error('duplicate script')
                    })
                ),
                [createScriptManifest({ artifactHash: checksum })]
            )
        ).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({ code: 'scriptRegistrationFailed', scriptName: 'flightControl' })
        expect(revokeObjectUrl).toHaveBeenCalledWith(moduleUrl)
    })

    it('fails closed when the PlayCanvas registry rejects a script class', async () => {
        const source = scriptSource()
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await expect(
            loadManifestScripts(createApp(vi.fn(() => false)), [createScriptManifest({ artifactHash: checksum })])
        ).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({ code: 'scriptRegistrationFailed', scriptName: 'flightControl' })
    })

    it('requires exported classes to inherit from the PlayCanvas Script base', async () => {
        const source = `export class FlightControl { static scriptName = 'flightControl' }`
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        const add = vi.fn()
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await expect(loadManifestScripts(createApp(add), [createScriptManifest({ artifactHash: checksum })])).rejects.toMatchObject<
            Partial<ManifestScriptAssetError>
        >({ code: 'scriptRegistrationFailed', scriptName: 'flightControl' })
        expect(add).not.toHaveBeenCalled()
    })

    it('rejects duplicate script exports from one artifact', async () => {
        const source = `${scriptSource()}
export { FlightControl as DuplicateFlightControl }`
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await expect(loadManifestScripts(createApp(), [createScriptManifest({ artifactHash: checksum })])).rejects.toMatchObject<
            Partial<ManifestScriptAssetError>
        >({ code: 'scriptDuplicateName', scriptName: 'flightControl' })
    })

    it('rejects an additional exported Script class that is absent from the manifest', async () => {
        const source = `${scriptSource()}
export class ExtraScript extends globalThis.${scriptBaseGlobal} {
    static scriptName = 'extraScript'
}`
        const checksum = await computeScriptArtifactDigest(encoder.encode(source).buffer)
        const moduleUrl = `data:text/javascript,${encodeURIComponent(source)}`
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(source))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => moduleUrl),
            revokeObjectURL: vi.fn()
        })

        await expect(loadManifestScripts(createApp(), [createScriptManifest({ artifactHash: checksum })])).rejects.toMatchObject<
            Partial<ManifestScriptAssetError>
        >({ code: 'scriptRegistrationFailed', scriptName: 'flightControl' })
    })

    it('rejects duplicate manifest script names before fetching any artifact', async () => {
        const fetch = vi.fn()
        vi.stubGlobal('fetch', fetch)

        await expect(
            loadManifestScripts(createApp(), [createScriptManifest(), createScriptManifest({ id: 'script-asset-2' })])
        ).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({ code: 'scriptDuplicateName', scriptName: 'flightControl' })
        expect(fetch).not.toHaveBeenCalled()
    })

    it('does not let a previously loaded script satisfy a later artifact', async () => {
        const firstSource = scriptSource()
        const secondSource = `export const helper = 42`
        const firstChecksum = await computeScriptArtifactDigest(encoder.encode(firstSource).buffer)
        const secondChecksum = await computeScriptArtifactDigest(encoder.encode(secondSource).buffer)
        const firstUrl = `data:text/javascript,${encodeURIComponent(firstSource)}`
        const secondUrl = `data:text/javascript,${encodeURIComponent(secondSource)}`
        let fetchIndex = 0
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responseFor(fetchIndex++ === 0 ? firstSource : secondSource))
        )
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => (fetchIndex === 1 ? firstUrl : secondUrl)),
            revokeObjectURL: vi.fn()
        })

        await expect(
            loadManifestScripts(createApp(), [
                createScriptManifest({ artifactHash: firstChecksum }),
                createScriptManifest({ scriptName: 'followCamera', artifactHash: secondChecksum })
            ])
        ).rejects.toMatchObject<Partial<ManifestScriptAssetError>>({
            code: 'scriptRegistrationFailed',
            scriptName: 'followCamera'
        })
    })
})

describe('attachManifestScripts', () => {
    it('adds a script component and passes authored attribute values unchanged', () => {
        const create = vi.fn(() => ({}))
        const entity: { script?: { create: typeof create }; addComponent: ReturnType<typeof vi.fn> } = {
            addComponent: vi.fn(function (this: typeof entity, type: string) {
                expect(type).toBe('script')
                this.script = { create }
            })
        }
        const attributes = { cruiseSpeed: 25, cameraDistance: 36, enabled: true }

        attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest({ attributeValues: attributes })])

        expect(entity.addComponent).toHaveBeenCalledWith('script')
        expect(create).toHaveBeenCalledWith('flightControl', { attributes })
    })

    it('reuses an existing script component', () => {
        const create = vi.fn(() => ({}))
        const entity = { script: { create }, addComponent: vi.fn() }

        attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest()])

        expect(entity.addComponent).not.toHaveBeenCalled()
        expect(create).toHaveBeenCalledWith('flightControl', { attributes: {} })
    })

    it('fails closed when adding the script component does not expose a create method', () => {
        const entity = { addComponent: vi.fn(() => ({})) }

        expect(() => attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest()])).toThrowError(
            expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptComponentMissing', scriptName: 'flightControl' })
        )
    })

    it('fails closed when PlayCanvas cannot create the authored script instance', () => {
        const entity = { script: { create: vi.fn(() => null) }, addComponent: vi.fn() }

        expect(() => attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest()])).toThrowError(
            expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptCreateFailed', scriptName: 'flightControl' })
        )
    })

    it('fails closed when adding a PlayCanvas script component throws', () => {
        const entity = {
            addComponent: vi.fn(() => {
                throw new Error('component creation failed')
            })
        }

        expect(() => attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest()])).toThrowError(
            expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptComponentMissing', scriptName: 'flightControl' })
        )
    })

    it('fails closed when the script component returns a non-instance value', () => {
        const entity = { script: { create: vi.fn(() => false) }, addComponent: vi.fn() }

        expect(() => attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest()])).toThrowError(
            expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptCreateFailed', scriptName: 'flightControl' })
        )
    })

    it('rejects duplicate script names before mutating any entity', () => {
        const addComponent = vi.fn()
        const entity = { addComponent }

        expect(() =>
            attachManifestScripts(new Map([['ship-1', entity]]), [createScriptManifest(), createScriptManifest({ id: 'script-asset-2' })])
        ).toThrowError(expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptDuplicateName' }))
        expect(addComponent).not.toHaveBeenCalled()
    })

    it('fails closed when the authored scene entity is missing', () => {
        expect(() => attachManifestScripts(new Map(), [createScriptManifest()])).toThrowError(
            expect.objectContaining<Partial<ManifestScriptAssetError>>({ code: 'scriptEntityMissing', scriptName: 'flightControl' })
        )
    })
})
