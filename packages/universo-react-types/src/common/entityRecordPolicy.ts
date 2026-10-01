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

export const entityRecordPolicyCoRequiredGroupsSchema = z
    .array(z.array(policyCodenameSchema).min(2).max(32))
    .max(16)
    .superRefine((groups, context) => {
        const allFields = new Set<string>()
        const identities = new Set<string>()
        groups.forEach((group, groupIndex) => {
            if (new Set(group).size !== group.length) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [groupIndex],
                    message: 'Co-required Component codenames must be unique within each group.'
                })
            }
            const identity = [...group].sort().join('\u0000')
            if (identities.has(identity)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [groupIndex],
                    message: 'Co-required Component groups must be unique.'
                })
            }
            identities.add(identity)
            for (const field of group) {
                if (allFields.has(field)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [groupIndex],
                        message: 'A Component can belong to only one co-required group.'
                    })
                }
                allFields.add(field)
            }
        })
    })

const entityRecordPolicyConditionValueSchema = z.union([z.string().max(256), z.number().finite(), z.boolean()])

export const entityRecordPolicyConditionalRequiredSchema = z
    .array(
        z
            .object({
                componentCodename: policyCodenameSchema,
                when: z
                    .object({
                        componentCodename: policyCodenameSchema,
                        equals: entityRecordPolicyConditionValueSchema
                    })
                    .strict()
            })
            .strict()
    )
    .max(32)
    .superRefine((rules, context) => {
        const targets = new Set<string>()
        rules.forEach((rule, index) => {
            if (rule.componentCodename === rule.when.componentCodename) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'when', 'componentCodename'],
                    message: 'A condition cannot depend on the Component it makes required.'
                })
            }
            if (targets.has(rule.componentCodename)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'componentCodename'],
                    message: 'A Component can have only one conditional required rule.'
                })
            }
            targets.add(rule.componentCodename)
        })
    })

export type EntityRecordPolicyConditionalRequired = z.infer<typeof entityRecordPolicyConditionalRequiredSchema>[number]

/** Compare conditional rules independently of their declaration order. */
export const sameEntityRecordPolicyConditionalRequired = (
    left: readonly EntityRecordPolicyConditionalRequired[] | undefined,
    right: readonly EntityRecordPolicyConditionalRequired[] | undefined
): boolean => {
    const normalize = (rules: readonly EntityRecordPolicyConditionalRequired[] | undefined): string[] =>
        (rules ?? []).map(({ componentCodename, when }) => JSON.stringify([componentCodename, when.componentCodename, when.equals])).sort()
    const normalizedLeft = normalize(left)
    const normalizedRight = normalize(right)
    return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((rule, index) => rule === normalizedRight[index])
}

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
        coRequiredGroups: entityRecordPolicyCoRequiredGroupsSchema.optional(),
        conditionalRequired: entityRecordPolicyConditionalRequiredSchema.optional()
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
