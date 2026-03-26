import { Router, Request, Response, RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { isSuperuser, getGlobalRoleCodename } from '@universo/admin-backend'
import { activeAppRowCondition } from '@universo/utils'
import {
    findMetahubById,
    findMetahubByCodename,
    findMetahubBySlug,
    findMetahubForUpdate,
    listMetahubs as listMetahubsStore,
    createMetahub as createMetahubStore,
    updateMetahub as updateMetahubStore,
    findMetahubMembership,
    findMetahubMemberById,
    listMetahubMembers,
    addMetahubMember,
    updateMetahubMember as updateMetahubMemberStore,
    removeMetahubMember,
    countMetahubMembers,
    findBranchByIdAndMetahub,
    findBranchesByMetahub,
    createBranch,
    countBranches,
    findTemplateByIdNotDeleted,
    findTemplateByCodename,
    softDelete,
    type SqlQueryable,
    type MetahubRow,
    type MetahubUserRow,
    type MetahubMemberListItem
} from '../../../persistence'
import { activeMetahubRowCondition } from '../../../persistence/metahubsQueryHelpers'
import { ensureMetahubAccess, ROLE_PERMISSIONS, assertNotOwner, MetahubRole } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import { z } from 'zod'
import type { VersionedLocalizedContent } from '@universo/types'
import { validateListQuery } from '../../shared/queryParams'
import { sanitizeLocalizedInput, buildLocalizedContent } from '@universo/utils/vlc'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '@universo/utils/validation/codename'
import { codenameErrorMessage } from '../../shared/codenameStyleHelper'
import {
    requiredCodenamePayloadSchema,
    optionalCodenamePayloadSchema,
    getCodenamePayloadText,
    syncCodenamePayloadText,
    syncOptionalCodenamePayloadText
} from '../../shared/codenamePayload'
import type { CodenameStyle, CodenameAlphabet } from '@universo/types'
import { OptimisticLockError } from '@universo/utils'
import { buildManagedDynamicSchemaName, isManagedDynamicSchemaName, quoteIdentifier } from '@universo/migrations-core'
import { escapeLikeWildcards, getRequestDbExecutor, getRequestDbSession, type DbExecutor } from '../../../utils'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { MetahubObjectsService } from '../services/MetahubObjectsService'
import { MetahubHubsService } from '../services/MetahubHubsService'
import { structureVersionToSemver } from '../services/structureVersions'
import { MetahubBranchesService } from '../../branches/services/MetahubBranchesService'
import { getDDLServices, uuidToLockKey, acquirePoolAdvisoryLock, releasePoolAdvisoryLock } from '../../ddl'
import { DEFAULT_TEMPLATE_CODENAME } from '../../templates/data'

// Default codename settings for metahub-level operations (CREATE, COPY, UPDATE).
// These match the seeded defaults in admin.cfg_settings and act as a safe fallback.
const DEFAULT_CODENAME_STYLE: CodenameStyle = 'pascal-case'
const DEFAULT_CODENAME_ALPHABET: CodenameAlphabet = 'en-ru'
const DEFAULT_CODENAME_ALLOW_MIXED = false
const DEFAULT_CODENAME_AUTO_CONVERT_MIXED = true

type GlobalMetahubCodenameConfig = {
    style: CodenameStyle
    alphabet: CodenameAlphabet
    allowMixed: boolean
    autoConvertMixedAlphabets: boolean
    localizedEnabled: boolean
}

type AdminSettingsRow = {
    key?: unknown
    value?: {
        _value?: unknown
    }
}

const isCodenameStyle = (value: unknown): value is CodenameStyle => value === 'pascal-case' || value === 'kebab-case'

const isCodenameAlphabet = (value: unknown): value is CodenameAlphabet => value === 'en' || value === 'ru' || value === 'en-ru'

const getGlobalMetahubCodenameConfig = async (exec: SqlQueryable): Promise<GlobalMetahubCodenameConfig> => {
    const fallback: GlobalMetahubCodenameConfig = {
        style: DEFAULT_CODENAME_STYLE,
        alphabet: DEFAULT_CODENAME_ALPHABET,
        allowMixed: DEFAULT_CODENAME_ALLOW_MIXED,
        autoConvertMixedAlphabets: DEFAULT_CODENAME_AUTO_CONVERT_MIXED,
        localizedEnabled: true
    }

    try {
        const rows = (await exec.query(
            `
                SELECT key, value
                FROM admin.cfg_settings
                WHERE category = $1
                                    AND key IN ('codenameStyle', 'codenameAlphabet', 'codenameAllowMixedAlphabets', 'codenameAutoConvertMixedAlphabets', 'codenameLocalizedEnabled')
            `,
            ['metahubs']
        )) as AdminSettingsRow[]

        if (!Array.isArray(rows) || rows.length === 0) {
            return fallback
        }

        const byKey = new Map<string, unknown>()
        for (const row of rows) {
            if (typeof row.key === 'string') {
                byKey.set(row.key, row.value?._value)
            }
        }

        const rawStyle = byKey.get('codenameStyle')
        const rawAlphabet = byKey.get('codenameAlphabet')
        const rawAllowMixed = byKey.get('codenameAllowMixedAlphabets')
        const rawAutoConvertMixed = byKey.get('codenameAutoConvertMixedAlphabets')
        const rawLocalizedEnabled = byKey.get('codenameLocalizedEnabled')

        return {
            style: isCodenameStyle(rawStyle) ? rawStyle : fallback.style,
            alphabet: isCodenameAlphabet(rawAlphabet) ? rawAlphabet : fallback.alphabet,
            allowMixed: rawAllowMixed === true,
            autoConvertMixedAlphabets: rawAutoConvertMixed !== false,
            localizedEnabled: rawLocalizedEnabled !== false
        }
    } catch {
        return fallback
    }
}

const isManagedMetahubSchemaName = (schemaName: string): boolean => schemaName.startsWith('mhb_') && isManagedDynamicSchemaName(schemaName)

const assertManagedMetahubSchemaName = (schemaName: string): void => {
    if (!isManagedMetahubSchemaName(schemaName)) {
        throw new Error(`Invalid metahub schema name: ${schemaName}`)
    }
}

const safeErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error)
}

const cleanupClonedSchemas = async (
    generator: { dropSchema: (schemaName: string) => Promise<void> },
    schemaNames: string[]
): Promise<string[]> => {
    const cleanupFailures: string[] = []
    for (const schemaName of schemaNames.slice().reverse()) {
        try {
            await generator.dropSchema(schemaName)
        } catch (error) {
            cleanupFailures.push(`${schemaName}: ${safeErrorMessage(error)}`)
        }
    }
    return cleanupFailures
}

interface UniqueViolationErrorLike {
    code?: string
    constraint?: string
    message?: string
    driverError?: UniqueViolationErrorLike
    cause?: unknown
}

const extractUniqueViolationError = (error: unknown): UniqueViolationErrorLike | null => {
    if (!error || typeof error !== 'object') return null

    const root = error as UniqueViolationErrorLike
    const nestedDriver = root.driverError
    const nestedCause = root.cause && typeof root.cause === 'object' ? (root.cause as UniqueViolationErrorLike) : null
    const nestedCauseDriver = nestedCause?.driverError

    const candidates: Array<UniqueViolationErrorLike | null | undefined> = [root, nestedDriver, nestedCause, nestedCauseDriver]
    for (const candidate of candidates) {
        if (candidate?.code === '23505') {
            return candidate
        }
    }
    return null
}

const resolveMetahubUniqueConflictError = (error: unknown): string | null => {
    const uniqueViolation = extractUniqueViolationError(error)
    if (!uniqueViolation) return null

    const constraint = uniqueViolation.constraint ?? ''
    if (constraint.includes('idx_metahubs_codename_active')) {
        return 'Codename already in use'
    }
    if (constraint.includes('idx_metahubs_slug_active')) {
        return 'Slug already in use'
    }
    if (constraint.includes('idx_branches_metahub_codename_active')) {
        return 'Branch codename already in use'
    }
    if (constraint.includes('idx_branches_metahub_number_active')) {
        return 'Branch number already in use'
    }
    return 'Unique constraint conflict'
}

const resolveMetahubCopyConflictError = (error: unknown): string | null => {
    const knownConflict = resolveMetahubUniqueConflictError(error)
    if (knownConflict) return knownConflict
    if (extractUniqueViolationError(error)) {
        return 'Unique constraint conflict while copying metahub'
    }
    return null
}

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

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

    for (const entry of Object.values(commentValue.locales)) {
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

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) {
        return {
            en: 'Copy (copy)'
        }
    }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

export function createMetahubsRoutes(
    ensureAuth: RequestHandler,
    getDbExecutor: () => DbExecutor,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    const services = (req: Request) => {
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const schemaService = new MetahubSchemaService(exec)
        const objectsService = new MetahubObjectsService(exec, schemaService)
        const branchesService = new MetahubBranchesService(exec)
        return {
            exec,
            schemaService,
            objectsService,
            branchesService
        }
    }

    const memberCommentInputSchema = z
        .union([z.string(), z.record(z.string(), z.string().optional())])
        .transform((value) => (typeof value === 'string' ? { en: value } : value))

    const mapMember = (member: MetahubUserRow | MetahubMemberListItem, email: string | null, nickname: string | null) => ({
        id: member.id,
        userId: member.userId,
        email,
        nickname,
        role: (member.role || 'member') as MetahubRole,
        comment: resolveLocalizedCommentText(member.comment),
        commentVlc: normalizeCommentVlcOutput(member.comment),
        createdAt: member._uplCreatedAt
    })

    const loadMembers = async (
        req: Request,
        metahubId: string,
        params?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string; search?: string }
    ): Promise<{ members: ReturnType<typeof mapMember>[]; total: number }> => {
        const exec = getRequestDbExecutor(req, getDbExecutor())

        try {
            const { items, total } = await listMetahubMembers(exec, {
                metahubId,
                limit: params?.limit ?? 100,
                offset: params?.offset ?? 0,
                sortBy: (params?.sortBy === 'email' ? 'email' : params?.sortBy === 'role' ? 'role' : 'created') as
                    | 'email'
                    | 'role'
                    | 'created',
                sortOrder: (params?.sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
                search: params?.search ? escapeLikeWildcards(params.search.toLowerCase()) : undefined
            })

            const members = items.map((item) => mapMember(item, item.email, item.nickname))
            return { members, total }
        } catch (error) {
            console.error('[loadMembers] Error loading metahub members:', error)
            throw error
        }
    }

    // ============ CODENAME DEFAULTS ============
    // Returns global (admin-level) codename configuration for use during new metahub creation.
    // Any authenticated user can call this — no admin or metahub-membership check required.
    router.get(
        '/metahubs/codename-defaults',
        readLimiter,
        asyncHandler(async (req, res) => {
            const { exec } = services(req)
            const config = await getGlobalMetahubCodenameConfig(exec)
            return res.json({
                success: true,
                data: {
                    style: config.style,
                    alphabet: config.alphabet,
                    allowMixed: config.allowMixed,
                    autoConvertMixedAlphabets: config.autoConvertMixedAlphabets,
                    localizedEnabled: config.localizedEnabled
                }
            })
        })
    )

    // ============ LIST METAHUBS ============
    router.get(
        '/metahubs',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { exec } = services(req)
            const dbSession = getRequestDbSession(req)

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

            // Only superusers may expand the list beyond their memberships.
            const q = dbSession && !dbSession.isReleased() ? dbSession : exec
            const isSu = await isSuperuser(q, userId)
            const canShowAll = showAll && isSu

            const { items: metahubs, total } = await listMetahubsStore(exec, {
                userId,
                showAll: canShowAll,
                limit,
                offset,
                sortBy: (sortBy === 'codename' ? 'codename' : sortBy === 'name' ? 'name' : sortBy === 'created' ? 'created' : 'updated') as
                    | 'name'
                    | 'codename'
                    | 'created'
                    | 'updated',
                sortOrder: (sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
                search: search ?? undefined
            })

            // Determine access type for each metahub
            const globalRoleName = isSu ? await getGlobalRoleCodename(q, userId) : null

            const result = metahubs.map((m) => {
                const role = m.membershipRole ? (m.membershipRole as MetahubRole) : globalRoleName ? 'owner' : 'member'
                const accessType = m.membershipRole ? 'member' : globalRoleName ?? 'member'
                const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

                return {
                    id: m.id,
                    name: m.name,
                    description: m.description,
                    codename: m.codename,
                    slug: m.slug,
                    isPublic: m.isPublic,
                    templateId: m.templateId ?? null,
                    templateVersionId: m.templateVersionId ?? null,
                    version: m._uplVersion || 1,
                    createdAt: m._uplCreatedAt,
                    updatedAt: m._uplUpdatedAt,
                    hubsCount: 0,
                    catalogsCount: 0,
                    membersCount: m.membersCount,
                    role,
                    accessType,
                    permissions
                }
            })

            return res.json({ items: result, total, limit, offset })
        })
    )

    // ============ GET SINGLE METAHUB ============
    router.get(
        '/metahub/:metahubId',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec, objectsService } = services(req)
            const dbSession = getRequestDbSession(req)

            const ctx = await ensureMetahubAccess(exec, userId, metahubId, undefined, dbSession)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            // Load counts from active branch (user-specific)
            const hubsService = new MetahubHubsService(exec, new MetahubSchemaService(exec))
            let hubsCount = 0
            try {
                const { total } = await hubsService.findAll(metahubId, { limit: 1, offset: 0 }, userId)
                hubsCount = total
            } catch (e) {
                // Ignore errors (e.g. schema not found yet)
            }

            // Count catalogs by active branch schema
            let catalogsCount = 0
            try {
                catalogsCount = await objectsService.countByKind(metahubId, 'catalog', userId)
            } catch (e) {
                // Ignore error (e.g. schema not found)
            }

            const { total: membersCount } = await loadMembers(req, metahubId, { limit: 1 })

            const role = ctx.membership.role as MetahubRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                templateId: metahub.templateId ?? null,
                templateVersionId: metahub.templateVersionId ?? null,
                version: metahub._uplVersion || 1,
                createdAt: metahub._uplCreatedAt,
                updatedAt: metahub._uplUpdatedAt,
                hubsCount,
                catalogsCount,
                membersCount,
                role,
                accessType: ctx.isSynthetic ? ctx.globalRole : 'member',
                permissions
            })
        })
    )

    // ============ METAHUB BOARD SUMMARY ============
    router.get(
        '/metahub/:metahubId/board/summary',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)
            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, undefined, dbSession)

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const membership = await findMetahubMembership(exec, metahubId, userId)
            const activeBranchId = membership?.activeBranchId ?? metahub.defaultBranchId ?? null

            let hubsCount = 0
            let catalogsCount = 0

            if (activeBranchId) {
                const activeBranch = await findBranchByIdAndMetahub(exec, activeBranchId, metahubId)
                const schemaName = activeBranch?.schemaName ?? null

                if (schemaName && isManagedMetahubSchemaName(schemaName)) {
                    const schemaIdent = quoteIdentifier(schemaName)
                    try {
                        const [hubsResult, catalogsResult] = await Promise.all([
                            exec.query<{ count: number }>(
                                `SELECT COUNT(*)::int as count FROM ${schemaIdent}._mhb_objects WHERE kind = 'hub'`
                            ),
                            exec.query<{ count: number }>(
                                `SELECT COUNT(*)::int as count FROM ${schemaIdent}._mhb_objects WHERE kind = 'catalog'`
                            )
                        ])
                        hubsCount = hubsResult?.[0]?.count ?? 0
                        catalogsCount = catalogsResult?.[0]?.count ?? 0
                    } catch {
                        hubsCount = 0
                        catalogsCount = 0
                    }
                }
            }

            const [branchesCount, publicationsCount, membersCount] = await Promise.all([
                countBranches(exec, metahubId),
                exec
                    .query<{ count: number }>(
                        `SELECT COUNT(*)::int as count FROM metahubs.doc_publications WHERE metahub_id = $1 AND ${activeMetahubRowCondition()}`,
                        [metahubId]
                    )
                    .then((r) => r[0]?.count ?? 0),
                countMetahubMembers(exec, metahubId)
            ])

            const versionsResult = await exec.query<{ count: number }>(
                `SELECT COUNT(*)::int as count
                 FROM metahubs.doc_publication_versions pv
                 JOIN metahubs.doc_publications p ON p.id = pv.publication_id
                 WHERE p.metahub_id = $1
                   AND ${activeMetahubRowCondition('p')} AND ${activeMetahubRowCondition('pv')}`,
                [metahubId]
            )

            const applicationsResult = await exec.query<{ count: number }>(
                `SELECT COUNT(DISTINCT a.id)::int as count
                 FROM applications.cat_applications a
                 JOIN applications.cat_connectors c ON c.application_id = a.id
                 JOIN applications.rel_connector_publications cp ON cp.connector_id = c.id
                 JOIN metahubs.doc_publications p ON p.id = cp.publication_id
                 WHERE p.metahub_id = $1
                   AND ${activeMetahubRowCondition('p')} AND ${activeAppRowCondition('a')}
                   AND ${activeAppRowCondition('c')} AND ${activeAppRowCondition('cp')}`,
                [metahubId]
            )

            return res.json({
                metahubId,
                activeBranchId,
                branchesCount,
                hubsCount,
                catalogsCount,
                membersCount,
                publicationsCount,
                publicationVersionsCount: versionsResult?.[0]?.count ?? 0,
                applicationsCount: applicationsResult?.[0]?.count ?? 0
            })
        })
    )

    // ============ CREATE METAHUB ============
    router.post(
        '/metahubs',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema,
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                codename: requiredCodenamePayloadSchema,
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                templateId: z.string().uuid().optional(),
                createOptions: z
                    .object({
                        createHub: z.boolean().optional().default(true),
                        createCatalog: z.boolean().optional().default(true),
                        createSet: z.boolean().optional().default(true),
                        createEnumeration: z.boolean().optional().default(true)
                    })
                    .optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const { exec, branchesService } = services(req)
            const codenameConfig = await getGlobalMetahubCodenameConfig(exec)

            const normalizedCodename = normalizeCodenameForStyle(
                getCodenamePayloadText(result.data.codename),
                codenameConfig.style,
                codenameConfig.alphabet
            )
            if (
                !normalizedCodename ||
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: {
                        codename: [codenameErrorMessage(codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)]
                    }
                })
            }

            const existingCodename = await findMetahubByCodename(exec, normalizedCodename)
            if (existingCodename) {
                return res.status(409).json({ error: 'Codename already in use' })
            }

            // Check slug uniqueness if provided
            if (result.data.slug) {
                const existing = await findMetahubBySlug(exec, result.data.slug)
                if (existing) {
                    return res.status(409).json({ error: 'Slug already in use' })
                }
            }

            const sanitizedName = sanitizeLocalizedInput(result.data.name)
            if (Object.keys(sanitizedName).length === 0) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(sanitizedName, result.data.namePrimaryLocale, 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = undefined
            if (result.data.description) {
                const sanitizedDescription = sanitizeLocalizedInput(result.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc = buildLocalizedContent(
                        sanitizedDescription,
                        result.data.descriptionPrimaryLocale,
                        result.data.namePrimaryLocale ?? 'en'
                    )
                }
            }

            const codenameVlc = syncCodenamePayloadText(
                result.data.codename,
                result.data.namePrimaryLocale ?? 'en',
                normalizedCodename,
                codenameConfig.style,
                codenameConfig.alphabet
            )
            if (!codenameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { codename: ['Codename is required'] } })
            }

            // Resolve template (optional — falls back to default)
            let templateId: string | undefined
            let templateVersionId: string | undefined
            if (result.data.templateId) {
                const template = await findTemplateByIdNotDeleted(exec, result.data.templateId)
                if (!template || !template.isActive) {
                    return res.status(404).json({ error: 'Template not found or inactive' })
                }
                if (!template.activeVersionId) {
                    return res.status(400).json({ error: 'Template has no active version' })
                }
                templateId = template.id
                templateVersionId = template.activeVersionId
            } else {
                // Auto-assign default template when none specified
                const defaultTemplate = await findTemplateByCodename(exec, DEFAULT_TEMPLATE_CODENAME)
                if (defaultTemplate?.isActive && defaultTemplate.activeVersionId) {
                    templateId = defaultTemplate.id
                    templateVersionId = defaultTemplate.activeVersionId
                }
                // If default template not found (e.g. seeder hasn't run), proceed without template —
                // MetahubSchemaService will fall back to built-in manifest
            }

            const branchName = buildLocalizedContent({ en: 'Main', ru: 'Основная' }, 'en', 'en')
            const branchDescription = buildLocalizedContent({ en: 'Your first branch', ru: 'Ваша первая ветка' }, 'en', 'en')
            if (!branchName) {
                return res.status(500).json({ error: 'Failed to build default branch name' })
            }

            // Create metahub + owner membership atomically
            let metahub: MetahubRow
            try {
                metahub = await exec.transaction(async (tx) => {
                    const saved = await createMetahubStore(tx, {
                        name: nameVlc,
                        description: descriptionVlc,
                        codename: codenameVlc,
                        slug: result.data.slug,
                        isPublic: result.data.isPublic ?? false,
                        templateId: templateId ?? null,
                        templateVersionId: templateVersionId ?? null,
                        userId
                    })

                    await addMetahubMember(tx, {
                        metahubId: saved.id,
                        userId,
                        role: 'owner',
                        createdBy: userId
                    })

                    return saved
                })
            } catch (error) {
                const conflictMessage = resolveMetahubUniqueConflictError(error)
                if (conflictMessage) {
                    return res.status(409).json({ error: conflictMessage })
                }
                throw error
            }

            // Create initial branch (includes DDL schema + entity save).
            // branchesService.createInitialBranch already cleans up DDL on its own failure.
            try {
                await branchesService.createInitialBranch({
                    metahubId: metahub.id,
                    name: branchName,
                    description: branchDescription ?? null,
                    createdBy: userId,
                    createOptions: result.data.createOptions
                })
            } catch (error) {
                // Cleanup: hard-delete the just-created metahub (CASCADE removes membership).
                // Hard DELETE is used instead of soft-delete because the metahub has no
                // meaningful data yet and must not remain as a zombie row.
                try {
                    await exec.query(`DELETE FROM metahubs.cat_metahubs WHERE id = $1`, [metahub.id])
                } catch (cleanupError) {
                    console.error('[metahubs] Failed to cleanup metahub after initial-branch failure', {
                        metahubId: metahub.id,
                        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                    })
                }
                throw error
            }

            return res.status(201).json({
                id: metahub.id,
                name: metahub.name,
                description: metahub.description,
                codename: metahub.codename,
                slug: metahub.slug,
                isPublic: metahub.isPublic,
                templateId: metahub.templateId ?? null,
                templateVersionId: metahub.templateVersionId ?? null,
                version: metahub._uplVersion || 1,
                createdAt: metahub._uplCreatedAt,
                updatedAt: metahub._uplUpdatedAt,
                role: 'owner',
                accessType: 'member',
                permissions: ROLE_PERMISSIONS.owner
            })
        })
    )

    // ============ COPY METAHUB ============
    router.post(
        '/metahub/:metahubId/copy',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)
            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, 'manageMetahub', dbSession)

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                codename: optionalCodenamePayloadSchema,
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .optional(),
                isPublic: z.boolean().optional(),
                copyDefaultBranchOnly: z.boolean().optional().default(true),
                copyAccess: z.boolean().optional().default(false)
            })

            const parsed = schema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
            }

            const sourceMetahub = await findMetahubById(exec, metahubId)
            if (!sourceMetahub) {
                return res.status(404).json({ error: 'Metahub not found' })
            }

            const allSourceBranches = await findBranchesByMetahub(exec, metahubId)
            const sourceBranches = allSourceBranches.filter((b) => !b._uplDeleted && !b._appDeleted)
            if (sourceBranches.length === 0) {
                return res.status(409).json({ error: 'Metahub has no branches to copy' })
            }

            const defaultSourceBranch = sourceBranches.find((branch) => branch.id === sourceMetahub.defaultBranchId) ?? sourceBranches[0]

            const selectedSourceBranches = parsed.data.copyDefaultBranchOnly ? [defaultSourceBranch] : sourceBranches

            const requestedName = parsed.data.name
                ? sanitizeLocalizedInput(parsed.data.name)
                : buildDefaultCopyNameInput(sourceMetahub.name)
            if (Object.keys(requestedName).length === 0) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            const nameVlc = buildLocalizedContent(requestedName, parsed.data.namePrimaryLocale, sourceMetahub.name?._primary ?? 'en')
            if (!nameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
            }

            let descriptionVlc = sourceMetahub.description
            if (parsed.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(parsed.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    descriptionVlc =
                        buildLocalizedContent(
                            sanitizedDescription,
                            parsed.data.descriptionPrimaryLocale,
                            parsed.data.namePrimaryLocale ?? sourceMetahub.description?._primary ?? sourceMetahub.name?._primary ?? 'en'
                        ) ?? null
                } else {
                    descriptionVlc = null
                }
            }

            const codenameFallbackLocale = parsed.data.namePrimaryLocale ?? sourceMetahub.name?._primary ?? 'en'

            const codenameConfig = await getGlobalMetahubCodenameConfig(exec)
            const copySuffix = codenameConfig.style === 'pascal-case' ? 'Copy' : '-copy'
            const normalizedCodename = normalizeCodenameForStyle(
                parsed.data.codename
                    ? getCodenamePayloadText(parsed.data.codename)
                    : `${getCodenamePayloadText(sourceMetahub.codename)}${copySuffix}`,
                codenameConfig.style,
                codenameConfig.alphabet
            )
            if (
                !normalizedCodename ||
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                return res.status(400).json({
                    error: 'Invalid input',
                    details: {
                        codename: [codenameErrorMessage(codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)]
                    }
                })
            }

            const codenameVlc = syncCodenamePayloadText(
                parsed.data.codename ?? sourceMetahub.codename,
                codenameFallbackLocale,
                normalizedCodename,
                codenameConfig.style,
                codenameConfig.alphabet
            )
            if (!codenameVlc) {
                return res.status(400).json({ error: 'Invalid input', details: { codename: ['Codename is required'] } })
            }

            const existingCodename = await findMetahubByCodename(exec, normalizedCodename)
            if (existingCodename) {
                return res.status(409).json({ error: 'Codename already in use' })
            }

            const slugCandidate = parsed.data.slug ?? (sourceMetahub.slug ? `${sourceMetahub.slug}-copy` : undefined)
            if (slugCandidate) {
                const existingSlug = await findMetahubBySlug(exec, slugCandidate)
                if (existingSlug) {
                    return res.status(409).json({ error: 'Slug already in use' })
                }
            }

            const [{ id: newMetahubId }] = await exec.query<{ id: string }>(`SELECT public.uuid_generate_v7() AS id`)

            const branchClonePlan = selectedSourceBranches.map((sourceBranch, index) => ({
                sourceBranch,
                branchNumber: index + 1,
                schemaName: buildManagedDynamicSchemaName({ prefix: 'mhb', ownerId: newMetahubId, branchNumber: index + 1 })
            }))

            const { cloner, generator } = getDDLServices()
            const createdSchemas: string[] = []
            try {
                for (const planItem of branchClonePlan) {
                    await cloner.clone({
                        sourceSchema: planItem.sourceBranch.schemaName,
                        targetSchema: planItem.schemaName,
                        dropTargetSchemaIfExists: true,
                        createTargetSchema: true,
                        copyData: true
                    })
                    createdSchemas.push(planItem.schemaName)
                }
            } catch (error) {
                const cleanupFailures = await cleanupClonedSchemas(generator, createdSchemas)
                if (cleanupFailures.length > 0) {
                    console.error('[metahub:copy] Failed to cleanup cloned schemas after clone failure', {
                        metahubId,
                        cleanupFailures
                    })
                    throw new Error(`Copy rollback cleanup failed: ${cleanupFailures.join('; ')}`)
                }
                throw error
            }

            try {
                const copied = await exec.transaction(async (tx) => {
                    const copiedMetahub = await createMetahubStore(tx, {
                        id: newMetahubId,
                        name: nameVlc,
                        description: descriptionVlc,
                        codename: codenameVlc,
                        slug: slugCandidate,
                        isPublic: parsed.data.isPublic ?? sourceMetahub.isPublic,
                        lastBranchNumber: branchClonePlan.length,
                        templateId: sourceMetahub.templateId ?? null,
                        templateVersionId: sourceMetahub.templateVersionId ?? null,
                        userId
                    })
                    console.info('[metahub-copy] saving copied metahub entity', {
                        id: copiedMetahub.id,
                        codename: JSON.stringify(copiedMetahub.codename),
                        sourceCodename: JSON.stringify(sourceMetahub.codename)
                    })

                    const branchIdMap = new Map<string, string>()
                    for (const planItem of branchClonePlan) {
                        const savedBranch = await createBranch(tx, {
                            metahubId: copiedMetahub.id,
                            name: planItem.sourceBranch.name,
                            description: planItem.sourceBranch.description ?? null,
                            codename: planItem.sourceBranch.codename,
                            branchNumber: planItem.branchNumber,
                            schemaName: planItem.schemaName,
                            structureVersion: structureVersionToSemver(planItem.sourceBranch.structureVersion),
                            lastTemplateVersionId: planItem.sourceBranch.lastTemplateVersionId ?? null,
                            lastTemplateVersionLabel: planItem.sourceBranch.lastTemplateVersionLabel ?? null,
                            lastTemplateSyncedAt: planItem.sourceBranch.lastTemplateSyncedAt ?? null,
                            userId
                        })
                        branchIdMap.set(planItem.sourceBranch.id, savedBranch.id)
                    }

                    for (const planItem of branchClonePlan) {
                        if (!planItem.sourceBranch.sourceBranchId) continue
                        const branchId = branchIdMap.get(planItem.sourceBranch.id)
                        const mappedSourceId = branchIdMap.get(planItem.sourceBranch.sourceBranchId)
                        if (!branchId || !mappedSourceId) continue
                        await tx.query(
                            `UPDATE metahubs.cat_metahub_branches SET source_branch_id = $1, _upl_updated_by = $2 WHERE id = $3`,
                            [mappedSourceId, userId, branchId]
                        )
                    }

                    const copiedDefaultBranchId = branchIdMap.get(defaultSourceBranch.id) ?? null
                    await updateMetahubStore(tx, copiedMetahub.id, {
                        defaultBranchId: copiedDefaultBranchId,
                        lastBranchNumber: branchClonePlan.length,
                        userId
                    })

                    await addMetahubMember(tx, {
                        metahubId: copiedMetahub.id,
                        userId,
                        role: 'owner',
                        activeBranchId: copiedDefaultBranchId,
                        createdBy: userId
                    })

                    if (parsed.data.copyAccess) {
                        const sourceMembers = await tx.query<{
                            userId: string
                            role: string
                            comment: unknown
                            activeBranchId: string | null
                        }>(
                            `SELECT user_id AS "userId", role, comment, active_branch_id AS "activeBranchId"
                             FROM metahubs.rel_metahub_users
                             WHERE metahub_id = $1 AND _upl_deleted = false`,
                            [metahubId]
                        )
                        for (const sourceMember of sourceMembers) {
                            if (sourceMember.userId === userId) continue
                            await addMetahubMember(tx, {
                                metahubId: copiedMetahub.id,
                                userId: sourceMember.userId,
                                role: sourceMember.role,
                                comment: sourceMember.comment as VersionedLocalizedContent<string> | null,
                                activeBranchId: sourceMember.activeBranchId ? branchIdMap.get(sourceMember.activeBranchId) ?? null : null,
                                createdBy: userId
                            })
                        }
                    }

                    const finalMetahub = await findMetahubById(tx, copiedMetahub.id)
                    if (!finalMetahub) throw new Error('Failed to read copied metahub')
                    return finalMetahub
                })

                return res.status(201).json({
                    id: copied.id,
                    name: copied.name,
                    description: copied.description,
                    codename: copied.codename,
                    slug: copied.slug,
                    isPublic: copied.isPublic,
                    version: copied._uplVersion || 1,
                    createdAt: copied._uplCreatedAt,
                    updatedAt: copied._uplUpdatedAt,
                    role: 'owner',
                    accessType: 'member',
                    permissions: ROLE_PERMISSIONS.owner
                })
            } catch (error) {
                const cleanupFailures = await cleanupClonedSchemas(generator, createdSchemas)
                if (cleanupFailures.length > 0) {
                    console.error('[metahub:copy] Failed to cleanup cloned schemas after metadata transaction failure', {
                        metahubId,
                        cleanupFailures
                    })
                    throw new Error(`Copy rollback cleanup failed: ${cleanupFailures.join('; ')}`)
                }
                const conflictMessage = resolveMetahubCopyConflictError(error)
                if (conflictMessage) {
                    return res.status(409).json({ error: conflictMessage })
                }
                throw error
            }
        })
    )

    // ============ UPDATE METAHUB ============
    router.put(
        '/metahub/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)

            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, 'manageMetahub', dbSession)

            const localizedInputSchema = z
                .union([z.string().min(1).max(255), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const optionalLocalizedInputSchema = z
                .union([z.string(), z.record(z.string())])
                .transform((val) => (typeof val === 'string' ? { en: val } : val))

            const schema = z.object({
                name: localizedInputSchema.optional(),
                description: optionalLocalizedInputSchema.optional(),
                namePrimaryLocale: z.string().optional(),
                descriptionPrimaryLocale: z.string().optional(),
                codename: optionalCodenamePayloadSchema,
                slug: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
                    .nullable()
                    .optional(),
                isPublic: z.boolean().optional(),
                expectedVersion: z.number().int().positive().optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid input', details: result.error.flatten() })
            }

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const codenameConfig = await getGlobalMetahubCodenameConfig(exec)

            // Build update fields
            const updateInput: Parameters<typeof updateMetahubStore>[2] = { userId }
            let resolvedCodename = getCodenamePayloadText(metahub.codename)
            let resolvedSlug = metahub.slug

            if (result.data.codename !== undefined) {
                const normalizedCodename = normalizeCodenameForStyle(
                    getCodenamePayloadText(result.data.codename),
                    codenameConfig.style,
                    codenameConfig.alphabet
                )
                if (
                    !normalizedCodename ||
                    !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
                ) {
                    return res.status(400).json({
                        error: 'Invalid input',
                        details: {
                            codename: [codenameErrorMessage(codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)]
                        }
                    })
                }
                const existingCodename = await findMetahubByCodename(exec, normalizedCodename)
                if (existingCodename && existingCodename.id !== metahubId) {
                    return res.status(409).json({ error: 'Codename already in use' })
                }
                const nextCodename = syncOptionalCodenamePayloadText(
                    result.data.codename,
                    result.data.namePrimaryLocale ?? metahub.name?._primary ?? 'en',
                    normalizedCodename
                )
                if (!nextCodename) {
                    return res.status(400).json({ error: 'Invalid input', details: { codename: ['Codename is required'] } })
                }
                updateInput.codename = nextCodename
                resolvedCodename = normalizedCodename
            }

            // Check slug uniqueness if changing
            if (result.data.slug !== undefined && result.data.slug !== metahub.slug) {
                if (result.data.slug !== null) {
                    const existing = await findMetahubBySlug(exec, result.data.slug)
                    if (existing && existing.id !== metahubId) {
                        return res.status(409).json({ error: 'Slug already in use' })
                    }
                }
                updateInput.slug = result.data.slug || null
                resolvedSlug = result.data.slug || null
            }

            if (result.data.name !== undefined) {
                const sanitizedName = sanitizeLocalizedInput(result.data.name)
                if (Object.keys(sanitizedName).length === 0) {
                    return res.status(400).json({ error: 'Invalid input', details: { name: ['Name is required'] } })
                }
                const namePrimary = result.data.namePrimaryLocale ?? metahub.name?._primary ?? 'en'
                const nameVlc = buildLocalizedContent(sanitizedName, namePrimary, namePrimary)
                if (nameVlc) {
                    updateInput.name = nameVlc
                }
            }
            if (result.data.description !== undefined) {
                const sanitizedDescription = sanitizeLocalizedInput(result.data.description)
                if (Object.keys(sanitizedDescription).length > 0) {
                    const descriptionPrimary =
                        result.data.descriptionPrimaryLocale ?? metahub.description?._primary ?? metahub.name?._primary ?? 'en'
                    const descriptionVlc = buildLocalizedContent(sanitizedDescription, descriptionPrimary, descriptionPrimary)
                    if (descriptionVlc) {
                        updateInput.description = descriptionVlc
                    }
                } else {
                    updateInput.description = null
                }
            }
            if (result.data.isPublic !== undefined) {
                updateInput.isPublic = result.data.isPublic
            }

            const { expectedVersion } = result.data

            // Optimistic locking: pre-check before UPDATE — allows richer error message
            if (expectedVersion !== undefined) {
                const currentVersion = metahub._uplVersion || 1
                if (currentVersion !== expectedVersion) {
                    throw new OptimisticLockError({
                        entityId: metahubId,
                        entityType: 'metahub',
                        expectedVersion,
                        actualVersion: currentVersion,
                        updatedAt: metahub._uplUpdatedAt,
                        updatedBy: metahub._uplUpdatedBy ?? null
                    })
                }
                updateInput.expectedVersion = expectedVersion
            }

            let updated: MetahubRow | null
            try {
                updated = await updateMetahubStore(exec, metahubId, updateInput)
            } catch (error) {
                const conflictMessage = resolveMetahubUniqueConflictError(error)
                if (conflictMessage) {
                    return res.status(409).json({ error: conflictMessage })
                }
                throw error
            }

            if (!updated) {
                // Version changed between pre-check and UPDATE — race condition
                throw new OptimisticLockError({
                    entityId: metahubId,
                    entityType: 'metahub',
                    expectedVersion: expectedVersion ?? (metahub._uplVersion || 1),
                    actualVersion: 0,
                    updatedAt: metahub._uplUpdatedAt ?? new Date(),
                    updatedBy: metahub._uplUpdatedBy ?? null
                })
            }

            return res.json({
                id: updated.id,
                name: updated.name,
                description: updated.description,
                codename: updated.codename,
                slug: updated.slug,
                isPublic: updated.isPublic,
                version: updated._uplVersion || 1,
                createdAt: updated._uplCreatedAt,
                updatedAt: updated._uplUpdatedAt
            })
        })
    )

    // ============ DELETE METAHUB ============
    router.delete(
        '/metahub/:metahubId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)

            const dbSession = getRequestDbSession(req)

            const ctx = await ensureMetahubAccess(exec, userId, metahubId, 'deleteContent', dbSession)
            // Only owner can delete
            if (ctx.membership.role !== 'owner' && !ctx.isSynthetic) {
                return res.status(403).json({ error: 'Only the owner can delete this metahub' })
            }

            const metahub = await findMetahubById(exec, metahubId)
            if (!metahub) return res.status(404).json({ error: 'Metahub not found' })

            const lockKey = uuidToLockKey(metahubId)
            const lockAcquired = await acquirePoolAdvisoryLock(lockKey)
            if (!lockAcquired) {
                return res.status(409).json({
                    error: 'Could not acquire metahub delete lock. Please retry.'
                })
            }

            try {
                await exec.transaction(async (tx) => {
                    const lockedMetahub = await findMetahubForUpdate(tx, metahubId)
                    if (!lockedMetahub) {
                        throw new Error('Metahub not found')
                    }

                    const lockedBranches = await tx.query<{ schemaName: string | null }>(
                        `SELECT schema_name AS "schemaName"
                         FROM metahubs.cat_metahub_branches
                         WHERE metahub_id = $1
                         FOR UPDATE`,
                        [metahubId]
                    )

                    const schemasToDrop = lockedBranches
                        .map((branch) => branch.schemaName)
                        .filter((schemaName): schemaName is string => Boolean(schemaName))

                    for (const schemaName of schemasToDrop) {
                        assertManagedMetahubSchemaName(schemaName)
                    }

                    for (const schemaName of schemasToDrop) {
                        const schemaIdent = quoteIdentifier(schemaName)
                        await tx.query(`DROP SCHEMA IF EXISTS ${schemaIdent} CASCADE`)
                    }

                    // Cascade soft-delete children before the metahub itself
                    await tx.query(
                        `UPDATE metahubs.cat_metahub_branches
                         SET _upl_deleted = true,
                             _upl_deleted_at = NOW(),
                             _upl_deleted_by = $2,
                             _app_deleted = true,
                             _app_deleted_at = NOW(),
                             _app_deleted_by = $2,
                             _upl_updated_at = NOW(),
                             _upl_version = _upl_version + 1
                         WHERE metahub_id = $1 AND _upl_deleted = false AND _app_deleted = false`,
                        [metahubId, userId]
                    )

                    await tx.query(
                        `UPDATE metahubs.rel_metahub_users
                         SET _upl_deleted = true,
                             _upl_deleted_at = NOW(),
                             _upl_deleted_by = $2,
                             _app_deleted = true,
                             _app_deleted_at = NOW(),
                             _app_deleted_by = $2,
                             _upl_updated_at = NOW(),
                             _upl_version = _upl_version + 1
                         WHERE metahub_id = $1 AND _upl_deleted = false AND _app_deleted = false`,
                        [metahubId, userId]
                    )

                    // Soft-delete publication versions before their parent publications
                    await tx.query(
                        `UPDATE metahubs.doc_publication_versions
                         SET _upl_deleted = true,
                             _upl_deleted_at = NOW(),
                             _upl_deleted_by = $2,
                             _app_deleted = true,
                             _app_deleted_at = NOW(),
                             _app_deleted_by = $2,
                             _upl_updated_at = NOW(),
                             _upl_version = _upl_version + 1
                         WHERE publication_id IN (
                             SELECT id FROM metahubs.doc_publications WHERE metahub_id = $1
                         ) AND _upl_deleted = false AND _app_deleted = false`,
                        [metahubId, userId]
                    )

                    await tx.query(
                        `UPDATE metahubs.doc_publications
                         SET _upl_deleted = true,
                             _upl_deleted_at = NOW(),
                             _upl_deleted_by = $2,
                             _app_deleted = true,
                             _app_deleted_at = NOW(),
                             _app_deleted_by = $2,
                             _upl_updated_at = NOW(),
                             _upl_version = _upl_version + 1
                         WHERE metahub_id = $1 AND _upl_deleted = false AND _app_deleted = false`,
                        [metahubId, userId]
                    )

                    await softDelete(tx, 'metahubs', 'cat_metahubs', metahubId, userId)
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete metahub'
                if (message === 'Metahub not found') {
                    return res.status(404).json({ error: message })
                }
                if (message.startsWith('Invalid metahub schema name:')) {
                    return res.status(500).json({ error: message })
                }
                throw error
            } finally {
                await releasePoolAdvisoryLock(lockKey)
            }

            MetahubSchemaService.clearCache(metahubId)

            return res.status(204).send()
        })
    )

    // ============ GET MEMBERS ============
    router.get(
        '/metahub/:metahubId/members',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)
            const dbSession = getRequestDbSession(req)

            const ctx = await ensureMetahubAccess(exec, userId, metahubId, undefined, dbSession)

            let validatedQuery
            try {
                validatedQuery = validateListQuery(req.query)
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return res.status(400).json({ error: 'Invalid query', details: error.flatten() })
                }
                throw error
            }
            const { members, total } = await loadMembers(req, metahubId, validatedQuery)

            const role = ctx.membership.role as MetahubRole
            const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member

            return res.json({ members, total, role, permissions })
        })
    )

    // ============ ADD MEMBER ============
    router.post(
        '/metahub/:metahubId/members',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const { exec } = services(req)

            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, 'manageMembers', dbSession)

            const schema = z.object({
                email: z.string().email(),
                role: z.enum(['admin', 'editor', 'member']),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid payload', details: result.error.flatten() })
            }

            const normalizedComment = normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
            if (normalizedComment.error) {
                return res.status(400).json({
                    error: 'Invalid payload',
                    details: { formErrors: [normalizedComment.error], fieldErrors: { comment: [normalizedComment.error] } }
                })
            }

            // Find user by email
            const authUsers = await exec.query<{ id: string; email: string }>(
                `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
                [result.data.email]
            )
            const authUser = authUsers[0]

            if (!authUser) {
                return res.status(404).json({ error: 'User not found' })
            }

            // Check if already a member
            const existing = await findMetahubMembership(exec, metahubId, authUser.id)
            if (existing) {
                return res.status(409).json({
                    error: 'User already has access',
                    code: 'METAHUB_MEMBER_EXISTS'
                })
            }

            const membership = await addMetahubMember(exec, {
                metahubId,
                userId: authUser.id,
                role: result.data.role,
                comment: normalizedComment.commentVlc,
                createdBy: userId
            })

            return res.status(201).json({
                id: membership.id,
                userId: authUser.id,
                email: authUser.email,
                role: membership.role,
                comment: resolveLocalizedCommentText(membership.comment),
                commentVlc: normalizeCommentVlcOutput(membership.comment),
                createdAt: membership._uplCreatedAt
            })
        })
    )

    // ============ UPDATE MEMBER ============
    router.patch(
        '/metahub/:metahubId/member/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const { exec } = services(req)

            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, 'manageMembers', dbSession)

            const membership = await findMetahubMemberById(exec, memberId)
            if (!membership || membership.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(membership, 'modify')

            const schema = z.object({
                role: z.enum(['admin', 'editor', 'member']).optional(),
                comment: memberCommentInputSchema.nullable().optional(),
                commentPrimaryLocale: z.string().trim().min(2).max(16).optional()
            })

            const result = schema.safeParse(req.body)
            if (!result.success) {
                return res.status(400).json({ error: 'Invalid payload', details: result.error.flatten() })
            }

            const normalizedComment: { commentVlc: VersionedLocalizedContent<string> | null | undefined; error?: string } =
                result.data.comment !== undefined
                    ? normalizeMemberCommentInput(result.data.comment, result.data.commentPrimaryLocale)
                    : { commentVlc: undefined }

            if (normalizedComment.error) {
                return res.status(400).json({
                    error: 'Invalid payload',
                    details: { formErrors: [normalizedComment.error], fieldErrors: { comment: [normalizedComment.error] } }
                })
            }

            const updated = await updateMetahubMemberStore(exec, memberId, {
                role: result.data.role,
                comment: result.data.comment !== undefined ? normalizedComment.commentVlc ?? null : undefined,
                updatedBy: userId
            })

            if (!updated) {
                return res.status(404).json({ error: 'Member not found' })
            }

            return res.json({
                id: updated.id,
                userId: updated.userId,
                role: updated.role,
                comment: resolveLocalizedCommentText(updated.comment),
                commentVlc: normalizeCommentVlcOutput(updated.comment),
                createdAt: updated._uplCreatedAt
            })
        })
    )

    // ============ REMOVE MEMBER ============
    router.delete(
        '/metahub/:metahubId/member/:memberId',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId, memberId } = req.params
            const { exec } = services(req)

            const dbSession = getRequestDbSession(req)

            await ensureMetahubAccess(exec, userId, metahubId, 'manageMembers', dbSession)

            const membership = await findMetahubMemberById(exec, memberId)
            if (!membership || membership.metahubId !== metahubId) {
                return res.status(404).json({ error: 'Member not found' })
            }

            assertNotOwner(membership, 'remove')

            await removeMetahubMember(exec, memberId, userId)

            return res.status(204).send()
        })
    )

    return router
}
