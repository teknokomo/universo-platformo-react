import type { DbExecutor } from '@universo-react/utils'
import { builtinPackageSeeds } from '../../domains/packages/data'
import {
    PackageSeeder,
    isLegacyBuiltinPackageSeed,
    legacyBuiltinPackageSeedChecksumSource,
    packageAuthoringSettingsSeedChecksumSource
} from '../../domains/packages/services/PackageSeeder'

describe('PackageSeeder', () => {
    const exec: DbExecutor = {
        query: jest.fn()
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(exec.query).mockResolvedValue([{ id: 'pkg-1' }])
    })

    it('idempotently upserts the built-in package registry entries', async () => {
        const logger = { info: jest.fn(), error: jest.fn() }

        await new PackageSeeder(exec, { logger, failFast: true }).seed()

        expect(exec.query).toHaveBeenCalledTimes(5)
        expect(builtinPackageSeeds.map((seed) => seed.packageName)).toEqual([
            '@universo-react/colyseus-client',
            '@universo-react/colyseus-server',
            '@universo-react/playcanvas-engine',
            '@universo-react/playcanvas-editor-frontend'
        ])
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (package_name, version)'), expect.any(Array))
        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith('[PackageSeeder] Seed complete: 4 upserted, 0 errors')
    })

    it('keeps the legacy seed migration checksum immutable for already-applied migrations', () => {
        expect(legacyBuiltinPackageSeedChecksumSource).toContain('@universo-react/colyseus-client')
        expect(legacyBuiltinPackageSeedChecksumSource).toContain('@universo-react/colyseus-server')
        expect(legacyBuiltinPackageSeedChecksumSource).toContain('@universo-react/playcanvas-engine')
        expect(legacyBuiltinPackageSeedChecksumSource).not.toContain('@universo-react/playcanvas-editor-frontend')
        expect(legacyBuiltinPackageSeedChecksumSource).not.toContain('playcanvasEditor')
    })

    it('can run the legacy seed subset without seeding the authoring-only editor package', async () => {
        const logger = { info: jest.fn(), error: jest.fn() }

        await new PackageSeeder(exec, { logger, failFast: true, packageFilter: isLegacyBuiltinPackageSeed }).seed()

        expect(exec.query).toHaveBeenCalledTimes(3)
        expect(logger.info).toHaveBeenCalledWith('[PackageSeeder] Seed complete: 3 upserted, 0 errors')
        expect(JSON.stringify(jest.mocked(exec.query).mock.calls)).not.toContain('@universo-react/playcanvas-editor-frontend')
    })

    it('ties the authoring settings migration checksum to the current package seed contract', () => {
        expect(packageAuthoringSettingsSeedChecksumSource).toContain('@universo-react/playcanvas-editor-frontend')
        expect(packageAuthoringSettingsSeedChecksumSource).toContain('playcanvasEditor')
    })

    it('keeps PlayCanvas Engine product naming untranslated in Russian seed content', () => {
        const playcanvas = builtinPackageSeeds.find((seed) => seed.packageName === '@universo-react/playcanvas-engine')

        expect(playcanvas?.displayName.locales.ru.content).toBe('PlayCanvas Engine')
        expect(playcanvas?.description?.locales.ru.content).toContain('PlayCanvas Engine')
    })

    it('seeds PlayCanvas Editor with an authoring-only display config contract', () => {
        const playcanvasEditor = builtinPackageSeeds.find((seed) => seed.packageName === '@universo-react/playcanvas-editor-frontend')

        expect(playcanvasEditor?.source.runtimeTargets).toEqual([])
        expect(playcanvasEditor?.authoringSurface).toMatchObject({
            schemaVersion: '1',
            kind: 'playcanvasEditor',
            packageSlug: 'playcanvas-editor',
            supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately', 'developmentUrl'],
            defaultConfig: {
                schemaVersion: '1',
                kind: 'display',
                display: {
                    mode: 'embeddedIframe',
                    developmentUrl: null,
                    showArtifactOnlyNotice: true
                }
            },
            artifact: {
                packageName: '@universo-react/playcanvas-editor-frontend',
                manifestFileName: 'universo-artifact-manifest.json',
                outputRoot: 'dist/editor',
                smokeMode: 'universo-hosted'
            }
        })
    })

    it('rejects malformed package authoring surface seed descriptors before upsert', async () => {
        const logger = { info: jest.fn(), error: jest.fn() }
        const playcanvasEditor = builtinPackageSeeds.find((seed) => seed.packageName === '@universo-react/playcanvas-editor-frontend')
        expect(playcanvasEditor).toBeDefined()
        if (!playcanvasEditor) {
            throw new Error('PlayCanvas Editor seed is missing')
        }
        const malformedSeed = {
            ...playcanvasEditor,
            packageName: '@universo-react/playcanvas-editor-frontend-malformed',
            authoringSurface: {
                schemaVersion: '1',
                kind: 'playcanvasEditor',
                packageSlug: '../playcanvas-editor',
                supportedDisplayModes: ['embeddedIframe'],
                defaultConfig: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'embeddedIframe',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                },
                artifact: {
                    packageName: '@universo-react/playcanvas-editor-frontend',
                    manifestFileName: 'universo-artifact-manifest.json',
                    outputRoot: 'dist/editor',
                    smokeMode: 'artifact-only'
                }
            }
        } as (typeof builtinPackageSeeds)[number]
        builtinPackageSeeds.push(malformedSeed)

        try {
            await expect(
                new PackageSeeder(exec, {
                    logger,
                    failFast: true,
                    packageFilter: (seed) => seed.packageName === malformedSeed.packageName
                }).seed()
            ).rejects.toThrow('Invalid package authoring surface descriptor')
        } finally {
            builtinPackageSeeds.pop()
        }

        expect(exec.query).not.toHaveBeenCalled()
    })
})
