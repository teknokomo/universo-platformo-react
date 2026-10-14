jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import { deleteApplicationWithSchema, listApplications } from '../../persistence/applicationsStore'
import {
    countConnectorPublicationLinks,
    findConnector,
    findConnectorPublicationLink,
    listConnectorPublicationLinks
} from '../../persistence/connectorsStore'
import { ensureConnectorAccess, getApplicationMembership } from '../../routes/guards'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('Applications backend soft-delete parity', () => {
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    it('listApplications excludes soft-deleted applications', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.obj_applications a') && sql.includes('COUNT(*) OVER() AS "windowTotal"')) {
                const hasFilters = sql.includes('a._upl_deleted = false') && sql.includes('a._app_deleted = false')

                return hasFilters
                    ? []
                    : [
                          {
                              id: 'application-1',
                              name: { en: 'Deleted app', _primary: 'en' },
                              description: null,
                              isPublic: false,
                              schemaName: 'app_deleted',
                              schemaStatus: 'draft',
                              schemaSyncedAt: null,
                              schemaError: null,
                              version: 1,
                              createdAt: new Date(),
                              updatedAt: new Date(),
                              updatedBy: null,
                              connectorsCount: 0,
                              membersCount: 0,
                              membershipRole: 'owner',
                              windowTotal: '1'
                          }
                      ]
            }

            return []
        })

        const result = await listApplications(executor, {
            userId: 'user-1',
            showAll: true,
            limit: 20,
            offset: 0,
            sortBy: 'updated',
            sortOrder: 'desc'
        })

        expect(result).toEqual({ items: [], total: 0 })
    })

    it('deleteApplicationWithSchema rejects invalid schema names before executing SQL', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        await expect(
            deleteApplicationWithSchema(executor, {
                applicationId: 'application-1',
                schemaName: 'public"; DROP SCHEMA applications; --'
            })
        ).rejects.toThrow('Invalid application schema name')

        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('fails closed before child changes when the target application is not active', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        await expect(
            deleteApplicationWithSchema(executor, {
                applicationId: 'application-1',
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                userId: 'user-1'
            })
        ).rejects.toThrow('Application was not found or is already deleted')

        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0][0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[0][1]).toEqual(['application-1'])
    })

    it('deleteApplicationWithSchema uses soft-delete UPDATE with cascade for children', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        // Lock active app, DROP SCHEMA, cascade links/connectors, release global links,
        // purge guest replay secrets, tombstone the app, then cascade memberships.
        txExecutor.query
            .mockResolvedValueOnce([{ id: applicationId }]) // active application lock
            .mockResolvedValueOnce([]) // DROP SCHEMA
            .mockResolvedValueOnce([]) // publication links cascade
            .mockResolvedValueOnce([]) // connectors cascade
            .mockResolvedValueOnce([]) // global short-link release
            .mockResolvedValueOnce([]) // guest session replay cleanup
            .mockResolvedValueOnce([{ id: applicationId }]) // application soft-delete
            .mockResolvedValueOnce([]) // members cascade

        const result = await deleteApplicationWithSchema(executor, {
            applicationId,
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            userId: 'user-1'
        })

        expect(result).toBe(true)
        expect(txExecutor.query.mock.calls[0][0]).toContain('FROM applications.obj_applications')
        expect(txExecutor.query.mock.calls[0][0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[0][1]).toEqual([applicationId])
        // Schema drop
        expect(txExecutor.query.mock.calls[1][0]).toContain('DROP SCHEMA IF EXISTS "app_018f8a787b8f7c1da111222233334444" CASCADE')
        // Cascade soft-delete publication links before connectors so active rows cannot be missed
        expect(txExecutor.query.mock.calls[2][0]).toContain('UPDATE applications.rel_connector_publications')
        expect(txExecutor.query.mock.calls[2][0]).toContain('_upl_deleted = true')
        expect(txExecutor.query.mock.calls[2][0]).toContain('_app_deleted = true')
        expect(txExecutor.query.mock.calls[2][0]).toContain('_upl_version = COALESCE(cp._upl_version, 1) + 1')
        expect(txExecutor.query.mock.calls[2][0]).not.toContain('c._upl_deleted = false AND c._app_deleted = false')
        // Cascade soft-delete connectors
        expect(txExecutor.query.mock.calls[3][0]).toContain('UPDATE applications.obj_connectors')
        expect(txExecutor.query.mock.calls[3][0]).toContain('_upl_deleted = true')
        expect(txExecutor.query.mock.calls[3][0]).toContain('_app_deleted = true')
        // Release active global links before the application tombstone; preserve audit/version fields.
        expect(txExecutor.query.mock.calls[4][0]).toContain('UPDATE "applications"."obj_global_short_links"')
        expect(txExecutor.query.mock.calls[4][0]).toContain('released_at = now()')
        expect(txExecutor.query.mock.calls[4][0]).toContain('released_by = $2')
        expect(txExecutor.query.mock.calls[4][0]).toContain('_upl_updated_by = $2')
        expect(txExecutor.query.mock.calls[4][0]).toContain('_upl_version = COALESCE(_upl_version, 1) + 1')
        expect(txExecutor.query.mock.calls[4][0]).toContain('application_id = $1')
        expect(txExecutor.query.mock.calls[4][1]).toEqual([applicationId, 'user-1'])
        // Purge encrypted replay secrets in the same transaction before the application tombstone.
        expect(txExecutor.query.mock.calls[5][0]).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(txExecutor.query.mock.calls[5][0]).toContain('WHERE application_id = $1')
        expect(txExecutor.query.mock.calls[5][1]).toEqual([applicationId])
        // Soft-delete the application while manager membership still exists.
        expect(txExecutor.query.mock.calls[6][0]).toContain('UPDATE applications.obj_applications')
        expect(txExecutor.query.mock.calls[6][0]).toContain('_upl_deleted = true')
        expect(txExecutor.query.mock.calls[6][0]).toContain('_app_deleted = true')
        expect(txExecutor.query.mock.calls[6][0]).toContain('_upl_deleted = false AND _app_deleted = false')
        // Cascade soft-delete members after the application RLS update succeeds.
        expect(txExecutor.query.mock.calls[7][0]).toContain('UPDATE applications.rel_application_users')
        expect(txExecutor.query.mock.calls[7][0]).toContain('_upl_deleted = true')
        expect(txExecutor.query.mock.calls[7][0]).toContain('_app_deleted = true')
    })

    it('aborts the enclosing transaction when the application tombstone fails after releasing links', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let transactionCommitted = false
        executor.transaction.mockImplementation(async (callback: (transactionExecutor: typeof txExecutor) => Promise<unknown>) => {
            const result = await callback(txExecutor)
            transactionCommitted = true
            return result
        })
        txExecutor.query
            .mockResolvedValueOnce([{ id: applicationId }]) // active application lock
            .mockResolvedValueOnce([]) // publication links cascade
            .mockResolvedValueOnce([]) // connectors cascade
            .mockResolvedValueOnce([]) // global short-link release
            .mockResolvedValueOnce([]) // guest session replay cleanup
            .mockResolvedValueOnce([]) // application UPDATE returns no row and aborts transaction

        await expect(
            deleteApplicationWithSchema(executor, {
                applicationId,
                schemaName: null,
                userId: 'user-1'
            })
        ).rejects.toThrow('Application was not soft-deleted')

        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(6)
        expect(txExecutor.query.mock.calls[3][0]).toContain('UPDATE "applications"."obj_global_short_links"')
        expect(txExecutor.query.mock.calls[4][0]).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
        expect(transactionCommitted).toBe(false)
    })

    it('aborts application deletion if guest replay secrets cannot be purged', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const purgeError = new Error('guest replay cleanup failed')
        let transactionRolledBack = false
        executor.transaction.mockImplementation(async (callback: (transactionExecutor: typeof txExecutor) => Promise<unknown>) => {
            try {
                return await callback(txExecutor)
            } catch (error) {
                transactionRolledBack = true
                throw error
            }
        })
        txExecutor.query
            .mockResolvedValueOnce([{ id: applicationId }]) // active application lock
            .mockResolvedValueOnce([]) // publication links cascade
            .mockResolvedValueOnce([]) // connectors cascade
            .mockResolvedValueOnce([]) // global short-link release
            .mockRejectedValueOnce(purgeError) // replay cleanup

        await expect(
            deleteApplicationWithSchema(executor, {
                applicationId,
                schemaName: null,
                userId: 'user-1'
            })
        ).rejects.toBe(purgeError)

        expect(transactionRolledBack).toBe(true)
        expect(txExecutor.query).toHaveBeenCalledTimes(5)
        expect(txExecutor.query.mock.calls[4][0]).toContain('DELETE FROM "applications"."obj_guest_session_idempotency"')
    })

    it('propagates a global-link release failure before completing application soft-delete cascades', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const releaseError = new Error('global short-link release failed')
        let transactionRolledBack = false
        executor.transaction.mockImplementation(async (callback: (transactionExecutor: typeof txExecutor) => Promise<unknown>) => {
            try {
                return await callback(txExecutor)
            } catch (error) {
                transactionRolledBack = true
                throw error
            }
        })
        txExecutor.query
            .mockResolvedValueOnce([{ id: applicationId }]) // active application lock
            .mockResolvedValueOnce([]) // publication links cascade
            .mockResolvedValueOnce([]) // connectors cascade
            .mockRejectedValueOnce(releaseError) // global short-link release

        await expect(
            deleteApplicationWithSchema(executor, {
                applicationId,
                schemaName: null,
                userId: 'user-1'
            })
        ).rejects.toBe(releaseError)

        expect(transactionRolledBack).toBe(true)
        expect(txExecutor.query).toHaveBeenCalledTimes(4)
        expect(txExecutor.query.mock.calls[3][0]).toContain('UPDATE "applications"."obj_global_short_links"')
    })
})

describe('Connectors persistence soft-delete parity', () => {
    it('findConnector ignores soft-deleted connectors', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.obj_connectors') && sql.includes('application_id = $2')) {
                const hasFilters = sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false')
                return hasFilters
                    ? []
                    : [
                          {
                              id: 'connector-1',
                              applicationId: 'application-1',
                              name: { en: 'Deleted connector', _primary: 'en' },
                              description: null,
                              sortOrder: 0,
                              isSingleMetahub: false,
                              isRequiredMetahub: false,
                              version: 1,
                              createdAt: new Date(),
                              updatedAt: new Date(),
                              updatedBy: null
                          }
                      ]
            }

            return []
        })

        await expect(findConnector(executor, 'application-1', 'connector-1')).resolves.toBeNull()
    })

    it('countConnectorPublicationLinks ignores soft-deleted links', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.rel_connector_publications') && sql.includes('COUNT(*)::text AS count')) {
                const hasFilters = sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false')
                return [{ count: hasFilters ? '0' : '1' }]
            }

            return []
        })

        await expect(countConnectorPublicationLinks(executor, 'connector-1')).resolves.toBe(0)
    })

    it('findConnectorPublicationLink ignores soft-deleted duplicate links', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.rel_connector_publications') && sql.includes('publication_id = $2')) {
                const hasFilters = sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false')
                return hasFilters
                    ? []
                    : [
                          {
                              id: 'link-1',
                              connectorId: 'connector-1',
                              publicationId: 'publication-1',
                              sortOrder: 0,
                              version: 1,
                              createdAt: new Date(),
                              updatedAt: new Date()
                          }
                      ]
            }

            return []
        })

        await expect(findConnectorPublicationLink(executor, 'connector-1', 'publication-1')).resolves.toBeNull()
    })

    it('listConnectorPublicationLinks excludes soft-deleted link rows', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.rel_connector_publications cp') && sql.includes('ORDER BY cp.sort_order ASC')) {
                const hasFilters =
                    sql.includes('cp._upl_deleted = false') &&
                    sql.includes('cp._app_deleted = false') &&
                    sql.includes('p._upl_deleted = false') &&
                    sql.includes('p._app_deleted = false') &&
                    sql.includes('m._upl_deleted = false') &&
                    sql.includes('m._app_deleted = false')
                return hasFilters
                    ? []
                    : [
                          {
                              id: 'link-1',
                              connectorId: 'connector-1',
                              publicationId: 'publication-1',
                              sortOrder: 0,
                              createdAt: new Date(),
                              publication_id: 'publication-1',
                              publication_name: { en: 'Publication', _primary: 'en' },
                              publication_description: null,
                              metahubId: 'metahub-1',
                              metahub_codename: 'hub',
                              metahub_name: { en: 'Metahub', _primary: 'en' }
                          }
                      ]
            }

            return []
        })

        await expect(listConnectorPublicationLinks(executor, 'connector-1')).resolves.toEqual([])
    })
})

describe('Applications access guards soft-delete parity', () => {
    it('getApplicationMembership ignores soft-deleted memberships', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.rel_application_users')) {
                const hasFilters = sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false')
                return hasFilters
                    ? []
                    : [
                          {
                              applicationId: 'application-1',
                              userId: 'user-1',
                              role: 'owner',
                              _uplCreatedAt: new Date()
                          }
                      ]
            }

            return []
        })

        await expect(getApplicationMembership(executor, 'user-1', 'application-1')).resolves.toBeNull()
    })

    it('ensureConnectorAccess rejects soft-deleted connectors', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.obj_connectors')) {
                const hasFilters = sql.includes('_upl_deleted = false') && sql.includes('_app_deleted = false')
                return hasFilters ? [] : [{ id: 'connector-1', applicationId: 'application-1' }]
            }

            if (sql.includes('FROM applications.rel_application_users')) {
                return [
                    {
                        applicationId: 'application-1',
                        userId: 'user-1',
                        role: 'owner',
                        _uplCreatedAt: new Date()
                    }
                ]
            }

            return []
        })

        await expect(ensureConnectorAccess(executor, 'user-1', 'connector-1')).rejects.toMatchObject({ statusCode: 404 })
    })
})
