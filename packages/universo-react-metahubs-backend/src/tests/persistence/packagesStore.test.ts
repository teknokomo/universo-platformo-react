import type { SqlQueryable } from '@universo-react/utils'
import {
    attachMetahubPackage,
    changeMetahubPackageVersion,
    copyMetahubPackages,
    detachMetahubPackage,
    listMetahubPackages,
    listPackageCatalog,
    replaceMetahubPackagesFromSnapshot
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

const createExec = (rows: unknown[] = []): SqlQueryable => ({
    query: jest.fn(async () => rows)
})

describe('packagesStore', () => {
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
        const attachmentRow = {
            id: 'attach-1',
            metahubId: 'metahub-1',
            packageId: 'pkg-1',
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            displayName: localized('Colyseus Server'),
            description: null,
            source,
            attachedAt,
            isActive: true
        }
        const exec = createExec([attachmentRow])

        const attached = await attachMetahubPackage(exec, {
            metahubId: 'metahub-1',
            packageName: '@universo-react/colyseus-server',
            version: '0.1.0',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('RETURNING id, metahub_id, package_id'), [
            'metahub-1',
            '@universo-react/colyseus-server',
            '0.1.0',
            'user-1'
        ])
        expect(attached?.attachedAt).toBe('2026-05-27T12:00:00.000Z')

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query).mockResolvedValueOnce([attachmentRow])

        await changeMetahubPackageVersion(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            version: '0.1.1',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'attach-1',
            '0.1.1',
            'user-1'
        ])
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('RETURNING a.id')

        jest.mocked(exec.query).mockClear()
        jest.mocked(exec.query).mockResolvedValueOnce([{ id: 'attach-1' }])

        await detachMetahubPackage(exec, {
            metahubId: 'metahub-1',
            attachmentId: 'attach-1',
            userId: 'user-1'
        })

        expect(exec.query).toHaveBeenCalledWith(expect.stringContaining('RETURNING id'), ['metahub-1', 'attach-1', 'user-1'])
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
                attachedAt: new Date('2026-05-27T12:00:00.000Z'),
                isActive: true
            }
        ])

        const rows = await listMetahubPackages(exec, 'metahub-1')

        expect(rows[0]?.attachedAt).toBe('2026-05-27T12:00:00.000Z')
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
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('source._upl_deleted = false')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('p._upl_deleted = false')
        expect(jest.mocked(exec.query).mock.calls[0]?.[0]).toContain('RETURNING id')
    })

    it('replaces metahub packages from a snapshot and rejects duplicate package names', async () => {
        const exec = createExec()
        jest.mocked(exec.query)
            .mockResolvedValueOnce([{ id: 'old-attach' }])
            .mockResolvedValueOnce([{ id: 'new-attach' }])

        const restored = await replaceMetahubPackagesFromSnapshot(exec, {
            metahubId: 'metahub-1',
            packages: [{ packageName: '@universo-react/colyseus-server', version: '0.1.0', source }],
            userId: 'user-1'
        })

        expect(restored).toBe(1)
        expect(exec.query).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE "metahubs"."rel_metahub_packages"'), [
            'metahub-1',
            'user-1'
        ])
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('WITH selected_package AS'), [
            'metahub-1',
            '@universo-react/colyseus-server',
            '0.1.0',
            'user-1',
            JSON.stringify(source)
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
})
