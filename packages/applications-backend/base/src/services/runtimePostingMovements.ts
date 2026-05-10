import type { CatalogRecordBehavior, ScriptPostingMovement } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { z } from 'zod'
import { UpdateFailure } from '../shared/runtimeHelpers'
import { RuntimeLedgerService } from './runtimeLedgersService'

type PostingMovementResultLike = {
    movements?: unknown
}

type StoredPostingMovement = {
    ledgerCodename: string
    facts: Array<{ id: string; idempotent?: boolean }>
}

const MAX_MOVEMENTS_PER_POST = 50
const MAX_FACTS_PER_MOVEMENT = 100
const LEDGER_CODENAME_PATTERN = /^[A-Za-z0-9_.-]{1,120}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const storedPostingFactSchema = z
    .object({
        id: z.string().regex(UUID_PATTERN),
        idempotent: z.boolean().optional()
    })
    .strict()

const storedPostingMovementSchema = z
    .object({
        ledgerCodename: z.string().trim().regex(LEDGER_CODENAME_PATTERN),
        facts: z.array(storedPostingFactSchema).min(1).max(MAX_FACTS_PER_MOVEMENT)
    })
    .strict()

const storedPostingMovementsSchema = z.array(storedPostingMovementSchema).max(MAX_MOVEMENTS_PER_POST)

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeLedgerCodename = (value: string): string => value.trim().toLowerCase()

export class RuntimePostingMovementService {
    constructor(private readonly ledgers = new RuntimeLedgerService()) {}

    normalizeMovementResults(results: unknown[], behavior: CatalogRecordBehavior): ScriptPostingMovement[] {
        const movements: ScriptPostingMovement[] = []

        for (const result of results) {
            if (result === null || result === undefined) {
                continue
            }
            if (!isPlainRecord(result)) {
                throw this.invalidPayload('Posting lifecycle handlers must return an object or nothing')
            }

            const rawMovements = (result as PostingMovementResultLike).movements
            if (rawMovements === undefined || rawMovements === null) {
                continue
            }
            if (!Array.isArray(rawMovements)) {
                throw this.invalidPayload('Posting movement result must contain a movements array')
            }
            if (rawMovements.length > MAX_MOVEMENTS_PER_POST) {
                throw this.invalidPayload(`Posting movement result supports at most ${MAX_MOVEMENTS_PER_POST} movements`)
            }

            for (const rawMovement of rawMovements) {
                movements.push(this.normalizeMovement(rawMovement))
            }
        }

        this.assertDeclaredLedgers(movements, behavior)
        return movements
    }

    async appendMovements(params: {
        executor: DbExecutor
        schemaName: string
        registrarKind: string
        behavior: CatalogRecordBehavior
        currentWorkspaceId: string | null
        currentUserId: string | null
        results: unknown[]
    }): Promise<Array<{ ledgerCodename: string; facts: Array<{ id: string; idempotent?: boolean }> }>> {
        const movements = this.normalizeMovementResults(params.results, params.behavior)
        const appended: Array<{ ledgerCodename: string; facts: Array<{ id: string; idempotent?: boolean }> }> = []

        for (const movement of movements) {
            try {
                appended.push({
                    ledgerCodename: movement.ledgerCodename,
                    facts: await this.ledgers.appendFacts({
                        executor: params.executor,
                        schemaName: params.schemaName,
                        ledgerCodename: movement.ledgerCodename,
                        currentWorkspaceId: params.currentWorkspaceId,
                        currentUserId: params.currentUserId,
                        facts: movement.facts,
                        writeOrigin: 'registrar',
                        registrarKind: params.registrarKind
                    })
                })
            } catch (error) {
                let detail = 'Posting movement could not be appended'
                if (error instanceof UpdateFailure && typeof error.body.error === 'string') {
                    detail = error.body.error
                } else if (error instanceof Error) {
                    detail = error.message
                }
                throw new UpdateFailure(409, {
                    error: detail,
                    code: 'POSTING_MOVEMENT_INVALID',
                    ledgerCodename: movement.ledgerCodename
                })
            }
        }

        return appended
    }

    async reversePostedMovements(params: {
        executor: DbExecutor
        schemaName: string
        registrarKind: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        storedMovements: unknown
    }): Promise<Array<{ ledgerCodename: string; facts: Array<{ id: string }> }>> {
        const movements = this.normalizeStoredMovements(params.storedMovements)
        const reversed: Array<{ ledgerCodename: string; facts: Array<{ id: string }> }> = []

        for (const movement of movements) {
            const factIds = Array.from(new Set(movement.facts.map((fact) => fact.id).filter((id) => UUID_PATTERN.test(id))))
            if (factIds.length === 0) {
                continue
            }

            try {
                reversed.push({
                    ledgerCodename: movement.ledgerCodename,
                    facts: await this.ledgers.reverseFacts({
                        executor: params.executor,
                        schemaName: params.schemaName,
                        ledgerCodename: movement.ledgerCodename,
                        currentWorkspaceId: params.currentWorkspaceId,
                        currentUserId: params.currentUserId,
                        factIds,
                        writeOrigin: 'registrar',
                        registrarKind: params.registrarKind
                    })
                })
            } catch (error) {
                throw new UpdateFailure(409, {
                    error: error instanceof Error ? error.message : 'Posting movement could not be reversed',
                    code: 'POSTING_REVERSAL_INVALID',
                    ledgerCodename: movement.ledgerCodename
                })
            }
        }

        return reversed
    }

    private normalizeMovement(rawMovement: unknown): ScriptPostingMovement {
        if (!isPlainRecord(rawMovement)) {
            throw this.invalidPayload('Posting movement must be an object')
        }

        const ledgerCodename = typeof rawMovement.ledgerCodename === 'string' ? rawMovement.ledgerCodename.trim() : ''
        if (!LEDGER_CODENAME_PATTERN.test(ledgerCodename)) {
            throw this.invalidPayload('Posting movement ledgerCodename is invalid')
        }

        const rawFacts = rawMovement.facts
        if (!Array.isArray(rawFacts) || rawFacts.length === 0 || rawFacts.length > MAX_FACTS_PER_MOVEMENT) {
            throw this.invalidPayload(`Posting movement facts must contain between 1 and ${MAX_FACTS_PER_MOVEMENT} items`)
        }

        const facts = rawFacts.map((rawFact) => {
            if (!isPlainRecord(rawFact) || !isPlainRecord(rawFact.data)) {
                throw this.invalidPayload('Posting movement facts must contain object data')
            }
            return { data: rawFact.data }
        })

        return { ledgerCodename, facts }
    }

    private assertDeclaredLedgers(movements: ScriptPostingMovement[], behavior: CatalogRecordBehavior): void {
        if (movements.length === 0) {
            return
        }

        const declared = new Set(behavior.posting.targetLedgers.map(normalizeLedgerCodename).filter(Boolean))
        if (declared.size === 0) {
            throw new UpdateFailure(409, {
                error: 'Posting movements require declared target ledgers',
                code: 'POSTING_LEDGER_NOT_DECLARED'
            })
        }

        for (const movement of movements) {
            if (!declared.has(normalizeLedgerCodename(movement.ledgerCodename))) {
                throw new UpdateFailure(409, {
                    error: `Posting movement references an undeclared ledger: ${movement.ledgerCodename}`,
                    code: 'POSTING_LEDGER_NOT_DECLARED',
                    ledgerCodename: movement.ledgerCodename
                })
            }
        }
    }

    private invalidPayload(error: string): UpdateFailure {
        return new UpdateFailure(409, {
            error,
            code: 'POSTING_MOVEMENT_INVALID'
        })
    }

    private normalizeStoredMovements(value: unknown): StoredPostingMovement[] {
        if (value === null || value === undefined) {
            return []
        }
        const parsed = storedPostingMovementsSchema.safeParse(value)
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]
            const message = this.formatStoredMovementValidationError(firstIssue?.path ?? [])
            throw new UpdateFailure(409, {
                error: message,
                code: 'POSTING_REVERSAL_INVALID'
            })
        }

        return parsed.data.map((movement) => ({
            ledgerCodename: movement.ledgerCodename,
            facts: movement.facts.map((fact) => ({
                id: fact.id,
                idempotent: fact.idempotent === true
            }))
        }))
    }

    private formatStoredMovementValidationError(path: Array<string | number>): string {
        if (path.length === 0) {
            return 'Stored posting movements are invalid'
        }
        if (path.includes('ledgerCodename')) {
            return 'Stored posting movement ledgerCodename is invalid'
        }
        if (path.includes('facts')) {
            if (path.includes('id')) {
                return 'Stored posting movement fact id is invalid'
            }
            return 'Stored posting movement facts are invalid'
        }
        return 'Stored posting movement is invalid'
    }
}
