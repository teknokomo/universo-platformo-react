import { z } from 'zod'
import { serialization } from '@universo/utils'
import type { SystemStructureSnapshot } from './systemTableDefinitions'

const systemColumnSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['uuid', 'string', 'text', 'integer', 'boolean', 'jsonb', 'timestamptz']),
    length: z.number().int().positive().optional(),
    nullable: z.boolean().optional(),
    defaultTo: z.union([z.string(), z.number(), z.boolean()]).optional(),
    primary: z.boolean().optional(),
    index: z.boolean().optional()
})

const systemForeignKeySchema = z.object({
    column: z.string().min(1),
    referencesTable: z.string().min(1),
    referencesColumn: z.string().min(1),
    onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional()
})

const systemIndexSchema = z.object({
    name: z.string().min(1),
    columns: z.array(z.string().min(1)),
    unique: z.boolean().optional(),
    where: z.string().optional(),
    method: z.enum(['btree', 'gin']).optional()
})

export const systemStructureSnapshotSchema = z.object({
    version: z.number().int().positive(),
    tables: z.array(
        z.object({
            name: z.string().min(1),
            columns: z.array(systemColumnSchema),
            indexes: z.array(systemIndexSchema),
            foreignKeys: z.array(systemForeignKeySchema),
            uniqueConstraints: z.array(z.array(z.string().min(1)))
        })
    )
})

const migrationCountsSchema = z.object({
    layoutsAdded: z.number().int().nonnegative(),
    zoneWidgetsAdded: z.number().int().nonnegative(),
    settingsAdded: z.number().int().nonnegative(),
    entitiesAdded: z.number().int().nonnegative(),
    attributesAdded: z.number().int().nonnegative(),
    enumValuesAdded: z.number().int().nonnegative().optional().default(0),
    elementsAdded: z.number().int().nonnegative()
})

const baselineMetaSchema = z.object({
    kind: z.literal('baseline'),
    createdAt: z.string().datetime(),
    templateVersionLabel: z.string().nullable().optional(),
    snapshotBefore: z.null(),
    snapshotAfter: systemStructureSnapshotSchema.nullable()
})

const structureMetaSchema = z.object({
    kind: z.literal('structure'),
    migratedAt: z.string().datetime(),
    applied: z.array(z.string()),
    skippedDestructive: z.array(z.string()),
    snapshotBefore: systemStructureSnapshotSchema.nullable(),
    snapshotAfter: systemStructureSnapshotSchema.nullable()
})

const templateSeedMetaSchema = z.object({
    kind: z.literal('template_seed'),
    appliedAt: z.string().datetime(),
    templateVersionId: z.string().uuid().nullable().optional(),
    templateVersionLabel: z.string().nullable().optional(),
    counts: migrationCountsSchema,
    skipped: z.array(z.string())
})

const manualDestructiveMetaSchema = z.object({
    kind: z.literal('manual_destructive'),
    appliedAt: z.string().datetime(),
    summary: z.string().min(1),
    confirmedBy: z.string().uuid().nullable().optional(),
    notes: z.array(z.string()).optional()
})

export const metahubMigrationMetaSchema = z.discriminatedUnion('kind', [
    baselineMetaSchema,
    structureMetaSchema,
    templateSeedMetaSchema,
    manualDestructiveMetaSchema
])

export type MetahubMigrationMeta = z.infer<typeof metahubMigrationMetaSchema>
export type MetahubTemplateSeedMigrationCounts = z.infer<typeof migrationCountsSchema>

export const buildBaselineMigrationMeta = (
    snapshotAfter: SystemStructureSnapshot | null,
    templateVersionLabel?: string | null
): MetahubMigrationMeta => ({
    kind: 'baseline',
    createdAt: new Date().toISOString(),
    templateVersionLabel: templateVersionLabel ?? null,
    snapshotBefore: null,
    snapshotAfter
})

export const buildStructureMigrationMeta = (params: {
    applied: string[]
    skippedDestructive: string[]
    snapshotBefore: SystemStructureSnapshot | null
    snapshotAfter: SystemStructureSnapshot | null
}): MetahubMigrationMeta => ({
    kind: 'structure',
    migratedAt: new Date().toISOString(),
    applied: params.applied,
    skippedDestructive: params.skippedDestructive,
    snapshotBefore: params.snapshotBefore,
    snapshotAfter: params.snapshotAfter
})

export const buildTemplateSeedMigrationMeta = (params: {
    counts: MetahubTemplateSeedMigrationCounts
    skipped: string[]
    templateVersionId?: string | null
    templateVersionLabel?: string | null
}): MetahubMigrationMeta => ({
    kind: 'template_seed',
    appliedAt: new Date().toISOString(),
    templateVersionId: params.templateVersionId ?? null,
    templateVersionLabel: params.templateVersionLabel ?? null,
    counts: params.counts,
    skipped: params.skipped
})

export const parseMetahubMigrationMeta = (meta: unknown): MetahubMigrationMeta | null => {
    const candidate =
        typeof meta === 'string'
            ? (() => {
                  const parsed = serialization.safeParseJson<unknown>(meta)
                  return parsed.ok ? parsed.value : null
              })()
            : meta

    if (!candidate || typeof candidate !== 'object') {
        return null
    }

    const parsed = metahubMigrationMetaSchema.safeParse(candidate)
    return parsed.success ? parsed.data : null
}
