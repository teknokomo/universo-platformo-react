import { copyApplicationWithOptions } from '../../persistence/applicationCopyStore'
import type { ApplicationCopySourceRecord, ApplicationRecord } from '../../persistence/applicationsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const buildSourceApplication = (): ApplicationCopySourceRecord => ({
    id: 'application-source',
    name: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'Source Application',
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    },
    description: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'Source description',
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    },
    isPublic: false,
    showInAppList: false,
    settings: null,
    workspacesEnabled: true,
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
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'Copied Application',
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    },
    description: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'Copied description',
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    },
    isPublic: true,
    showInAppList: false,
    settings: null,
    workspacesEnabled: true,
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
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 2 }])
            .mockResolvedValueOnce([insertedApplication])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312399' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        const result = await copyApplicationWithOptions(executor, {
            newApplicationId: insertedApplication.id,
            sourceApplicationId: 'application-source',
            sourceApplication: buildSourceApplication(),
            copiedName: insertedApplication.name,
            copiedDescription: insertedApplication.description,
            isPublic: insertedApplication.isPublic,
            settings: null,
            workspacesEnabled: false,
            schemaName: insertedApplication.schemaName!,
            schemaStatus: insertedApplication.schemaStatus!,
            copyAccess: true,
            copyConnector: true,
            actorUserId: 'user-actor'
        })

        expect(result).toEqual(insertedApplication)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(7)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))')
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual(['application-copy:application-source'])
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual(['application-source'])
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('INSERT INTO applications.obj_applications')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('INSERT INTO applications.rel_application_users')
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('applications.record_application_catalog_visibility_audit')
        expect(txExecutor.query.mock.calls[5]?.[0]).toContain('user_id <> $5')
        expect(txExecutor.query.mock.calls[5]?.[0]).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(txExecutor.query.mock.calls[5]?.[0]).toContain("WHEN role = 'owner' THEN 'admin'")
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('public.uuid_generate_v7() AS new_id')
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('INSERT INTO applications.obj_connectors')
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('INSERT INTO applications.rel_connector_publications')
        expect(txExecutor.query.mock.calls[6]?.[0]).toContain('WHERE cp._upl_deleted = false AND cp._app_deleted = false')
    })

    it('skips access and connector duplication when the copy options are disabled', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const insertedApplication = buildInsertedApplication()

        txExecutor.query
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 2 }])
            .mockResolvedValueOnce([insertedApplication])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312399' }])

        const result = await copyApplicationWithOptions(executor, {
            newApplicationId: insertedApplication.id,
            sourceApplicationId: 'application-source',
            sourceApplication: buildSourceApplication(),
            copiedName: insertedApplication.name,
            copiedDescription: insertedApplication.description,
            isPublic: insertedApplication.isPublic,
            settings: null,
            workspacesEnabled: false,
            schemaName: insertedApplication.schemaName!,
            schemaStatus: 'draft',
            copyAccess: false,
            copyConnector: false,
            actorUserId: 'user-actor'
        })

        expect(result).toEqual(insertedApplication)
        expect(txExecutor.query).toHaveBeenCalledTimes(5)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('INSERT INTO applications.obj_applications')
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('INSERT INTO applications.rel_application_users')
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('applications.record_application_catalog_visibility_audit')
    })

    it('propagates transactional copy failures instead of reporting partial success', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const insertedApplication = buildInsertedApplication()

        txExecutor.query
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 2 }])
            .mockResolvedValueOnce([insertedApplication])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312399' }])
            .mockRejectedValueOnce(new Error('copy access exploded'))

        await expect(
            copyApplicationWithOptions(executor, {
                newApplicationId: insertedApplication.id,
                sourceApplicationId: 'application-source',
                sourceApplication: buildSourceApplication(),
                copiedName: insertedApplication.name,
                copiedDescription: insertedApplication.description,
                isPublic: insertedApplication.isPublic,
                settings: null,
                workspacesEnabled: false,
                schemaName: insertedApplication.schemaName!,
                schemaStatus: insertedApplication.schemaStatus!,
                copyAccess: true,
                copyConnector: false,
                actorUserId: 'user-actor'
            })
        ).rejects.toThrow('copy access exploded')

        expect(txExecutor.query).toHaveBeenCalledTimes(6)
    })

    it('fails closed without inserting a copy when the source is missing or changed', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([]).mockResolvedValueOnce([])

        await expect(
            copyApplicationWithOptions(executor, {
                newApplicationId: 'application-copy',
                sourceApplicationId: 'application-source',
                sourceApplication: buildSourceApplication(),
                copiedName: buildInsertedApplication().name,
                copiedDescription: null,
                settings: {},
                isPublic: true,
                workspacesEnabled: false,
                schemaName: 'app_018f8a787b8f7c1da555666677778888',
                schemaStatus: 'draft',
                copyAccess: false,
                copyConnector: false,
                actorUserId: 'user-actor'
            })
        ).rejects.toMatchObject({ name: 'ApplicationCopySourceUnavailableError' })
        expect(txExecutor.query).toHaveBeenCalledTimes(2)

        txExecutor.query
            .mockReset()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 3 }])
        await expect(
            copyApplicationWithOptions(executor, {
                newApplicationId: 'application-copy',
                sourceApplicationId: 'application-source',
                sourceApplication: buildSourceApplication(),
                copiedName: buildInsertedApplication().name,
                copiedDescription: null,
                settings: {},
                isPublic: true,
                workspacesEnabled: false,
                schemaName: 'app_018f8a787b8f7c1da555666677778888',
                schemaStatus: 'draft',
                copyAccess: false,
                copyConnector: false,
                actorUserId: 'user-actor'
            })
        ).rejects.toMatchObject({ name: 'ApplicationCopySourceChangedError' })
        expect(txExecutor.query).toHaveBeenCalledTimes(2)
    })
})
