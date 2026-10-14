import { DEFAULT_GUEST_INTAKE_POLICY } from '@universo-react/types'
import {
    resolveAccessLinkIntakePolicy,
    RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID,
    type AccessLinkIntakeFieldMetadata
} from '../../services/guestAccessLinkIntakePolicy'

const policyDefaultsByCodename = {
    ShowFirstName: DEFAULT_GUEST_INTAKE_POLICY.showFirstName,
    RequireFirstName: DEFAULT_GUEST_INTAKE_POLICY.requireFirstName,
    ShowLastName: DEFAULT_GUEST_INTAKE_POLICY.showLastName,
    RequireLastName: DEFAULT_GUEST_INTAKE_POLICY.requireLastName,
    ShowEmail: DEFAULT_GUEST_INTAKE_POLICY.showEmail,
    RequireEmail: DEFAULT_GUEST_INTAKE_POLICY.requireEmail,
    ShowPhone: DEFAULT_GUEST_INTAKE_POLICY.showPhone,
    RequirePhone: DEFAULT_GUEST_INTAKE_POLICY.requirePhone,
    CaptchaEnabled: DEFAULT_GUEST_INTAKE_POLICY.captchaEnabled
}
const policyCodenames = Object.keys(policyDefaultsByCodename)

const createFields = (defaults: Record<string, unknown> = {}): AccessLinkIntakeFieldMetadata[] =>
    policyCodenames.map((codename, index) => ({
        codename,
        columnName: `col_policy_${index}`,
        dataType: 'BOOLEAN',
        defaultValue: defaults[codename] ?? policyDefaultsByCodename[codename as keyof typeof policyDefaultsByCodename]
    }))

describe('resolveAccessLinkIntakePolicy', () => {
    it('applies valid metadata defaults when the snapshot omits configured intake fields', () => {
        const fields = createFields()

        expect(resolveAccessLinkIntakePolicy({ objectCodename: 'AccessLinks', fields, row: {}, applyDefaults: true })).toEqual({
            valid: true,
            valuesByColumn: {
                col_policy_0: true,
                col_policy_1: true,
                col_policy_2: true,
                col_policy_3: true,
                col_policy_4: false,
                col_policy_5: false,
                col_policy_6: false,
                col_policy_7: false,
                col_policy_8: false
            }
        })
    })

    it('rejects policies that hide required identity fields or all guest identity fields', () => {
        const fields = createFields()

        expect(
            resolveAccessLinkIntakePolicy({
                objectCodename: 'AccessLinks',
                fields,
                row: { ShowFirstName: false, RequireFirstName: true }
            })
        ).toMatchObject({ valid: false, code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID })
        expect(resolveAccessLinkIntakePolicy({ objectCodename: 'AccessLinks', fields, row: {} })).toMatchObject({
            valid: false,
            code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID
        })
    })

    it('rejects incomplete metadata and non-boolean policy values', () => {
        expect(resolveAccessLinkIntakePolicy({ objectCodename: 'AccessLinks', fields: createFields().slice(1), row: {} })).toMatchObject({
            valid: false,
            code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID
        })

        const fields = createFields()
        fields[0] = { ...fields[0]!, dataType: 'STRING' }
        expect(resolveAccessLinkIntakePolicy({ objectCodename: 'AccessLinks', fields, row: {} })).toMatchObject({
            valid: false,
            code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID
        })

        expect(
            resolveAccessLinkIntakePolicy({
                objectCodename: 'AccessLinks',
                fields: createFields(),
                row: { ShowFirstName: 'true', RequireFirstName: false, ShowLastName: true }
            })
        ).toMatchObject({ valid: false, code: RUNTIME_ACCESS_LINK_INTAKE_POLICY_INVALID })
    })

    it('treats nullable persisted flags as disabled and leaves unrelated objects untouched', () => {
        expect(
            resolveAccessLinkIntakePolicy({
                objectCodename: 'accesslinks',
                fields: createFields(),
                row: {
                    ShowFirstName: null,
                    ShowLastName: true,
                    RequireLastName: false
                }
            })
        ).toMatchObject({ valid: true })

        expect(resolveAccessLinkIntakePolicy({ objectCodename: 'Quizzes', fields: [], row: {} })).toEqual({
            valid: true,
            valuesByColumn: {}
        })
    })

    it('resolves policy field codenames stored as localized values in runtime metadata', () => {
        const localizedFields = createFields().map((field) => ({
            ...field,
            codename: {
                _primary: 'ru',
                locales: {
                    en: { content: String(field.codename) },
                    ru: { content: String(field.codename) }
                }
            }
        }))

        expect(
            resolveAccessLinkIntakePolicy({
                objectCodename: 'AccessLinks',
                fields: localizedFields,
                row: {
                    ShowFirstName: true,
                    RequireFirstName: true,
                    ShowLastName: true,
                    RequireLastName: true
                }
            })
        ).toMatchObject({ valid: true, valuesByColumn: { col_policy_0: true, col_policy_1: true, col_policy_2: true, col_policy_3: true } })
    })
})
