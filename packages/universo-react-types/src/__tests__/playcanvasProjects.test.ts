import { describe, expect, it } from 'vitest'
import type { PackageAttachmentConfig } from '../common/packages'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_PROJECT_FILE_ROOT,
    playCanvasProjectSchema,
    playCanvasProjectSnapshotSectionSchema,
    playCanvasRuntimeManifestSchema,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasScriptFileReference
} from '../common/playcanvasProjects'

const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const vlc = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: '2026-06-03T00:00:00.000Z',
            updatedAt: '2026-06-03T00:00:00.000Z'
        }
    }
})

describe('PlayCanvas project contracts', () => {
    it('validates a project envelope', () => {
        const parsed = playCanvasProjectSchema.parse({
            schemaVersion: '1',
            id: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
            codename: vlc('main-project'),
            displayName: vlc('Main project'),
            packageRef: {
                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                version: '0.1.0',
                compatibilityStatus: 'compatible'
            },
            settings: {},
            defaultSceneId: null,
            publicationConfig: {}
        })

        expect(parsed.packageRef.packageName).toBe(PLAYCANVAS_EDITOR_PACKAGE_NAME)
    })

    it('validates a runtime manifest', () => {
        const parsed = playCanvasRuntimeManifestSchema.parse({
            schemaVersion: '1',
            projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
            sceneId: null,
            checksum: hash,
            assets: [
                {
                    id: 'scene-json',
                    type: 'scene',
                    name: 'Scene',
                    url: '/metahub/project/assets/scene.json',
                    hash
                }
            ],
            scripts: [
                {
                    id: 'script-1',
                    scriptName: 'FlightController',
                    scriptKind: 'esm',
                    artifactHash: hash,
                    attributes: {}
                }
            ]
        })

        expect(parsed.assets[0].type).toBe('scene')
    })

    it('keeps package config as pointer-only metadata', () => {
        const config: PackageAttachmentConfig = {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'embeddedIframe',
                showArtifactOnlyNotice: true
            },
            playcanvasProject: {
                defaultProjectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104'
            }
        }

        expect(config.playcanvasProject?.defaultProjectId).toBeTruthy()
        expect('scenes' in config).toBe(false)
        expect('assets' in config).toBe(false)
    })

    it('validates snapshot section version', () => {
        const parsed = playCanvasProjectSnapshotSectionSchema.parse({
            schemaVersion: 1,
            projects: [],
            scenes: [],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: [],
            runtimeManifests: []
        })

        expect(parsed.schemaVersion).toBe(1)
        expect(PLAYCANVAS_PROJECT_FILE_ROOT).toBe('playcanvas-projects')
    })

    it('classifies scene payload file references as JSON files under the scene namespace', () => {
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.json',
                mime: 'application/json'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/scene-one.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.json',
                mime: null
            })
        ).toBe(false)
    })

    it('classifies PlayCanvas asset and script file references by asset namespace and MIME class', () => {
        expect(
            isPlayCanvasAssetFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: null
            })
        ).toBe(false)
        expect(
            isPlayCanvasAssetFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
    })

    it('classifies generated artifact references as JavaScript files under the generated namespace', () => {
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: null
            })
        ).toBe(false)
    })
})
