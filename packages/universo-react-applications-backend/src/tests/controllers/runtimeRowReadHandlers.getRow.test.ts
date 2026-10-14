import type { Response } from 'express'

const mockResolveRuntimeSchema = jest.fn()
const mockResolveRuntimeObjectCollection = jest.fn()
const mockBuildRuntimeRecordAccessClause = jest.fn()

jest.mock('../../shared/runtimeHelpers', () => {
    const actual = jest.requireActual('../../shared/runtimeHelpers')
    return {
        __esModule: true,
        ...actual,
        buildRuntimeActiveRowCondition: jest.fn(() => 'TRUE'),
        resolveRuntimeSchema: (...args: unknown[]) => mockResolveRuntimeSchema(...args)
    }
})

jest.mock('../../controllers/runtimeRowSupport/objects', () => ({
    resolveRuntimeObjectCollection: (...args: unknown[]) => mockResolveRuntimeObjectCollection(...args)
}))

jest.mock('../../services/runtimeRowSupport/access', () => ({
    buildRuntimeRecordAccessClause: (...args: unknown[]) => mockBuildRuntimeRecordAccessClause(...args)
}))

import { createGetRowHandler } from '../../controllers/runtimeRowReadHandlers/getRow'

const applicationId = '019f2000-0000-7000-8000-000000000001'
const rowId = '019f2000-0000-7000-8000-000000000002'
const objectCollectionId = '019f2000-0000-7000-8000-000000000003'

describe('runtime row getRow hidden-component protection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('omits hidden guest-session verifiers from SQL selection and the response DTO', async () => {
        const manager = {
            query: jest.fn().mockResolvedValue([
                {
                    id: rowId,
                    display_name: 'Lyceum learner',
                    guest_session_token: 'secret-verifier',
                    _upl_version: 3
                }
            ])
        }
        mockResolveRuntimeSchema.mockResolvedValue({
            manager,
            schemaIdent: '"runtime_schema"',
            currentWorkspaceId: null,
            userId: '019f2000-0000-7000-8000-000000000004',
            permissions: {}
        })
        mockResolveRuntimeObjectCollection.mockResolvedValue({
            objectCollection: {
                id: objectCollectionId,
                kind: 'object',
                codename: 'Students',
                table_name: 'students',
                config: {}
            },
            attrs: [
                { id: 'display-name', codename: 'DisplayName', column_name: 'display_name', data_type: 'STRING', ui_config: {} },
                {
                    id: 'session-token',
                    codename: 'GuestSessionToken',
                    column_name: 'guest_session_token',
                    data_type: 'STRING',
                    ui_config: { hidden: true, serverOwned: true }
                }
            ],
            error: null
        })
        mockBuildRuntimeRecordAccessClause.mockResolvedValue('')

        const response = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response & {
            json: jest.Mock
            status: jest.Mock
        }
        const handler = createGetRowHandler({
            getDbExecutor: () => manager as never,
            query: jest.fn() as never
        })

        await handler(
            {
                params: { applicationId, rowId },
                query: { objectCollectionId }
            } as never,
            response
        )

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(String(manager.query.mock.calls[0]?.[0])).not.toContain('"guest_session_token"')
        expect(response.json).toHaveBeenCalledWith({
            id: rowId,
            version: 3,
            data: { display_name: 'Lyceum learner' }
        })
        expect(JSON.stringify(response.json.mock.calls[0])).not.toContain('secret-verifier')
    })
})
