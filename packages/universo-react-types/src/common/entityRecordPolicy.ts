import { z } from 'zod'

const policyCodenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
const semanticKeyValueSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)

export const entityRecordPolicySchema = z
    .object({
        version: z.literal(1),
        semanticKey: z
            .object({
                componentCodename: policyCodenameSchema,
                creationPrefix: semanticKeyValueSchema,
                protectedValues: z.array(semanticKeyValueSchema).min(1).max(16)
            })
            .strict()
            .optional(),
        denyDeleteWhenBound: z.boolean(),
        immutableSemanticKeyWhenBound: z.boolean(),
        runtimeMutation: z.enum(['allow', 'deny']),
        requiredLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(8).optional(),
        validatorKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()
    .superRefine((policy, context) => {
        const protectedValues = policy.semanticKey?.protectedValues ?? []
        if (new Set(protectedValues).size !== protectedValues.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['semanticKey', 'protectedValues'],
                message: 'Protected semantic keys must be unique.'
            })
        }
        if (policy.immutableSemanticKeyWhenBound && !policy.semanticKey) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['semanticKey'],
                message: 'A semantic key definition is required for bound-key immutability.'
            })
        }
        if (policy.requiredLocales && new Set(policy.requiredLocales).size !== policy.requiredLocales.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['requiredLocales'],
                message: 'Required locales must be unique.'
            })
        }
    })
export type EntityRecordPolicy = z.infer<typeof entityRecordPolicySchema>

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

/** Read an optional policy from persisted Entity config; malformed policies fail closed. */
export const resolveEntityRecordPolicy = (config: unknown): EntityRecordPolicy | undefined => {
    if (!isRecord(config) || !Object.hasOwn(config, 'recordPolicy')) return undefined
    return entityRecordPolicySchema.parse(config.recordPolicy)
}
