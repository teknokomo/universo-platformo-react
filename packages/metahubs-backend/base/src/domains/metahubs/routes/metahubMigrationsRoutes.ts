import { Router, type Request, type Response, type RequestHandler } from 'express'
import { z } from 'zod'
import type { DataSource, EntityManager, QueryRunner } from 'typeorm'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { ensureMetahubAccess } from '../../shared/guards'
import { Metahub } from '../../../database/entities/Metahub'
import { MetahubBranch } from '../../../database/entities/MetahubBranch'
import { MetahubUser } from '../../../database/entities/MetahubUser'
import { Template } from '../../../database/entities/Template'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import type { MetahubTemplateManifest } from '@universo/types'
import { CURRENT_STRUCTURE_VERSION } from '../services/structureVersions'
import { KnexClient, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { SYSTEM_TABLE_VERSIONS } from '../services/systemTableDefinitions'
import { calculateSystemTableDiff } from '../services/systemTableDiff'
import { TemplateSeedMigrator, type SeedMigrationResult } from '../../templates/services/TemplateSeedMigrator'
import {
    TEMPLATE_CLEANUP_MODES,
    TemplateSeedCleanupService,
    type TemplateCleanupMode,
    type TemplateSeedCleanupResult
} from '../../templates/services/TemplateSeedCleanupService'
import { parseMetahubMigrationMeta, type MetahubTemplateSeedMigrationCounts } from '../services/metahubMigrationMeta'
import {
    MetahubMigrationApplyLockTimeoutError,
    MetahubPoolExhaustedError,
    isKnexPoolTimeoutError,
    isMetahubDomainError
} from '../../shared/domainErrors'
import { getRequestManager } from '../../../utils'

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    branchId: z.string().uuid().optional()
})

const statusQuerySchema = z.object({
    branchId: z.string().uuid().optional(),
    targetTemplateVersionId: z.string().uuid().optional(),
    cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('keep')
})

const planBodySchema = z.object({
    branchId: z.string().uuid().optional(),
    targetTemplateVersionId: z.string().uuid().optional(),
    cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('keep')
})

const applyBodySchema = z.object({
    branchId: z.string().uuid().optional(),
    dryRun: z.boolean().optional().default(false),
    targetTemplateVersionId: z.string().uuid().optional(),
    cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('keep')
})

const resolveUserId = (req: Request): string | undefined => {
    const user = (req as Request & { user?: Record<string, unknown> }).user
    if (!user) return undefined
    return (user.id as string | undefined) ?? (user.sub as string | undefined) ?? (user.user_id as string | undefined)
}

interface RequestWithDbContext extends Request {
    dbContext?: {
        queryRunner?: QueryRunner
    }
}

const getRequestQueryRunner = (req: Request): QueryRunner | undefined => {
    return (req as RequestWithDbContext).dbContext?.queryRunner
}

interface BranchContext {
    metahub: Metahub
    branch: MetahubBranch
}

interface StructurePlanStep {
    fromVersion: number
    toVersion: number
    summary: string
    additive: string[]
    destructive: string[]
}

interface StructurePlan {
    steps: StructurePlanStep[]
    additive: string[]
    destructive: string[]
    blockers: string[]
}

interface TemplateContext {
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    currentManifest: MetahubTemplateManifest | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
    targetManifest: MetahubTemplateManifest | null
}

interface TemplatePlan {
    minStructureVersion: number | null
    structureCompatible: boolean
    seedDryRun: (SeedMigrationResult & { hasChanges: boolean }) | null
    cleanup: TemplateSeedCleanupResult
    blockers: string[]
}

interface MetahubMigrationPlanResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: number
    targetStructureVersion: number
    structureUpgradeRequired: boolean
    structurePlan: StructurePlan
    templateId: string | null
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
    templateUpgradeRequired: boolean
    templatePlan: TemplatePlan
}

interface BuildMigrationPlanOptions {
    includeTemplateSeedDryRun?: boolean
}

interface MetahubMigrationStatusResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: number
    targetStructureVersion: number
    structureUpgradeRequired: boolean
    templateUpgradeRequired: boolean
    migrationRequired: boolean
    blockers: string[]
    status: 'up_to_date' | 'requires_migration' | 'blocked'
    code: 'UP_TO_DATE' | 'MIGRATION_REQUIRED' | 'MIGRATION_BLOCKED'
    currentTemplateVersionId: string | null
    currentTemplateVersionLabel: string | null
    targetTemplateVersionId: string | null
    targetTemplateVersionLabel: string | null
}

const normalizeStructureVersion = (value: number | null | undefined): number => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || (value ?? 0) <= 0) {
        return 1
    }
    return Number(value)
}

const zeroSeedCounts: MetahubTemplateSeedMigrationCounts = {
    layoutsAdded: 0,
    zoneWidgetsAdded: 0,
    settingsAdded: 0,
    entitiesAdded: 0,
    attributesAdded: 0,
    elementsAdded: 0
}

const safeErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error)
}

interface MappedRouteErrorPayload {
    statusCode: number
    body: Record<string, unknown>
}

const mapMigrationsRouteError = (
    error: unknown,
    context: { metahubId: string; branchId?: string; plan?: MetahubMigrationPlanResponse }
): MappedRouteErrorPayload | null => {
    if (isMetahubDomainError(error)) {
        return {
            statusCode: error.statusCode,
            body: {
                error: error.message,
                code: error.code,
                details: error.details ?? null,
                ...(context.plan ? { plan: context.plan } : {})
            }
        }
    }

    if (isKnexPoolTimeoutError(error)) {
        const mapped = new MetahubPoolExhaustedError('Database connection pool is exhausted during migration request', {
            metahubId: context.metahubId,
            branchId: context.branchId
        })
        return {
            statusCode: mapped.statusCode,
            body: {
                error: mapped.message,
                code: mapped.code,
                details: mapped.details ?? null,
                ...(context.plan ? { plan: context.plan } : {})
            }
        }
    }

    return null
}

const toMigrationStatus = (plan: MetahubMigrationPlanResponse): MetahubMigrationStatusResponse => {
    const blockers = [...plan.structurePlan.blockers, ...plan.templatePlan.blockers]
    const migrationRequired = plan.structureUpgradeRequired || plan.templateUpgradeRequired
    const status: MetahubMigrationStatusResponse['status'] =
        blockers.length > 0 ? 'blocked' : migrationRequired ? 'requires_migration' : 'up_to_date'
    const code: MetahubMigrationStatusResponse['code'] =
        status === 'blocked' ? 'MIGRATION_BLOCKED' : status === 'requires_migration' ? 'MIGRATION_REQUIRED' : 'UP_TO_DATE'

    return {
        branchId: plan.branchId,
        schemaName: plan.schemaName,
        currentStructureVersion: plan.currentStructureVersion,
        targetStructureVersion: plan.targetStructureVersion,
        structureUpgradeRequired: plan.structureUpgradeRequired,
        templateUpgradeRequired: plan.templateUpgradeRequired,
        migrationRequired,
        blockers,
        status,
        code,
        currentTemplateVersionId: plan.currentTemplateVersionId,
        currentTemplateVersionLabel: plan.currentTemplateVersionLabel,
        targetTemplateVersionId: plan.targetTemplateVersionId,
        targetTemplateVersionLabel: plan.targetTemplateVersionLabel
    }
}

async function resolveBranchContext(
    manager: EntityManager,
    metahubId: string,
    userId: string,
    requestedBranchId?: string
): Promise<BranchContext> {
    const metahubRepo = manager.getRepository(Metahub)
    const branchRepo = manager.getRepository(MetahubBranch)
    const memberRepo = manager.getRepository(MetahubUser)

    const metahub = await metahubRepo.findOneBy({ id: metahubId })
    if (!metahub) {
        throw new Error('Metahub not found')
    }

    const membership = await memberRepo.findOne({ where: { metahubId, userId } })
    const fallbackBranchId = requestedBranchId ?? membership?.activeBranchId ?? metahub.defaultBranchId ?? null
    if (!fallbackBranchId) {
        throw new Error('Default branch is not configured')
    }

    const branch = await branchRepo.findOne({ where: { id: fallbackBranchId, metahubId } })
    if (!branch) {
        throw new Error('Branch not found')
    }

    return { metahub, branch }
}

async function resolveTemplateContext(
    manager: EntityManager,
    metahub: Metahub,
    branch: MetahubBranch,
    requestedVersionId?: string
): Promise<TemplateContext> {
    const currentTemplateVersionId = branch.lastTemplateVersionId ?? null
    if (!metahub.templateId) {
        return {
            currentTemplateVersionId,
            currentTemplateVersionLabel: branch.lastTemplateVersionLabel ?? null,
            currentManifest: null,
            targetTemplateVersionId: null,
            targetTemplateVersionLabel: null,
            targetManifest: null
        }
    }

    const templateRepo = manager.getRepository(Template)
    const templateVersionRepo = manager.getRepository(TemplateVersion)
    const template = await templateRepo.findOneBy({ id: metahub.templateId })
    if (!template) {
        return {
            currentTemplateVersionId,
            currentTemplateVersionLabel: branch.lastTemplateVersionLabel ?? null,
            currentManifest: null,
            targetTemplateVersionId: null,
            targetTemplateVersionLabel: null,
            targetManifest: null
        }
    }

    const targetTemplateVersionId = requestedVersionId ?? template.activeVersionId ?? null

    let currentTemplateVersionLabel: string | null = branch.lastTemplateVersionLabel ?? null
    let currentManifest: MetahubTemplateManifest | null = null
    if (currentTemplateVersionId) {
        const currentVersion = await templateVersionRepo.findOneBy({ id: currentTemplateVersionId })
        currentTemplateVersionLabel = currentVersion?.versionLabel ?? null
        if (currentVersion?.manifestJson) {
            try {
                currentManifest = validateTemplateManifest(currentVersion.manifestJson)
            } catch (error) {
                throw new Error(`Current template manifest is invalid: ${safeErrorMessage(error)}`)
            }
        }
    }

    if (!targetTemplateVersionId) {
        return {
            currentTemplateVersionId,
            currentTemplateVersionLabel,
            currentManifest,
            targetTemplateVersionId: null,
            targetTemplateVersionLabel: null,
            targetManifest: null
        }
    }

    const requested = await templateVersionRepo.findOneBy({ id: targetTemplateVersionId })
    if (!requested || requested.templateId !== template.id) {
        throw new Error('Target template version is not linked to this metahub template')
    }

    let targetManifest: MetahubTemplateManifest | null = null
    if (requested.manifestJson) {
        try {
            targetManifest = validateTemplateManifest(requested.manifestJson)
        } catch (error) {
            throw new Error(`Target template manifest is invalid: ${safeErrorMessage(error)}`)
        }
    }

    return {
        currentTemplateVersionId,
        currentTemplateVersionLabel,
        currentManifest,
        targetTemplateVersionId: requested.id,
        targetTemplateVersionLabel: requested.versionLabel,
        targetManifest
    }
}

const buildStructurePlan = (currentVersion: number, targetVersion: number): StructurePlan => {
    const steps: StructurePlanStep[] = []
    const additive: string[] = []
    const destructive: string[] = []
    const blockers: string[] = []

    if (currentVersion >= targetVersion) {
        return { steps, additive, destructive, blockers }
    }

    for (let version = currentVersion; version < targetVersion; version++) {
        const fromDefs = SYSTEM_TABLE_VERSIONS.get(version)
        const toDefs = SYSTEM_TABLE_VERSIONS.get(version + 1)

        if (!fromDefs || !toDefs) {
            blockers.push(`Missing structure definitions for version transition ${version} -> ${version + 1}`)
            break
        }

        const diff = calculateSystemTableDiff(fromDefs, toDefs, version, version + 1)

        steps.push({
            fromVersion: version,
            toVersion: version + 1,
            summary: diff.summary,
            additive: diff.additive.map((change) => change.description),
            destructive: diff.destructive.map((change) => change.description)
        })

        additive.push(...diff.additive.map((change) => change.description))
        destructive.push(...diff.destructive.map((change) => change.description))
    }

    blockers.push(...destructive)
    return { steps, additive, destructive, blockers }
}

async function buildTemplatePlan(
    schemaName: string,
    structureTargetVersion: number,
    templateContext: TemplateContext,
    cleanupMode: TemplateCleanupMode,
    skipSeedDryRun = false
): Promise<TemplatePlan> {
    const blockers: string[] = []
    const targetManifest = templateContext.targetManifest
    const cleanupService = new TemplateSeedCleanupService(KnexClient.getInstance(), schemaName)
    const cleanup = await cleanupService.analyze({
        mode: cleanupMode,
        currentSeed: templateContext.currentManifest?.seed ?? null,
        targetSeed: targetManifest?.seed ?? null
    })
    blockers.push(...cleanup.blockers)

    if (!targetManifest || !templateContext.targetTemplateVersionId) {
        return {
            minStructureVersion: null,
            structureCompatible: true,
            seedDryRun: {
                ...zeroSeedCounts,
                skipped: [],
                hasChanges: false
            },
            cleanup,
            blockers
        }
    }

    const minStructureVersion = targetManifest.minStructureVersion
    const structureCompatible = minStructureVersion <= structureTargetVersion
    if (!structureCompatible) {
        blockers.push(
            `Template requires structure version ${minStructureVersion}, but target structure version is ${structureTargetVersion}`
        )
        return {
            minStructureVersion,
            structureCompatible,
            seedDryRun: null,
            cleanup,
            blockers
        }
    }

    if (skipSeedDryRun) {
        return {
            minStructureVersion,
            structureCompatible,
            seedDryRun: null,
            cleanup,
            blockers
        }
    }

    try {
        const seedMigrator = new TemplateSeedMigrator(KnexClient.getInstance(), schemaName)
        const dryRunResult = await seedMigrator.migrateSeed(targetManifest.seed, { dryRun: true })
        const hasChanges =
            dryRunResult.layoutsAdded > 0 ||
            dryRunResult.zoneWidgetsAdded > 0 ||
            dryRunResult.settingsAdded > 0 ||
            dryRunResult.entitiesAdded > 0 ||
            dryRunResult.attributesAdded > 0 ||
            dryRunResult.elementsAdded > 0

        return {
            minStructureVersion,
            structureCompatible,
            seedDryRun: {
                ...dryRunResult,
                hasChanges
            },
            cleanup,
            blockers
        }
    } catch (error) {
        if (isMetahubDomainError(error)) {
            throw error
        }
        if (isKnexPoolTimeoutError(error)) {
            throw new MetahubPoolExhaustedError('Database connection pool is exhausted during template seed dry-run', {
                schemaName
            })
        }
        blockers.push(`Template seed dry-run failed: ${safeErrorMessage(error)}`)
        return {
            minStructureVersion,
            structureCompatible,
            seedDryRun: null,
            cleanup,
            blockers
        }
    }
}

async function buildMigrationPlan(
    manager: EntityManager,
    metahub: Metahub,
    branch: MetahubBranch,
    requestedTemplateVersionId?: string,
    cleanupMode: TemplateCleanupMode = 'keep',
    options?: BuildMigrationPlanOptions
): Promise<MetahubMigrationPlanResponse> {
    const currentStructureVersion = normalizeStructureVersion(branch.structureVersion)
    const targetStructureVersion = CURRENT_STRUCTURE_VERSION
    const includeTemplateSeedDryRun = options?.includeTemplateSeedDryRun ?? true

    const structurePlan = buildStructurePlan(currentStructureVersion, targetStructureVersion)
    const templateContext = await resolveTemplateContext(manager, metahub, branch, requestedTemplateVersionId)
    const templatePlan = await buildTemplatePlan(
        branch.schemaName,
        targetStructureVersion,
        templateContext,
        cleanupMode,
        currentStructureVersion < targetStructureVersion || !includeTemplateSeedDryRun
    )

    return {
        branchId: branch.id,
        schemaName: branch.schemaName,
        currentStructureVersion,
        targetStructureVersion,
        structureUpgradeRequired: currentStructureVersion < targetStructureVersion,
        structurePlan,
        templateId: metahub.templateId ?? null,
        currentTemplateVersionId: templateContext.currentTemplateVersionId,
        currentTemplateVersionLabel: templateContext.currentTemplateVersionLabel,
        targetTemplateVersionId: templateContext.targetTemplateVersionId,
        targetTemplateVersionLabel: templateContext.targetTemplateVersionLabel,
        templateUpgradeRequired: Boolean(
            templateContext.targetTemplateVersionId && templateContext.currentTemplateVersionId !== templateContext.targetTemplateVersionId
        ),
        templatePlan
    }
}

export function createMetahubMigrationsRoutes(
    ensureAuth: RequestHandler,
    getDataSource: () => DataSource,
    readLimiter: RateLimitRequestHandler,
    writeLimiter: RateLimitRequestHandler
): Router {
    const router = Router({ mergeParams: true })
    router.use(ensureAuth)

    const asyncHandler =
        (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res).catch(next)
        }

    router.get(
        '/metahub/:metahubId/migrations/status',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)
            const manager = getRequestManager(req, ds)
            const parsed = statusQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
            }

            try {
                await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)
                const { metahub, branch } = await resolveBranchContext(manager, metahubId, userId, parsed.data.branchId)
                const plan = await buildMigrationPlan(
                    manager,
                    metahub,
                    branch,
                    parsed.data.targetTemplateVersionId,
                    parsed.data.cleanupMode,
                    {
                        includeTemplateSeedDryRun: false
                    }
                )
                return res.json(toMigrationStatus(plan))
            } catch (error) {
                const mapped = mapMigrationsRouteError(error, { metahubId })
                if (mapped) {
                    return res.status(mapped.statusCode).json(mapped.body)
                }
                return res.status(422).json({ error: safeErrorMessage(error) })
            }
        })
    )

    router.get(
        '/metahub/:metahubId/migrations',
        readLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)
            const manager = getRequestManager(req, ds)
            const parsed = listQuerySchema.safeParse(req.query)
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
            }

            try {
                await ensureMetahubAccess(ds, userId, metahubId, undefined, rlsRunner)
                const { branch } = await resolveBranchContext(manager, metahubId, userId, parsed.data.branchId)

                const knex = KnexClient.getInstance()
                const hasMigrationTable = await knex.schema.withSchema(branch.schemaName).hasTable('_mhb_migrations')
                if (!hasMigrationTable) {
                    return res.json({
                        items: [],
                        total: 0,
                        limit: parsed.data.limit,
                        offset: parsed.data.offset,
                        branchId: branch.id,
                        schemaName: branch.schemaName
                    })
                }

                const countRow = await knex
                    .withSchema(branch.schemaName)
                    .from('_mhb_migrations')
                    .count<{ count: string }[]>('* as count')
                    .first()
                const total = Number(countRow?.count ?? 0)

                const rows = await knex
                    .withSchema(branch.schemaName)
                    .from('_mhb_migrations')
                    .select('id', 'name', 'applied_at', 'from_version', 'to_version', 'meta')
                    .orderBy('applied_at', 'desc')
                    .limit(parsed.data.limit)
                    .offset(parsed.data.offset)

                return res.json({
                    items: rows.map((row) => ({
                        id: row.id,
                        name: row.name,
                        appliedAt: new Date(row.applied_at).toISOString(),
                        fromVersion: row.from_version,
                        toVersion: row.to_version,
                        meta: parseMetahubMigrationMeta(row.meta)
                    })),
                    total,
                    limit: parsed.data.limit,
                    offset: parsed.data.offset,
                    branchId: branch.id,
                    schemaName: branch.schemaName
                })
            } catch (error) {
                const mapped = mapMigrationsRouteError(error, { metahubId })
                if (mapped) {
                    return res.status(mapped.statusCode).json(mapped.body)
                }
                throw error
            }
        })
    )

    router.post(
        '/metahub/:metahubId/migrations/plan',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)
            const manager = getRequestManager(req, ds)
            const parsed = planBodySchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
            }

            try {
                await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)
                const { metahub, branch } = await resolveBranchContext(manager, metahubId, userId, parsed.data.branchId)
                const plan = await buildMigrationPlan(
                    manager,
                    metahub,
                    branch,
                    parsed.data.targetTemplateVersionId,
                    parsed.data.cleanupMode
                )
                return res.json(plan)
            } catch (error) {
                const mapped = mapMigrationsRouteError(error, { metahubId })
                if (mapped) {
                    return res.status(mapped.statusCode).json(mapped.body)
                }
                return res.status(422).json({ error: safeErrorMessage(error) })
            }
        })
    )

    router.post(
        '/metahub/:metahubId/migrations/apply',
        writeLimiter,
        asyncHandler(async (req, res) => {
            const userId = resolveUserId(req)
            if (!userId) return res.status(401).json({ error: 'Unauthorized' })

            const { metahubId } = req.params
            const ds = getDataSource()
            const rlsRunner = getRequestQueryRunner(req)
            const manager = getRequestManager(req, ds)
            const parsed = applyBodySchema.safeParse(req.body ?? {})
            if (!parsed.success) {
                return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
            }

            let metahub: Metahub | null = null
            let branch: MetahubBranch | null = null
            let plan: MetahubMigrationPlanResponse
            try {
                await ensureMetahubAccess(ds, userId, metahubId, 'manageMetahub', rlsRunner)
                const context = await resolveBranchContext(manager, metahubId, userId, parsed.data.branchId)
                metahub = context.metahub
                branch = context.branch
                plan = await buildMigrationPlan(manager, metahub, branch, parsed.data.targetTemplateVersionId, parsed.data.cleanupMode)
            } catch (error) {
                const mapped = mapMigrationsRouteError(error, {
                    metahubId,
                    branchId: branch?.id
                })
                if (mapped) {
                    return res.status(mapped.statusCode).json(mapped.body)
                }
                return res.status(422).json({ error: safeErrorMessage(error) })
            }
            if (!metahub || !branch) {
                return res.status(422).json({ error: 'Could not resolve migration context' })
            }

            if (parsed.data.dryRun) {
                return res.json({
                    status: 'dry_run',
                    plan
                })
            }

            const blockers = [...plan.structurePlan.blockers, ...plan.templatePlan.blockers]
            if (parsed.data.cleanupMode === 'dry_run' && plan.templatePlan.cleanup.hasChanges) {
                blockers.push('Template cleanup mode "dry_run" cannot apply destructive cleanup. Use cleanupMode="confirm".')
            }
            if (blockers.length > 0) {
                return res.status(422).json({
                    error: 'Migration contains blockers and cannot be applied automatically',
                    blockers,
                    plan
                })
            }

            let manifestOverride: MetahubTemplateManifest | undefined
            if (plan.templateUpgradeRequired && plan.targetTemplateVersionId) {
                const version = await manager.getRepository(TemplateVersion).findOneBy({ id: plan.targetTemplateVersionId })
                if (!version?.manifestJson) {
                    return res.status(422).json({
                        error: 'Target template manifest is not available',
                        plan
                    })
                }
                try {
                    manifestOverride = validateTemplateManifest(version.manifestJson)
                } catch (error) {
                    return res.status(422).json({
                        error: `Target template manifest is invalid: ${safeErrorMessage(error)}`,
                        plan
                    })
                }
            }

            const lockKey = uuidToLockKey(`metahub-migration-apply:${branch.id}`)
            const lockAcquired = await acquireAdvisoryLock(KnexClient.getInstance(), lockKey)
            if (!lockAcquired) {
                throw new MetahubMigrationApplyLockTimeoutError(
                    'Could not acquire migration apply lock. Another migration may be in progress.',
                    {
                        metahubId,
                        branchId: branch.id
                    }
                )
            }

            const toDomainPayload = (error: unknown) => {
                if (isMetahubDomainError(error)) {
                    return {
                        statusCode: error.statusCode,
                        body: {
                            error: error.message,
                            code: error.code,
                            details: error.details ?? null,
                            plan
                        }
                    }
                }
                if (isKnexPoolTimeoutError(error)) {
                    const mapped = new MetahubPoolExhaustedError('Database connection pool is exhausted during migration apply', {
                        metahubId,
                        branchId: branch.id
                    })
                    return {
                        statusCode: mapped.statusCode,
                        body: {
                            error: mapped.message,
                            code: mapped.code,
                            details: mapped.details ?? null,
                            plan
                        }
                    }
                }
                return null
            }

            let cleanupResult: TemplateSeedCleanupResult | null = null
            try {
                const schemaService = new MetahubSchemaService(ds, branch.id, manager)
                await schemaService.ensureSchema(metahubId, userId, {
                    mode: 'apply_migrations',
                    manifestOverride,
                    templateVersionId: plan.targetTemplateVersionId,
                    templateVersionLabel: plan.targetTemplateVersionLabel
                })

                if (parsed.data.cleanupMode === 'confirm') {
                    const templateContext = await resolveTemplateContext(manager, metahub, branch, parsed.data.targetTemplateVersionId)
                    const cleanupService = new TemplateSeedCleanupService(KnexClient.getInstance(), branch.schemaName)
                    cleanupResult = await cleanupService.apply({
                        mode: 'confirm',
                        currentSeed: templateContext.currentManifest?.seed ?? null,
                        targetSeed: templateContext.targetManifest?.seed ?? null,
                        actorId: userId
                    })
                    if (cleanupResult.blockers.length > 0) {
                        return res.status(422).json({
                            error: 'Template cleanup cannot be applied automatically',
                            blockers: cleanupResult.blockers,
                            cleanup: cleanupResult,
                            plan
                        })
                    }
                }

                const refreshedBranchAfterSync = await manager.getRepository(MetahubBranch).findOne({
                    where: { id: branch.id, metahubId }
                })
                if (!refreshedBranchAfterSync) {
                    return res.status(404).json({
                        error: 'Branch not found after migration apply',
                        plan
                    })
                }

                if (plan.templateUpgradeRequired && plan.targetTemplateVersionId) {
                    const branchTemplateSynced = refreshedBranchAfterSync.lastTemplateVersionId === plan.targetTemplateVersionId
                    if (!branchTemplateSynced) {
                        return res.status(409).json({
                            error: 'Template migration is not confirmed on branch state. Please retry migration.',
                            code: 'TEMPLATE_SYNC_NOT_CONFIRMED',
                            branchTemplateVersionId: refreshedBranchAfterSync.lastTemplateVersionId ?? null,
                            targetTemplateVersionId: plan.targetTemplateVersionId,
                            plan
                        })
                    }

                    await manager.transaction(async (txManager) => {
                        const metahubRepoTx = txManager.getRepository(Metahub)
                        const lockedMetahub = await metahubRepoTx
                            .createQueryBuilder('metahub')
                            .setLock('pessimistic_write')
                            .where('metahub.id = :id', { id: metahub.id })
                            .getOne()

                        if (!lockedMetahub) {
                            throw new Error('Metahub not found')
                        }

                        lockedMetahub.templateVersionId = plan.targetTemplateVersionId
                        lockedMetahub._uplUpdatedBy = userId
                        await metahubRepoTx.save(lockedMetahub)
                    })
                }
            } catch (error) {
                const mapped = toDomainPayload(error)
                if (mapped) {
                    return res.status(mapped.statusCode).json(mapped.body)
                }
                throw error
            } finally {
                await releaseAdvisoryLock(KnexClient.getInstance(), lockKey)
            }

            let structureVersion = CURRENT_STRUCTURE_VERSION
            let templateVersionId: string | null = plan.targetTemplateVersionId ?? null
            let latestMigrations: Array<{
                id: string
                name: string
                appliedAt: string
                fromVersion: number
                toVersion: number
                meta: ReturnType<typeof parseMetahubMigrationMeta>
            }> = []
            let postApplyReadWarning: string | null = null

            try {
                const [refreshedBranch, refreshedMetahub] = await Promise.all([
                    manager.getRepository(MetahubBranch).findOne({ where: { id: branch.id, metahubId } }),
                    manager.getRepository(Metahub).findOneBy({ id: metahub.id })
                ])
                structureVersion = refreshedBranch?.structureVersion ?? CURRENT_STRUCTURE_VERSION
                templateVersionId = refreshedMetahub?.templateVersionId ?? null

                const knex = KnexClient.getInstance()
                const hasMigrationTable = await knex.schema.withSchema(branch.schemaName).hasTable('_mhb_migrations')
                const latest = hasMigrationTable
                    ? await knex
                          .withSchema(branch.schemaName)
                          .from('_mhb_migrations')
                          .select('id', 'name', 'applied_at', 'from_version', 'to_version', 'meta')
                          .orderBy('applied_at', 'desc')
                          .limit(10)
                    : []

                latestMigrations = latest.map((row) => ({
                    id: row.id,
                    name: row.name,
                    appliedAt: new Date(row.applied_at).toISOString(),
                    fromVersion: row.from_version,
                    toVersion: row.to_version,
                    meta: parseMetahubMigrationMeta(row.meta)
                }))
            } catch (error) {
                postApplyReadWarning =
                    'Migrations were applied, but follow-up state refresh failed. Reload migration status to verify final state.'
                console.warn('[metahub:migrations] post-apply state refresh failed', {
                    metahubId,
                    branchId: branch.id,
                    error: safeErrorMessage(error)
                })
            }

            return res.json({
                status: 'applied',
                plan,
                branchId: branch.id,
                schemaName: branch.schemaName,
                structureVersion,
                templateVersionId,
                cleanupMode: parsed.data.cleanupMode,
                cleanup: cleanupResult,
                latestMigrations,
                postApplyReadWarning
            })
        })
    )

    return router
}
