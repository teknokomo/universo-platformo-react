import { resolvePackageAttachmentConfig } from '../../domains/packages/services/packageConfigValidation'

describe('packageConfigValidation', () => {
    const authoringSurface = {
        schemaVersion: '1' as const,
        kind: 'playcanvasEditor' as const,
        packageSlug: 'playcanvas-editor',
        supportedDisplayModes: ['embeddedIframe' as const, 'openSeparately' as const],
        defaultConfig: {
            schemaVersion: '1' as const,
            kind: 'display' as const,
            display: {
                mode: 'embeddedIframe' as const,
                developmentUrl: null,
                showArtifactOnlyNotice: true
            }
        },
        artifact: {
            packageName: '@universo-react/playcanvas-editor' as const,
            manifestFileName: 'universo-artifact-manifest.json' as const,
            outputRoot: 'dist/editor' as const,
            smokeMode: 'artifact-only' as const
        }
    }

    it('preserves PlayCanvas default project settings while normalizing display config', () => {
        const config = resolvePackageAttachmentConfig(
            {
                schemaVersion: '1',
                kind: 'display',
                display: {
                    mode: 'embeddedIframe',
                    developmentUrl: 'https://example.invalid/editor',
                    showArtifactOnlyNotice: false
                },
                playcanvasProject: {
                    defaultProjectId: '019e8afa-0000-7000-8000-000000000001'
                }
            },
            authoringSurface
        )

        expect(config).toEqual({
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'embeddedIframe',
                developmentUrl: null,
                showArtifactOnlyNotice: false
            },
            playcanvasProject: {
                defaultProjectId: '019e8afa-0000-7000-8000-000000000001'
            }
        })
    })
})
