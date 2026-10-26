import type { DbExecutor } from '@universo-react/utils'
import type { RolePermission } from '../../../routes/guards'
import { buildRuntimeRecordAccessClause } from '../../../services/runtimeRowSupport/access'
import type { RuntimeObjectCollectionAttr } from '../../../services/runtimeRowSupport/contracts'

type RuntimeRecordAccessParams = Parameters<typeof buildRuntimeRecordAccessClause>[0]

const ownerAttr: RuntimeObjectCollectionAttr = {
    id: 'owner-field-id',
    codename: 'OwnerId',
    column_name: 'owner_id',
    data_type: 'TEXT',
    is_required: false
}

const buildParams = (overrides: Partial<RuntimeRecordAccessParams> = {}) => ({
    manager: { query: jest.fn() } as unknown as DbExecutor,
    schemaIdent: 'app_schema',
    currentWorkspaceId: 'workspace-1',
    currentUserId: 'user-1',
    permissions: { manageApplication: true } as Record<RolePermission, boolean>,
    objectCodename: 'Tasks',
    attrs: [ownerAttr],
    config: { runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerId' } },
    outerRowIdSql: 'task_row.id',
    values: [] as unknown[],
    ...overrides
})

describe('buildRuntimeRecordAccessClause', () => {
    it('applies the owner predicate and binds the current user even for application managers', async () => {
        const params = buildParams()

        await expect(buildRuntimeRecordAccessClause(params)).resolves.toBe('"owner_id" = $1')
        expect(params.values).toEqual(['user-1'])
        expect(params.manager.query).not.toHaveBeenCalled()
    })

    it('fails closed for owner-only access when there is no current user', async () => {
        const params = buildParams({ currentUserId: null })

        await expect(buildRuntimeRecordAccessClause(params)).resolves.toBe('FALSE')
        expect(params.values).toEqual([])
    })

    it('preserves the manage-application bypass for owner-or-shared access', async () => {
        const params = buildParams({
            config: { runtimeRecordAccess: { mode: 'ownerOrShared', ownerFieldCodename: 'OwnerId' } }
        })

        await expect(buildRuntimeRecordAccessClause(params)).resolves.toBeNull()
        expect(params.values).toEqual([])
    })
})
