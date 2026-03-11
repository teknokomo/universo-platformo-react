import * as catalog from '@universo/migrations-catalog'
import { diffRegisteredPlatformDefinitions, exportRegisteredPlatformDefinitions, platformMigrations } from '../platformMigrations'

describe('platformMigrations', () => {
    it('registers all platform schemas through native SQL definitions', () => {
        const adminMigration = platformMigrations.find((migration) => migration.id === 'CreateAdminSchema1733400000000')
        const profileMigration = platformMigrations.find((migration) => migration.id === 'AddProfile1741277504477')
        const metahubsMigration = platformMigrations.find((migration) => migration.id === 'CreateMetahubsSchema1766351182000')
        const applicationsMigration = platformMigrations.find((migration) => migration.id === 'CreateApplicationsSchema1800000000000')

        expect(adminMigration).toBeDefined()
        expect(profileMigration).toBeDefined()
        expect(metahubsMigration).toBeDefined()
        expect(applicationsMigration).toBeDefined()
        expect(adminMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'admin'
        })
        expect(profileMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'profile'
        })
        expect(metahubsMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'metahubs'
        })
        expect(applicationsMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'applications'
        })
        expect(adminMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(profileMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(metahubsMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        expect(applicationsMigration?.checksumSource).toContain('"kind":"native-sql-migration"')
        for (const migration of platformMigrations) {
            expect(migration.checksumSource ?? '').not.toContain('typeorm-migration:')
        }
    })

    it('registers the admin soft-delete migration with correct scope and ordering', () => {
        const softDeleteMigration = platformMigrations.find(
            (migration) => migration.id === 'AddAdminSoftDeleteColumns1800000000300'
        )
        expect(softDeleteMigration).toBeDefined()
        expect(softDeleteMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'admin'
        })
        expect(softDeleteMigration?.checksumSource).toContain('"kind":"native-sql-migration"')

        // Verify ordering: soft-delete migration comes after applications schema
        const appsMigrationIndex = platformMigrations.findIndex(
            (m) => m.id === 'CreateApplicationsSchema1800000000000'
        )
        const softDeleteIndex = platformMigrations.findIndex(
            (m) => m.id === 'AddAdminSoftDeleteColumns1800000000300'
        )
        expect(softDeleteIndex).toBeGreaterThan(appsMigrationIndex)
    })

    it('registers the uuid v7 pgcrypto repair migration before schema bootstrap migrations', () => {
        const repairMigration = platformMigrations.find(
            (migration) => migration.id === 'RepairUuidV7PgcryptoDependency1500000000001'
        )

        expect(repairMigration).toBeDefined()
        expect(repairMigration?.scope).toEqual({
            kind: 'platform_schema',
            key: 'public'
        })

        const repairIndex = platformMigrations.findIndex(
            (migration) => migration.id === 'RepairUuidV7PgcryptoDependency1500000000001'
        )
        const adminIndex = platformMigrations.findIndex(
            (migration) => migration.id === 'CreateAdminSchema1733400000000'
        )

        expect(repairIndex).toBeGreaterThanOrEqual(0)
        expect(repairIndex).toBeLessThan(adminIndex)
    })

    it('exports deterministic definition artifacts for registered platform migrations', () => {
        const artifacts = exportRegisteredPlatformDefinitions()

        expect(artifacts).toHaveLength(platformMigrations.length)
        expect(artifacts[0]).toEqual(
            expect.objectContaining({
                kind: 'custom',
                name: platformMigrations[0]?.id,
                schemaQualifiedName: expect.stringContaining(`platform_migration.${platformMigrations[0]?.scope.kind}.${platformMigrations[0]?.scope.key}`)
            })
        )
    })

    it('diffs registered definitions against the catalog export', async () => {
        const desiredArtifacts = exportRegisteredPlatformDefinitions()
        const storageReadyMock = jest.spyOn(catalog.PlatformMigrationCatalog.prototype, 'isStorageReady').mockResolvedValue(true)
        const exportDefinitionsMock = jest.spyOn(catalog, 'exportDefinitions').mockResolvedValue([
            { ...desiredArtifacts[0], checksum: 'changed' },
            desiredArtifacts[1]
        ])

        const result = await diffRegisteredPlatformDefinitions({} as never)

        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[0]?.schemaQualifiedName}::${desiredArtifacts[0]?.kind}`,
                status: 'checksum_mismatch'
            })
        )
        expect(result).toContainEqual(
            expect.objectContaining({
                logicalKey: `${desiredArtifacts[1]?.schemaQualifiedName}::${desiredArtifacts[1]?.kind}`,
                status: 'match'
            })
        )
        storageReadyMock.mockRestore()
        exportDefinitionsMock.mockRestore()
    })
})
