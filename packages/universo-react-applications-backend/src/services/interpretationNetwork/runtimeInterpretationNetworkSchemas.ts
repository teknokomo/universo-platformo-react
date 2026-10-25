import { Buffer } from 'node:buffer'
import { LocalizedStringAllowEmptySchema, LocalizedStringSchema, uuidV7Schema } from '@universo-react/types'
import { ensureVLC } from '@universo-react/utils'
import { z } from 'zod'

export const MAX_MATERIAL_BODY_BYTES = 256 * 1024

/** Measure string Body values directly and structured Body values as JSON UTF-8 bytes. */
export const getMaterialBodyByteLength = (value: unknown): number | null => {
    try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value)
        return typeof serialized === 'string' ? Buffer.byteLength(serialized, 'utf8') : null
    } catch {
        return null
    }
}

const materialDataSchema = z.record(z.unknown()).superRefine((data, context) => {
    for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase() !== 'body') continue
        const byteLength = getMaterialBodyByteLength(value)
        if (byteLength !== null && byteLength <= MAX_MATERIAL_BODY_BYTES) continue
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `Material Body must not exceed ${MAX_MATERIAL_BODY_BYTES} UTF-8 bytes`
        })
    }
})

const localizedRequiredTextSchema = z.preprocess((value) => ensureVLC(value, 'en') ?? value, LocalizedStringSchema)
const localizedOptionalTextSchema = z.preprocess((value) => ensureVLC(value, 'en') ?? value, LocalizedStringAllowEmptySchema.optional())

export const interpretationNetworkEnsureSystemStructureRequestSchema = z.object({ locale: z.string().optional() }).strict()

export const interpretationNetworkStructureCreateRequestSchema = z
    .object({
        name: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateSaveRequestSchema = z
    .object({
        sourceStructureId: z.string().uuid(),
        templateName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        includeMaterials: z.boolean(),
        scope: z
            .discriminatedUnion('kind', [
                z.object({ kind: z.literal('wholeStructure') }).strict(),
                z.object({ kind: z.literal('selectedBranch'), rootCellId: uuidV7Schema }).strict()
            ])
            .default({ kind: 'wholeStructure' }),
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateUpdateRequestSchema = z
    .object({
        templateName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateDeleteRequestSchema = z
    .object({
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const interpretationNetworkTemplateInstantiateRequestSchema = z
    .object({
        structureName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkStructureDeleteRequestSchema = z
    .object({
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const interpretationNetworkStructureRouteParamsSchema = z
    .object({
        applicationId: z.string().min(1),
        structureId: z.string().uuid()
    })
    .strict()

export const interpretationNetworkMaterialCreateRequestSchema = z
    .object({
        interpretationId: z.string().uuid(),
        matrixRowId: z.string().uuid().optional(),
        cellId: z.string().trim().min(1).max(255).optional(),
        data: materialDataSchema,
        expectedVersion: z.number().int().positive().optional(),
        expectedCellVersion: z.number().int().positive().optional()
    })
    .strict()
    .superRefine((input, context) => {
        if (input.cellId === undefined) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['cellId'], message: 'Cell ID is required' })
        }
        if (
            input.expectedVersion !== undefined &&
            input.expectedCellVersion !== undefined &&
            input.expectedVersion !== input.expectedCellVersion
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expectedCellVersion'],
                message: 'Version aliases must match when both are provided'
            })
        }
    })
    .transform(({ expectedVersion, expectedCellVersion, ...input }) => ({
        ...input,
        cellId: input.cellId!,
        ...(expectedCellVersion === undefined && expectedVersion === undefined
            ? {}
            : { expectedCellVersion: expectedCellVersion ?? expectedVersion })
    }))

const interpretationNetworkMaterialContextSchema = z
    .object({
        interpretationId: uuidV7Schema,
        cellId: z.string().trim().min(1).max(255)
    })
    .strict()

export const interpretationNetworkMaterialUpdateRequestSchema = interpretationNetworkMaterialContextSchema
    .extend({
        data: materialDataSchema.refine((data) => Object.keys(data).length > 0),
        expectedCellVersion: z.number().int().positive(),
        expectedMaterialVersion: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkMaterialPrimaryRequestSchema = interpretationNetworkMaterialContextSchema
    .extend({
        materialId: uuidV7Schema.nullable(),
        expectedCellVersion: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkMaterialDeleteRequestSchema = interpretationNetworkMaterialContextSchema
    .extend({
        expectedCellVersion: z.number().int().positive(),
        expectedMaterialVersion: z.number().int().positive()
    })
    .strict()

const interpretationNetworkCellPlacementSchema = z
    .object({
        parentCellId: z.string().uuid().nullable().optional(),
        rowKey: z.string().trim().min(1).max(64).optional(),
        colKey: z.string().trim().min(1).max(64).optional(),
        sortOrder: z.number().int().nonnegative().max(2_147_483_647).optional()
    })
    .strict()

export const interpretationNetworkMatrixCellCreateRequestSchema = z
    .object({
        interpretationId: z.string().uuid(),
        data: z.record(z.unknown()),
        placement: interpretationNetworkCellPlacementSchema
    })
    .strict()

export const interpretationNetworkMatrixCellUpdateRequestSchema = z
    .object({
        interpretationId: uuidV7Schema,
        data: z.record(z.unknown()).refine((data) => Object.keys(data).length > 0),
        expectedCellVersion: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkMatrixCellDeleteRequestSchema = z
    .object({
        interpretationId: uuidV7Schema,
        expectedCellVersion: z.number().int().positive()
    })
    .strict()

export const interpretationNetworkMatrixCellsMoveRequestSchema = z
    .object({
        interpretationId: uuidV7Schema,
        updates: z
            .array(
                z
                    .object({
                        cellId: uuidV7Schema,
                        expectedVersion: z.number().int().positive(),
                        placement: interpretationNetworkCellPlacementSchema,
                        data: z.record(z.unknown()).optional()
                    })
                    .strict()
            )
            .min(1)
            .max(5000)
    })
    .strict()
