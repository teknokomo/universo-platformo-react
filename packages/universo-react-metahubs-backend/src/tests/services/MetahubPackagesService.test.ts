const mockListMetahubPackages = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    listMetahubPackages: (...args: unknown[]) => mockListMetahubPackages(...args)
}))

import { MetahubPackagesService } from '../../domains/packages/services/MetahubPackagesService'

const editorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`

const packageSource = (runtimeTargets: string[]) => ({
    kind: 'workspace' as const,
    packageName: '@universo-react/example',
    importName: '@universo-react/example',
    upstreamPackageName: 'example',
    upstreamVersion: '1.0.0',
    runtimeTargets
})

const createPackage = (overrides: Record<string, unknown> = {}) => ({
    id: 'attach-1',
    metahubId: 'metahub-1',
    packageId: 'pkg-1',
    packageName: '@universo-react/example',
    version: '0.1.0',
    displayName: null,
    description: null,
    source: packageSource(['client']),
    authoringSurface: {
        schemaVersion: '1',
        kind: 'none',
        supportedDisplayModes: [],
        defaultConfig: { schemaVersion: '1', kind: 'none' }
    },
    config: { schemaVersion: '1', kind: 'none' },
    attachedAt: '2026-06-01T00:00:00.000Z',
    isActive: true,
    ...overrides
})

describe('MetahubPackagesService', () => {
    const exec = { query: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('excludes authoring-only packages from runtime publication packages', async () => {
        mockListMetahubPackages.mockResolvedValue([
            createPackage({ packageName: '@universo-react/playcanvas-engine', source: packageSource(['client']) }),
            createPackage({
                packageName: editorPackageName,
                source: packageSource([]),
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'embeddedIframe',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                }
            })
        ])

        const packages = await new MetahubPackagesService(exec).listPublishedPackages('metahub-1')

        expect(packages).toEqual([
            {
                packageName: '@universo-react/playcanvas-engine',
                version: '0.1.0',
                source: packageSource(['client'])
            }
        ])
    })

    it('preserves package config in design-time metahub snapshots', async () => {
        const editorConfig = {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'openSeparately',
                developmentUrl: null,
                showArtifactOnlyNotice: false
            }
        }
        mockListMetahubPackages.mockResolvedValue([
            createPackage({
                packageName: editorPackageName,
                source: packageSource([]),
                config: editorConfig
            })
        ])

        const packages = await new MetahubPackagesService(exec).listMetahubSnapshotPackages('metahub-1')

        expect(packages).toEqual([
            {
                packageName: editorPackageName,
                version: '0.1.0',
                source: packageSource([]),
                config: editorConfig
            }
        ])
    })
})
