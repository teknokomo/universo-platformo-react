import type { Request, Response } from 'express'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo-react/types'
import { database, type DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { buildLocalizedContent, sanitizeLocalizedInput } from '@universo-react/utils/vlc'
import { assertNotOwner, ensureApplicationAccess } from '../routes/guards'
import type { ApplicationRole } from '../routes/guards'
import { validateListQuery } from '../schemas/queryParams'
import {
    type ApplicationMemberRecord,
    deleteApplicationMember,
    findApplicationDetails,
    findApplicationMemberById,
    findApplicationMemberByUserId,
    findApplicationSchemaInfo,
    findAuthUserByEmail,
    insertApplicationMember,
    listApplicationMembers,
    updateApplicationMember
} from '../persistence/applicationsStore'
import { acquireApplicationCopyMutationLock } from '../persistence/applicationCopyLocking'
import {
    archivePersonalWorkspaceForUser,
    ensurePersonalWorkspaceForUser,
    ensureSharedWorkspaceBaselineMembership,
    listObjectWorkspaceLimits,
    removeSharedWorkspaceBaselineMembership,
    runtimeWorkspaceTablesExist,
    upsertObjectWorkspaceLimits
} from '../services/applicationWorkspaces'
import {
    assertUserIsNotLastSharedWorkspaceOwner,
    RUNTIME_WORKSPACE_ERROR_CODES,
    RuntimeWorkspaceError
} from '../services/runtimeWorkspaceService'
import { escapeLikeWildcards, getRequestDbExecutor } from '../utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    quoteIdentifier,
    normalizeLocale,
    resolveUserId,
    resolvePresentationName,
    resolvePresentationCodename,
    resolveRuntimeCodenameText,
    runtimeCodenameTextSql,
    createQueryHelper
} from '../shared/runtimeHelpers'

const APPLICATION_ROLE_LEVELS: Record<ApplicationRole, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    member: 1
}

const canManageApplicationRole = (actorRole: ApplicationRole, targetRole: ApplicationRole): boolean =>
    APPLICATION_ROLE_LEVELS[actorRole] > APPLICATION_ROLE_LEVELS[targetRole]

// ---------------------------------------------------------------------------
// Member helpers
// ---------------------------------------------------------------------------

const isCommentVlc = (value: unknown): value is VersionedLocalizedContent<string> =>
    Boolean(value && typeof value === 'object' && 'locales' in value && '_primary' in value)

const resolveLocalizedCommentText = (commentValue: unknown): string | undefined => {
    if (typeof commentValue === 'string') {
        const trimmed = commentValue.trim()
        return trimmed.length > 0 ? trimmed : undefined
    }
    if (!isCommentVlc(commentValue)) return undefined

    const primary = commentValue._primary
    const primaryContent = commentValue.locales[primary]?.content
    if (typeof primaryContent === 'string' && primaryContent.trim().length > 0) {
        return primaryContent.trim()
    }

    for (const entry of Object.values(commentValue.locales) as Array<{ content?: string }>) {
        if (typeof entry?.content === 'string' && entry.content.trim().length > 0) {
            return entry.content.trim()
        }
    }

    return undefined
}

const normalizeCommentVlcOutput = (commentValue: unknown): VersionedLocalizedContent<string> | null =>
    isCommentVlc(commentValue) ? commentValue : null

const normalizeMemberCommentInput = (
    comment: Record<string, string | undefined> | null | undefined,
    primaryLocale?: string
): { commentVlc: VersionedLocalizedContent<string> | null; error?: string } => {
    if (comment === null) {
        return { commentVlc: null }
    }

    const sanitized = sanitizeLocalizedInput(comment ?? {})
    for (const value of Object.values(sanitized)) {
        if (value.length > 500) {
            return { commentVlc: null, error: 'Comment must be 500 characters or less' }
        }
    }

    const commentVlc = buildLocalizedContent(sanitized, primaryLocale, 'en')
    return { commentVlc: commentVlc ?? null }
}

const memberCommentInputSchema = z
    .union([z.string(), z.record(z.string(), z.string().optional())])
    .transform((value) => (typeof value === 'string' ? { en: value } : value))

const mapMember = (member: ApplicationMemberRecord) => ({
    id: member.id,
    userId: member.userId,
    email: member.email,
    nickname: member.nickname,
    role: (member.role || 'member') as ApplicationRole,
    comment: resolveLocalizedCommentText(member.comment),
    commentVlc: normalizeCommentVlcOutput(member.comment),
    createdAt: member.createdAt
})

export function createApplicationMembershipController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    // ============ JOIN PUBLIC APPLICATION ============
    const join = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())
        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const application = await findApplicationDetails(executor, applicationId)
        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }
        if (!application.isPublic) {
            return res.status(403).json({ error: 'Only public applications can be joined directly' })
        }

        const existingMember = await findApplicationMemberByUserId(executor, {
            applicationId,
            userId
        })
        if (existingMember) {
            return res.json({ status: 'joined', member: mapMember(existingMember) })
        }

        const joinedMember = await ds.transaction(async (trx) => {
            await acquireApplicationCopyMutationLock(trx, applicationId)
            const member = await insertApplicationMember(trx, {
                applicationId,
                userId,
                role: 'member',
                comment: null,
                createdBy: userId,
                updatedBy: userId
            })

            if (!member) {
                throw new Error('Failed to create application membership')
            }

            if (
                application.workspacesEnabled &&
                application.schemaName &&
                IDENTIFIER_REGEX.test(application.schemaName) &&
                (await runtimeWorkspaceTablesExist(trx, application.schemaName))
            ) {
                // Canonical lock order across the workspace lifecycle:
                // `workspace-baseline` (application scope) first, then
                // `personal-workspace` (user scope). Re-entrant advisory
                // locks make this safe for the shared helpers below.
                await acquireAdvisoryXactLock(trx, `workspace-baseline:${application.schemaName}:${applicationId}`)

                await ensurePersonalWorkspaceForUser(trx, {
                    schemaName: application.schemaName,
                    userId,
                    actorUserId: userId,
                    defaultRoleCodename: 'owner'
                })

                // The new member accesses every shared workspace of the
                // application with baseline `member` rights.
                await ensureSharedWorkspaceBaselineMembership(trx, {
                    schemaName: application.schemaName,
                    applicationId,
                    actorUserId: userId
                })
            }

            return member
        })

        return res.status(201).json({ status: 'joined', member: mapMember(joinedMember) })
    }

    // ============ LEAVE APPLICATION ============
    const leave = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())
        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const member = await findApplicationMemberByUserId(executor, { applicationId, userId })
        if (!member) {
            return res.status(404).json({ error: 'Membership not found' })
        }
        assertNotOwner(member, 'Application owner cannot leave the application')

        const application = await findApplicationSchemaInfo(executor, applicationId)
        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        try {
            await ds.transaction(async (trx) => {
                await acquireApplicationCopyMutationLock(trx, applicationId)
                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    // Canonical lock order (`workspace-baseline` before
                    // `personal-workspace`). Holding the application-scoped
                    // baseline lock across the membership delete AND the
                    // last-owner check serializes concurrent departures: a
                    // second co-owner transaction replays only after the
                    // first one commits and then sees the departed active
                    // membership instead of silently leaving the workspace
                    // without owners.
                    await acquireAdvisoryXactLock(trx, `workspace-baseline:${application.schemaName}:${applicationId}`)
                }

                await deleteApplicationMember(trx, { applicationId, memberId: member.id, userId })

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    // A shared workspace whose only `owner` row belongs to the
                    // departing user would become unmanageable (member management
                    // is owner-gated). Reject the exit instead of stranding it.
                    await assertUserIsNotLastSharedWorkspaceOwner(trx, {
                        schemaName: application.schemaName,
                        applicationId,
                        userId
                    })

                    await removeSharedWorkspaceBaselineMembership(trx, {
                        schemaName: application.schemaName,
                        applicationId,
                        userId,
                        actorUserId: userId
                    })

                    await archivePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId,
                        actorUserId: userId
                    })
                }
            })
        } catch (error) {
            if (error instanceof RuntimeWorkspaceError && error.code === RUNTIME_WORKSPACE_ERROR_CODES.memberWorkspaceOwnershipBlocked) {
                return res.status(409).json({ error: error.message, code: error.code })
            }
            throw error
        }

        return res.json({ status: 'left' })
    }

    // ============ APPLICATION SETTINGS: GET LIMITS ============
    const getLimits = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())
        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const application = await findApplicationSchemaInfo(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) return res.status(404).json({ error: 'Application not found' })
        if (!application.schemaName) return res.status(400).json({ error: 'Application schema is not configured' })
        if (!application.workspacesEnabled) return res.status(400).json({ error: 'Workspace limits require workspace mode' })
        if (!IDENTIFIER_REGEX.test(application.schemaName)) return res.status(400).json({ error: 'Invalid application schema name' })
        if (!(await runtimeWorkspaceTablesExist(ds, application.schemaName))) {
            return res.status(400).json({ error: 'Workspace subsystem is not initialized yet' })
        }

        const schemaIdent = quoteIdentifier(application.schemaName)
        const objects = (await ds.query(
            `
        SELECT id, codename, table_name, presentation
        FROM ${schemaIdent}._app_objects
        WHERE kind = 'object'
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
      `
        )) as Array<{
            id: string
            codename: unknown
            table_name: string
            presentation?: unknown
        }>

        const limits = await listObjectWorkspaceLimits(ds, {
            schemaName: application.schemaName
        })
        const limitMap = new Map(limits.map((limit) => [limit.objectId, limit.maxRows]))

        return res.json({
            items: objects.map((object) => ({
                objectId: object.id,
                codename: object.codename,
                codenameDisplay: resolvePresentationCodename(
                    object.presentation,
                    normalizeLocale(req.query.locale as string | undefined),
                    resolveRuntimeCodenameText(object.codename)
                ),
                tableName: object.table_name,
                name: resolvePresentationName(
                    object.presentation,
                    normalizeLocale(req.query.locale as string | undefined),
                    resolveRuntimeCodenameText(object.codename)
                ),
                maxRows: limitMap.get(object.id) ?? null
            }))
        })
    }

    // ============ APPLICATION SETTINGS: UPDATE LIMITS ============
    const updateLimits = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())
        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const payloadSchema = z
            .object({
                limits: z.array(
                    z
                        .object({
                            objectId: z.string().uuid(),
                            maxRows: z.number().int().positive().nullable()
                        })
                        .strict()
                )
            })
            .strict()

        const parsed = payloadSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() })
        }

        const application = await findApplicationSchemaInfo(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) return res.status(404).json({ error: 'Application not found' })
        if (!application.schemaName) return res.status(400).json({ error: 'Application schema is not configured' })
        if (!application.workspacesEnabled) return res.status(400).json({ error: 'Workspace limits require workspace mode' })
        if (!IDENTIFIER_REGEX.test(application.schemaName)) return res.status(400).json({ error: 'Invalid application schema name' })
        if (!(await runtimeWorkspaceTablesExist(ds, application.schemaName))) {
            return res.status(400).json({ error: 'Workspace subsystem is not initialized yet' })
        }

        const uniqueObjectIds = new Set(parsed.data.limits.map((limit) => limit.objectId))
        if (uniqueObjectIds.size !== parsed.data.limits.length) {
            return res.status(400).json({ error: 'Duplicate object limit rows are not allowed' })
        }

        const limitsSchemaName = application.schemaName
        const updatedLimits = await ds.transaction(async (trx) => {
            const catalogRows = await trx.query<{ id: string }>(
                `
          SELECT id
          FROM ${quoteIdentifier(limitsSchemaName)}._app_objects
          WHERE kind = 'object'
            AND _upl_deleted = false
            AND _app_deleted = false
            AND id = ANY($1::uuid[])
        `,
                [parsed.data.limits.map((limit) => limit.objectId)]
            )

            if (catalogRows.length !== uniqueObjectIds.size) {
                throw new UpdateFailure(400, {
                    error: 'Limits can only be updated for active objects'
                })
            }

            await upsertObjectWorkspaceLimits(trx, {
                schemaName: limitsSchemaName,
                actorUserId: userId,
                limits: parsed.data.limits
            })

            return listObjectWorkspaceLimits(trx, { schemaName: limitsSchemaName })
        })
        return res.json({ items: updatedLimits })
    }

    // ============ LIST MEMBERS ============
    const listMembers = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }

        const { items: members, total } = await listApplicationMembers(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            {
                applicationId,
                limit: validatedQuery.limit,
                offset: validatedQuery.offset,
                sortBy: validatedQuery.sortBy,
                sortOrder: validatedQuery.sortOrder,
                search: validatedQuery.search ? escapeLikeWildcards(validatedQuery.search.toLowerCase()) : undefined
            }
        )
        return res.json({
            items: members.map(mapMember),
            total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset
        })
    }

    // ============ ADD MEMBER ============
    const addMember = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const schema = z
            .object({
                email: z.string().email(),
                role: z.enum(['member', 'editor', 'admin']).default('member'),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })
            .strict()

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const normalizedComment = normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
        if (normalizedComment.error) {
            return res.status(400).json({
                error: 'Invalid input',
                details: {
                    formErrors: [normalizedComment.error],
                    fieldErrors: { comment: [normalizedComment.error] }
                }
            })
        }

        const { email, role } = result.data
        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const user = await findAuthUserByEmail(executor, email.toLowerCase())
        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        const existing = await findApplicationMemberByUserId(executor, {
            applicationId,
            userId: user.id
        })
        if (existing) {
            return res.status(409).json({ error: 'User is already a member', code: 'APPLICATION_MEMBER_EXISTS' })
        }

        const application = await findApplicationSchemaInfo(executor, applicationId)
        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        try {
            const member = await ds.transaction(async (trx) => {
                await acquireApplicationCopyMutationLock(trx, applicationId)
                const insertedMember = await insertApplicationMember(trx, {
                    applicationId,
                    userId: user.id,
                    role,
                    comment: normalizedComment.commentVlc,
                    createdBy: userId,
                    updatedBy: userId
                })

                if (!insertedMember) {
                    throw new Error('Failed to create application member')
                }

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    await acquireAdvisoryXactLock(trx, `workspace-baseline:${application.schemaName}:${applicationId}`)

                    await ensurePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId: user.id,
                        actorUserId: userId,
                        defaultRoleCodename: 'owner'
                    })

                    // The added member accesses every shared workspace of the
                    // application with baseline `member` rights (same as join).
                    await ensureSharedWorkspaceBaselineMembership(trx, {
                        schemaName: application.schemaName,
                        applicationId,
                        actorUserId: userId
                    })
                }

                return insertedMember
            })

            return res.status(201).json(mapMember(member))
        } catch (error) {
            if (database.isUniqueViolation(error)) {
                return res.status(409).json({ error: 'User is already a member', code: 'APPLICATION_MEMBER_EXISTS' })
            }
            throw error
        }
    }

    // ============ UPDATE MEMBER ============
    const updateMember = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId, memberId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        const accessContext = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const member = await findApplicationMemberById(executor, { applicationId, memberId })
        if (!member) {
            return res.status(404).json({ error: 'Member not found' })
        }

        assertNotOwner(member, 'Cannot modify owner role')

        const schema = z
            .object({
                role: z.enum(['member', 'editor', 'admin']).optional(),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })
            .strict()

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const actorRole = (accessContext.membership.role || 'member') as ApplicationRole
        const targetRole = (member.role || 'member') as ApplicationRole
        if (!canManageApplicationRole(actorRole, targetRole)) {
            return res.status(403).json({ error: 'Cannot modify this member role' })
        }
        if (result.data.role !== undefined && !canManageApplicationRole(actorRole, result.data.role as ApplicationRole)) {
            return res.status(403).json({ error: 'Cannot assign this member role' })
        }

        const normalizedComment: {
            commentVlc: VersionedLocalizedContent<string> | null | undefined
            error?: string
        } =
            result.data.comment !== undefined
                ? normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
                : { commentVlc: undefined }

        if (normalizedComment.error) {
            return res.status(400).json({
                error: 'Invalid input',
                details: {
                    formErrors: [normalizedComment.error],
                    fieldErrors: { comment: [normalizedComment.error] }
                }
            })
        }

        const { role } = result.data

        if (role !== undefined) member.role = role

        const updatedMember = await ds.transaction(async (trx) => {
            await acquireApplicationCopyMutationLock(trx, applicationId)
            return updateApplicationMember(trx, {
                applicationId,
                memberId,
                role: result.data.role,
                comment: result.data.comment !== undefined ? normalizedComment.commentVlc ?? null : undefined,
                updatedBy: userId
            })
        })

        if (!updatedMember) {
            return res.status(404).json({ error: 'Member not found' })
        }

        return res.json(mapMember(updatedMember))
    }

    // ============ REMOVE MEMBER ============
    const removeMember = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId, memberId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const member = await findApplicationMemberById(executor, { applicationId, memberId })
        if (!member) {
            return res.status(404).json({ error: 'Member not found' })
        }

        assertNotOwner(member, 'Cannot remove owner')

        const application = await findApplicationSchemaInfo(executor, applicationId)
        if (!application) {
            return res.status(404).json({ error: 'Application not found' })
        }

        try {
            await ds.transaction(async (trx) => {
                await acquireApplicationCopyMutationLock(trx, applicationId)
                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    // Same canonical lock order and last-owner serialization as
                    // the leave flow (see comment there).
                    await acquireAdvisoryXactLock(trx, `workspace-baseline:${application.schemaName}:${applicationId}`)
                }

                await deleteApplicationMember(trx, { applicationId, memberId, userId })

                if (
                    application.workspacesEnabled &&
                    application.schemaName &&
                    IDENTIFIER_REGEX.test(application.schemaName) &&
                    (await runtimeWorkspaceTablesExist(trx, application.schemaName))
                ) {
                    await assertUserIsNotLastSharedWorkspaceOwner(trx, {
                        schemaName: application.schemaName,
                        applicationId,
                        userId: member.userId
                    })

                    await removeSharedWorkspaceBaselineMembership(trx, {
                        schemaName: application.schemaName,
                        applicationId,
                        userId: member.userId,
                        actorUserId: userId
                    })

                    await archivePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId: member.userId,
                        actorUserId: userId
                    })
                }
            })
        } catch (error) {
            if (error instanceof RuntimeWorkspaceError && error.code === RUNTIME_WORKSPACE_ERROR_CODES.memberWorkspaceOwnershipBlocked) {
                return res.status(409).json({ error: error.message, code: error.code })
            }
            throw error
        }
        return res.status(204).send()
    }

    return {
        join,
        leave,
        getLimits,
        updateLimits,
        listMembers,
        addMember,
        updateMember,
        removeMember
    }
}
