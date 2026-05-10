import { UpdateFailure } from '../../shared/runtimeHelpers'
import {
    allocateRuntimeRecordNumber,
    assertRuntimeRecordMutable,
    normalizeRuntimeRecordBehavior,
    RuntimeNumberingService,
    RuntimeRecordCommandService,
    resolveRecordNumberPeriodKey
} from '../../services/runtimeRecordBehavior'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeRecordBehavior', () => {
    it('normalizes partial record behavior over safe defaults', () => {
        const behavior = normalizeRuntimeRecordBehavior({
            recordBehavior: {
                mode: 'transactional',
                numbering: {
                    enabled: true,
                    prefix: 'ENR-'
                }
            }
        })

        expect(behavior.mode).toBe('transactional')
        expect(behavior.numbering.enabled).toBe(true)
        expect(behavior.numbering.scope).toBe('workspace')
        expect(behavior.numbering.periodicity).toBe('none')
        expect(behavior.numbering.prefix).toBe('ENR-')
    })

    it('rejects mutable operations for posted rows when configured', () => {
        expect(() =>
            assertRuntimeRecordMutable(
                {
                    recordBehavior: {
                        immutability: 'posted'
                    }
                },
                { _app_record_state: 'posted' }
            )
        ).toThrow(UpdateFailure)
    })

    it('formats numbering periods deterministically in UTC', () => {
        const date = new Date('2026-05-07T23:30:00.000Z')

        expect(resolveRecordNumberPeriodKey(date, 'day')).toBe('2026-05-07')
        expect(resolveRecordNumberPeriodKey(date, 'month')).toBe('2026-05')
        expect(resolveRecordNumberPeriodKey(date, 'quarter')).toBe('2026-Q2')
        expect(resolveRecordNumberPeriodKey(date, 'year')).toBe('2026')
        expect(resolveRecordNumberPeriodKey(date, 'none')).toBe('all')
    })

    it('allocates numbers through a single upsert counter statement', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '12' }])

        await expect(
            allocateRuntimeRecordNumber({
                manager: executor,
                schemaIdent: '"app_schema"',
                objectId: 'object-1',
                behavior: normalizeRuntimeRecordBehavior({
                    recordBehavior: {
                        numbering: {
                            enabled: true,
                            scope: 'workspace',
                            periodicity: 'month',
                            prefix: 'ENR-',
                            minLength: 5
                        }
                    }
                }),
                currentWorkspaceId: 'workspace-1',
                currentUserId: 'user-1',
                date: new Date('2026-05-07T00:00:00.000Z')
            })
        ).resolves.toBe('ENR-00012')

        expect(String(executor.query.mock.calls[0][0])).toContain('ON CONFLICT (object_id, scope_key, period_key, prefix)')
        expect(executor.query.mock.calls[0][1]).toEqual(['object-1', 'workspace:workspace-1', '2026-05', 'ENR-', 'user-1'])
    })

    it('uses the global numbering scope without workspace fallback', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '3' }])

        await expect(
            allocateRuntimeRecordNumber({
                manager: executor,
                schemaIdent: '"app_schema"',
                objectId: 'object-1',
                behavior: normalizeRuntimeRecordBehavior({
                    recordBehavior: {
                        numbering: {
                            enabled: true,
                            scope: 'global',
                            periodicity: 'none',
                            minLength: 3
                        }
                    }
                }),
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                date: new Date('2026-05-07T00:00:00.000Z')
            })
        ).resolves.toBe('003')

        expect(executor.query.mock.calls[0][1]).toEqual(['object-1', 'global', 'all', '', 'user-1'])
    })

    it('keeps workspace numbering isolated when no workspace is active', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '1' }])

        await allocateRuntimeRecordNumber({
            manager: executor,
            schemaIdent: '"app_schema"',
            objectId: 'object-1',
            behavior: normalizeRuntimeRecordBehavior({
                recordBehavior: {
                    numbering: {
                        enabled: true,
                        scope: 'workspace',
                        periodicity: 'year',
                        prefix: 'DOC-',
                        minLength: 2
                    }
                }
            }),
            currentWorkspaceId: null,
            currentUserId: 'user-1',
            date: new Date('2026-05-07T00:00:00.000Z')
        })

        expect(executor.query.mock.calls[0][1]).toEqual([
            'object-1',
            'workspace:00000000-0000-0000-0000-000000000000',
            '2026',
            'DOC-',
            'user-1'
        ])
    })

    it('allocates concurrent numbers through independent atomic upserts', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([{ last_number: '1' }]).mockResolvedValueOnce([{ last_number: '2' }])
        const behavior = normalizeRuntimeRecordBehavior({
            recordBehavior: {
                numbering: {
                    enabled: true,
                    scope: 'workspace',
                    periodicity: 'none',
                    minLength: 4
                }
            }
        })

        await expect(
            Promise.all([
                allocateRuntimeRecordNumber({
                    manager: executor,
                    schemaIdent: '"app_schema"',
                    objectId: 'object-1',
                    behavior,
                    currentWorkspaceId: 'workspace-1',
                    currentUserId: 'user-1',
                    date: new Date('2026-05-07T00:00:00.000Z')
                }),
                allocateRuntimeRecordNumber({
                    manager: executor,
                    schemaIdent: '"app_schema"',
                    objectId: 'object-1',
                    behavior,
                    currentWorkspaceId: 'workspace-1',
                    currentUserId: 'user-1',
                    date: new Date('2026-05-07T00:00:00.000Z')
                })
            ])
        ).resolves.toEqual(['0001', '0002'])

        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(String(executor.query.mock.calls[0][0])).toContain('ON CONFLICT (object_id, scope_key, period_key, prefix)')
        expect(String(executor.query.mock.calls[1][0])).toContain('ON CONFLICT (object_id, scope_key, period_key, prefix)')
    })

    it('exposes numbering through RuntimeNumberingService', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '9' }])
        const service = new RuntimeNumberingService()

        await expect(
            service.allocate({
                manager: executor,
                schemaIdent: '"app_schema"',
                objectId: 'object-1',
                behavior: normalizeRuntimeRecordBehavior({
                    recordBehavior: {
                        numbering: {
                            enabled: true,
                            scope: 'global',
                            periodicity: 'none',
                            minLength: 2
                        }
                    }
                }),
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                date: new Date('2026-05-07T00:00:00.000Z')
            })
        ).resolves.toBe('09')
        expect(service.resolvePeriodKey(new Date('2026-05-07T00:00:00.000Z'), 'year')).toBe('2026')
    })

    it('builds post command updates through RuntimeRecordCommandService', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '4' }])
        const service = new RuntimeRecordCommandService()

        const update = await service.buildUpdate({
            command: 'post',
            previousRow: { id: 'row-1', _app_record_state: 'draft', _app_record_number: null },
            behavior: normalizeRuntimeRecordBehavior({
                recordBehavior: {
                    numbering: {
                        enabled: true,
                        scope: 'workspace',
                        periodicity: 'none',
                        prefix: 'DOC-',
                        minLength: 3
                    }
                }
            }),
            manager: executor,
            schemaIdent: '"app_schema"',
            objectId: 'object-1',
            rowId: 'row-1',
            currentWorkspaceId: 'workspace-1',
            currentUserId: 'user-1',
            date: new Date('2026-05-07T00:00:00.000Z')
        })

        expect(update.values).toEqual(['row-1', 'user-1', 'posted', 'DOC-004'])
        expect(update.setClauses).toContain('_app_posting_batch_id = public.uuid_generate_v7()')
    })

    it('builds initial record system fields for transactional create flows', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([{ last_number: '7' }])
        const service = new RuntimeRecordCommandService()

        const columnValues = await service.buildInitialCreateColumnValues({
            columnValues: [{ column: 'name', value: 'Enrollment' }],
            behavior: normalizeRuntimeRecordBehavior({
                recordBehavior: {
                    mode: 'transactional',
                    numbering: {
                        enabled: true,
                        scope: 'workspace',
                        periodicity: 'month',
                        prefix: 'ENR-',
                        minLength: 4
                    },
                    effectiveDate: {
                        enabled: true,
                        defaultToNow: true
                    },
                    posting: {
                        mode: 'manual'
                    }
                }
            }),
            manager: executor,
            schemaIdent: '"app_schema"',
            objectId: 'object-1',
            currentWorkspaceId: 'workspace-1',
            currentUserId: 'user-1',
            date: new Date('2026-05-07T00:00:00.000Z')
        })

        expect(columnValues).toEqual([
            { column: 'name', value: 'Enrollment' },
            { column: '_app_record_number', value: 'ENR-0007' },
            { column: '_app_record_date', value: new Date('2026-05-07T00:00:00.000Z') },
            { column: '_app_record_state', value: 'draft' }
        ])
    })

    it('rejects invalid command transitions through RuntimeRecordCommandService before mutation planning', () => {
        const service = new RuntimeRecordCommandService()

        expect(() => service.assertCommandAllowed('post', { _app_record_state: 'posted' })).toThrow(UpdateFailure)
        expect(() => service.assertCommandAllowed('unpost', { _app_record_state: 'draft' })).toThrow(UpdateFailure)
        expect(() => service.assertCommandAllowed('void', { _app_record_state: 'voided' })).toThrow(UpdateFailure)
    })
})
