import type { Request, Response } from 'express'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import { ApplicationMembershipState } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { database, normalizeApplicationCopyOptions, OptimisticLockError } from '@universo/utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { generateSchemaName, isValidSchemaName } from '@universo/schema-ddl'
import { isSuperuser as isSuperuserCheck, getGlobalRoleCodename, hasSubjectPermission } from '@universo/admin-backend'
import { ensureApplicationAccess, ROLE_PERMISSIONS, assertNotOwner } from '../routes/guards'
import type { ApplicationRole, RolePermission } from '../routes/guards'
import { validateListQuery } from '../schemas/queryParams'
import { ApplicationSchemaStatus } from '../persistence/contracts'
import {
    type ApplicationMemberRecord,
    copyApplicationWithOptions,
    createApplicationWithOwner,
    deleteApplicationMember,
    deleteApplicationWithSchema,
    findApplicationBySlug,
    findApplicationCopySource,
    findApplicationDetails,
    findApplicationMemberById,
    findApplicationMemberByUserId,
    findApplicationSchemaInfo,
    findAuthUserByEmail,
    insertApplicationMember,
    listApplicationMembers,
    listApplications,
    updateApplicationMember,
    updateApplication
} from '../persistence/applicationsStore'
import {
    archivePersonalWorkspaceForUser,
    ensurePersonalWorkspaceForUser,
    listCatalogWorkspaceLimits,
    runtimeWorkspaceTablesExist,
    upsertCatalogWorkspaceLimits
} from '../services/applicationWorkspaces'
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
    buildDefaultCopyNameInput,
    buildCopiedApplicationSlugCandidate,
    createQueryHelper
} from '../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NO_APPLICATION_PERMISSIONS: Record<RolePermission, boolean> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false
}

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

// ---------------------------------------------------------------------------
// Zod schemas (shared across multiple handlers in this controller)
// ---------------------------------------------------------------------------

const localizedInputSchema = z
    .union([z.string().min(1).max(255), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const optionalLocalizedInputSchema = z
    .union([z.string(), z.record(z.string())])
    .transform((val) => (typeof val === 'string' ? { en: val } : val))

const applicationDialogSettingsSchema = z
    .object({
        dialogSizePreset: z.enum(['small', 'medium', 'large']).optional(),
        dialogAllowFullscreen: z.boolean().optional(),
        dialogAllowResize: z.boolean().optional(),
        dialogCloseBehavior: z.enum(['strict-modal', 'backdrop-close']).optional(),
        sectionLinksEnabled: z.boolean().optional(),
        applicationLayouts: z
            .object({
                readRoles: z
                    .array(z.enum(['owner', 'admin', 'editor', 'member']))
                    .min(1)
                    .optional()
            })
            .strict()
            .optional()
    })
    .strict()

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createApplicationsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)

    const hasGlobalApplicationAdminAccess = async (executor: DbExecutor, userId: string): Promise<boolean> => {
        const [canUpdate, canDelete] = await Promise.all([
            hasSubjectPermission(executor, userId, 'applications', 'update'),
            hasSubjectPermission(executor, userId, 'applications', 'delete')
        ])
        return canUpdate || canDelete
    }

    // ============ LIST APPLICATIONS ============
    const list = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const ds = getRequestDbExecutor(req, getDbExecutor())

        let validatedQuery
        try {
            validatedQuery = validateListQuery(req.query)
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
            }
            throw error
        }
        const { limit, offset, sortBy, sortOrder, search, showAll } = validatedQuery

        const isSuperuser = await isSuperuserCheck(ds, userId)
        const hasGlobalApplicationsReadAccess = await hasSubjectPermission(ds, userId, 'applications', 'read')
        const hasGlobalApplicationsAdminAccess = isSuperuser ? true : await hasGlobalApplicationAdminAccess(ds, userId)
        const escapedSearch = search ? escapeLikeWildcards(search) : undefined
        const { items: applications, total } = await listApplications(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            {
                userId,
                showAll: showAll && (isSuperuser || hasGlobalApplicationsReadAccess),
                limit,
                offset,
                sortBy: sortBy === 'name' || sortBy === 'created' || sortBy === 'updated' ? sortBy : 'updated',
                sortOrder,
                search: escapedSearch
            }
        )

        const elevatedGlobalRoleName = hasGlobalApplicationsAdminAccess ? await getGlobalRoleCodename(ds, userId) : null

        const result = applications.map((a) => {
            const membershipState = a.membershipRole ? ApplicationMembershipState.JOINED : ApplicationMembershipState.NOT_JOINED
            const role = a.membershipRole ? (a.membershipRole as ApplicationRole) : elevatedGlobalRoleName ? 'owner' : null
            const accessType = a.membershipRole
                ? 'member'
                : elevatedGlobalRoleName
                ? isSuperuser
                    ? 'superadmin'
                    : 'supermoderator'
                : 'public'
            const permissions = role ? ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member : NO_APPLICATION_PERMISSIONS

            return {
                id: a.id,
                name: a.name,
                description: a.description,
                settings: a.settings ?? {},
                slug: a.slug,
                isPublic: a.isPublic,
                workspacesEnabled: a.workspacesEnabled,
                version: a.version || 1,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
                connectorsCount: a.connectorsCount ?? 0,
                membersCount: a.membersCount ?? 0,
                role,
                accessType,
                permissions,
                membershipState,
                canJoin: membershipState === ApplicationMembershipState.NOT_JOINED && a.isPublic === true && !elevatedGlobalRoleName,
                canLeave: membershipState === ApplicationMembershipState.JOINED && role !== 'owner'
            }
        })

        return res.json({ items: result, total, limit, offset })
    }

    // ============ GET SINGLE APPLICATION ============
    const get = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        const ctx = await ensureApplicationAccess(ds, userId, applicationId)

        const application = await findApplicationDetails(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) return res.status(404).json({ error: 'Application not found' })

        const role = ctx.membership.role as ApplicationRole
        const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

        return res.json({
            id: application.id,
            name: application.name,
            description: application.description,
            settings: application.settings ?? {},
            slug: application.slug,
            isPublic: application.isPublic,
            workspacesEnabled: application.workspacesEnabled,
            version: application.version || 1,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            schemaName: application.schemaName,
            schemaStatus: application.schemaStatus,
            schemaSyncedAt: application.schemaSyncedAt,
            schemaError: application.schemaError,
            connectorsCount: application.connectorsCount,
            membersCount: application.membersCount,
            role,
            accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
            permissions,
            membershipState: ApplicationMembershipState.JOINED,
            canJoin: false,
            canLeave: role !== 'owner'
        })
    }

    // ============ CREATE APPLICATION ============
    const create = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const schema = z
            .object({
                name: localizedInputSchema,
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional()
            })
            .strict()

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const { name, description, slug, isPublic, namePrimaryLocale, descriptionPrimaryLocale } = result.data
        const resolvedIsPublic = isPublic ?? false

        const sanitizedName = sanitizeLocalizedInput(name)
        if (Object.keys(sanitizedName).length === 0) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }
        const nameVlc = buildLocalizedContent(sanitizedName, namePrimaryLocale, 'en')
        if (!nameVlc) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        let descriptionVlc = undefined
        if (description) {
            const sanitizedDescription = sanitizeLocalizedInput(description)
            if (Object.keys(sanitizedDescription).length > 0) {
                descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimaryLocale, namePrimaryLocale ?? 'en')
            }
        }

        if (slug) {
            const existing = await findApplicationBySlug(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                slug
            )
            if (existing) {
                return res.status(409).json({ error: 'Application with this slug already exists' })
            }
        }

        let saved
        try {
            const provisionalSchemaName = generateSchemaName('00000000-0000-7000-8000-000000000000')
            if (
                !provisionalSchemaName.startsWith('app_') ||
                !isValidSchemaName(provisionalSchemaName) ||
                !IDENTIFIER_REGEX.test(provisionalSchemaName)
            ) {
                return res.status(400).json({ error: 'Invalid generated application schema name' })
            }

            saved = await createApplicationWithOwner(getRequestDbExecutor(req, getDbExecutor()), {
                name: nameVlc,
                description: descriptionVlc ?? null,
                slug,
                isPublic: resolvedIsPublic,
                workspacesEnabled: false,
                userId,
                resolveSchemaName: generateSchemaName,
                validateSchemaName: (schemaName) =>
                    schemaName.startsWith('app_') && isValidSchemaName(schemaName) && IDENTIFIER_REGEX.test(schemaName)
            })
        } catch (error) {
            if (database.isSlugUniqueViolation(error)) {
                return res.status(409).json({ error: 'Application with this slug already exists' })
            }
            throw error
        }

        return res.status(201).json({
            id: saved.id,
            name: saved.name,
            description: saved.description,
            settings: saved.settings ?? {},
            slug: saved.slug,
            isPublic: saved.isPublic,
            workspacesEnabled: saved.workspacesEnabled,
            version: saved.version || 1,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            connectorsCount: 0,
            membersCount: 1,
            role: 'owner',
            accessType: 'member',
            permissions: ROLE_PERMISSIONS.owner,
            membershipState: ApplicationMembershipState.JOINED,
            canJoin: false,
            canLeave: false
        })
    }

    // ============ COPY APPLICATION ============
    const copy = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        await ensureApplicationAccess(ds, userId, applicationId, ['owner', 'admin'])

        const schema = z
            .object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                settings: applicationDialogSettingsSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                copyConnector: z.boolean().optional(),
                copyAccess: z.boolean().optional().default(false)
            })
            .strict()

        const parsed = schema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
        }

        const copyOptions = normalizeApplicationCopyOptions({
            copyConnector: parsed.data.copyConnector,
            copyAccess: parsed.data.copyAccess
        })
        const sourceApplication = await findApplicationCopySource(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!sourceApplication) {
            return res.status(404).json({ error: 'Application not found' })
        }
        const resolvedIsPublic = parsed.data.isPublic ?? sourceApplication.isPublic
        const resolvedWorkspacesEnabled = sourceApplication.workspacesEnabled

        const requestedName = parsed.data.name
            ? sanitizeLocalizedInput(parsed.data.name)
            : buildDefaultCopyNameInput(sourceApplication.name)
        if (Object.keys(requestedName).length === 0) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceApplication.name?._primary ?? 'en')
        if (!nameVlc) {
            return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
        }

        let descriptionVlc: VersionedLocalizedContent<string> | null = sourceApplication.description ?? null
        if (parsed.data.description !== undefined) {
            const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
            if (Object.keys(sanitizedDescription).length > 0) {
                descriptionVlc =
                    buildLocalizedContent(
                        sanitizedDescription,
                        parsed.data.descriptionPrimaryLocale,
                        parsed.data.namePrimaryLocale ?? sourceApplication.description?._primary ?? sourceApplication.name?._primary ?? 'en'
                    ) ?? null
            } else {
                descriptionVlc = null
            }
        }

        const requestedSlug = parsed.data.slug
        const sourceSlug = sourceApplication.slug
        const maxSlugAttempts = 1000
        let slugCandidate: string | undefined
        let nextSlugAttempt = 1

        const assignNextAvailableGeneratedSlug = async (): Promise<boolean> => {
            if (!sourceSlug) return false
            for (; nextSlugAttempt <= maxSlugAttempts; nextSlugAttempt++) {
                const candidate = buildCopiedApplicationSlugCandidate(sourceSlug, nextSlugAttempt)
                const existing = await findApplicationBySlug(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    candidate
                )
                if (!existing) {
                    slugCandidate = candidate
                    nextSlugAttempt += 1
                    return true
                }
            }
            return false
        }

        if (requestedSlug) {
            slugCandidate = requestedSlug
            const existing = await findApplicationBySlug(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                slugCandidate
            )
            if (existing) {
                return res.status(409).json({ error: 'Application with this slug already exists' })
            }
        } else if (sourceSlug) {
            const hasSlugCandidate = await assignNextAvailableGeneratedSlug()
            if (!hasSlugCandidate) {
                return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
            }
        }

        const [{ id: newApplicationId }] = (await query<{ id: string }>(req, `SELECT public.uuid_generate_v7() AS id`)) as Array<{
            id: string
        }>
        const newSchemaName = generateSchemaName(newApplicationId)

        if (!newSchemaName.startsWith('app_') || !isValidSchemaName(newSchemaName) || !IDENTIFIER_REGEX.test(newSchemaName)) {
            return res.status(400).json({ error: 'Invalid generated application schema name' })
        }

        const runCopyTransaction = () =>
            copyApplicationWithOptions(ds, {
                newApplicationId,
                sourceApplicationId: applicationId,
                sourceApplication,
                copiedName: nameVlc,
                copiedDescription: descriptionVlc ?? null,
                settings: sourceApplication.settings ?? {},
                slug: slugCandidate ?? null,
                isPublic: resolvedIsPublic,
                workspacesEnabled: resolvedWorkspacesEnabled,
                schemaName: newSchemaName,
                schemaStatus: copyOptions.copyConnector ? ApplicationSchemaStatus.OUTDATED : ApplicationSchemaStatus.DRAFT,
                copyAccess: copyOptions.copyAccess,
                copyConnector: copyOptions.copyConnector,
                actorUserId: userId
            })

        let copied: Awaited<ReturnType<typeof copyApplicationWithOptions>> | null = null
        const maxCopyAttempts = requestedSlug ? 1 : sourceSlug ? maxSlugAttempts : 1
        for (let attempt = 0; attempt < maxCopyAttempts; attempt++) {
            try {
                copied = await runCopyTransaction()
                break
            } catch (error) {
                if (!database.isSlugUniqueViolation(error)) {
                    throw error
                }
                if (requestedSlug) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
                if (sourceSlug) {
                    const hasSlugCandidate = await assignNextAvailableGeneratedSlug()
                    if (hasSlugCandidate) {
                        continue
                    }
                    return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
                }
                throw error
            }
        }

        if (!copied) {
            return res.status(409).json({ error: 'Unable to generate unique slug for copied application' })
        }

        return res.status(201).json({
            id: copied.id,
            name: copied.name,
            description: copied.description,
            settings: copied.settings ?? {},
            slug: copied.slug,
            isPublic: copied.isPublic,
            workspacesEnabled: copied.workspacesEnabled,
            version: copied.version || 1,
            createdAt: copied.createdAt,
            updatedAt: copied.updatedAt,
            connectorsCount: undefined,
            membersCount: undefined,
            role: 'owner',
            accessType: 'member',
            permissions: ROLE_PERMISSIONS.owner,
            membershipState: ApplicationMembershipState.JOINED,
            canJoin: false,
            canLeave: false
        })
    }

    // ============ UPDATE APPLICATION ============
    const update = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        const ctx = await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const application = await findApplicationDetails(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) return res.status(404).json({ error: 'Application not found' })

        const schema = z.object({
            name: localizedInputSchema.optional(),
            description: optionalLocalizedInputSchema.optional(),
            settings: applicationDialogSettingsSchema.optional(),
            namePrimaryLocale: z.string().optional(),
            descriptionPrimaryLocale: z.string().optional(),
            slug: z
                .string()
                .min(1)
                .max(100)
                .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                .nullable()
                .optional(),
            isPublic: z.boolean().optional(),
            workspacesEnabled: z.boolean().optional(),
            expectedVersion: z.number().int().positive().optional()
        })

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const {
            name,
            description,
            settings,
            slug,
            isPublic,
            workspacesEnabled,
            namePrimaryLocale,
            descriptionPrimaryLocale,
            expectedVersion
        } = result.data

        if (workspacesEnabled !== undefined) {
            return res.status(400).json({
                error: 'Immutable application parameters',
                details: {
                    workspacesEnabled: ['Workspace mode cannot be changed after creation']
                }
            })
        }

        if (expectedVersion !== undefined) {
            const currentVersion = application.version || 1
            if (currentVersion !== expectedVersion) {
                throw new OptimisticLockError({
                    entityId: applicationId,
                    entityType: 'application',
                    expectedVersion,
                    actualVersion: currentVersion,
                    updatedAt: application.updatedAt,
                    updatedBy: application.updatedBy ?? null
                })
            }
        }

        let nextName = application.name
        if (name !== undefined) {
            const sanitizedName = sanitizeLocalizedInput(name)
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Validation failed', details: { name: ['Name is required'] } })
            }
            const primary = namePrimaryLocale ?? application.name?._primary ?? 'en'
            const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
            if (nameVlc) {
                nextName = nameVlc
            }
        }

        let nextDescription = application.description
        if (description !== undefined) {
            const sanitizedDescription = sanitizeLocalizedInput(description)
            if (Object.keys(sanitizedDescription).length > 0) {
                const primary =
                    descriptionPrimaryLocale ?? application.description?._primary ?? nextName?._primary ?? namePrimaryLocale ?? 'en'
                const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                if (descriptionVlc) {
                    nextDescription = descriptionVlc
                }
            } else {
                nextDescription = null
            }
        }

        let nextSlug = application.slug
        if (slug !== undefined) {
            if (slug !== null && slug !== application.slug) {
                const existing = await findApplicationBySlug(
                    {
                        query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                    },
                    slug
                )
                if (existing && existing.id !== applicationId) {
                    return res.status(409).json({ error: 'Application with this slug already exists' })
                }
            }
            nextSlug = slug ?? null
        }

        const nextSettings = settings !== undefined ? settings : application.settings ?? {}

        let saved = await updateApplication(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            {
                applicationId,
                name: name !== undefined ? nextName : undefined,
                description: description !== undefined ? nextDescription : undefined,
                settings: settings !== undefined ? nextSettings : undefined,
                slug: slug !== undefined ? nextSlug : undefined,
                isPublic,
                userId,
                expectedVersion
            }
        )

        if (!saved && expectedVersion !== undefined) {
            const latest = await findApplicationDetails(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
            if (latest && latest.version !== expectedVersion) {
                throw new OptimisticLockError({
                    entityId: applicationId,
                    entityType: 'application',
                    expectedVersion,
                    actualVersion: latest.version,
                    updatedAt: latest.updatedAt,
                    updatedBy: latest.updatedBy ?? null
                })
            }
        }

        if (!saved) {
            saved = await findApplicationDetails(
                {
                    query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
                },
                applicationId
            )
        }
        if (!saved) return res.status(404).json({ error: 'Application not found' })
        const role = ctx.membership.role as ApplicationRole
        const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

        return res.json({
            id: saved.id,
            name: saved.name,
            description: saved.description,
            settings: saved.settings ?? {},
            slug: saved.slug,
            isPublic: saved.isPublic,
            workspacesEnabled: saved.workspacesEnabled,
            version: saved.version || 1,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            role,
            accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
            permissions,
            membershipState: ApplicationMembershipState.JOINED,
            canJoin: false,
            canLeave: role !== 'owner'
        })
    }

    // ============ DELETE APPLICATION ============
    const remove = async (req: Request, res: Response) => {
        const userId = resolveUserId(req)
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { applicationId } = req.params
        const ds = getRequestDbExecutor(req, getDbExecutor())

        await ensureApplicationAccess(ds, userId, applicationId, ['owner'])

        const application = await findApplicationDetails(
            {
                query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
            },
            applicationId
        )
        if (!application) return res.status(404).json({ error: 'Application not found' })

        const schemaName = application.schemaName
        if (schemaName) {
            if (!schemaName.startsWith('app_') || !isValidSchemaName(schemaName) || !IDENTIFIER_REGEX.test(schemaName)) {
                return res.status(400).json({ error: 'Invalid application schema name' })
            }
        }

        await deleteApplicationWithSchema(ds, { applicationId, schemaName, userId })
        return res.status(204).send()
    }

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
                await ensurePersonalWorkspaceForUser(trx, {
                    schemaName: application.schemaName,
                    userId,
                    actorUserId: userId,
                    defaultRoleCodename: 'owner'
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

        await ds.transaction(async (trx) => {
            await deleteApplicationMember(trx, { applicationId, memberId: member.id, userId })

            if (
                application.workspacesEnabled &&
                application.schemaName &&
                IDENTIFIER_REGEX.test(application.schemaName) &&
                (await runtimeWorkspaceTablesExist(trx, application.schemaName))
            ) {
                await archivePersonalWorkspaceForUser(trx, {
                    schemaName: application.schemaName,
                    userId,
                    actorUserId: userId
                })
            }
        })

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
        const catalogs = (await ds.query(
            `
        SELECT id, codename, table_name, presentation
        FROM ${schemaIdent}._app_objects
        WHERE kind = 'catalog'
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

        const limits = await listCatalogWorkspaceLimits(ds, {
            schemaName: application.schemaName
        })
        const limitMap = new Map(limits.map((limit) => [limit.objectId, limit.maxRows]))

        return res.json({
            items: catalogs.map((catalog) => ({
                objectId: catalog.id,
                codename: catalog.codename,
                codenameDisplay: resolvePresentationCodename(
                    catalog.presentation,
                    normalizeLocale(req.query.locale as string | undefined),
                    resolveRuntimeCodenameText(catalog.codename)
                ),
                tableName: catalog.table_name,
                name: resolvePresentationName(
                    catalog.presentation,
                    normalizeLocale(req.query.locale as string | undefined),
                    resolveRuntimeCodenameText(catalog.codename)
                ),
                maxRows: limitMap.get(catalog.id) ?? null
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

        const payloadSchema = z.object({
            limits: z.array(
                z.object({
                    objectId: z.string().uuid(),
                    maxRows: z.number().int().positive().nullable()
                })
            )
        })

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
            return res.status(400).json({ error: 'Duplicate catalog limit rows are not allowed' })
        }

        const limitsSchemaName = application.schemaName
        const updatedLimits = await ds.transaction(async (trx) => {
            const catalogRows = await trx.query<{ id: string }>(
                `
          SELECT id
          FROM ${quoteIdentifier(limitsSchemaName)}._app_objects
          WHERE kind = 'catalog'
            AND _upl_deleted = false
            AND _app_deleted = false
            AND id = ANY($1::uuid[])
        `,
                [parsed.data.limits.map((limit) => limit.objectId)]
            )

            if (catalogRows.length !== uniqueObjectIds.size) {
                throw new UpdateFailure(400, {
                    error: 'Limits can only be updated for active catalogs'
                })
            }

            await upsertCatalogWorkspaceLimits(trx, {
                schemaName: limitsSchemaName,
                actorUserId: userId,
                limits: parsed.data.limits
            })

            return listCatalogWorkspaceLimits(trx, { schemaName: limitsSchemaName })
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

        const schema = z.object({
            email: z.string().email(),
            role: z.enum(['member', 'editor', 'admin']).default('member'),
            comment: memberCommentInputSchema.nullable().optional(),
            commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
        })

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
                    await ensurePersonalWorkspaceForUser(trx, {
                        schemaName: application.schemaName,
                        userId: user.id,
                        actorUserId: userId,
                        defaultRoleCodename: 'owner'
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

        await ensureApplicationAccess(ds, userId, applicationId, ['admin', 'owner'])

        const executor = {
            query: <TRow = unknown>(sql: string, parameters?: unknown[]) => query<TRow>(req, sql, parameters ?? [])
        }

        const member = await findApplicationMemberById(executor, { applicationId, memberId })
        if (!member) {
            return res.status(404).json({ error: 'Member not found' })
        }

        assertNotOwner(member, 'Cannot modify owner role')

        const schema = z.object({
            role: z.enum(['member', 'editor', 'admin']).optional(),
            comment: memberCommentInputSchema.nullable().optional(),
            commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
        })

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
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

        const updatedMember = await updateApplicationMember(executor, {
            applicationId,
            memberId,
            role: result.data.role,
            comment: result.data.comment !== undefined ? normalizedComment.commentVlc ?? null : undefined,
            updatedBy: userId
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

        await ds.transaction(async (trx) => {
            await deleteApplicationMember(trx, { applicationId, memberId, userId })

            if (
                application.workspacesEnabled &&
                application.schemaName &&
                IDENTIFIER_REGEX.test(application.schemaName) &&
                (await runtimeWorkspaceTablesExist(trx, application.schemaName))
            ) {
                await archivePersonalWorkspaceForUser(trx, {
                    schemaName: application.schemaName,
                    userId: member.userId,
                    actorUserId: userId
                })
            }
        })
        return res.status(204).send()
    }

    return {
        list,
        get,
        create,
        copy,
        update,
        remove,
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
