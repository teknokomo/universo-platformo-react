import { createLocalizedContent } from '@universo-react/utils'
import { createPlayCanvasProjectsController } from '../../domains/playcanvas-projects/controllers/playCanvasProjectsController'
import { PlayCanvasProjectsService } from '../../domains/playcanvas-projects/services/PlayCanvasProjectsService'

describe('createPlayCanvasProjectsController permissions', () => {
    it('protects PlayCanvas authoring metadata, files, and snapshots with manageMetahub', () => {
        const registrations: Array<{ returned: jest.Mock; permission?: string }> = []
        const createHandler = jest.fn((_handler: unknown, options?: { permission?: string }) => {
            const returned = jest.fn()
            registrations.push({ returned, permission: options?.permission })
            return returned
        })

        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const permissionFor = (handler: unknown): string | undefined =>
            registrations.find((registration) => registration.returned === handler)?.permission

        expect(permissionFor(ctrl.list)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getById)).toBe('manageMetahub')
        expect(permissionFor(ctrl.create)).toBe('manageMetahub')
        expect(permissionFor(ctrl.update)).toBe('manageMetahub')
        expect(permissionFor(ctrl.remove)).toBe('manageMetahub')
        expect(permissionFor(ctrl.listScenes)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getScene)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeScene)).toBe('manageMetahub')
        expect(permissionFor(ctrl.listAssets)).toBe('manageMetahub')
        expect(permissionFor(ctrl.getAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeScriptAsset)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeBinding)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeGeneratedArtifact)).toBe('manageMetahub')
        expect(permissionFor(ctrl.publishProjectState)).toBe('manageMetahub')
        expect(permissionFor(ctrl.exportProjectState)).toBe('manageMetahub')
        expect(permissionFor(ctrl.readFile)).toBe('manageMetahub')
        expect(permissionFor(ctrl.writeFile)).toBe('manageMetahub')
        expect(permissionFor(ctrl.deleteFile)).toBe('manageMetahub')
    })

    it('rejects PlayCanvas file writes without an optimistic current checksum guard', async () => {
        const writeProjectFile = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeProjectFile').mockResolvedValue({
            sourcePath: 'playcanvas-projects/018f8a78-7b8f-7c1d-a111-222233334444/scenes/scene.json',
            checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            size: 2,
            mime: 'application/json'
        })
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(function status() {
                return res
            }),
            json: jest.fn()
        }

        await ctrl.writeFile({
            req: {
                params: {
                    projectId: '018f8a78-7b8f-7c1d-a111-222233334444'
                },
                body: {
                    sourcePath: 'playcanvas-projects/018f8a78-7b8f-7c1d-a111-222233334444/scenes/scene.json',
                    contentBase64: Buffer.from('{}').toString('base64'),
                    expectedChecksum: null,
                    mime: 'application/json'
                }
            },
            res,
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: {}
        } as never)

        expect(writeProjectFile).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Invalid input'
            })
        )

        writeProjectFile.mockRestore()
    })

    it('accepts first-time PlayCanvas metadata upserts without expectedVersion', async () => {
        const projectId = '018f8a78-7b8f-7c1d-a111-222233334444'
        const sceneId = '018f8a78-7b8f-7c1d-a111-222233334445'
        const assetId = '018f8a78-7b8f-7c1d-a111-222233334446'
        const scriptAssetId = '018f8a78-7b8f-7c1d-a111-222233334447'
        const bindingId = '018f8a78-7b8f-7c1d-a111-222233334448'
        const artifactId = '018f8a78-7b8f-7c1d-a111-222233334449'
        const sceneBody = {
            codename: createLocalizedContent('en', 'main_scene'),
            displayName: createLocalizedContent('en', 'Main Scene'),
            payloadSchemaVersion: '1',
            payload: null,
            payloadFile: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/scenes/main.json`,
                hash: null,
                mime: 'application/json',
                status: 'missing'
            },
            checksum: null,
            sortOrder: 0,
            publish: true
        }
        const assetBody = {
            stableAssetId: 'texture-1',
            type: 'texture',
            name: 'Texture',
            virtualPath: ['assets', 'texture.json'],
            file: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/assets/texture.json`,
                hash: null,
                mime: 'application/json',
                status: 'missing'
            },
            metadata: {},
            publish: true
        }
        const scriptBody = {
            assetId,
            moduleId: null,
            moduleCodename: null,
            moduleSourcePath: null,
            scriptName: 'ShipController',
            scriptKind: 'esm',
            parsedAttributes: {},
            parseStatus: 'missing',
            parseDiagnostics: null
        }
        const bindingBody = {
            sceneId,
            sceneEntityStableId: 'ship-1',
            scriptAssetId,
            scriptName: 'ShipController',
            attributeValues: {},
            bindingSchemaVersion: '1',
            platformoEntityId: null,
            sortOrder: 0,
            enabled: true
        }
        const artifactBody = {
            scriptAssetId,
            sourceModuleId: null,
            sourceModuleCodename: null,
            sourceModulePath: null,
            sourceChecksum: null,
            outputFile: {
                provider: 'local',
                root: 'playcanvas-projects',
                path: `playcanvas-projects/${projectId}/generated/ship.mjs`,
                hash: null,
                mime: 'text/javascript',
                status: 'missing'
            },
            scriptName: 'ShipController',
            moduleExportName: null,
            scriptKind: 'esm',
            parseStatus: 'missing',
            generatedAt: null,
            parsedAt: null
        }
        const writeScene = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeScene').mockResolvedValue({
            ...sceneBody,
            id: sceneId,
            projectId,
            version: 1
        } as never)
        const writeAssetMetadata = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeAssetMetadata').mockResolvedValue({
            ...assetBody,
            id: assetId,
            projectId,
            version: 1
        } as never)
        const resolveScriptAsset = jest.spyOn(PlayCanvasProjectsService.prototype, 'resolveScriptAsset').mockResolvedValue({
            ...scriptBody,
            id: scriptAssetId,
            version: 1
        } as never)
        const writeSceneScriptBinding = jest.spyOn(PlayCanvasProjectsService.prototype, 'writeSceneScriptBinding').mockResolvedValue({
            ...bindingBody,
            id: bindingId,
            version: 1
        } as never)
        const upsertGeneratedArtifact = jest.spyOn(PlayCanvasProjectsService.prototype, 'upsertGeneratedArtifact').mockResolvedValue({
            ...artifactBody,
            id: artifactId,
            version: 1
        } as never)
        const createHandler = jest.fn((handler: unknown) => handler)
        const ctrl = createPlayCanvasProjectsController(createHandler as never)
        const makeRes = () => {
            const res = {
                setHeader: jest.fn(),
                status: jest.fn(),
                json: jest.fn()
            }
            res.status.mockReturnValue(res)
            return res
        }
        const baseContext = {
            metahubId: 'metahub-1',
            userId: 'user-1',
            exec: {},
            schemaService: {}
        }

        const calls = [
            {
                handler: ctrl.writeScene,
                params: { projectId, sceneId },
                body: sceneBody,
                spy: writeScene
            },
            {
                handler: ctrl.writeAsset,
                params: { projectId, assetId },
                body: assetBody,
                spy: writeAssetMetadata
            },
            {
                handler: ctrl.writeScriptAsset,
                params: { projectId, scriptAssetId },
                body: scriptBody,
                spy: resolveScriptAsset
            },
            {
                handler: ctrl.writeBinding,
                params: { projectId, bindingId },
                body: bindingBody,
                spy: writeSceneScriptBinding
            },
            {
                handler: ctrl.writeGeneratedArtifact,
                params: { projectId, artifactId },
                body: artifactBody,
                spy: upsertGeneratedArtifact
            }
        ]

        for (const call of calls) {
            const res = makeRes()
            await call.handler({
                ...baseContext,
                req: { params: call.params, body: call.body },
                res
            } as never)
            expect(res.status).not.toHaveBeenCalledWith(400)
            expect(call.spy).toHaveBeenCalledWith('metahub-1', projectId, expect.any(Object), 'user-1')
            expect(call.spy.mock.calls.at(-1)?.[2]).not.toHaveProperty('expectedVersion')
        }

        writeScene.mockRestore()
        writeAssetMetadata.mockRestore()
        resolveScriptAsset.mockRestore()
        writeSceneScriptBinding.mockRestore()
        upsertGeneratedArtifact.mockRestore()
    })
})
