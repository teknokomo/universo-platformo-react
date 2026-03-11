jest.mock('@universo/admin-backend', () => ({
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
    it('listApplications excludes soft-deleted applications', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.applications a') && sql.includes('COUNT(*) OVER() AS "windowTotal"')) {
                const hasFilters =
                    sql.includes('COALESCE(a._upl_deleted, false) = false') && sql.includes('COALESCE(a._app_deleted, false) = false')

                return hasFilters
                    ? []
                    : [
                          {
                              id: 'application-1',
                              name: { en: 'Deleted app', _primary: 'en' },
                              description: null,
                              slug: 'deleted-app',
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

    it('deleteApplicationWithSchema uses soft-delete UPDATE with cascade for children', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        // DROP SCHEMA, cascade connectors, cascade links, cascade members, soft-delete application
        txExecutor.query
            .mockResolvedValueOnce([]) // DROP SCHEMA
            .mockResolvedValueOnce([]) // connectors cascade
            .mockResolvedValueOnce([]) // publication links cascade
            .mockResolvedValueOnce([]) // members cascade
            .mockResolvedValueOnce([{ id: 'application-1' }]) // application soft-delete

        const result = await deleteApplicationWithSchema(executor, {
            applicationId: 'application-1',
            schemaName: 'app_018f8a787b8f7c1da111222233334444',
            userId: 'user-1'
        })

        expect(result).toBe(true)
        // Schema drop
        expect(txExecutor.query.mock.calls[0][0]).toContain('DROP SCHEMA IF EXISTS "app_018f8a787b8f7c1da111222233334444" CASCADE')
        // Cascade soft-delete connectors
        expect(txExecutor.query.mock.calls[1][0]).toContain('UPDATE applications.connectors')
        expect(txExecutor.query.mock.calls[1][0]).toContain('_upl_deleted = true')
        // Cascade soft-delete publication links
        expect(txExecutor.query.mock.calls[2][0]).toContain('UPDATE applications.connectors_publications')
        expect(txExecutor.query.mock.calls[2][0]).toContain('_upl_deleted = true')
        // Cascade soft-delete members
        expect(txExecutor.query.mock.calls[3][0]).toContain('UPDATE applications.applications_users')
        expect(txExecutor.query.mock.calls[3][0]).toContain('_upl_deleted = true')
        // Soft-delete the application itself
        expect(txExecutor.query.mock.calls[4][0]).toContain('UPDATE applications.applications')
        expect(txExecutor.query.mock.calls[4][0]).toContain('_upl_deleted = true')
        expect(txExecutor.query.mock.calls[4][0]).toContain('COALESCE(_upl_deleted, false) = false')
        expect(txExecutor.query.mock.calls[4][0]).toContain('COALESCE(_app_deleted, false) = false')
    })
})

describe('Connectors persistence soft-delete parity', () => {
    it('findConnector ignores soft-deleted connectors', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.connectors') && sql.includes('application_id = $2')) {
                const hasFilters =
                    sql.includes('COALESCE(_upl_deleted, false) = false') && sql.includes('COALESCE(_app_deleted, false) = false')
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
            if (sql.includes('FROM applications.connectors_publications') && sql.includes('COUNT(*)::text AS count')) {
                const hasFilters =
                    sql.includes('COALESCE(_upl_deleted, false) = false') && sql.includes('COALESCE(_app_deleted, false) = false')
                return [{ count: hasFilters ? '0' : '1' }]
            }

            return []
        })

        await expect(countConnectorPublicationLinks(executor, 'connector-1')).resolves.toBe(0)
    })

    it('findConnectorPublicationLink ignores soft-deleted duplicate links', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM applications.connectors_publications') && sql.includes('publication_id = $2')) {
                const hasFilters =
                    sql.includes('COALESCE(_upl_deleted, false) = false') && sql.includes('COALESCE(_app_deleted, false) = false')
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
            if (sql.includes('FROM applications.connectors_publications cp') && sql.includes('ORDER BY cp.sort_order ASC')) {
                const hasFilters =
                    sql.includes('COALESCE(cp._upl_deleted, false) = false') &&
                    sql.includes('COALESCE(cp._app_deleted, false) = false') &&
                    sql.includes('COALESCE(p._upl_deleted, false) = false') &&
                    sql.includes('COALESCE(p._mhb_deleted, false) = false') &&
                    sql.includes('COALESCE(m._upl_deleted, false) = false') &&
                    sql.includes('COALESCE(m._mhb_deleted, false) = false') &&
                    !sql.includes('COALESCE(p._app_deleted, false) = false') &&
                    !sql.includes('COALESCE(m._app_deleted, false) = false')
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
            if (sql.includes('FROM applications.applications_users')) {
                const hasFilters =
                    sql.includes('COALESCE(_upl_deleted, false) = false') && sql.includes('COALESCE(_app_deleted, false) = false')
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
            if (sql.includes('FROM applications.connectors')) {
                const hasFilters =
                    sql.includes('COALESCE(_upl_deleted, false) = false') && sql.includes('COALESCE(_app_deleted, false) = false')
                return hasFilters ? [] : [{ id: 'connector-1', applicationId: 'application-1' }]
            }

            if (sql.includes('FROM applications.applications_users')) {
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
