import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID } from '../../services/guestAccessLinkIntakePolicy'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da1112222333346aa'
const intakePolicyCodenames = [
    'ShowFirstName',
    'RequireFirstName',
    'ShowLastName',
    'RequireLastName',
    'ShowEmail',
    'RequireEmail',
    'ShowPhone',
    'RequirePhone',
    'CaptchaEnabled'
]

const createIntakeAttrs = () =>
    intakePolicyCodenames.map((codename, index) => ({
        id: `attr-${index}`,
        codename,
        column_name: `policy_${index}`,
        data_type: 'BOOLEAN',
        is_required: false,
        ui_config: { defaultValue: false }
    }))

const createAccessLinkBinding = (attrs = createIntakeAttrs()) => ({
    object: {
        id: 'access-links-object',
        kind: 'object',
        codename: 'AccessLinks',
        table_name: 'access_links',
        config: {},
        lifecycleContract: {
            publish: { enabled: true, trackAt: true, trackBy: true },
            archive: { enabled: true, trackAt: true, trackBy: true },
            delete: { mode: 'soft', trackAt: true, trackBy: true }
        },
        hasWorkspaceColumn: false
    },
    attrs,
    tableIdent: `"${schemaName}"."access_links"`,
    tableName: 'access_links',
    activeRowCondition: '_upl_deleted = false AND _app_deleted = false'
})

describe('RuntimeModulesService AccessLinks write boundary', () => {
    const engine = { callMethod: jest.fn(), dispatchEvent: jest.fn().mockResolvedValue([]) }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('uses trusted defaults for server-owned fields and rejects client values by codename or column', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const attrs = [
            {
                id: 'use-count',
                codename: 'UseCount',
                column_name: 'use_count',
                data_type: 'NUMBER',
                is_required: false,
                ui_config: { serverOwned: true, defaultValue: 0 }
            }
        ]
        const serviceInternals = service as never as {
            buildWritableColumnValues: (params: {
                executor: typeof executor
                schemaName: string
                attrs: typeof attrs
                payload: Record<string, unknown>
                mode: 'create' | 'update'
            }) => Promise<Array<{ column: string; value: unknown }>>
        }

        await expect(
            serviceInternals.buildWritableColumnValues({ executor, schemaName, attrs, payload: {}, mode: 'create' })
        ).resolves.toEqual([{ column: 'use_count', value: 0 }])
        await expect(
            serviceInternals.buildWritableColumnValues({ executor, schemaName, attrs, payload: {}, mode: 'update' })
        ).resolves.toEqual([])
        await expect(
            serviceInternals.buildWritableColumnValues({ executor, schemaName, attrs, payload: { UseCount: 99 }, mode: 'create' })
        ).rejects.toThrow('Field is server-owned: UseCount')
        await expect(
            serviceInternals.buildWritableColumnValues({ executor, schemaName, attrs, payload: { use_count: 99 }, mode: 'update' })
        ).rejects.toThrow('Field is server-owned: UseCount')
    })

    it('rejects an invalid guest-intake policy before module create lifecycle or SQL insert', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const binding = createAccessLinkBinding()
        jest.spyOn(service as never as { resolveRecordBinding: () => Promise<unknown> }, 'resolveRecordBinding').mockResolvedValue(binding)
        const lifecycle = jest.spyOn(service, 'dispatchLifecycleEvent').mockResolvedValue()

        await expect(
            (
                service as never as {
                    createRecord: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
                }
            ).createRecord({
                executor,
                applicationId: 'application-1',
                schemaName,
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: { createContent: true },
                entityCodename: 'AccessLinks',
                data: { ShowFirstName: false, RequireFirstName: true }
            })
        ).rejects.toMatchObject({ statusCode: 400, code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID })

        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(lifecycle).not.toHaveBeenCalled()
    })

    it('validates the merged persisted AccessLinks row before module update lifecycle or SQL write', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeModulesService(engine as never)
        const binding = createAccessLinkBinding()
        const currentRow = intakePolicyCodenames.reduce<Record<string, unknown>>((row, _codename, index) => {
            row[`policy_${index}`] = false
            return row
        }, {})
        currentRow.id = 'access-link-1'
        currentRow.policy_0 = true
        currentRow.policy_1 = true
        currentRow._upl_locked = false

        jest.spyOn(service as never as { resolveRecordBinding: () => Promise<unknown> }, 'resolveRecordBinding').mockResolvedValue(binding)
        jest.spyOn(service as never as { getRecordById: () => Promise<unknown> }, 'getRecordById').mockResolvedValue(currentRow)
        txExecutor.query.mockImplementation(async (sql: string) => (String(sql).includes('SELECT *') ? [currentRow] : []))
        const lifecycle = jest.spyOn(service, 'dispatchLifecycleEvent').mockResolvedValue()

        await expect(
            (
                service as never as {
                    updateRecord: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
                }
            ).updateRecord({
                executor,
                applicationId: 'application-1',
                schemaName,
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                permissions: { editContent: true },
                entityCodename: 'AccessLinks',
                recordId: 'access-link-1',
                patch: { ShowFirstName: false }
            })
        ).rejects.toMatchObject({ statusCode: 400, code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID })

        const lockedRead = txExecutor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT *'))
        expect(String(lockedRead?.[0])).toMatch(/FOR UPDATE/i)
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE "'))).toBe(false)
        expect(lifecycle).not.toHaveBeenCalled()
    })
})
