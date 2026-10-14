import { DEFAULT_GUEST_INTAKE_POLICY, guestIntakePolicySchema } from '@universo-react/types'
import { selectVisibleGuestIdentityFields } from '../../controllers/runtimeGuest/guestSessionIntake'

describe('guest intake field policy', () => {
    it('requires at least one visible identity field and prevents required hidden fields', () => {
        expect(
            guestIntakePolicySchema.safeParse({
                ...DEFAULT_GUEST_INTAKE_POLICY,
                showFirstName: false,
                requireFirstName: false,
                showLastName: false,
                requireLastName: false,
                showEmail: true
            }).success
        ).toBe(true)

        expect(
            guestIntakePolicySchema.safeParse({
                ...DEFAULT_GUEST_INTAKE_POLICY,
                showFirstName: false,
                requireFirstName: true
            }).success
        ).toBe(false)

        expect(
            guestIntakePolicySchema.safeParse({
                ...DEFAULT_GUEST_INTAKE_POLICY,
                showFirstName: false,
                requireFirstName: false,
                showLastName: false,
                requireLastName: false,
                showEmail: false,
                showPhone: false
            }).success
        ).toBe(false)
    })

    it('stores only visible optional values and drops blank or hidden fields', () => {
        const policy = guestIntakePolicySchema.parse({
            ...DEFAULT_GUEST_INTAKE_POLICY,
            showFirstName: false,
            requireFirstName: false,
            showLastName: false,
            requireLastName: false,
            showEmail: true
        })

        expect(
            selectVisibleGuestIdentityFields({ firstName: 'Hidden', lastName: 'Value', email: 'learner@example.test', phone: '' }, policy)
        ).toEqual({ firstName: undefined, lastName: undefined, email: 'learner@example.test', phone: undefined })
    })
})
