import { guestIntakePolicySchema } from '@universo-react/types'
import { IDENTIFIER_REGEX } from '../shared/runtimeSqlIdentifiers'
import { resolveRuntimeCodenameText } from '../shared/runtimeCodenameText'

export const RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID = 'RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID'

export const ACCESS_LINK_INTAKE_POLICY_ERROR = 'Show at least one guest identity field and make every required field visible.'

export type AccessLinkIntakeFieldMetadata = {
    codename: unknown
    columnName: string
    dataType: string
    defaultValue?: unknown
}

export type AccessLinkIntakePolicyResolution =
    | { valid: true; valuesByColumn: Record<string, boolean> }
    | { valid: false; code: typeof RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID; error: typeof ACCESS_LINK_INTAKE_POLICY_ERROR }

const POLICY_FIELDS = [
    { codename: 'ShowFirstName', policyKey: 'showFirstName' },
    { codename: 'RequireFirstName', policyKey: 'requireFirstName' },
    { codename: 'ShowLastName', policyKey: 'showLastName' },
    { codename: 'RequireLastName', policyKey: 'requireLastName' },
    { codename: 'ShowEmail', policyKey: 'showEmail' },
    { codename: 'RequireEmail', policyKey: 'requireEmail' },
    { codename: 'ShowPhone', policyKey: 'showPhone' },
    { codename: 'RequirePhone', policyKey: 'requirePhone' },
    { codename: 'CaptchaEnabled', policyKey: 'captchaEnabled' }
] as const

const invalidPolicy = (): AccessLinkIntakePolicyResolution => ({
    valid: false,
    code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID,
    error: ACCESS_LINK_INTAKE_POLICY_ERROR
})

const normalizeAccessLinkCodename = (value: unknown): string => resolveRuntimeCodenameText(value).trim().toLowerCase()

export const resolveAccessLinkIntakePolicy = (input: {
    objectCodename: string
    fields: AccessLinkIntakeFieldMetadata[]
    row: Record<string, unknown>
    applyDefaults?: boolean
}): AccessLinkIntakePolicyResolution => {
    if (typeof input.objectCodename !== 'string' || input.objectCodename.trim().toLowerCase() !== 'accesslinks') {
        return { valid: true, valuesByColumn: {} }
    }

    const policy: Record<string, boolean> = {}
    const valuesByColumn: Record<string, boolean> = {}

    for (const policyField of POLICY_FIELDS) {
        const field = input.fields.find(
            (candidate) => normalizeAccessLinkCodename(candidate.codename) === policyField.codename.toLowerCase()
        )
        if (!field || field.dataType !== 'BOOLEAN' || !IDENTIFIER_REGEX.test(field.columnName)) return invalidPolicy()

        const hasColumnValue = Object.prototype.hasOwnProperty.call(input.row, field.columnName)
        const hasCodenameValue = Object.prototype.hasOwnProperty.call(input.row, policyField.codename)
        let value = hasColumnValue
            ? input.row[field.columnName]
            : hasCodenameValue
            ? input.row[policyField.codename]
            : input.applyDefaults === true
            ? field.defaultValue
            : undefined

        // Runtime public-link reads interpret nullable booleans as disabled.
        // Keep this normalization consistent while applying metadata defaults
        // only when a caller omitted the field entirely.
        if (value === undefined || value === null) value = false
        if (typeof value !== 'boolean') return invalidPolicy()

        policy[policyField.policyKey] = value
        valuesByColumn[field.columnName] = value
    }

    if (!guestIntakePolicySchema.safeParse(policy).success) return invalidPolicy()

    return { valid: true, valuesByColumn }
}
