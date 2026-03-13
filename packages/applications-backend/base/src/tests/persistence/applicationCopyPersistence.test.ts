import { copyApplicationWithOptions, type ApplicationCopySourceRecord, type ApplicationRecord } from '../../persistence/applicationsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const buildSourceApplication = (): ApplicationCopySourceRecord => ({
    id: 'application-source',
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Source Application' } }
    },
    description: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Source description' } }
    },
    slug: 'source-application',
    isPublic: false,
    schemaName: 'app_018f8a787b8f7c1da111222233334444',
    schemaStatus: 'synced',
    schemaSyncedAt: null,
    schemaError: null,
    schemaSnapshot: { entities: [] },
    appStructureVersion: 1,
    lastSyncedPublicationVersionId: 'publication-version-1',
    version: 2,
    createdAt: new Date('2026-03-13T10:00:00.000Z'),
    updatedAt: new Date('2026-03-13T10:05:00.000Z'),
    updatedBy: 'user-source'
})

const buildInsertedApplication = (): ApplicationRecord => ({
    id: 'application-copy',
    name: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Copied Application' } }
    },
    description: {
        _schema: 'v1',
        _primary: 'en',
        locales: { en: { content: 'Copied description' } }
    },
    slug: 'copied-application',
    isPublic: true,
    schemaName: 'app_018f8a787b8f7c1da555666677778888',
    schemaStatus: 'outdated',
    schemaSyncedAt: null,
    schemaError: null,
    version: 1,
    createdAt: new Date('2026-03-13T11:00:00.000Z'),
    updatedAt: new Date('2026-03-13T11:00:00.000Z'),
    updatedBy: 'user-actor'
})

describe('Applications backend copy persistence', () => {
    it('copies application metadata, access, connectors, and publication links inside one transaction', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const insertedApplication = buildInsertedApplication()

        txExecutor.query
            .mockResolvedValueOnce([insertedApplication])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        const result = await copyApplicationWithOptions(executor, {
            newApplicationId: insertedApplication.id,
            sourceApplicationId: 'application-source',
            sourceApplication: buildSourceApplication(),
            copiedName: insertedApplication.name,
            copiedDescription: insertedApplication.description,
            slug: insertedApplication.slug,
            isPublic: insertedApplication.isPublic,
            schemaName: insertedApplication.schemaName!,
            schemaStatus: insertedApplication.schemaStatus!,
            copyAccess: true,
            copyConnector: true,
            actorUserId: 'user-actor'
        })

        expect(result).toEqual(insertedApplication)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(4)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('INSERT INTO applications.cat_applications')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('INSERT INTO applications.rel_application_users')
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('user_id <> $5')
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('public.uuid_generate_v7() AS new_id')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('INSERT INTO applications.cat_connectors')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('INSERT INTO applications.rel_connector_publications')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('WHERE cp._upl_deleted = false AND cp._app_deleted = false')
    })

    it('skips access and connector duplication when the copy options are disabled', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const insertedApplication = buildInsertedApplication()

        txExecutor.query.mockResolvedValueOnce([insertedApplication]).mockResolvedValueOnce([])

        const result = await copyApplicationWithOptions(executor, {
            newApplicationId: insertedApplication.id,
            sourceApplicationId: 'application-source',
            sourceApplication: buildSourceApplication(),
            copiedName: insertedApplication.name,
            copiedDescription: insertedApplication.description,
            slug: insertedApplication.slug,
            isPublic: insertedApplication.isPublic,
            schemaName: insertedApplication.schemaName!,
            schemaStatus: 'draft',
            copyAccess: false,
            copyConnector: false,
            actorUserId: 'user-actor'
        })

        expect(result).toEqual(insertedApplication)
        expect(txExecutor.query).toHaveBeenCalledTimes(2)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('INSERT INTO applications.cat_applications')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('INSERT INTO applications.rel_application_users')
    })

    it('propagates transactional copy failures instead of reporting partial success', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const insertedApplication = buildInsertedApplication()

        txExecutor.query
            .mockResolvedValueOnce([insertedApplication])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('copy access exploded'))

        await expect(
            copyApplicationWithOptions(executor, {
                newApplicationId: insertedApplication.id,
                sourceApplicationId: 'application-source',
                sourceApplication: buildSourceApplication(),
                copiedName: insertedApplication.name,
                copiedDescription: insertedApplication.description,
                slug: insertedApplication.slug,
                isPublic: insertedApplication.isPublic,
                schemaName: insertedApplication.schemaName!,
                schemaStatus: insertedApplication.schemaStatus!,
                copyAccess: true,
                copyConnector: false,
                actorUserId: 'user-actor'
            })
        ).rejects.toThrow('copy access exploded')

        expect(txExecutor.query).toHaveBeenCalledTimes(3)
    })
})
