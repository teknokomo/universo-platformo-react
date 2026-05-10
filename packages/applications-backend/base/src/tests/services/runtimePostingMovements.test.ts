import { RuntimePostingMovementService } from '../../services/runtimePostingMovements'
import { createMockDbExecutor } from '../utils/dbMocks'

const behavior = {
    mode: 'transactional',
    numbering: {
        enabled: false,
        scope: 'workspace',
        periodicity: 'none'
    },
    effectiveDate: {
        enabled: false,
        defaultToNow: true
    },
    lifecycle: {
        enabled: true,
        states: []
    },
    posting: {
        mode: 'manual',
        targetLedgers: ['ProgressLedger']
    },
    immutability: 'posted'
} as const

describe('RuntimePostingMovementService', () => {
    it('normalizes declared posting movements', () => {
        const service = new RuntimePostingMovementService()

        expect(
            service.normalizeMovementResults(
                [
                    undefined,
                    {
                        movements: [
                            {
                                ledgerCodename: 'ProgressLedger',
                                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }]
                            }
                        ]
                    }
                ],
                behavior
            )
        ).toEqual([
            {
                ledgerCodename: 'ProgressLedger',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }]
            }
        ])
    })

    it('rejects movements when the ledger is not declared by record posting behavior', () => {
        const service = new RuntimePostingMovementService()

        expect(() =>
            service.normalizeMovementResults(
                [
                    {
                        movements: [
                            {
                                ledgerCodename: 'ScoreLedger',
                                facts: [{ data: { Learner: 'student-1', ScoreDelta: 5 } }]
                            }
                        ]
                    }
                ],
                behavior
            )
        ).toThrow('Update failed')

        try {
            service.normalizeMovementResults(
                [
                    {
                        movements: [
                            {
                                ledgerCodename: 'ScoreLedger',
                                facts: [{ data: { Learner: 'student-1', ScoreDelta: 5 } }]
                            }
                        ]
                    }
                ],
                behavior
            )
        } catch (error) {
            expect(error).toMatchObject({
                body: {
                    error: 'Posting movement references an undeclared ledger: ScoreLedger',
                    code: 'POSTING_LEDGER_NOT_DECLARED',
                    ledgerCodename: 'ScoreLedger'
                }
            })
        }
    })

    it('rejects malformed movement payloads', () => {
        const service = new RuntimePostingMovementService()

        expect(() =>
            service.normalizeMovementResults(
                [
                    {
                        movements: [
                            {
                                ledgerCodename: 'ProgressLedger',
                                facts: [{ data: null }]
                            }
                        ]
                    }
                ],
                behavior
            )
        ).toThrow('Update failed')

        try {
            service.normalizeMovementResults(
                [
                    {
                        movements: [
                            {
                                ledgerCodename: 'ProgressLedger',
                                facts: [{ data: null }]
                            }
                        ]
                    }
                ],
                behavior
            )
        } catch (error) {
            expect(error).toMatchObject({
                body: {
                    error: 'Posting movement facts must contain object data',
                    code: 'POSTING_MOVEMENT_INVALID'
                }
            })
        }
    })

    it('appends valid movements through the ledger service', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            appendFacts: jest.fn().mockResolvedValue([{ id: 'fact-1' }])
        }
        const service = new RuntimePostingMovementService(ledgers as never)

        const result = await service.appendMovements({
            executor,
            schemaName: 'app_runtime_test',
            registrarKind: 'document',
            behavior,
            currentWorkspaceId: 'workspace-1',
            currentUserId: 'user-1',
            results: [
                {
                    movements: [
                        {
                            ledgerCodename: 'ProgressLedger',
                            facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }]
                        }
                    ]
                }
            ]
        })

        expect(result).toEqual([{ ledgerCodename: 'ProgressLedger', facts: [{ id: 'fact-1' }] }])
        expect(ledgers.appendFacts).toHaveBeenCalledWith(
            expect.objectContaining({
                executor,
                schemaName: 'app_runtime_test',
                ledgerCodename: 'ProgressLedger',
                currentWorkspaceId: 'workspace-1',
                currentUserId: 'user-1',
                facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }],
                writeOrigin: 'registrar',
                registrarKind: 'document'
            })
        )
    })

    it('reverses stored posting movement facts through registrar ledger writes', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            reverseFacts: jest.fn().mockResolvedValue([{ id: '019e0000-0000-7000-8000-000000000010' }])
        }
        const service = new RuntimePostingMovementService(ledgers as never)

        const result = await service.reversePostedMovements({
            executor,
            schemaName: 'app_runtime_test',
            registrarKind: 'document',
            currentWorkspaceId: 'workspace-1',
            currentUserId: 'user-1',
            storedMovements: [
                {
                    ledgerCodename: 'ProgressLedger',
                    facts: [{ id: '019e0000-0000-7000-8000-000000000001' }, { id: '019e0000-0000-7000-8000-000000000001' }]
                }
            ]
        })

        expect(result).toEqual([
            {
                ledgerCodename: 'ProgressLedger',
                facts: [{ id: '019e0000-0000-7000-8000-000000000010' }]
            }
        ])
        expect(ledgers.reverseFacts).toHaveBeenCalledWith(
            expect.objectContaining({
                executor,
                schemaName: 'app_runtime_test',
                ledgerCodename: 'ProgressLedger',
                currentWorkspaceId: 'workspace-1',
                currentUserId: 'user-1',
                factIds: ['019e0000-0000-7000-8000-000000000001'],
                writeOrigin: 'registrar',
                registrarKind: 'document'
            })
        )
    })

    it('rejects malformed stored posting movement metadata during reversal', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            reverseFacts: jest.fn()
        }
        const service = new RuntimePostingMovementService(ledgers as never)

        await expect(
            service.reversePostedMovements({
                executor,
                schemaName: 'app_runtime_test',
                registrarKind: 'document',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                storedMovements: { ledgerCodename: 'ProgressLedger' }
            })
        ).rejects.toMatchObject({
            body: {
                code: 'POSTING_REVERSAL_INVALID'
            }
        })
        expect(ledgers.reverseFacts).not.toHaveBeenCalled()
    })

    it('fails closed when stored posting movement facts contain invalid ids', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            reverseFacts: jest.fn()
        }
        const service = new RuntimePostingMovementService(ledgers as never)

        await expect(
            service.reversePostedMovements({
                executor,
                schemaName: 'app_runtime_test',
                registrarKind: 'document',
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                storedMovements: [
                    {
                        ledgerCodename: 'ProgressLedger',
                        facts: [{ id: 'invalid' }]
                    }
                ]
            })
        ).rejects.toMatchObject({
            body: {
                error: 'Stored posting movement fact id is invalid',
                code: 'POSTING_REVERSAL_INVALID'
            }
        })
        expect(ledgers.reverseFacts).not.toHaveBeenCalled()
    })

    it('maps ledger append validation failures to stable posting movement errors', async () => {
        const { executor } = createMockDbExecutor()
        const ledgers = {
            appendFacts: jest.fn().mockRejectedValue(new Error('Ledger fact contains an unknown field: Unexpected'))
        }
        const service = new RuntimePostingMovementService(ledgers as never)

        await expect(
            service.appendMovements({
                executor,
                schemaName: 'app_runtime_test',
                registrarKind: 'document',
                behavior,
                currentWorkspaceId: null,
                currentUserId: 'user-1',
                results: [
                    {
                        movements: [
                            {
                                ledgerCodename: 'ProgressLedger',
                                facts: [{ data: { Unexpected: true } }]
                            }
                        ]
                    }
                ]
            })
        ).rejects.toMatchObject({
            body: {
                error: 'Ledger fact contains an unknown field: Unexpected',
                code: 'POSTING_MOVEMENT_INVALID',
                ledgerCodename: 'ProgressLedger'
            }
        })
    })
})
