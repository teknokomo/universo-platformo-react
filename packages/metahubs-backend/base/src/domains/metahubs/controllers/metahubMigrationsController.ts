import type { Request, Response } from 'express'
import { z } from 'zod'
import { ensureMetahubAccess, type RolePermission } from '../../shared/guards'
import { resolveUserId } from '../../shared/routeAuth'
import {
    findMetahubById,
    findMetahubForUpdate,
    findBranchByIdAndMetahub,
    findMetahubMembership,
    findTemplateById,
    findTemplateVersionById,
    type SqlQueryable,
    type MetahubRow,
    type MetahubBranchRow
} from '../../../persistence'
import { getRequestDbExecutor, getRequestDbSession, type DbExecutor } from '../../../utils'
import { type MetahubMigrationStatusResponse, type MetahubTemplateManifest, type StructuredBlocker } from '@universo/types'
import { determineSeverity } from '@universo/migration-guard-shared/utils'
import { CURRENT_STRUCTURE_VERSION, semverToStructureVersion, structureVersionToSemver } from '../services/structureVersions'
import {
    uuidToLockKey,
    acquirePoolAdvisoryLock,
    releasePoolAdvisoryLock,
    hasPoolRuntimeHistoryTable,
    createPoolTemplateSeedCleanupService,
    createPoolTemplateSeedMigrator
} from '../../ddl'
import { getPoolExecutor, qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from '../services/MetahubSchemaService'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { SYSTEM_TABLE_VERSIONS } from '../services/systemTableDefinitions'
import { calculateSystemTableDiff } from '../services/systemTableDiff'
import type { SeedMigrationResult } from '../../templates/services/TemplateSeedMigrator'
import {
    TEMPLATE_CLEANUP_MODES,
    type TemplateCleanupMode,
    type TemplateSeedCleanupResult
} from '../../templates/services/TemplateSeedCleanupService'
import { parseMetahubMigrationMeta, type MetahubTemplateSeedMigrationCounts } from '../services/metahubMigrationMeta'
import {
    MetahubMigrationApplyLockTimeoutError,
    MetahubNotFoundError,
    MetahubPoolExhaustedError,
    MetahubValidationError,
    isKnexPoolTimeoutError,
    isMetahubDomainError
} from '../../shared/domainErrors'
import { createLogger } from '../../../utils/logger'

const log = createLogger('metahub:migrations')

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    branchId: z.string().uuid().optional()
})

const statusQuerySchema = z.object({
    branchId: z.string().uuid().optional(),
    targetTemplateVersionId: z.string().uuid().optional(),
    cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('confirm')
})

const planBodySchema = z
    .object({
        branchId: z.string().uuid().optional(),
        targetTemplateVersionId: z.string().uuid().optional(),
        cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('confirm')
    })
    .strict()

const applyBodySchema = z
    .object({
        branchId: z.string().uuid().optional(),
        dryRun: z.boolean().optional().default(false),
        targetTemplateVersionId: z.string().uuid().optional(),
        cleanupMode: z.enum(TEMPLATE_CLEANUP_MODES).default('confirm')
    })
    .strict()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BranchContext {
    metahub: MetahubRow
    branch: MetahubBranchRow
}

interface StructurePlanStep {
    fromVersion: string
    toVersion: string
    summary: string
    additive: string[]
    destructive: string[]
}

interface StructurePlan {
    steps: StructurePlanStep[]
    additive: string[]
    destructive: string[]
    blockers: StructuredBlocker[]
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
    minStructureVersion: string | null
    structureCompatible: boolean
    seedDryRun: (SeedMigrationResult & { hasChanges: boolean }) | null
    cleanup: TemplateSeedCleanupResult
    blockers: StructuredBlocker[]
}

interface MetahubMigrationPlanResponse {
    branchId: string
    schemaName: string
    currentStructureVersion: string
    targetStructureVersion: string
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

interface MappedRouteErrorPayload {
    statusCode: number
    body: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeStructureVersion = (value: string | number | null | undefined): number => semverToStructureVersion(value)

const zeroSeedCounts: MetahubTemplateSeedMigrationCounts = {
    layoutsAdded: 0,
    zoneWidgetsAdded: 0,
    settingsAdded: 0,
    entitiesAdded: 0,
    constantsAdded: 0,
    attributesAdded: 0,
    enumValuesAdded: 0,
    elementsAdded: 0
}

const safeErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error)
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

    const severity = determineSeverity({
        migrationRequired,
        isMandatory: plan.structureUpgradeRequired || blockers.length > 0
    })

    return {
        branchId: plan.branchId,
        schemaName: plan.schemaName,
        currentStructureVersion: plan.currentStructureVersion,
        targetStructureVersion: plan.targetStructureVersion,
        structureUpgradeRequired: plan.structureUpgradeRequired,
        templateUpgradeRequired: plan.templateUpgradeRequired,
        migrationRequired,
        severity,
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
    exec: SqlQueryable,
    metahubId: string,
    userId: string,
    requestedBranchId?: string
): Promise<BranchContext> {
    const metahub = await findMetahubById(exec, metahubId)
    if (!metahub) {
        throw new MetahubNotFoundError('Metahub', metahubId)
    }

    const membership = await findMetahubMembership(exec, metahubId, userId)
    const fallbackBranchId = requestedBranchId ?? membership?.activeBranchId ?? metahub.defaultBranchId ?? null
    if (!fallbackBranchId) {
        throw new MetahubValidationError('Default branch is not configured', { metahubId })
    }

    const branch = await findBranchByIdAndMetahub(exec, fallbackBranchId, metahubId)
    if (!branch) {
        throw new MetahubNotFoundError('Branch', fallbackBranchId)
    }

    return { metahub, branch }
}

async function resolveTemplateContext(
    exec: SqlQueryable,
    metahub: MetahubRow,
    branch: MetahubBranchRow,
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

    const template = await findTemplateById(exec, metahub.templateId)
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
        const currentVersion = await findTemplateVersionById(exec, currentTemplateVersionId)
        currentTemplateVersionLabel = currentVersion?.versionLabel ?? null
        if (currentVersion?.manifestJson) {
            try {
                currentManifest = validateTemplateManifest(currentVersion.manifestJson)
            } catch (error) {
                throw new MetahubValidationError(`Current template manifest is invalid: ${safeErrorMessage(error)}`, {
                    metahubId: metahub.id
                })
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

    const requested = await findTemplateVersionById(exec, targetTemplateVersionId)
    if (!requested || requested.templateId !== template.id) {
        throw new MetahubValidationError('Target template version is not linked to this metahub template', {
            targetTemplateVersionId,
            templateId: template.id
        })
    }

    let targetManifest: MetahubTemplateManifest | null = null
    if (requested.manifestJson) {
        try {
            targetManifest = validateTemplateManifest(requested.manifestJson)
        } catch (error) {
            throw new MetahubValidationError(`Target template manifest is invalid: ${safeErrorMessage(error)}`, { targetTemplateVersionId })
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
    const blockers: StructuredBlocker[] = []

    if (currentVersion >= targetVersion) {
        return { steps, additive, destructive, blockers }
    }

    for (let version = currentVersion; version < targetVersion; version++) {
        const fromDefs = SYSTEM_TABLE_VERSIONS.get(version)
        const toDefs = SYSTEM_TABLE_VERSIONS.get(version + 1)

        if (!fromDefs || !toDefs) {
            blockers.push({
                code: 'structure.missing_definitions',
                params: { from: structureVersionToSemver(version), to: structureVersionToSemver(version + 1) },
                message: `Missing structure definitions for version transition ${structureVersionToSemver(
                    version
                )} -> ${structureVersionToSemver(version + 1)}`
            })
            break
        }

        const diff = calculateSystemTableDiff(fromDefs, toDefs, version, version + 1)

        steps.push({
            fromVersion: structureVersionToSemver(version),
            toVersion: structureVersionToSemver(version + 1),
            summary: diff.summary,
            additive: diff.additive.map((change) => change.description),
            destructive: diff.destructive.map((change) => change.description)
        })

        additive.push(...diff.additive.map((change) => change.description))
        destructive.push(...diff.destructive.map((change) => change.description))
    }

    for (const desc of destructive) {
        blockers.push({
            code: 'structure.destructive_change',
            params: { description: desc },
            message: desc
        })
    }
    return { steps, additive, destructive, blockers }
}

async function buildTemplatePlan(
    schemaName: string,
    structureTargetVersion: number,
    templateContext: TemplateContext,
    cleanupMode: TemplateCleanupMode,
    skipSeedDryRun = false
): Promise<TemplatePlan> {
    const blockers: StructuredBlocker[] = []
    const targetManifest = templateContext.targetManifest
    const cleanupService = createPoolTemplateSeedCleanupService(schemaName)
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
    const requiredStructureVersion = semverToStructureVersion(minStructureVersion)
    const structureCompatible = requiredStructureVersion <= structureTargetVersion
    if (!structureCompatible) {
        blockers.push({
            code: 'template.structure_incompatible',
            params: { required: String(minStructureVersion), target: structureVersionToSemver(structureTargetVersion) },
            message: `Template requires structure version ${minStructureVersion}, but target structure version is ${structureVersionToSemver(
                structureTargetVersion
            )}`
        })
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
        const seedMigrator = createPoolTemplateSeedMigrator(schemaName)
        const dryRunResult = await seedMigrator.migrateSeed(targetManifest.seed, { dryRun: true })
        const hasChanges =
            dryRunResult.layoutsAdded > 0 ||
            dryRunResult.zoneWidgetsAdded > 0 ||
            dryRunResult.settingsAdded > 0 ||
            dryRunResult.entitiesAdded > 0 ||
            dryRunResult.constantsAdded > 0 ||
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
        blockers.push({
            code: 'template.seed_dry_run_failed',
            params: { error: safeErrorMessage(error) },
            message: `Template seed dry-run failed: ${safeErrorMessage(error)}`
        })
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
    exec: SqlQueryable,
    metahub: MetahubRow,
    branch: MetahubBranchRow,
    requestedTemplateVersionId?: string,
    cleanupMode: TemplateCleanupMode = 'confirm',
    options?: BuildMigrationPlanOptions
): Promise<MetahubMigrationPlanResponse> {
    const currentStructureVersion = normalizeStructureVersion(branch.structureVersion as string | number | undefined)
    const targetStructureVersion = CURRENT_STRUCTURE_VERSION
    const includeTemplateSeedDryRun = options?.includeTemplateSeedDryRun ?? true

    const structurePlan = buildStructurePlan(currentStructureVersion, targetStructureVersion)
    const templateContext = await resolveTemplateContext(exec, metahub, branch, requestedTemplateVersionId)
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
        currentStructureVersion: structureVersionToSemver(currentStructureVersion),
        targetStructureVersion: structureVersionToSemver(targetStructureVersion),
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

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createMetahubMigrationsController(getDbExecutor: () => DbExecutor) {
    const ensureAccess = async (req: Request, res: Response, permission?: RolePermission) => {
        const userId = resolveUserId(req)
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        const { metahubId } = req.params
        const exec = getRequestDbExecutor(req, getDbExecutor())
        const dbSession = getRequestDbSession(req)
        await ensureMetahubAccess(exec, userId, metahubId, permission, dbSession)
        return { userId, metahubId, exec }
    }

    const status = async (req: Request, res: Response) => {
        const parsed = statusQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
        }

        try {
            const ctx = await ensureAccess(req, res)
            if (!ctx) return
            const { userId, metahubId, exec } = ctx

            const { metahub, branch } = await resolveBranchContext(exec, metahubId, userId, parsed.data.branchId)
            const plan = await buildMigrationPlan(exec, metahub, branch, parsed.data.targetTemplateVersionId, parsed.data.cleanupMode, {
                includeTemplateSeedDryRun: false
            })
            return res.json(toMigrationStatus(plan))
        } catch (error) {
            const mapped = mapMigrationsRouteError(error, { metahubId: req.params.metahubId })
            if (mapped) {
                return res.status(mapped.statusCode).json(mapped.body)
            }
            return res.status(422).json({ error: safeErrorMessage(error) })
        }
    }

    const list = async (req: Request, res: Response) => {
        const parsed = listQuerySchema.safeParse(req.query)
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() })
        }

        try {
            const ctx = await ensureAccess(req, res)
            if (!ctx) return
            const { userId, metahubId, exec } = ctx

            const { branch } = await resolveBranchContext(exec, metahubId, userId, parsed.data.branchId)

            const hasMigrationTable = await hasPoolRuntimeHistoryTable(branch.schemaName, '_mhb_migrations')
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

            const poolExec = getPoolExecutor()
            const migrationsTable = qSchemaTable(branch.schemaName, '_mhb_migrations')

            const countRows = await poolExec.query<{ count: string }>(`SELECT count(*) AS count FROM ${migrationsTable}`, [])
            const total = Number(countRows[0]?.count ?? 0)

            const rows = await poolExec.query<{
                id: string
                name: string
                applied_at: string
                from_version: string | number
                to_version: string | number
                meta: unknown
            }>(
                `SELECT id, name, applied_at, from_version, to_version, meta
         FROM ${migrationsTable}
         ORDER BY applied_at DESC
         LIMIT $1 OFFSET $2`,
                [parsed.data.limit, parsed.data.offset]
            )

            return res.json({
                items: rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    appliedAt: new Date(row.applied_at).toISOString(),
                    fromVersion: structureVersionToSemver(row.from_version),
                    toVersion: structureVersionToSemver(row.to_version),
                    meta: parseMetahubMigrationMeta(row.meta)
                })),
                total,
                limit: parsed.data.limit,
                offset: parsed.data.offset,
                branchId: branch.id,
                schemaName: branch.schemaName
            })
        } catch (error) {
            const mapped = mapMigrationsRouteError(error, { metahubId: req.params.metahubId })
            if (mapped) {
                return res.status(mapped.statusCode).json(mapped.body)
            }
            throw error
        }
    }

    const plan = async (req: Request, res: Response) => {
        const parsed = planBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        try {
            const ctx = await ensureAccess(req, res, 'manageMetahub')
            if (!ctx) return
            const { userId, metahubId, exec } = ctx

            const { metahub, branch } = await resolveBranchContext(exec, metahubId, userId, parsed.data.branchId)
            const migrationPlan = await buildMigrationPlan(
                exec,
                metahub,
                branch,
                parsed.data.targetTemplateVersionId,
                parsed.data.cleanupMode
            )
            return res.json(migrationPlan)
        } catch (error) {
            const mapped = mapMigrationsRouteError(error, { metahubId: req.params.metahubId })
            if (mapped) {
                return res.status(mapped.statusCode).json(mapped.body)
            }
            return res.status(422).json({ error: safeErrorMessage(error) })
        }
    }

    const apply = async (req: Request, res: Response) => {
        const ctx = await ensureAccess(req, res, 'manageMetahub')
        if (!ctx) return
        const { userId, metahubId, exec } = ctx

        const parsed = applyBodySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
        }

        let metahub: MetahubRow | null = null
        let branch: MetahubBranchRow | null = null
        let migrationPlan: MetahubMigrationPlanResponse
        try {
            const context = await resolveBranchContext(exec, metahubId, userId, parsed.data.branchId)
            metahub = context.metahub
            branch = context.branch
            migrationPlan = await buildMigrationPlan(exec, metahub, branch, parsed.data.targetTemplateVersionId, parsed.data.cleanupMode)
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
                plan: migrationPlan
            })
        }

        const blockers: StructuredBlocker[] = [...migrationPlan.structurePlan.blockers, ...migrationPlan.templatePlan.blockers]
        if (parsed.data.cleanupMode === 'dry_run' && migrationPlan.templatePlan.cleanup.hasChanges) {
            blockers.push({
                code: 'template.cleanup_dry_run',
                params: {},
                message: 'Template cleanup mode "dry_run" cannot apply destructive cleanup. Use cleanupMode="confirm".'
            })
        }
        if (blockers.length > 0) {
            return res.status(422).json({
                error: 'Migration contains blockers and cannot be applied automatically',
                blockers,
                plan: migrationPlan
            })
        }

        let manifestOverride: MetahubTemplateManifest | undefined
        if (migrationPlan.templateUpgradeRequired && migrationPlan.targetTemplateVersionId) {
            const version = await findTemplateVersionById(exec, migrationPlan.targetTemplateVersionId)
            if (!version?.manifestJson) {
                return res.status(422).json({
                    error: 'Target template manifest is not available',
                    plan: migrationPlan
                })
            }
            try {
                manifestOverride = validateTemplateManifest(version.manifestJson)
            } catch (error) {
                return res.status(422).json({
                    error: `Target template manifest is invalid: ${safeErrorMessage(error)}`,
                    plan: migrationPlan
                })
            }
        }

        const lockKey = uuidToLockKey(`metahub-migration-apply:${branch.id}`)
        const lockAcquired = await acquirePoolAdvisoryLock(lockKey)
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
                        plan: migrationPlan
                    }
                }
            }
            if (isKnexPoolTimeoutError(error)) {
                const mapped = new MetahubPoolExhaustedError('Database connection pool is exhausted during migration apply', {
                    metahubId,
                    branchId: branch!.id
                })
                return {
                    statusCode: mapped.statusCode,
                    body: {
                        error: mapped.message,
                        code: mapped.code,
                        details: mapped.details ?? null,
                        plan: migrationPlan
                    }
                }
            }
            return null
        }

        let cleanupResult: TemplateSeedCleanupResult | null = null
        try {
            const schemaService = new MetahubSchemaService(exec, branch.id)
            await schemaService.ensureSchema(metahubId, userId, {
                mode: 'apply_migrations',
                manifestOverride,
                templateVersionId: migrationPlan.targetTemplateVersionId,
                templateVersionLabel: migrationPlan.targetTemplateVersionLabel
            })

            if (parsed.data.cleanupMode === 'confirm') {
                const templateContext = await resolveTemplateContext(exec, metahub, branch, parsed.data.targetTemplateVersionId)
                const cleanupService = createPoolTemplateSeedCleanupService(branch.schemaName)
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
                        plan: migrationPlan
                    })
                }
            }

            const refreshedBranchAfterSync = await findBranchByIdAndMetahub(exec, branch.id, metahubId)
            if (!refreshedBranchAfterSync) {
                return res.status(404).json({
                    error: 'Branch not found after migration apply',
                    plan: migrationPlan
                })
            }

            if (migrationPlan.templateUpgradeRequired && migrationPlan.targetTemplateVersionId) {
                const branchTemplateSynced = refreshedBranchAfterSync.lastTemplateVersionId === migrationPlan.targetTemplateVersionId
                if (!branchTemplateSynced) {
                    return res.status(409).json({
                        error: 'Template migration is not confirmed on branch state. Please retry migration.',
                        code: 'TEMPLATE_SYNC_NOT_CONFIRMED',
                        branchTemplateVersionId: refreshedBranchAfterSync.lastTemplateVersionId ?? null,
                        targetTemplateVersionId: migrationPlan.targetTemplateVersionId,
                        plan: migrationPlan
                    })
                }

                await exec.transaction(async (tx) => {
                    const locked = await findMetahubForUpdate(tx, metahub!.id)
                    if (!locked) {
                        throw new MetahubNotFoundError('Metahub', metahub!.id)
                    }
                    await tx.query(
                        `UPDATE metahubs.cat_metahubs
             SET template_version_id = $1,
                 _upl_updated_by = $2,
                 _upl_updated_at = NOW()
             WHERE id = $3`,
                        [migrationPlan.targetTemplateVersionId, userId, metahub!.id]
                    )
                })
            }
        } catch (error) {
            const mapped = toDomainPayload(error)
            if (mapped) {
                return res.status(mapped.statusCode).json(mapped.body)
            }
            throw error
        } finally {
            await releasePoolAdvisoryLock(lockKey)
        }

        let structureVersion: string | number = structureVersionToSemver(CURRENT_STRUCTURE_VERSION)
        let templateVersionId: string | null = migrationPlan.targetTemplateVersionId ?? null
        let latestMigrations: Array<{
            id: string
            name: string
            appliedAt: string
            fromVersion: string
            toVersion: string
            meta: ReturnType<typeof parseMetahubMigrationMeta>
        }> = []
        let postApplyReadWarning: string | null = null

        try {
            const [refreshedBranch, refreshedMetahub] = await Promise.all([
                findBranchByIdAndMetahub(exec, branch.id, metahubId),
                findMetahubById(exec, metahub.id)
            ])
            structureVersion = refreshedBranch?.structureVersion ?? structureVersionToSemver(CURRENT_STRUCTURE_VERSION)
            templateVersionId = refreshedMetahub?.templateVersionId ?? null

            const hasMigrationTable = await hasPoolRuntimeHistoryTable(branch.schemaName, '_mhb_migrations')
            const latest = hasMigrationTable
                ? await getPoolExecutor().query<{
                      id: string
                      name: string
                      applied_at: string
                      from_version: string | number
                      to_version: string | number
                      meta: unknown
                  }>(
                      `SELECT id, name, applied_at, from_version, to_version, meta
             FROM ${qSchemaTable(branch.schemaName, '_mhb_migrations')}
             ORDER BY applied_at DESC
             LIMIT 10`,
                      []
                  )
                : []

            latestMigrations = latest.map((row) => ({
                id: row.id,
                name: row.name,
                appliedAt: new Date(row.applied_at).toISOString(),
                fromVersion: structureVersionToSemver(row.from_version),
                toVersion: structureVersionToSemver(row.to_version),
                meta: parseMetahubMigrationMeta(row.meta)
            }))
        } catch (error) {
            postApplyReadWarning =
                'Migrations were applied, but follow-up state refresh failed. Reload migration status to verify final state.'
            log.warn('post-apply state refresh failed', {
                metahubId,
                branchId: branch.id,
                error: safeErrorMessage(error)
            })
        }

        return res.json({
            status: 'applied',
            plan: migrationPlan,
            branchId: branch.id,
            schemaName: branch.schemaName,
            structureVersion: structureVersionToSemver(structureVersion),
            templateVersionId,
            cleanupMode: parsed.data.cleanupMode,
            cleanup: cleanupResult,
            latestMigrations,
            postApplyReadWarning
        })
    }

    return { status, list, plan, apply }
}
