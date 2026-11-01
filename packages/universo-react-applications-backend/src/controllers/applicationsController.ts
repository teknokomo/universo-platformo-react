import type { Request, Response } from 'express'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo-react/types'
import {
    applicationLearningContentSettingsSchema,
    applicationRolePolicySettingsSchema,
    applicationWorkspaceOverridePolicySchema,
    normalizeApplicationWorkspaceOverridePolicy,
    sanitizeApplicationRolePolicySettingsForSupportedScopes
} from '@universo-react/types'
import { ApplicationMembershipState } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { normalizeApplicationCopyOptions, OptimisticLockError } from '@universo-react/utils'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo-react/utils/vlc'
import { generateSchemaName, isValidSchemaName } from '@universo-react/schema-ddl'
import { isSuperuser as isSuperuserCheck, getGlobalRoleCodename, hasSubjectPermission } from '@universo-react/admin-backend'
import { ensureApplicationAccess, resolveEffectiveRolePermissions } from '../routes/guards'
import type { ApplicationRole, RolePermission } from '../routes/guards'
import { validateListQuery } from '../schemas/queryParams'
import { ApplicationSchemaStatus } from '../persistence/contracts'
import {
    type ApplicationRecord,
    deleteApplicationWithSchema,
    findApplicationCopySource,
    findApplicationDetails,
    listApplications
} from '../persistence/applicationsStore'
import {
    ApplicationCopySourceChangedError,
    ApplicationCopySourceUnavailableError,
    copyApplicationWithOptions
} from '../persistence/applicationCopyStore'
import { createApplicationWithOwner, updateApplication, updateApplicationInTransaction } from '../persistence/applicationMutationStore'
import { lockApplicationForPublicGuestWithdrawal } from '../persistence/publicGuestApplicationStore'
import { revokeGuestSessionIdempotencyForApplication } from '../persistence/guestSessionIdempotencyStore'
import { revokeGuestAssessmentAttemptsForApplication } from '../services/guestAssessmentApplicationRevocation'
import { escapeLikeWildcards, getRequestDbExecutor } from '../utils'
import { UpdateFailure, IDENTIFIER_REGEX, resolveUserId, buildDefaultCopyNameInput, createQueryHelper } from '../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NO_APPLICATION_PERMISSIONS: Record<RolePermission, boolean> = {
    manageMembers: false,
    manageApplication: false,
    createContent: false,
    editContent: false,
    deleteContent: false,
    readReports: false
}

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
        dashboardDefaultMode: z.enum(['layout-default', 'first-menu-item']).optional(),
        datasourceExecutionPolicy: z.enum(['workspace-scoped', 'layout-only']).optional(),
        workspaceOpenBehavior: z.enum(['last-used', 'default-workspace']).optional(),
        schemaDiffLocalizedLabels: z.boolean().optional(),
        learningContent: applicationLearningContentSettingsSchema.optional(),
        rolePolicies: applicationRolePolicySettingsSchema.optional(),
        workspaceOverrides: applicationWorkspaceOverridePolicySchema.optional(),
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

const applicationSettingsUpdateSchema = applicationDialogSettingsSchema
    .extend({
        publicRuntime: z.unknown().optional(),
        guestRuntime: z.unknown().optional()
    })
    .strict()

const SERVER_MANAGED_APPLICATION_SETTING_KEYS = ['publicRuntime', 'guestRuntime'] as const

const sanitizeApplicationSettingsUpdate = (
    settings: z.infer<typeof applicationSettingsUpdateSchema>
): z.infer<typeof applicationSettingsUpdateSchema> => ({
    ...settings,
    ...(settings.rolePolicies ? { rolePolicies: sanitizeApplicationRolePolicySettingsForSupportedScopes(settings.rolePolicies) } : {}),
    ...(settings.workspaceOverrides !== undefined
        ? { workspaceOverrides: normalizeApplicationWorkspaceOverridePolicy({ workspaceOverrides: settings.workspaceOverrides }) }
        : {})
})

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const serializeApplicationSettings = (settings: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    const safeSettings = settings ?? {}
    const workspaceOverrides = safeSettings.workspaceOverrides
    if (!isRecord(workspaceOverrides)) return safeSettings

    const parsedPolicy = applicationWorkspaceOverridePolicySchema.safeParse(workspaceOverrides)
    if (!parsedPolicy.success) return safeSettings

    return {
        ...safeSettings,
        workspaceOverrides: parsedPolicy.data
    }
}

const mergeApplicationSettingsForUpdate = (
    currentSettings: Record<string, unknown> | null | undefined,
    requestedSettings: Record<string, unknown>
): Record<string, unknown> => {
    const nextSettings: Record<string, unknown> = { ...requestedSettings }
    for (const key of SERVER_MANAGED_APPLICATION_SETTING_KEYS) {
        delete nextSettings[key]
    }

    if (isRecord(currentSettings)) {
        for (const key of SERVER_MANAGED_APPLICATION_SETTING_KEYS) {
            if (Object.prototype.hasOwnProperty.call(currentSettings, key)) {
                nextSettings[key] = currentSettings[key]
            }
        }
    }

    return nextSettings
}

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
            const permissions = role ? resolveEffectiveRolePermissions(role, a.settings ?? {}) : NO_APPLICATION_PERMISSIONS

            return {
                id: a.id,
                name: a.name,
                description: a.description,
                settings: serializeApplicationSettings(a.settings),
                isPublic: a.isPublic,
                showInAppList: a.showInAppList,
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
        const permissions = resolveEffectiveRolePermissions(role, application.settings ?? {})

        return res.json({
            id: application.id,
            name: application.name,
            description: application.description,
            settings: serializeApplicationSettings(application.settings),
            isPublic: application.isPublic,
            showInAppList: application.showInAppList,
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
                isPublic: z.boolean().optional(),
                showInAppList: z.boolean().default(true)
            })
            .strict()

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const { name, description, isPublic, showInAppList, namePrimaryLocale, descriptionPrimaryLocale } = result.data
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

        const provisionalSchemaName = generateSchemaName('00000000-0000-7000-8000-000000000000')
        if (
            !provisionalSchemaName.startsWith('app_') ||
            !isValidSchemaName(provisionalSchemaName) ||
            !IDENTIFIER_REGEX.test(provisionalSchemaName)
        ) {
            return res.status(400).json({ error: 'Invalid generated application schema name' })
        }

        const saved = await createApplicationWithOwner(getRequestDbExecutor(req, getDbExecutor()), {
            name: nameVlc,
            description: descriptionVlc ?? null,
            isPublic: resolvedIsPublic,
            showInAppList,
            workspacesEnabled: false,
            userId,
            resolveSchemaName: generateSchemaName,
            validateSchemaName: (schemaName) =>
                schemaName.startsWith('app_') && isValidSchemaName(schemaName) && IDENTIFIER_REGEX.test(schemaName)
        })

        return res.status(201).json({
            id: saved.id,
            name: saved.name,
            description: saved.description,
            settings: serializeApplicationSettings(saved.settings),
            isPublic: saved.isPublic,
            showInAppList: saved.showInAppList,
            workspacesEnabled: saved.workspacesEnabled,
            version: saved.version || 1,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            connectorsCount: 0,
            membersCount: 1,
            role: 'owner',
            accessType: 'member',
            permissions: resolveEffectiveRolePermissions('owner', saved.settings ?? {}),
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
                settings: applicationSettingsUpdateSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                isPublic: z.boolean().optional(),
                showInAppList: z.boolean().optional(),
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
        const resolvedShowInAppList = parsed.data.showInAppList ?? sourceApplication.showInAppList
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

        const [{ id: newApplicationId }] = (await query<{ id: string }>(req, `SELECT public.uuid_generate_v7() AS id`)) as Array<{
            id: string
        }>
        const newSchemaName = generateSchemaName(newApplicationId)

        if (!newSchemaName.startsWith('app_') || !isValidSchemaName(newSchemaName) || !IDENTIFIER_REGEX.test(newSchemaName)) {
            return res.status(400).json({ error: 'Invalid generated application schema name' })
        }

        let copied: ApplicationRecord
        try {
            copied = await copyApplicationWithOptions(ds, {
                newApplicationId,
                sourceApplicationId: applicationId,
                sourceApplication,
                copiedName: nameVlc,
                copiedDescription: descriptionVlc ?? null,
                settings: sourceApplication.settings ?? {},
                isPublic: resolvedIsPublic,
                showInAppList: resolvedShowInAppList,
                workspacesEnabled: resolvedWorkspacesEnabled,
                schemaName: newSchemaName,
                schemaStatus: copyOptions.copyConnector ? ApplicationSchemaStatus.OUTDATED : ApplicationSchemaStatus.DRAFT,
                copyAccess: copyOptions.copyAccess,
                copyConnector: copyOptions.copyConnector,
                actorUserId: userId
            })
        } catch (error) {
            if (error instanceof ApplicationCopySourceUnavailableError) return res.status(404).json({ error: 'Application not found' })
            if (error instanceof ApplicationCopySourceChangedError)
                return res.status(409).json({ error: 'Application changed; retry the copy' })
            throw error
        }

        return res.status(201).json({
            id: copied.id,
            name: copied.name,
            description: copied.description,
            settings: serializeApplicationSettings(copied.settings),
            isPublic: copied.isPublic,
            showInAppList: copied.showInAppList,
            workspacesEnabled: copied.workspacesEnabled,
            version: copied.version || 1,
            createdAt: copied.createdAt,
            updatedAt: copied.updatedAt,
            connectorsCount: undefined,
            membersCount: undefined,
            role: 'owner',
            accessType: 'member',
            permissions: resolveEffectiveRolePermissions('owner', copied.settings ?? {}),
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

        const schema = z
            .object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                settings: applicationSettingsUpdateSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                isPublic: z.boolean().optional(),
                workspacesEnabled: z.boolean().optional(),
                showInAppList: z.boolean().optional(),
                expectedVersion: z.number().int().positive().optional()
            })
            .strict()
            .superRefine((value, context) => {
                if (value.showInAppList !== undefined && value.expectedVersion === undefined) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['expectedVersion'],
                        message: 'expectedVersion is required when changing showInAppList'
                    })
                }
            })

        const result = schema.safeParse(req.body)
        if (!result.success) {
            return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
        }

        const {
            name,
            description,
            settings,
            isPublic,
            showInAppList,
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

        const buildUpdateValues = (base: typeof application) => {
            let nextName = base.name
            if (name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(name)
                if (Object.keys(sanitizedName).length === 0) {
                    return { error: 'Name is required' as const }
                }
                const primary = namePrimaryLocale ?? base.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, primary, primary)
                if (nameVlc) nextName = nameVlc
            }

            let nextDescription = base.description
            if (description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const primary =
                        descriptionPrimaryLocale ?? base.description?._primary ?? nextName?._primary ?? namePrimaryLocale ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, primary, primary)
                    if (descriptionVlc) nextDescription = descriptionVlc
                } else {
                    nextDescription = null
                }
            }

            const sanitizedSettings = settings !== undefined ? sanitizeApplicationSettingsUpdate(settings) : undefined
            const nextSettings =
                sanitizedSettings !== undefined
                    ? mergeApplicationSettingsForUpdate(base.settings ?? {}, sanitizedSettings)
                    : base.settings ?? {}

            return {
                name: name !== undefined ? nextName : undefined,
                description: description !== undefined ? nextDescription : undefined,
                settings: sanitizedSettings !== undefined ? nextSettings : undefined
            }
        }

        const initialUpdateValues = buildUpdateValues(application)
        if ('error' in initialUpdateValues) {
            return res.status(400).json({ error: 'Validation failed', details: { name: [initialUpdateValues.error] } })
        }

        let responseRole: ApplicationRole = ctx.membership.role as ApplicationRole
        let saved: ApplicationRecord | null
        if (isPublic === false) {
            const withdrawalResult = await ds.transaction(async (transaction) => {
                const lockedApplication = await lockApplicationForPublicGuestWithdrawal(transaction, applicationId)
                if (!lockedApplication) return { kind: 'missing' as const }

                const currentAccess = await ensureApplicationAccess(transaction, userId, applicationId, ['admin', 'owner'])
                responseRole = currentAccess.membership.role as ApplicationRole
                const currentApplication = await findApplicationDetails(transaction, applicationId)
                if (!currentApplication) return { kind: 'missing' as const }

                if (expectedVersion !== undefined && currentApplication.version !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: applicationId,
                        entityType: 'application',
                        expectedVersion,
                        actualVersion: currentApplication.version,
                        updatedAt: currentApplication.updatedAt,
                        updatedBy: currentApplication.updatedBy ?? null
                    })
                }

                const currentUpdateValues = buildUpdateValues(currentApplication)
                if ('error' in currentUpdateValues) {
                    return { kind: 'validation_error' as const, message: currentUpdateValues.error }
                }

                const updated = await updateApplicationInTransaction(transaction, {
                    applicationId,
                    ...currentUpdateValues,
                    isPublic: false,
                    showInAppList,
                    userId,
                    expectedVersion
                })
                if (!updated) {
                    throw new UpdateFailure(404, { error: 'Application could not be withdrawn' })
                }

                await revokeGuestSessionIdempotencyForApplication(transaction, applicationId)
                await revokeGuestAssessmentAttemptsForApplication(
                    transaction,
                    lockedApplication.schemaName,
                    lockedApplication.workspacesEnabled,
                    lockedApplication.settings
                )
                return { kind: 'saved' as const, application: updated }
            })
            if (withdrawalResult.kind === 'validation_error') {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: { name: [withdrawalResult.message] }
                })
            }
            saved = withdrawalResult.kind === 'saved' ? withdrawalResult.application : null
        } else {
            saved = await updateApplication(ds, {
                applicationId,
                ...initialUpdateValues,
                isPublic,
                showInAppList,
                userId,
                expectedVersion
            })
        }

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
        const role = responseRole
        const permissions = resolveEffectiveRolePermissions(role, saved.settings ?? {})

        return res.json({
            id: saved.id,
            name: saved.name,
            description: saved.description,
            settings: serializeApplicationSettings(saved.settings),
            isPublic: saved.isPublic,
            showInAppList: saved.showInAppList,
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

    return {
        list,
        get,
        create,
        copy,
        update,
        remove
    }
}
