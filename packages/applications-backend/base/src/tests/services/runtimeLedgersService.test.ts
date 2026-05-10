import { RuntimeLedgerService } from '../../services/runtimeLedgersService'
import { createMockDbExecutor } from '../utils/dbMocks'

const ledgerObject = {
    id: '019e0000-0000-7000-8000-000000000001',
    kind: 'ledger',
    codename: {
        _primary: 'en',
        locales: { en: { content: 'ProgressLedger' } }
    },
    presentation: { name: { _primary: 'en', locales: { en: { content: 'Progress Ledger' } } } },
    table_name: 'led_progress',
    config: {
        components: {
            dataSchema: { enabled: true },
            physicalTable: { enabled: true },
            ledgerSchema: { enabled: true }
        },
        ledger: {
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            periodicity: 'instant',
            sourcePolicy: 'registrar',
            registrarKinds: ['catalog'],
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension', required: true },
                { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true }
            ],
            projections: [
                {
                    codename: 'ProgressByLearner',
                    kind: 'balance',
                    dimensions: ['Learner'],
                    resources: ['ProgressDelta'],
                    period: 'none'
                }
            ],
            idempotency: { keyFields: [] }
        }
    }
}

const ledgerAttrs = [
    {
        id: '019e0000-0000-7000-8000-000000000101',
        object_id: ledgerObject.id,
        codename: 'Learner',
        column_name: 'learner',
        data_type: 'STRING',
        is_required: true,
        validation_rules: {}
    },
    {
        id: '019e0000-0000-7000-8000-000000000102',
        object_id: ledgerObject.id,
        codename: 'ProgressDelta',
        column_name: 'progress_delta',
        data_type: 'NUMBER',
        is_required: true,
        validation_rules: {}
    },
    {
        id: '019e0000-0000-7000-8000-000000000103',
        object_id: ledgerObject.id,
        codename: 'OccurredAt',
        column_name: 'occurred_at',
        data_type: 'DATE',
        is_required: false,
        validation_rules: {}
    },
    {
        id: '019e0000-0000-7000-8000-000000000104',
        object_id: ledgerObject.id,
        codename: 'SourceObjectId',
        column_name: 'source_object_id',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {}
    },
    {
        id: '019e0000-0000-7000-8000-000000000105',
        object_id: ledgerObject.id,
        codename: 'SourceRowId',
        column_name: 'source_row_id',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {}
    },
    {
        id: '019e0000-0000-7000-8000-000000000106',
        object_id: ledgerObject.id,
        codename: 'SourceLineId',
        column_name: 'source_line_id',
        data_type: 'STRING',
        is_required: false,
        validation_rules: {}
    }
]

describe('RuntimeLedgersService', () => {
    it('lists ledger metadata with field roles from config.ledger', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        executor.query.mockResolvedValueOnce([ledgerObject]).mockResolvedValueOnce(ledgerAttrs)

        const ledgers = await service.listLedgers({ executor, schemaName: 'app_runtime_test' })

        expect(ledgers).toHaveLength(1)
        expect(String(executor.query.mock.calls[0]?.[0])).not.toContain("kind = 'ledger'")
        expect(String(executor.query.mock.calls[0]?.[0])).not.toContain("config ? 'ledger'")
        expect(String(executor.query.mock.calls[0]?.[0])).toContain("config->'components'->'ledgerSchema'")
        expect(String(executor.query.mock.calls[0]?.[0])).toContain("jsonb_typeof(config->'ledger') = 'object'")
        expect(ledgers[0]).toEqual(
            expect.objectContaining({
                id: ledgerObject.id,
                codename: 'ProgressLedger',
                fields: expect.arrayContaining([
                    expect.objectContaining({ codename: 'Learner', role: 'dimension', required: true }),
                    expect.objectContaining({ codename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true })
                ])
            })
        )
    })

    it('returns a controlled not-found error when a ledger binding cannot be resolved', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        executor.query.mockResolvedValueOnce([])

        await expect(
            service.listFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            body: {
                code: 'LEDGER_NOT_FOUND'
            }
        })
    })

    it('fails closed when a projection references an unknown field', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        executor.query
            .mockResolvedValueOnce([
                {
                    ...ledgerObject,
                    config: {
                        ledger: {
                            ...ledgerObject.config.ledger,
                            projections: [
                                {
                                    codename: 'BrokenProjection',
                                    kind: 'balance',
                                    dimensions: ['MissingField'],
                                    resources: ['ProgressDelta'],
                                    period: 'none'
                                }
                            ]
                        }
                    }
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))

        await expect(
            service.queryProjection({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                projectionCodename: 'BrokenProjection'
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: {
                code: 'LEDGER_PROJECTION_INVALID'
            }
        })
    })

    it('rejects append payloads with unknown fields before inserting', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        txExecutor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))

        await expect(
            service.appendFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10, Unexpected: true } }],
                writeOrigin: 'registrar',
                registrarKind: 'catalog'
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            body: {
                code: 'LEDGER_FACT_FIELD_INVALID',
                field: 'Unexpected'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('rejects append payloads with invalid field values as controlled validation failures', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        txExecutor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))

        await expect(
            service.appendFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 'not-a-number' } }],
                writeOrigin: 'registrar',
                registrarKind: 'catalog'
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            body: {
                code: 'LEDGER_FACT_FIELD_VALUE_INVALID',
                field: 'ProgressDelta',
                detail: 'Expected number value'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('rejects direct manual appends to registrar-only ledgers before validation or inserts', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        txExecutor.query.mockResolvedValueOnce([ledgerObject]).mockResolvedValueOnce([])

        await expect(
            service.appendFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }]
            })
        ).rejects.toMatchObject({
            statusCode: 403,
            body: {
                code: 'LEDGER_REGISTRAR_ONLY'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('rejects registrar writes when the registrar kind is not allowed by ledger config', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        txExecutor.query.mockResolvedValueOnce([ledgerObject]).mockResolvedValueOnce([])

        await expect(
            service.appendFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }],
                writeOrigin: 'registrar',
                registrarKind: 'page'
            })
        ).rejects.toMatchObject({
            statusCode: 403,
            body: {
                code: 'LEDGER_REGISTRAR_KIND_FORBIDDEN',
                registrarKind: 'page'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('appends facts through insert-only SQL and returns inserted IDs', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        txExecutor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([{ id: '019e0000-0000-7000-8000-000000000777' }])

        const result = await service.appendFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: null,
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: '019e0000-0000-7000-8000-000000000777' }])
        const insertCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))
        expect(insertCall?.[0]).toContain('"app_runtime_test"."led_progress"')
        expect(insertCall?.[0]).not.toContain('UPDATE')
    })

    it('deduplicates append calls by declared idempotency keys within the active workspace', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const existingFactId = '019e0000-0000-7000-8000-000000000778'

        txExecutor.query
            .mockResolvedValueOnce([
                {
                    ...ledgerObject,
                    config: {
                        ledger: {
                            ...ledgerObject.config.ledger,
                            idempotency: { keyFields: ['Learner'] }
                        }
                    }
                }
            ])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([{ id: existingFactId }])

        const result = await service.appendFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: '019e0000-0000-7000-8000-000000000901',
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: existingFactId, idempotent: true }])
        const idempotencyCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('ORDER BY _upl_created_at ASC'))
        expect(String(idempotencyCall?.[0])).toContain('workspace_id = $2')
        expect(idempotencyCall?.[1]).toEqual(['student-1', '019e0000-0000-7000-8000-000000000901'])
        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('deduplicates ledger facts when snake_case idempotency keys target PascalCase field codenames', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const existingFactId = '019e0000-0000-7000-8000-000000000780'

        txExecutor.query
            .mockResolvedValueOnce([
                {
                    ...ledgerObject,
                    config: {
                        ledger: {
                            ...ledgerObject.config.ledger,
                            idempotency: { keyFields: ['source_object_id', 'source_row_id', 'source_line_id'] }
                        }
                    }
                }
            ])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([{ id: existingFactId }])

        const result = await service.appendFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: '019e0000-0000-7000-8000-000000000901',
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            facts: [
                {
                    data: {
                        SourceObjectId: 'Enrollments',
                        SourceRowId: '019e0000-0000-7000-8000-000000000111',
                        SourceLineId: 'enrollment-progress',
                        Learner: 'student-1',
                        ProgressDelta: 10
                    }
                }
            ],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: existingFactId, idempotent: true }])
        const idempotencyCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('ORDER BY _upl_created_at ASC'))
        expect(idempotencyCall?.[1]).toEqual([
            'Enrollments',
            '019e0000-0000-7000-8000-000000000111',
            'enrollment-progress',
            '019e0000-0000-7000-8000-000000000901'
        ])
        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('returns the existing idempotent fact when a concurrent insert is skipped by a database constraint', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const existingFactId = '019e0000-0000-7000-8000-000000000781'

        txExecutor.query
            .mockResolvedValueOnce([
                {
                    ...ledgerObject,
                    config: {
                        ledger: {
                            ...ledgerObject.config.ledger,
                            idempotency: { keyFields: ['Learner'] }
                        }
                    }
                }
            ])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: existingFactId }])

        const result = await service.appendFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: '019e0000-0000-7000-8000-000000000901',
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: existingFactId, idempotent: true }])
        const insertCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))
        expect(String(insertCall?.[0])).toContain('ON CONFLICT DO NOTHING')
    })

    it('keeps list queries isolated to the active workspace when the ledger table supports workspaces', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()

        executor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([
                {
                    id: '019e0000-0000-7000-8000-000000000779',
                    _upl_created_at: new Date('2026-05-08T00:00:00.000Z'),
                    f0: 'student-1',
                    f1: '10'
                }
            ])

        const result = await service.listFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: '019e0000-0000-7000-8000-000000000901',
            limit: 10,
            offset: 5
        })

        expect(result.rows[0]).toMatchObject({
            id: '019e0000-0000-7000-8000-000000000779',
            data: { Learner: 'student-1', ProgressDelta: 10 }
        })
        const factsCall = executor.query.mock.calls.find((call) => String(call[0]).includes('ORDER BY _upl_created_at DESC'))
        expect(String(factsCall?.[0])).toContain('workspace_id = $1')
        expect(factsCall?.[1]).toEqual(['019e0000-0000-7000-8000-000000000901', 10, 5])
    })

    it('aggregates projection resources with declared dimensions only', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()

        executor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([{ d0: 'student-1', r0: '42' }])

        const result = await service.queryProjection({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: null,
            projectionCodename: 'ProgressByLearner',
            filters: { Learner: 'student-1' },
            limit: 25,
            offset: 0
        })

        expect(result.rows).toEqual([{ Learner: 'student-1', ProgressDelta: 42 }])
        const projectionCall = executor.query.mock.calls.find((call) => String(call[0]).includes('SUM("progress_delta")'))
        expect(String(projectionCall?.[0])).toContain('"learner" = $1')
        expect(projectionCall?.[1]).toEqual(['student-1', 25, 0])
    })

    it('rejects projection filters that are not declared ledger fields', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()

        executor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))

        await expect(
            service.queryProjection({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                projectionCodename: 'ProgressByLearner',
                filters: { Unexpected: 'student-1' }
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            body: {
                code: 'LEDGER_FILTER_INVALID',
                field: 'Unexpected'
            }
        })
    })

    it('rejects projection filters with invalid field values as controlled validation failures', async () => {
        const { executor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()

        executor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))

        await expect(
            service.queryProjection({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                projectionCodename: 'ProgressByLearner',
                filters: { ProgressDelta: 'not-a-number' }
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            body: {
                code: 'LEDGER_FILTER_VALUE_INVALID',
                field: 'ProgressDelta',
                detail: 'Expected number value'
            }
        })
    })

    it('updates manual-editable ledger facts through a guarded soft mutation path', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const factId = '019e0000-0000-7000-8000-000000000801'
        const manualLedger = {
            ...ledgerObject,
            config: {
                ledger: {
                    ...ledgerObject.config.ledger,
                    mutationPolicy: 'manualEditable',
                    sourcePolicy: 'manual',
                    registrarKinds: []
                }
            }
        }

        txExecutor.query
            .mockResolvedValueOnce([manualLedger])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([{ id: factId }])

        const result = await service.updateFact({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            factId,
            currentWorkspaceId: '019e0000-0000-7000-8000-000000000901',
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            data: { ProgressDelta: 15 }
        })

        expect(result).toEqual({ id: factId })
        const updateCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('UPDATE "app_runtime_test"."led_progress"'))
        expect(String(updateCall?.[0])).toContain('"progress_delta" = $3')
        expect(String(updateCall?.[0])).toContain('workspace_id = $4')
        expect(String(updateCall?.[0])).toContain('RETURNING id')
        expect(updateCall?.[1]).toEqual([factId, '019e0000-0000-7000-8000-000000000999', 15, '019e0000-0000-7000-8000-000000000901'])
    })

    it('rejects manual fact updates for append-only ledgers', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const appendOnlyManualLedger = {
            ...ledgerObject,
            config: {
                ledger: {
                    ...ledgerObject.config.ledger,
                    mutationPolicy: 'appendOnly',
                    sourcePolicy: 'manual',
                    registrarKinds: []
                }
            }
        }

        txExecutor.query.mockResolvedValueOnce([appendOnlyManualLedger]).mockResolvedValueOnce([])

        await expect(
            service.updateFact({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                factId: '019e0000-0000-7000-8000-000000000801',
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                data: { ProgressDelta: 15 }
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: {
                code: 'LEDGER_APPEND_ONLY'
            }
        })
    })

    it('soft-deletes manual-editable ledger facts instead of hard deleting rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const factId = '019e0000-0000-7000-8000-000000000802'
        const manualLedger = {
            ...ledgerObject,
            config: {
                ledger: {
                    ...ledgerObject.config.ledger,
                    mutationPolicy: 'manualEditable',
                    sourcePolicy: 'manual',
                    registrarKinds: []
                }
            }
        }

        txExecutor.query
            .mockResolvedValueOnce([manualLedger])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: factId }])

        const result = await service.deleteFact({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            factId,
            currentWorkspaceId: null,
            currentUserId: '019e0000-0000-7000-8000-000000000999'
        })

        expect(result).toEqual({ id: factId })
        const deleteCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('UPDATE "app_runtime_test"."led_progress"'))
        expect(String(deleteCall?.[0])).toContain('_upl_deleted = true')
        expect(String(deleteCall?.[0])).toContain('_app_deleted = true')
        expect(String(deleteCall?.[0])).not.toContain('DELETE FROM')
        expect(deleteCall?.[1]).toEqual([factId, '019e0000-0000-7000-8000-000000000999'])
    })

    it('reverses facts by appending compensating rows instead of updating existing facts', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const sourceFactId = '019e0000-0000-7000-8000-000000000780'
        const reversedFactId = '019e0000-0000-7000-8000-000000000781'

        txExecutor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([{ column_name: '_app_reversal_of_fact_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([
                {
                    id: sourceFactId,
                    learner: 'student-1',
                    progress_delta: '10',
                    occurred_at: new Date('2026-05-08T00:00:00.000Z')
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: reversedFactId }])

        const result = await service.reverseFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: null,
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            factIds: [sourceFactId],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: reversedFactId }])
        const insertCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))
        expect(String(insertCall?.[0])).toContain('"app_runtime_test"."led_progress"')
        expect(String(insertCall?.[0])).not.toContain('UPDATE')
        expect(insertCall?.[1]).toEqual([
            'student-1',
            -10,
            '2026-05-08T00:00:00.000Z',
            null,
            null,
            null,
            '019e0000-0000-7000-8000-000000000999',
            '019e0000-0000-7000-8000-000000000999',
            sourceFactId
        ])
    })

    it('uses a deterministic reversal suffix for ledger idempotency keys', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const sourceFactId = '019e0000-0000-7000-8000-000000000783'
        const reversedFactId = '019e0000-0000-7000-8000-000000000784'
        const workspaceId = '019e0000-0000-7000-8000-000000000901'
        const sourceRowId = '019e0000-0000-7000-8000-000000000111'
        const reversalLineId = `enrollment-progress:reversal:${sourceFactId}`

        txExecutor.query
            .mockResolvedValueOnce([
                {
                    ...ledgerObject,
                    config: {
                        ledger: {
                            ...ledgerObject.config.ledger,
                            idempotency: { keyFields: ['source_object_id', 'source_row_id', 'source_line_id'] }
                        }
                    }
                }
            ])
            .mockResolvedValueOnce([{ column_name: 'workspace_id' }])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([
                {
                    id: sourceFactId,
                    learner: 'student-1',
                    progress_delta: '25',
                    occurred_at: new Date('2026-05-08T00:00:00.000Z'),
                    source_object_id: 'Enrollments',
                    source_row_id: sourceRowId,
                    source_line_id: 'enrollment-progress'
                }
            ])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: reversedFactId }])

        const result = await service.reverseFacts({
            executor,
            schemaName: 'app_runtime_test',
            ledgerId: ledgerObject.id,
            currentWorkspaceId: workspaceId,
            currentUserId: '019e0000-0000-7000-8000-000000000999',
            factIds: [sourceFactId],
            writeOrigin: 'registrar',
            registrarKind: 'catalog'
        })

        expect(result).toEqual([{ id: reversedFactId }])
        const idempotencyCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('ORDER BY _upl_created_at ASC'))
        expect(idempotencyCall?.[1]).toEqual(['Enrollments', sourceRowId, reversalLineId, workspaceId])

        const insertCall = txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))
        expect(String(insertCall?.[0])).toContain('ON CONFLICT DO NOTHING')
        expect(insertCall?.[1]).toEqual([
            'student-1',
            -25,
            '2026-05-08T00:00:00.000Z',
            'Enrollments',
            sourceRowId,
            reversalLineId,
            '019e0000-0000-7000-8000-000000000999',
            '019e0000-0000-7000-8000-000000000999',
            workspaceId
        ])
    })

    it('rejects direct manual reversals to registrar-only ledgers', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const sourceFactId = '019e0000-0000-7000-8000-000000000782'

        txExecutor.query.mockResolvedValueOnce([ledgerObject]).mockResolvedValueOnce([])

        await expect(
            service.reverseFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                factIds: [sourceFactId]
            })
        ).rejects.toMatchObject({
            statusCode: 403,
            body: {
                code: 'LEDGER_REGISTRAR_ONLY'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })

    it('fails closed when a reversal references missing or inaccessible facts', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const service = new RuntimeLedgerService()
        const sourceFactId = '019e0000-0000-7000-8000-000000000782'

        txExecutor.query
            .mockResolvedValueOnce([ledgerObject])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(ledgerAttrs.map(({ object_id: _objectId, ...attr }) => attr))
            .mockResolvedValueOnce([])

        await expect(
            service.reverseFacts({
                executor,
                schemaName: 'app_runtime_test',
                ledgerId: ledgerObject.id,
                currentWorkspaceId: null,
                currentUserId: '019e0000-0000-7000-8000-000000000999',
                factIds: [sourceFactId],
                writeOrigin: 'registrar',
                registrarKind: 'catalog'
            })
        ).rejects.toMatchObject({
            statusCode: 404,
            body: {
                code: 'LEDGER_REVERSAL_SOURCE_NOT_FOUND'
            }
        })

        expect(txExecutor.query.mock.calls.find((call) => String(call[0]).includes('INSERT INTO'))).toBeUndefined()
    })
})
