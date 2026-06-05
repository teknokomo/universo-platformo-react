import type { SqlQueryable } from '@universo-react/utils'
import {
    attachMetahubPackage,
    changeMetahubPackageVersion,
    copyMetahubPackages,
    detachMetahubPackage,
    listMetahubPackages,
    listPackageCatalog,
    replaceMetahubPackagesFromSnapshot,
    upsertPackageRegistryItem,
    updateMetahubPackageConfig
} from '../../persistence/packagesStore'

const localized = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: '2026-05-27T00:00:00.000Z',
            updatedAt: '2026-05-27T00:00:00.000Z'
        }
    }
})

const source = {
    kind: 'workspace' as const,
    packageName: '@universo-react/colyseus-server',
    importName: '@universo-react/colyseus-server',
    upstreamPackageName: '@colyseus/core',
    upstreamVersion: '0.17.43',
    runtimeTargets: ['server'] as const
}
const editorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`

const config = {
    schemaVersion: '1' as const,
    kind: 'none' as const
}

const authoringSurface = {
    schemaVersion: '1' as const,
    kind: 'none' as const,
    supportedDisplayModes: [] as const,
    defaultConfig: config
}

const createExec = (rows: unknown[] = []): SqlQueryable => ({
    query: jest.fn(async () => rows)
})

describe('packagesStore', () => {
    it('increments package registry row versions only when seed content changes', async () => {
        const exec = createExec([
            {
                id: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: localized('Server wrapper'),
                source,
                authoringSurface,
                isActive: true
            }
        ])

        await upsertPackageRegistryItem(exec, {
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            displayName: localized('Colyseus Server'),
            description: localized('Server wrapper'),
            source,
            authoringSurface,
            userId: null
        })

        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('_upl_version = CASE')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('p.authoring_surface IS DISTINCT FROM EXCLUDED.authoring_surface')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('THEN p._upl_version + 1')
    })

    it('rejects malformed package authoring surface descriptors before registry writes', async () => {
        const exec = createExec()

        await expect(
            upsertPackageRegistryItem(exec, {
                packageName: editorPackageName,
                version: '0.1.0',
                displayName: localized('PlayCanvas Editor'),
                description: localized('Editor wrapper'),
                source,
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
                        packageName: editorPackageName,
                        manifestFileName: 'universo-artifact-manifest.json',
                        outputRoot: 'dist/editor',
                        smokeMode: 'artifact-only'
                    }
                } as never,
                userId: null
            })
        ).rejects.toThrow('Invalid package authoring surface descriptor')

        expect(exec.query).not.toHaveBeenCalled()

        await expect(
            upsertPackageRegistryItem(exec, {
                packageName: editorPackageName,
                version: '0.1.0',
                displayName: localized('PlayCanvas Editor'),
                description: localized('Editor wrapper'),
                source,
                authoringSurface: {
                    schemaVersion: '1',
                    kind: 'playcanvasEditor',
                    packageSlug: 'playcanvas-editor',
                    supportedDisplayModes: ['embeddedIframe', 'developmentUrl'],
                    defaultConfig: {
                        schemaVersion: '1',
                        kind: 'display',
                        display: {
                            mode: 'developmentUrl',
                            developmentUrl: 'http://localhost:5100/editor',
                            showArtifactOnlyNotice: true
                        }
                    },
                    artifact: {
                        packageName: editorPackageName,
                        manifestFileName: 'universo-artifact-manifest.json',
                        outputRoot: 'dist/editor',
                        smokeMode: 'artifact-only'
                    }
                } as never,
                userId: null
            })
        ).rejects.toThrow('Invalid package authoring surface descriptor')

        expect(exec.query).not.toHaveBeenCalled()
    })

    it('rejects active PlayCanvas Editor authoring slug collisions across package names before registry writes', async () => {
        const exec = createExec()
        jest.mocked(exec.query).mockResolvedValueOnce([{ packageName: `@universo-react/${'playcanvas-editor-frontend'}-fork` }])

        await expect(
            upsertPackageRegistryItem(exec, {
                packageName: editorPackageName,
                version: '0.1.0',
                displayName: localized('PlayCanvas Editor'),
                description: localized('Editor wrapper'),
                source,
                authoringSurface: {
                    schemaVersion: '1',
                    kind: 'playcanvasEditor',
                    packageSlug: 'playcanvas-editor',
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
                        packageName: editorPackageName,
                        manifestFileName: 'universo-artifact-manifest.json',
                        outputRoot: 'dist/editor',
                        smokeMode: 'artifact-only'
                    }
                },
                userId: null
            })
        ).rejects.toThrow('Package authoring surface slug "playcanvas-editor" is already used')

        expect(exec.query).toHaveBeenCalledTimes(1)
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain("p.authoring_surface ->> 'packageSlug' = $1")
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).not.toContain('INSERT INTO')
    })

    it('lists package catalog rows without exposing raw attachment ids as display data', async () => {
        const exec = createExec([
            {
                id: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: localized('Server wrapper'),
                source,
                isActive: true,
                attachmentId: 'attach-1',
                attachedPackageId: 'pkg-1',
                attachedVersion: '0.1.0'
            }
        ])

        const rows = await listPackageCatalog(exec, 'metahub-1')

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN "metahubs"."rel_metahub_packages"'), ['metahub-1'])
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('AND a.package_id = p.id')
        expect(rows).toEqual([
            expect.objectContaining({
                packageName: '@universo-react/colyseus-server',
                attached: true,
                attachmentId: 'attach-1',
                attachedPackageId: 'pkg-1',
                attachedVersion: '0.1.0'
            })
        ])
    })

    it('marks only the attached registry version as connected in the package catalog', async () => {
        const exec = createExec([
            {
                id: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: localized('Server wrapper'),
                source,
                isActive: true,
                attachmentId: 'attach-1',
                attachedPackageId: 'pkg-1',
                attachedVersion: '0.1.0'
            },
            {
                id: 'pkg-2',
                packageName: '@universo-react/colyseus-server',
                version: '0.2.0',
                displayName: localized('Colyseus Server'),
                description: localized('Server wrapper'),
                source,
                isActive: true,
                attachmentId: null,
                attachedPackageId: null,
                attachedVersion: null
            }
        ])

        const rows = await listPackageCatalog(exec, 'metahub-1')

        expect(rows).toHaveLength(2)
        expect(rows[0]).toEqual(
            expect.objectContaining({
                id: 'pkg-1',
                version: '0.1.0',
                attached: true,
                attachmentId: 'attach-1',
                attachedPackageId: 'pkg-1',
                attachedVersion: '0.1.0'
            })
        )
        expect(rows[1]).toEqual(
            expect.objectContaining({
                id: 'pkg-2',
                version: '0.2.0',
                attached: false,
                attachmentId: null,
                attachedPackageId: null,
                attachedVersion: null
            })
        )
    })

    it('uses RETURNING mutations for attach, version change, and detach contracts', async () => {
        const attachedAt = new Date('2026-05-27T12:00:00.000Z')
        const packageRow = {
            id: 'pkg-1',
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            source,
            authoringSurface
        }
        const attachmentRow = {
            id: 'attach-1',
            metahubId: 'metahub-1',
            packageId: 'pkg-1',
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            displayName: localized('Colyseus Server'),
            description: null,
            source,
            authoringSurface,
            config,
            attachedAt,
            isActive: true
        }
        const exec = createExec()
        jest.mocked(exec.query).mockResolvedValueOnce([packageRow]).mockResolvedValueOnce([]).mockResolvedValueOnce([attachmentRow])

        const attached = await attachMetahubPackage(exec, {
            metahubId: 'metahub-1',
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM "metahubs"."obj_packages" p'), [
            '@universo-react/colyseus-server',
            '0.1.0'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM "metahubs"."rel_metahub_packages" a'), [
            'metahub-1',
            '@universo-react/colyseus-server'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(3, expect.stringContaining('RETURNING id, metahub_id, package_id'), [
            'metahub-1',
            'pkg-1',
            '@universo-react/colyseus-server',
            '0.1.0',
            JSON.stringify(config),
            'user-1'
        ])
        expect(jest.mocked(exec.query).mock.calls[2]?.[0]).toContain('config = EXCLUDED.config')
        expect(jest.mocked(exec.query).mock.calls[2]?.[0]).toContain('_upl_version = target._upl_version + 1')
        expect(attached?.attachedAt).toBe('2026-05-27T12:00:00.000Z')

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query)
            .mockResolvedValueOnce([
                {
                    attachmentId: 'attach-1',
                    packageName: '@universo-react/colyseus-server',
                    config,
                    currentPackageId: 'pkg-current',
                    selectedPackageId: 'pkg-1',
                    selectedVersion: '0.1.1',
                    selectedAuthoringSurface: authoringSurface
                }
            ])
            .mockResolvedValueOnce([attachmentRow])

        await changeMetahubPackageVersion(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            version: '0.1.1',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenNthCalledWith(1, expect.stringContaining('JOIN "metahubs"."obj_packages" p'), [
            'metahub-1',
            'attach-1',
            '0.1.1'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'attach-1',
            'pkg-1',
            '0.1.1',
            JSON.stringify(config),
            'user-1',
            'pkg-current'
        ])
        expect(jest.mocked(exec.query).mock.calls[1]?.[0]).toContain('RETURNING a.id')
        expect(jest.mocked(exec.query).mock.calls[1]?.[0]).toContain('_upl_version = a._upl_version + 1')

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query).mockResolvedValueOnce([
            {
                attachmentId: 'attach-1',
                packageName: '@universo-react/colyseus-server',
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: {
                        mode: 'embeddedIframe',
                        developmentUrl: null,
                        showArtifactOnlyNotice: true
                    }
                },
                currentPackageId: 'pkg-current',
                selectedPackageId: 'pkg-1',
                selectedVersion: '0.1.2',
                selectedAuthoringSurface: authoringSurface
            }
        ])

        await expect(
            changeMetahubPackageVersion(exec, {
                metahubId: 'metahub-1',
                attachmentId: 'attach-1',
                version: '0.1.2',
                userId: 'user-1'
            })
        ).rejects.toMatchObject({
            message: 'Package display settings are not compatible with the selected package version',
            details: { resetConfigRequired: true }
        })
        expect(exec.query).toHaveBeenCalledTimes(1)

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query)
            .mockResolvedValueOnce([
                {
                    attachmentId: 'attach-1',
                    packageName: '@universo-react/colyseus-server',
                    config: {
                        schemaVersion: '1',
                        kind: 'display',
                        display: {
                            mode: 'embeddedIframe',
                            developmentUrl: null,
                            showArtifactOnlyNotice: true
                        }
                    },
                    currentPackageId: 'pkg-current',
                    selectedPackageId: 'pkg-1',
                    selectedVersion: '0.1.2',
                    selectedAuthoringSurface: authoringSurface
                }
            ])
            .mockResolvedValueOnce([attachmentRow])

        await changeMetahubPackageVersion(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            version: '0.1.2',
            userId: 'user-1',
            resetConfig: true
        })

        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'attach-1',
            'pkg-1',
            '0.1.2',
            JSON.stringify(config),
            'user-1',
            'pkg-current'
        ])

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query).mockResolvedValueOnce([{ id: 'attach-1' }])

        await detachMetahubPackage(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('RETURNING id'), ['metahub-1', 'attach-1', 'user-1'])
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('_upl_version = _upl_version + 1')
    })

    it('normalizes attached package timestamps from Postgres rows', async () => {
        const exec = createExec([
            {
                id: 'attach-1',
                metahubId: 'metahub-1',
                packageId: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: null,
                source,
                authoringSurface,
                config,
                attachedAt: new Date('2026-05-27T12:00:00.000Z'),
                isActive: true
            }
        ])

        const rows = await listMetahubPackages(exec, 'metahub-1')

        expect(rows[0]?.attachedAt).toBe('2026-05-27T12:00:00.000Z')
    })

    it('normalizes legacy empty attachment configs to descriptor defaults', async () => {
        const exec = createExec([
            {
                id: 'attach-1',
                metahubId: 'metahub-1',
                packageId: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: null,
                source,
                authoringSurface,
                config: {},
                attachedAt: new Date('2026-05-27T12:00:00.000Z'),
                isActive: true
            }
        ])

        const rows = await listMetahubPackages(exec, 'metahub-1')

        expect(rows[0]?.config).toEqual(config)
    })

    it('preserves compatible config when direct attach reuses an active package attachment', async () => {
        const displayConfig = {
            schemaVersion: '1' as const,
            kind: 'display' as const,
            display: {
                mode: 'openSeparately' as const,
                developmentUrl: null,
                showArtifactOnlyNotice: false
            }
        }
        const editorAuthoringSurface = {
            schemaVersion: '1' as const,
            kind: 'playcanvasEditor' as const,
            packageSlug: 'playcanvas-editor',
            supportedDisplayModes: ['disabled', 'embeddedIframe', 'openSeparately'] as const,
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
                packageName: editorPackageName,
                manifestFileName: 'universo-artifact-manifest.json',
                outputRoot: 'dist/editor',
                smokeMode: 'artifact-only' as const
            }
        }
        const exec = createExec()
        jest.mocked(exec.query)
            .mockResolvedValueOnce([
                {
                    id: 'pkg-editor-next',
                    packageName: editorPackageName,
                    version: '0.2.0',
                    source,
                    authoringSurface: editorAuthoringSurface
                }
            ])
            .mockResolvedValueOnce([{ packageId: 'pkg-editor-current', config: displayConfig }])
            .mockResolvedValueOnce([
                {
                    id: 'attach-editor',
                    metahubId: 'metahub-1',
                    packageId: 'pkg-editor-next',
                    packageName: editorPackageName,
                    version: '0.2.0',
                    displayName: localized('PlayCanvas Editor'),
                    description: null,
                    source,
                    authoringSurface: editorAuthoringSurface,
                    config: displayConfig,
                    attachedAt: new Date('2026-06-01T00:00:00.000Z'),
                    isActive: true
                }
            ])

        const attached = await attachMetahubPackage(exec, {
            metahubId: 'metahub-1',
            packageName: editorPackageName,
            version: '0.2.0',
            userId: 'user-1'
        })

        expect(attached?.config).toEqual(displayConfig)
        expect(exec.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'pkg-editor-next',
            editorPackageName,
            '0.2.0',
            JSON.stringify(displayConfig),
            'user-1'
        ])
    })

    it('copies active package attachments with registry-backed source filtering', async () => {
        const exec = createExec([{ id: 'attach-copy-1' }])

        const copied = await copyMetahubPackages(exec, {
            sourceMetahubId: 'metahub-source',
            targetMetahubId: 'metahub-copy',
            userId: 'user-1'
        })

        expect(copied).toBe(1)
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('JOIN "metahubs"."obj_packages" p'), [
            'metahub-source',
            'metahub-copy',
            'user-1'
        ])
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('source.config')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('_upl_version = target._upl_version + 1')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('source._upl_deleted = false')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('p._upl_deleted = false')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('RETURNING id')
    })

    it('replaces metahub packages from a snapshot and rejects duplicate package names', async () => {
        const exec = createExec()
        const restoredConfig = {
            schemaVersion: '1' as const,
            kind: 'display' as const,
            display: {
                mode: 'disabled' as const,
                developmentUrl: null,
                showArtifactOnlyNotice: false
            }
        }
        const restoredAuthoringSurface = {
            schemaVersion: '1' as const,
            kind: 'playcanvasEditor' as const,
            packageSlug: 'playcanvas-editor',
            supportedDisplayModes: ['disabled', 'embeddedIframe'] as const,
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
                packageName: editorPackageName,
                manifestFileName: 'universo-artifact-manifest.json',
                outputRoot: 'dist/editor',
                smokeMode: 'artifact-only' as const
            }
        }
        jest.mocked(exec.query)
            .mockResolvedValueOnce([
                {
                    id: 'pkg-1',
                    packageName: editorPackageName,
                    version: '0.1.0',
                    source,
                    authoringSurface: restoredAuthoringSurface
                }
            ])
            .mockResolvedValueOnce([{ id: 'old-attach' }])
            .mockResolvedValueOnce([{ id: 'new-attach' }])

        const restored = await replaceMetahubPackagesFromSnapshot(exec, {
            metahubId: 'metahub-1',
            packages: [{ packageName: editorPackageName, version: '0.1.0', source, config: restoredConfig }],
            userId: 'user-1'
        })

        expect(restored).toBe(1)
        expect(exec.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM "metahubs"."obj_packages" p'), [
            editorPackageName,
            '0.1.0',
            JSON.stringify(source)
        ])
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'user-1'
        ])
        expect(jest.mocked(exec.query).mock.calls[1]?.[0]).toContain('_upl_version = _upl_version + 1')
        expect(exec.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'pkg-1',
            editorPackageName,
            '0.1.0',
            JSON.stringify(restoredConfig),
            'user-1'
        ])

        await expect(
            replaceMetahubPackagesFromSnapshot(exec, {
                metahubId: 'metahub-1',
                packages: [
                    { packageName: '@universo-react/colyseus-server', version: '0.1.0', source },
                    { packageName: '@universo-react/colyseus-server', version: '0.2.0', source }
                ],
                userId: 'user-1'
            })
        ).rejects.toThrow('Duplicate package in metahub snapshot')
    })

    it('prevalidates all snapshot packages before deleting existing attachments', async () => {
        const exec = createExec([])

        await expect(
            replaceMetahubPackagesFromSnapshot(exec, {
                metahubId: 'metahub-1',
                packages: [{ packageName: editorPackageName, version: '9.9.9', source }],
                userId: 'user-1'
            })
        ).rejects.toThrow('Package from metahub snapshot is not registered')

        expect(exec.query).toHaveBeenCalledTimes(1)
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('FROM "metahubs"."obj_packages" p')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).not.toContain('UPDATE "metahubs"."rel_metahub_packages"')
    })

    it('restores saved development URL package configs without applying the current server allowlist', async () => {
        const exec = createExec()
        const restoredConfig = {
            schemaVersion: '1' as const,
            kind: 'display' as const,
            display: {
                mode: 'developmentUrl' as const,
                developmentUrl: 'http://localhost:5100/editor',
                showArtifactOnlyNotice: true
            }
        }
        const restoredAuthoringSurface = {
            schemaVersion: '1' as const,
            kind: 'playcanvasEditor' as const,
            packageSlug: 'playcanvas-editor',
            supportedDisplayModes: ['disabled', 'embeddedIframe', 'developmentUrl'] as const,
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
                packageName: editorPackageName,
                manifestFileName: 'universo-artifact-manifest.json',
                outputRoot: 'dist/editor',
                smokeMode: 'artifact-only' as const
            }
        }
        jest.mocked(exec.query)
            .mockResolvedValueOnce([
                {
                    id: 'pkg-1',
                    packageName: editorPackageName,
                    version: '0.1.0',
                    source,
                    authoringSurface: restoredAuthoringSurface
                }
            ])
            .mockResolvedValueOnce([{ id: 'old-attach' }])
            .mockResolvedValueOnce([{ id: 'new-attach' }])

        const restored = await replaceMetahubPackagesFromSnapshot(exec, {
            metahubId: 'metahub-1',
            packages: [{ packageName: editorPackageName, version: '0.1.0', source, config: restoredConfig }],
            userId: 'user-1'
        })

        expect(restored).toBe(1)
        expect(exec.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'pkg-1',
            editorPackageName,
            '0.1.0',
            JSON.stringify(restoredConfig),
            'user-1'
        ])
    })

    it('updates package attachment config with a returning row contract', async () => {
        const exec = createExec([
            {
                id: 'attach-1',
                metahubId: 'metahub-1',
                packageId: 'pkg-1',
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                displayName: localized('Colyseus Server'),
                description: null,
                source,
                authoringSurface,
                config,
                attachedAt: new Date('2026-05-27T12:00:00.000Z'),
                isActive: true
            }
        ])

        const updated = await updateMetahubPackageConfig(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            config,
            userId: 'user-1'
        })

        expect(updated?.config).toEqual(config)
        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('SET config = $3::jsonb'), [
            'metahub-1',
            'attach-1',
            JSON.stringify(config),
            'user-1',
            null
        ])
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('_upl_version = a._upl_version + 1')
    })
})
