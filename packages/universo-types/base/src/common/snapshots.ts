import { z } from 'zod'

/** Zod schema for snapshot transport envelope — used by both backend and frontend */
export const MetahubSnapshotTransportEnvelopeSchema = z.object({
    kind: z.literal('metahub_snapshot_bundle'),
    bundleVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    sourceInstance: z.string().optional(),
    metahub: z.object({
        id: z.string().uuid(),
        name: z.record(z.unknown()),
        description: z.record(z.unknown()).optional(),
        codename: z.record(z.unknown()),
        slug: z.string().optional()
    }),
    publication: z
        .object({
            id: z.string().uuid(),
            name: z.record(z.unknown()),
            versionId: z.string().uuid(),
            versionNumber: z.number().int().positive()
        })
        .optional(),
    /** Structural snapshot validation — requires version, metahubId, entities at minimum.
     *  passthrough() preserves all fields for round-trip fidelity; hash integrity guards against injection. */
    snapshot: z
        .object({
            version: z.union([z.number().int().positive(), z.string()]),
            metahubId: z.string().uuid(),
            entities: z.record(z.unknown()),
            entityTypeDefinitions: z.record(z.unknown()).optional(),
            fixedValues: z.record(z.unknown()).optional(),
            optionValues: z.record(z.unknown()).optional(),
            elements: z.record(z.unknown()).optional(),
            systemFields: z.record(z.unknown()).optional(),
            scripts: z.array(z.unknown()).optional(),
            layouts: z.array(z.unknown()).optional(),
            layoutZoneWidgets: z.array(z.unknown()).optional(),
            defaultLayoutId: z.string().uuid().nullable().optional(),
            layoutConfig: z.record(z.unknown()).optional()
        })
        .passthrough(),
    snapshotHash: z.string().min(64).max(64)
})

export type MetahubSnapshotTransportEnvelope = z.infer<typeof MetahubSnapshotTransportEnvelopeSchema>

/** Constraints for import validation */
export const SNAPSHOT_BUNDLE_CONSTRAINTS = {
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
    MAX_ENTITIES: 500,
    MAX_FIELDS_PER_ENTITY: 200,
    MAX_ELEMENTS_PER_ENTITY: 10_000,
    MAX_JSON_NESTING_DEPTH: 50
} as const
