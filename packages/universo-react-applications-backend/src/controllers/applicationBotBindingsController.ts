import type { Request, Response } from 'express'
import {
    createApplicationBotBindingInputSchema as createBindingSchema,
    releaseApplicationBotBindingInputSchema as releaseBindingSchema,
    updateApplicationBotBindingInputSchema as updateBindingSchema
} from '@universo-react/types'
import { uuidV7Schema, type DbExecutor } from '@universo-react/utils'
import { ensureApplicationAccess } from '../routes/guards'
import { resolveUserId } from '../shared/runtimeHelpers'
import {
    ApplicationBotBindingApplicationNotFoundError,
    ApplicationBotBindingIdentityConflictError,
    createApplicationBotBindingsService,
    InvalidMessengerBotUsernameError
} from '../services/applicationBotBindings'
import { normalizeMessengerBotUsername } from '../services/messengerBotBindingIdentity'

type RequestDbExecutorResolver = (req: Request) => DbExecutor

const uuidV7ParamSchema = uuidV7Schema
const bindingParamSchema = uuidV7ParamSchema

const SECRET_OR_MESSENGER_IDENTITY_KEY =
    /token|secret|credential|init.?data|session|messenger.?user|telegram.?user|max.?user|phone|email|first.?name|last.?name|full.?name|given.?name|family.?name|surname|birth.?date|date.?of.?birth|address|user.?id|person.?id|contact.?id/i
const MAX_REQUEST_SCAN_DEPTH = 32
const MAX_REQUEST_SCAN_NODES = 10_000

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const containsSecretOrMessengerIdentity = (value: unknown): boolean => {
    const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
    let visitedNodes = 0
    const enqueue = (entry: unknown, depth: number): boolean => {
        if (depth > MAX_REQUEST_SCAN_DEPTH || visitedNodes + pending.length >= MAX_REQUEST_SCAN_NODES) return false
        pending.push({ value: entry, depth })
        return true
    }

    while (pending.length > 0) {
        const current = pending.pop()
        if (!current) continue
        visitedNodes += 1
        if (visitedNodes > MAX_REQUEST_SCAN_NODES || current.depth > MAX_REQUEST_SCAN_DEPTH) return true

        if (Array.isArray(current.value)) {
            for (const entry of current.value) {
                if (!enqueue(entry, current.depth + 1)) return true
            }
            continue
        }
        if (!isRecord(current.value)) continue

        for (const key in current.value) {
            if (!Object.prototype.hasOwnProperty.call(current.value, key)) continue
            if (SECRET_OR_MESSENGER_IDENTITY_KEY.test(key)) return true
            if (!enqueue(current.value[key], current.depth + 1)) return true
        }
    }

    return false
}

const applicationBotBindingNotFound = (res: Response) => res.status(404).json({ error: 'Application bot binding not found' })

const parseApplicationId = (req: Request, res: Response): string | null => {
    const result = uuidV7ParamSchema.safeParse(req.params.applicationId)
    if (!result.success) {
        res.status(400).json({ error: 'Invalid application id' })
        return null
    }

    return result.data
}

export function createApplicationBotBindingsController(getRequestDbExecutor?: RequestDbExecutorResolver) {
    const requestExecutor = (req: Request): DbExecutor => {
        if (!getRequestDbExecutor) {
            throw new Error('Request-scoped database executor is required for application bot binding routes')
        }
        return getRequestDbExecutor(req)
    }

    const authorizeManager = async (executor: DbExecutor, userId: string, applicationId: string): Promise<void> => {
        await ensureApplicationAccess(executor, userId, applicationId, ['owner', 'admin'])
    }

    const list = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return

        const executor = requestExecutor(req)
        await authorizeManager(executor, userId, applicationId)

        const bindings = await createApplicationBotBindingsService(executor).list(applicationId)
        return res.json({ items: bindings })
    }

    const create = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return

        if (containsSecretOrMessengerIdentity(req.body)) {
            return res.status(400).json({ error: 'Secret and messenger identity fields are not accepted' })
        }

        const parsed = createBindingSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

        let botUsername: string
        try {
            botUsername = normalizeMessengerBotUsername(parsed.data.platform, parsed.data.botUsername)
        } catch (error) {
            if (error instanceof InvalidMessengerBotUsernameError) {
                return res.status(400).json({ error: error.message })
            }
            throw error
        }

        const executor = requestExecutor(req)
        try {
            const binding = await executor.transaction(async (transaction) => {
                await authorizeManager(transaction, userId, applicationId)
                return createApplicationBotBindingsService(transaction).create({
                    applicationId,
                    platform: parsed.data.platform,
                    botUsername,
                    displayName: parsed.data.displayName ?? null
                })
            })
            return res.status(201).json(binding)
        } catch (error) {
            if (error instanceof ApplicationBotBindingIdentityConflictError) {
                return res.status(409).json({ error: 'A binding for this bot already exists in the application' })
            }
            if (error instanceof ApplicationBotBindingApplicationNotFoundError) {
                return res.status(404).json({ error: 'Application not found' })
            }
            throw error
        }
    }

    const update = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        if (containsSecretOrMessengerIdentity(req.body)) {
            return res.status(400).json({ error: 'Secret and messenger identity fields are not accepted' })
        }

        const parsed = updateBindingSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return

        const bindingIdResult = bindingParamSchema.safeParse(req.params.bindingId)
        if (!bindingIdResult.success) return res.status(400).json({ error: 'Invalid binding id' })

        const executor = requestExecutor(req)
        try {
            const updated = await executor.transaction(async (transaction) => {
                await authorizeManager(transaction, userId, applicationId)
                return createApplicationBotBindingsService(transaction).update({
                    applicationId,
                    bindingId: bindingIdResult.data,
                    expectedVersion: parsed.data.expectedVersion,
                    botUsername: parsed.data.botUsername,
                    displayName: parsed.data.displayName,
                    status: parsed.data.status
                })
            })

            if (!updated) return applicationBotBindingNotFound(res)
            return res.json(updated)
        } catch (error) {
            if (error instanceof InvalidMessengerBotUsernameError) return res.status(400).json({ error: error.message })
            if (error instanceof ApplicationBotBindingIdentityConflictError) {
                return res.status(409).json({ error: 'A binding for this bot already exists in the application' })
            }
            if (error instanceof ApplicationBotBindingApplicationNotFoundError) {
                return res.status(404).json({ error: 'Application not found' })
            }
            throw error
        }
    }

    const release = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        if (containsSecretOrMessengerIdentity(req.body)) {
            return res.status(400).json({ error: 'Secret and messenger identity fields are not accepted' })
        }

        const parsed = releaseBindingSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

        const applicationId = parseApplicationId(req, res)
        if (!applicationId) return

        const bindingIdResult = bindingParamSchema.safeParse(req.params.bindingId)
        if (!bindingIdResult.success) return res.status(400).json({ error: 'Invalid binding id' })

        const executor = requestExecutor(req)
        try {
            const released = await executor.transaction(async (transaction) => {
                await authorizeManager(transaction, userId, applicationId)
                return createApplicationBotBindingsService(transaction).release({
                    applicationId,
                    bindingId: bindingIdResult.data,
                    expectedVersion: parsed.data.expectedVersion
                })
            })

            if (!released) return applicationBotBindingNotFound(res)
            return res.json(released)
        } catch (error) {
            if (error instanceof ApplicationBotBindingApplicationNotFoundError) {
                return res.status(404).json({ error: 'Application not found' })
            }
            throw error
        }
    }

    return { list, create, update, release }
}

export function createMessengerBindingAttributionController(getDbExecutor: () => DbExecutor) {
    const resolveAttribution = async (req: Request, res: Response) => {
        const platform = await getDbExecutor().transaction((transaction) =>
            createApplicationBotBindingsService(transaction).resolvePublicAttribution(
                req.params.applicationRef ?? '',
                req.params.shortId ?? ''
            )
        )
        return res.json({ platform })
    }

    return { resolveAttribution }
}
