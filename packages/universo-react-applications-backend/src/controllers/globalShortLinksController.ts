import type { Request, Response } from 'express'
import { z } from 'zod'
import {
    globalShortLinkCreateInputSchema,
    globalShortLinkRecordSchema,
    globalShortLinkSlugSchema,
    globalShortLinkApplicationSectionSchema,
    globalShortLinkUuidV7Schema,
    globalShortLinkResolveResponseSchema,
    globalShortLinkResourceOptionsResponseSchema,
    globalShortLinkQuizAccessOptionsResponseSchema,
    type GlobalShortLinkResourceOption,
    type GlobalShortLinkTarget,
    type GlobalShortLinkResolveResponse
} from '@universo-react/types'
import { isValidUuid, type DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { withTransactionSavepoint } from '@universo-react/utils/database'
import { isSuperuser } from '@universo-react/admin-backend'
import { getApplicationMembership, ROLE_PERMISSIONS, type ApplicationRole } from '../routes/guards'
import {
    createGlobalShortLink,
    findActiveGlobalShortLinkApplicationId,
    findActiveGlobalShortLinkTarget,
    lockActiveGlobalShortLinkApplication,
    listGlobalShortLinks,
    releaseGlobalShortLink
} from '../persistence/globalShortLinksStore'
import { listGlobalShortLinkResourceOptions } from '../persistence/globalShortLinkResourcesStore'
import { PublicApplicationUnavailableError, resolvePublicApplication } from '../services/publicApplicationRuntime'
import { isGlobalShortLinkApplicationResourceAvailable } from '../services/globalShortLinkResourceAvailability'
import type { createRuntimeGuestController } from './runtimeGuestController'
import { resolveUserId } from '../shared/runtimeHelpers'

export type GlobalShortLinksGuestRuntime = Pick<
    ReturnType<typeof createRuntimeGuestController>,
    'isPublicQuizAccessLinkAvailable' | 'lockPublicQuizAccessLink' | 'listEligiblePublicQuizAccessLinks'
>

type PublicTargetKind = GlobalShortLinkTarget['kind']
type PublicApplication = Awaited<ReturnType<typeof resolvePublicApplication>>['application']

interface PublicTargetAdapter {
    isSupported: (target: GlobalShortLinkTarget) => boolean
    isAvailable: (target: GlobalShortLinkTarget, application: PublicApplication, executor: DbExecutor) => Promise<boolean>
}

const lockTargetWorkspace = async (
    executor: DbExecutor,
    application: PublicApplication,
    target: GlobalShortLinkTarget
): Promise<boolean> => {
    if (target.kind !== 'lms-access-link' || target.workspaceId === null) return true
    if (!application.workspacesEnabled) return false

    const workspaceTable = qSchemaTable(application.schemaName, '_app_workspaces')
    const rows = await executor.query<{ id: string }>(
        `
        SELECT ${qColumn('id')} AS id
        FROM ${workspaceTable}
        WHERE ${qColumn('id')} = $1
          AND ${qColumn('status')} = 'active'
          AND ${qColumn('_upl_deleted')} = false
          AND ${qColumn('_app_deleted')} = false
        FOR SHARE
        `,
        [target.workspaceId]
    )

    return rows.length > 0
}

const listQuerySchema = z
    .object({
        applicationId: globalShortLinkUuidV7Schema,
        includeReleased: z.preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean().default(false)),
        limit: z.coerce.number().int().min(1).max(100).default(100),
        offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0)
    })
    .strict()

const quizAccessOptionsQuerySchema = z.object({ locale: z.enum(['en', 'ru']).default('en') }).strict()
const resourceOptionsQuerySchema = z.object({ locale: z.enum(['en', 'ru']).default('en') }).strict()

const NOT_FOUND_RESPONSE = { code: 'GLOBAL_SHORT_LINK_NOT_FOUND' } as const

export function createGlobalShortLinksController(
    getDbExecutor: () => DbExecutor,
    getRequestScopedDbExecutor: (req: Request) => DbExecutor,
    guestRuntime: GlobalShortLinksGuestRuntime
) {
    const publicTargetAdapters: Record<PublicTargetKind, PublicTargetAdapter> = {
        'application-entry': {
            isSupported: (target) => target.kind === 'application-entry',
            isAvailable: async () => true
        },
        'application-section': {
            isSupported: (target) =>
                target.kind === 'application-section' &&
                globalShortLinkApplicationSectionSchema.safeParse(target.section).success &&
                (target.section === 'dashboard' || target.section === 'workspace'),
            isAvailable: async (target, application) =>
                target.kind === 'application-section' &&
                (target.section === 'dashboard' || (target.section === 'workspace' && application.workspacesEnabled))
        },
        'application-resource': {
            isSupported: (target) => target.kind === 'application-resource',
            isAvailable: async (target, application, executor) =>
                target.kind === 'application-resource' && isGlobalShortLinkApplicationResourceAvailable(executor, application, target)
        },
        'lms-access-link': {
            isSupported: (target) => target.kind === 'lms-access-link',
            isAvailable: async (target, application, executor) => {
                if (target.kind !== 'lms-access-link') return false
                return guestRuntime.isPublicQuizAccessLinkAvailable(
                    executor,
                    target.applicationId,
                    target.accessLinkId,
                    target.accessLinkSlug,
                    target.workspaceId
                )
            }
        }
    }
    const authorizeApplication = async (req: Request, res: Response, applicationId: string) => {
        const actorId = resolveUserId(req)
        if (!actorId || !isValidUuid(actorId)) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }

        const executor = getRequestScopedDbExecutor(req)
        const superuser = await isSuperuser(executor, actorId)
        const membership = superuser ? null : await getApplicationMembership(executor, actorId, applicationId)
        const role = membership?.role as ApplicationRole | undefined
        const allowed = superuser || (role !== undefined && ROLE_PERMISSIONS[role]?.manageApplication === true)
        if (!allowed) {
            res.status(403).json({ error: 'Access denied' })
            return null
        }

        return { actorId, executor }
    }

    return {
        async resolve(req: Request, res: Response) {
            res.setHeader('Cache-Control', 'no-store')
            const slug = globalShortLinkSlugSchema.safeParse(req.params.slug ?? '')
            if (!slug.success) return res.status(404).json(NOT_FOUND_RESPONSE)

            const target = await getDbExecutor().transaction(async (tx) => {
                await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
                const storedTarget = await findActiveGlobalShortLinkTarget(tx, slug.data)
                if (!storedTarget) return null
                const adapter = publicTargetAdapters[storedTarget.kind]
                if (!adapter || !adapter.isSupported(storedTarget)) return null

                try {
                    const resolved = await resolvePublicApplication(tx, storedTarget.applicationId)
                    if (resolved.application.id !== storedTarget.applicationId) return null
                    if (!(await adapter.isAvailable(storedTarget, resolved.application, tx))) return null
                    return storedTarget
                } catch (error) {
                    if (error instanceof PublicApplicationUnavailableError) return null
                    throw error
                }
            })
            if (!target) return res.status(404).json(NOT_FOUND_RESPONSE)

            const response: GlobalShortLinkResolveResponse = globalShortLinkResolveResponseSchema.parse({ target })
            return res.status(200).json(response)
        },

        async list(req: Request, res: Response) {
            const parsed = listQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() })
            }

            const context = await authorizeApplication(req, res, parsed.data.applicationId)
            if (!context) return

            const items = await listGlobalShortLinks(context.executor, parsed.data)
            return res.status(200).json({
                items: items.map((item) => globalShortLinkRecordSchema.parse(item)),
                limit: parsed.data.limit,
                offset: parsed.data.offset
            })
        },

        async listQuizAccessOptions(req: Request, res: Response) {
            const applicationId = globalShortLinkUuidV7Schema.safeParse(req.params.applicationId ?? '')
            const query = quizAccessOptionsQuerySchema.safeParse(req.query)
            if (!applicationId.success || !query.success) {
                return res.status(400).json({ error: 'Invalid quiz access options query' })
            }

            const context = await authorizeApplication(req, res, applicationId.data)
            if (!context) return

            try {
                await resolvePublicApplication(context.executor, applicationId.data)
            } catch (error) {
                if (error instanceof PublicApplicationUnavailableError) {
                    return res.status(200).json(globalShortLinkQuizAccessOptionsResponseSchema.parse({ items: [] }))
                }
                throw error
            }

            return guestRuntime.listEligiblePublicQuizAccessLinks(req, res)
        },

        async listApplicationResourceOptions(req: Request, res: Response) {
            const applicationId = globalShortLinkUuidV7Schema.safeParse(req.params.applicationId ?? '')
            const query = resourceOptionsQuerySchema.safeParse(req.query)
            if (!applicationId.success || !query.success) {
                return res.status(400).json({ error: 'Invalid application resource options query' })
            }

            const context = await authorizeApplication(req, res, applicationId.data)
            if (!context) return

            let application: PublicApplication
            try {
                application = (await resolvePublicApplication(context.executor, applicationId.data)).application
            } catch (error) {
                if (error instanceof PublicApplicationUnavailableError) {
                    return res.status(200).json(globalShortLinkResourceOptionsResponseSchema.parse({ items: [] }))
                }
                throw error
            }

            const candidates = await listGlobalShortLinkResourceOptions(context.executor, application.schemaName, query.data.locale)
            const items: GlobalShortLinkResourceOption[] = []
            for (const option of candidates) {
                const target: GlobalShortLinkTarget = {
                    kind: 'application-resource',
                    applicationId: application.id,
                    targetKind: option.targetKind,
                    entityTypeCodename: option.entityTypeCodename
                }
                if (await isGlobalShortLinkApplicationResourceAvailable(context.executor, application, target)) items.push(option)
            }

            return res.status(200).json(globalShortLinkResourceOptionsResponseSchema.parse({ items }))
        },

        async create(req: Request, res: Response) {
            const parsed = globalShortLinkCreateInputSchema.safeParse(req.body)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
            }

            const context = await authorizeApplication(req, res, parsed.data.target.applicationId)
            if (!context) return

            const adapter = publicTargetAdapters[parsed.data.target.kind]
            if (!adapter.isSupported(parsed.data.target)) {
                return res.status(422).json({ code: 'GLOBAL_SHORT_LINK_TARGET_UNSUPPORTED' })
            }

            const result = await withTransactionSavepoint(context.executor, async (tx) => {
                if (!(await lockActiveGlobalShortLinkApplication(tx, parsed.data.target.applicationId))) {
                    return { kind: 'unavailable' as const }
                }

                let application: PublicApplication
                try {
                    application = (await resolvePublicApplication(tx, parsed.data.target.applicationId)).application
                } catch (error) {
                    if (error instanceof PublicApplicationUnavailableError) return { kind: 'unavailable' as const }
                    throw error
                }

                if (parsed.data.target.kind === 'lms-access-link' && !(await lockTargetWorkspace(tx, application, parsed.data.target))) {
                    return { kind: 'unavailable' as const }
                }

                if (
                    parsed.data.target.kind === 'lms-access-link' &&
                    !(await guestRuntime.lockPublicQuizAccessLink(
                        tx,
                        parsed.data.target.applicationId,
                        parsed.data.target.accessLinkId,
                        parsed.data.target.accessLinkSlug,
                        parsed.data.target.workspaceId
                    ))
                ) {
                    return { kind: 'unavailable' as const }
                }

                if (!(await adapter.isAvailable(parsed.data.target, application, tx))) {
                    return { kind: 'unavailable' as const }
                }

                const record = await createGlobalShortLink(tx, parsed.data, context.actorId)
                return record ? { kind: 'created' as const, record } : { kind: 'conflict' as const }
            })

            if (result.kind === 'unavailable') return res.status(422).json({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })
            if (result.kind === 'conflict') return res.status(409).json({ code: 'GLOBAL_SHORT_LINK_SLUG_CONFLICT' })
            return res.status(201).json(globalShortLinkRecordSchema.parse(result.record))
        },

        async release(req: Request, res: Response) {
            const linkId = globalShortLinkUuidV7Schema.safeParse(req.params.id ?? '')
            if (!linkId.success) {
                return res.status(400).json({ error: 'Invalid link id', details: linkId.error.flatten() })
            }

            const lookupExecutor = getRequestScopedDbExecutor(req)
            const applicationId = await findActiveGlobalShortLinkApplicationId(lookupExecutor, linkId.data)
            if (!applicationId) return res.status(404).json(NOT_FOUND_RESPONSE)

            const context = await authorizeApplication(req, res, applicationId)
            if (!context) return

            const record = await releaseGlobalShortLink(context.executor, linkId.data, applicationId, context.actorId)
            if (!record) return res.status(404).json(NOT_FOUND_RESPONSE)
            return res.status(200).json(globalShortLinkRecordSchema.parse(record))
        }
    }
}
