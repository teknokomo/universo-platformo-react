import {
    convertPersonalWorkspaceToShared,
    RUNTIME_WORKSPACE_ERROR_CODES,
    RuntimeWorkspaceError
} from '../../services/runtimeWorkspaceService'

const mockAcquireAdvisoryLock = jest.fn<Promise<void>, [unknown, string]>()

jest.mock('@universo-react/utils/database', () => ({
    ...(jest.requireActual('@universo-react/utils/database') as object),
    acquireAdvisoryXactLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...(args as [unknown, string]))
}))

declare global {
    // Narrow capture type used by the fixtures below.
    interface ConversionCapturedWrite {
        sql: string
        params: unknown[] | undefined
    }
}

const uuid = (tail: string): string => `018f8a78-7b8f-7c1d-a111-${tail}`

const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334400'
const APPLICATION_ID = uuid('223333440000')
const USER_ID = uuid('223333440001')
const WORKSPACE_ID = uuid('223333440002')
const AUDIT_ROW_ID = uuid('223333440009')

interface ConversionFixture {
    executor: {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: jest.Mock
    }
    txExecutor: {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: jest.Mock
    }
    captured: ConversionCapturedWrite[]
}

function buildConversionFixture(
    workspaceRow: {
        missing?: boolean
        id?: string
        workspaceType?: string
        personalUserId?: string | null
    } = {}
): ConversionFixture {
    const captured: ConversionCapturedWrite[] = []

    const forward = async (sql: string, params?: unknown[]): Promise<unknown[]> => {
        captured.push({ sql, params })
        if (sql.includes('SELECT id, workspace_type')) {
            return workspaceRow.missing
                ? []
                : [
                      {
                          id: WORKSPACE_ID,
                          workspace_type: workspaceRow.workspaceType ?? 'personal',
                          personal_user_id: workspaceRow.personalUserId ?? USER_ID
                      }
                  ]
        }
        if (sql.includes('"_app_workspaces"') && sql.includes('converted_from_user_id')) {
            return [{ id: workspaceRow.id ?? WORKSPACE_ID }]
        }
        if (sql.includes('WITH activeMembers')) {
            return [{ inserted: 2 }]
        }
        if (sql.includes('_app_workspace_operation_audit')) {
            return [{ id: AUDIT_ROW_ID }]
        }
        return []
    }

    const txQuery: jest.Mock = jest.fn(async (sql: string, params?: unknown[]) => forward(sql, params))
    const txExecutor: { query: jest.Mock; transaction: jest.Mock; isReleased: jest.Mock } = {
        query: txQuery,
        transaction: jest.fn(async (fn: (exec: unknown) => Promise<{ id: string }>) => fn(txExecutor)),
        isReleased: jest.fn().mockReturnValue(false)
    }
    const executor = {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn(async (fn: (exec: unknown) => Promise<{ id: string }>) => fn(txExecutor as never)) as jest.Mock,
        isReleased: jest.fn().mockReturnValue(false)
    }

    return {
        executor: executor as unknown as ConversionFixture['executor'],
        txExecutor: txExecutor as unknown as ConversionFixture['txExecutor'],
        captured
    } as unknown as ConversionFixture
}

describe('convertPersonalWorkspaceToShared', () => {
    beforeEach(() => {
        mockAcquireAdvisoryLock.mockReset()
        mockAcquireAdvisoryLock.mockResolvedValue(undefined)
    })

    it('converts in place: locks per-user, sets the marker, enrolls baseline members, writes the audit row', async () => {
        const fixture = buildConversionFixture({})
        const result = await convertPersonalWorkspaceToShared(
            {
                ...fixture.executor,
                transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(fixture.txExecutor as never))
            } as never,
            {
                schemaName: SCHEMA_NAME,
                applicationId: APPLICATION_ID,
                workspaceId: WORKSPACE_ID,
                userId: USER_ID
            }
        )

        expect(result).toEqual({ id: WORKSPACE_ID })

        // Advisory lock serializes the conversion with ensurePersonalWorkspaceForUser.
        expect(mockAcquireAdvisoryLock).toHaveBeenCalledWith(expect.anything(), `personal-workspace:${SCHEMA_NAME}:${USER_ID}`)

        const workspaceUpdate = fixture.captured.find(({ sql }) => sql.includes('converted_from_user_id'))
        expect(workspaceUpdate).toBeDefined()
        expect(workspaceUpdate?.sql).toContain(`SET workspace_type = 'shared'`)
        expect(workspaceUpdate?.sql).toContain('personal_user_id = NULL')

        // The workspace row is locked before the guarded UPDATE runs.
        const lockSelect = fixture.captured.find(({ sql }) => sql.includes('SELECT id, workspace_type'))
        expect(lockSelect?.sql).toContain('FOR UPDATE')

        // Exactly one baseline enrollment statement: all application members in
        // every active non-personal workspace; owner rows win via DO NOTHING.
        const baselineStatements = fixture.captured.filter(({ sql }) => sql.includes('WITH activeMembers'))
        expect(baselineStatements).toHaveLength(1)
        expect(baselineStatements[0]?.sql).toContain('FROM applications.rel_application_users au')
        expect(baselineStatements[0]?.sql).toContain('au.application_id = $1')
        expect(baselineStatements[0]?.sql).toContain(`w.workspace_type <> 'personal'`)
        expect(baselineStatements[0]?.sql).toContain('w.personal_user_id IS NULL')
        expect(baselineStatements[0]?.sql).toContain(`r.codename = 'member'`)
        expect(baselineStatements[0]?.sql).toContain('ON CONFLICT (workspace_id, user_id)')
        expect(baselineStatements[0]?.sql).toContain('WHERE _upl_deleted = false AND _app_deleted = false')
        expect(baselineStatements[0]?.sql).toContain('DO NOTHING')

        // One audit row with the baseline-row count and the conversion kind.
        const auditRows = fixture.captured.filter(({ sql }) => sql.includes('_app_workspace_operation_audit'))
        expect(auditRows).toHaveLength(1)
        expect(auditRows[0]?.params?.[1]).toBe('personal_to_shared_conversion')
        expect(auditRows[0]?.params?.[2]).toBe(2)
    })

    it('never mutates business tables or workspace settings during conversion', async () => {
        const fixture = buildConversionFixture({})
        await convertPersonalWorkspaceToShared(
            {
                ...fixture.executor,
                transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(fixture.txExecutor as never))
            } as never,
            {
                schemaName: SCHEMA_NAME,
                applicationId: APPLICATION_ID,
                workspaceId: WORKSPACE_ID,
                userId: USER_ID
            }
        )

        const businessWrite = fixture.captured.find(({ sql }) => (sql.includes('"obj_') || sql.includes('"tbl_')) && sql.includes('UPDATE'))
        expect(businessWrite).toBeUndefined()

        const settingsWrite = fixture.captured.find(({ sql }) => sql.includes('"_app_workspace_settings"') && sql.includes('UPDATE'))
        expect(settingsWrite).toBeUndefined()
    })

    it('rejects a missing workspace with the typed not-found code', async () => {
        const fixture = buildConversionFixture({ missing: true })
        await expect(
            convertPersonalWorkspaceToShared(
                {
                    ...fixture.executor,
                    transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(fixture.txExecutor as never))
                } as never,
                {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    workspaceId: WORKSPACE_ID,
                    userId: USER_ID
                }
            )
        ).rejects.toMatchObject({ code: RUNTIME_WORKSPACE_ERROR_CODES.workspaceNotFound })
    })

    it('rejects a non-personal target and a foreign personal workspace', async () => {
        const sharedFixture = buildConversionFixture({ workspaceType: 'shared', personalUserId: null })
        await expect(
            convertPersonalWorkspaceToShared(
                {
                    ...sharedFixture.executor,
                    transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(sharedFixture.txExecutor as never))
                } as never,
                {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    workspaceId: WORKSPACE_ID,
                    userId: USER_ID
                }
            )
        ).rejects.toMatchObject({ code: RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked })

        const foreignFixture = buildConversionFixture({ personalUserId: uuid('223333440999') })
        await expect(
            convertPersonalWorkspaceToShared(
                {
                    ...foreignFixture.executor,
                    transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(foreignFixture.txExecutor as never))
                } as never,
                {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    workspaceId: WORKSPACE_ID,
                    userId: USER_ID
                }
            )
        ).rejects.toMatchObject({ code: RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked })
    })

    it('fails closed when the guarded UPDATE loses the row race and skips the audit write', async () => {
        const fixture = buildConversionFixture({})
        fixture.txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            fixture.captured.push({ sql, params })
            if (sql.includes('SELECT id, workspace_type')) {
                return [{ id: WORKSPACE_ID, workspace_type: 'personal', personal_user_id: USER_ID }]
            }
            if (sql.includes('"_app_workspaces"') && sql.includes('converted_from_user_id')) {
                return []
            }
            return []
        })

        await expect(
            convertPersonalWorkspaceToShared(
                {
                    ...fixture.executor,
                    transaction: jest.fn(async (fn: (exec: never) => Promise<{ id: string }>) => fn(fixture.txExecutor as never))
                } as never,
                {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    workspaceId: WORKSPACE_ID,
                    userId: USER_ID
                }
            )
        ).rejects.toMatchObject({ code: RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked })

        const auditRows = fixture.captured.filter(({ sql }) => sql.includes('_app_workspace_operation_audit'))
        expect(auditRows).toHaveLength(0)
    })

    it('exposes a stable RuntimeWorkspaceError type with the new conversion code', () => {
        const error = new RuntimeWorkspaceError(RUNTIME_WORKSPACE_ERROR_CODES.workspaceConversionBlocked, 'blocked')
        expect(error.code).toBe('WORKSPACE_CONVERSION_BLOCKED')
    })
})
