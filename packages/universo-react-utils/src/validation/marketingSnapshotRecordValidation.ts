import { z } from 'zod'

import {
    marketingActionSchema,
    marketingMediaReferenceSchema as marketingMediaResourceSchema,
    publicMarketingMediaSchema,
    type EntityRecordPolicyConditionalRequired,
    type WidgetBindingComponentRequirement
} from '@universo-react/types'

import { isUuidV7 } from '../uuid'
import { toLocalizedStringMap } from '../vlc'
import { isSafeMarketingActionHref } from './marketingPage'

type InvalidRecordComponent = {
    readonly recordIndex: number
    readonly componentCodename: string
}

const marketingMediaReferenceRecordSchema = z.unknown().superRefine((value, context) => {
    const media = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
    const rawResource = media && Object.hasOwn(media, 'resource') ? media.resource : value
    const parsedResource = marketingMediaResourceSchema.safeParse(rawResource)
    if (!parsedResource.success) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Marketing media must use a URL resource.' })
        return
    }

    const publicMedia = publicMarketingMediaSchema.safeParse({
        kind: 'feature',
        resource: parsedResource.data,
        decorative: true,
        ...(media?.width === undefined ? {} : { width: media.width }),
        ...(media?.height === undefined ? {} : { height: media.height })
    })
    if (!publicMedia.success) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Marketing media does not match the public media contract.' })
    }
})

const supportedFormats: Readonly<Record<string, z.ZodTypeAny>> = {
    marketingAction: marketingActionSchema,
    marketingMediaReference: marketingMediaReferenceRecordSchema
}

const createStringSchema = (requirement: WidgetBindingComponentRequirement): z.ZodString | undefined => {
    let schema = requirement.required ? z.string().trim().min(1) : z.string()
    if (requirement.maxLength !== undefined) schema = schema.max(requirement.maxLength)
    if (requirement.pattern !== undefined) {
        try {
            schema = schema.regex(new RegExp(requirement.pattern, 'u'))
        } catch {
            return undefined
        }
    }
    return schema
}

const createComponentValueSchema = (
    requirement: WidgetBindingComponentRequirement,
    requiredLocales: readonly string[]
): z.ZodTypeAny | undefined => {
    if (requirement.localized) {
        if (requirement.valueType !== 'string') return undefined
        const stringSchema = createStringSchema(requirement)
        if (!stringSchema) return undefined

        return z.unknown().superRefine((value, context) => {
            const localized = toLocalizedStringMap(value)
            if (!localized) {
                context.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected localized string content.' })
                return
            }

            const parsed = z.record(z.string(), stringSchema).safeParse(localized)
            if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: issue.path,
                        message: 'Localized string content does not match its Component contract.'
                    })
                }
                return
            }

            const hasAuthoredContent = Object.values(parsed.data).some((text) => text.trim().length > 0)
            for (const locale of requiredLocales) {
                if ((requirement.required || hasAuthoredContent) && !parsed.data[locale]?.trim()) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [locale],
                        message: 'Required localized content is missing.'
                    })
                }
            }

            if (requirement.required && !Object.values(parsed.data).some((text) => text.trim().length > 0)) {
                context.addIssue({ code: z.ZodIssueCode.custom, message: 'Required localized content is empty.' })
            }
        })
    }

    if (requirement.format !== undefined) {
        if (requirement.format === 'marketingHref') {
            if (requirement.valueType !== 'string') return undefined
            return createStringSchema(requirement)?.refine(isSafeMarketingActionHref, 'Expected a safe Marketing link.')
        }
        if (requirement.valueType !== 'json') return undefined
        return supportedFormats[requirement.format]
    }

    switch (requirement.valueType) {
        case 'string':
            return createStringSchema(requirement)
        case 'number':
            return z.number().finite()
        case 'boolean':
            return z.boolean()
        case 'ref':
            return z.string().uuid().refine(isUuidV7, 'Expected a UUID v7 reference.')
        case 'json':
            return z.unknown()
    }
}

/** Validate the persisted values that a registered binding can expose at runtime. */
export const findInvalidWidgetBindingRecordComponent = (
    records: readonly unknown[],
    requirements: readonly WidgetBindingComponentRequirement[],
    requiredLocales: readonly string[] = [],
    coRequiredGroups: readonly (readonly string[])[] = [],
    conditionalRequired: readonly EntityRecordPolicyConditionalRequired[] = []
): InvalidRecordComponent | undefined => {
    const unsupported = requirements.find((requirement) => !createComponentValueSchema(requirement, requiredLocales))
    if (unsupported) return { recordIndex: 0, componentCodename: unsupported.componentCodename }

    for (const [recordIndex, record] of records.entries()) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            return { recordIndex, componentCodename: requirements[0]?.componentCodename ?? 'data' }
        }
        const data = (record as Record<string, unknown>).data
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return { recordIndex, componentCodename: requirements[0]?.componentCodename ?? 'data' }
        }

        const values = data as Record<string, unknown>
        const groupRequiredFields = new Set<string>()
        const conditionallyRequiredFields = new Set<string>()
        for (const group of coRequiredGroups) {
            const present = group.filter((codename) => {
                const requirement = requirements.find((candidate) => candidate.componentCodename === codename)
                const value = values[codename]
                if (value === undefined || value === null || value === '') return false
                if (!requirement?.localized) return true
                const localized = toLocalizedStringMap(value)
                return Boolean(localized && Object.values(localized).some((text) => text.trim().length > 0))
            })
            if (present.length > 0 && present.length !== group.length) {
                return { recordIndex, componentCodename: group.find((codename) => !present.includes(codename)) ?? group[0] ?? 'data' }
            }
            if (present.length > 0) group.forEach((codename) => groupRequiredFields.add(codename))
        }

        for (const rule of conditionalRequired) {
            const target = requirements.find((requirement) => requirement.componentCodename === rule.componentCodename)
            const condition = requirements.find((requirement) => requirement.componentCodename === rule.when.componentCodename)
            if (!target || target.required || !condition || condition.localized) {
                return { recordIndex, componentCodename: rule.componentCodename }
            }
            if (values[rule.when.componentCodename] === rule.when.equals) conditionallyRequiredFields.add(rule.componentCodename)
        }

        const validators = requirements.map((requirement) => {
            const effectiveRequirement =
                groupRequiredFields.has(requirement.componentCodename) || conditionallyRequiredFields.has(requirement.componentCodename)
                    ? { ...requirement, required: true }
                    : requirement
            return {
                componentCodename: requirement.componentCodename,
                required: effectiveRequirement.required,
                schema: createComponentValueSchema(effectiveRequirement, requiredLocales)
            }
        })
        const unsupported = validators.find(({ schema }) => !schema)
        if (unsupported) return { recordIndex, componentCodename: unsupported.componentCodename }

        for (const validator of validators) {
            const value = values[validator.componentCodename]
            if (value === undefined || value === null) {
                if (validator.required) return { recordIndex, componentCodename: validator.componentCodename }
                continue
            }
            if (!validator.schema?.safeParse(value).success) {
                return { recordIndex, componentCodename: validator.componentCodename }
            }
        }
    }

    return undefined
}
