import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo/utils'
import { createQueryHelper, ensureRuntimePermission, resolveRuntimeSchema, UpdateFailure, UUID_REGEX } from '../shared/runtimeHelpers'
import { RuntimeLedgerService, type RuntimeLedgerProjectionResult } from '../services/runtimeLedgersService'

const ledgerListQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional()
})

const ledgerProjectionBodySchema = z.object({
    projectionCodename: z.string().min(1).max(120),
    filters: z.record(z.unknown()).optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional()
})

const ledgerFactAppendBodySchema = z.object({
    facts: z
        .array(z.object({ data: z.record(z.unknown()) }))
        .min(1)
        .max(100)
})

const ledgerFactReverseBodySchema = z.object({
    factIds: z.array(z.string().uuid()).min(1).max(100)
})

const ledgerFactUpdateBodySchema = z.object({
    data: z.record(z.unknown())
})

const validateLedgerIdParam = (res: Response, ledgerId: string): boolean => {
    if (UUID_REGEX.test(ledgerId)) {
        return true
    }

    res.status(400).json({
        error: 'Invalid ledger ID format',
        code: 'LEDGER_ID_INVALID'
    })
    return false
}

export function createRuntimeLedgersController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const service = new RuntimeLedgerService()

    const listLedgers = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const ledgers = await service.listLedgers({
            executor: ctx.manager,
            schemaName: ctx.schemaName
        })

        res.json({ ledgers })
    }

    const listFacts = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        if (!validateLedgerIdParam(res, ledgerId)) return

        const parsed = ledgerListQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid ledger query', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        try {
            const result = await service.listFacts({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                limit: parsed.data.limit,
                offset: parsed.data.offset
            })
            res.json(result)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }
    }

    const queryProjection = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        if (!validateLedgerIdParam(res, ledgerId)) return

        const parsed = ledgerProjectionBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid ledger projection query', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        let result: RuntimeLedgerProjectionResult
        try {
            result = await service.queryProjection({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                projectionCodename: parsed.data.projectionCodename,
                filters: parsed.data.filters,
                limit: parsed.data.limit,
                offset: parsed.data.offset
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }

        res.json(result)
    }

    const getProjection = async (req: Request, res: Response) => {
        req.body = {
            ...(req.body && typeof req.body === 'object' ? req.body : {}),
            projectionCodename: req.params.projectionCodename
        }
        await queryProjection(req, res)
    }

    const appendFacts = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        if (!validateLedgerIdParam(res, ledgerId)) return

        const parsed = ledgerFactAppendBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid ledger facts payload', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        let facts: Array<{ id: string; idempotent?: boolean }>
        try {
            facts = await service.appendFacts({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                facts: parsed.data.facts,
                writeOrigin: 'manual'
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }

        res.status(201).json({ facts })
    }

    const reverseFacts = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        if (!validateLedgerIdParam(res, ledgerId)) return

        const parsed = ledgerFactReverseBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid ledger reversal payload', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        let facts: Array<{ id: string }>
        try {
            facts = await service.reverseFacts({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                factIds: parsed.data.factIds,
                writeOrigin: 'manual'
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }

        res.status(201).json({ facts })
    }

    const updateFact = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        const factId = req.params.factId
        if (!validateLedgerIdParam(res, ledgerId)) return

        if (!UUID_REGEX.test(factId)) {
            res.status(400).json({ error: 'Invalid ledger fact ID format' })
            return
        }

        const parsed = ledgerFactUpdateBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid ledger fact update payload', details: parsed.error.flatten() })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        try {
            const fact = await service.updateFact({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                factId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                data: parsed.data.data
            })
            res.json({ fact })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }
    }

    const deleteFact = async (req: Request, res: Response) => {
        const applicationId = req.params.applicationId
        const ledgerId = req.params.ledgerId
        const factId = req.params.factId
        if (!validateLedgerIdParam(res, ledgerId)) return

        if (!UUID_REGEX.test(factId)) {
            res.status(400).json({ error: 'Invalid ledger fact ID format' })
            return
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

        try {
            const fact = await service.deleteFact({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                ledgerId,
                factId,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId
            })
            res.json({ fact })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                res.status(error.statusCode).json(error.body)
                return
            }
            throw error
        }
    }

    return {
        listLedgers,
        listFacts,
        queryProjection,
        getProjection,
        appendFacts,
        reverseFacts,
        updateFact,
        deleteFact
    }
}
