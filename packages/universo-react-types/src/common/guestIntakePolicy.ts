import { z } from 'zod'

/** Public, non-sensitive guest intake controls shared by the API and app template. */
export const guestIntakePolicySchema = z
    .object({
        showFirstName: z.boolean(),
        requireFirstName: z.boolean(),
        showLastName: z.boolean(),
        requireLastName: z.boolean(),
        showEmail: z.boolean(),
        requireEmail: z.boolean(),
        showPhone: z.boolean(),
        requirePhone: z.boolean(),
        captchaEnabled: z.boolean()
    })
    .strict()
    .superRefine((policy, ctx) => {
        for (const field of ['FirstName', 'LastName', 'Email', 'Phone'] as const) {
            if (policy[`require${field}`] && !policy[`show${field}`]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [`require${field}`],
                    message: `A required ${field.toLowerCase()} field must be visible`
                })
            }
        }

        if (![policy.showFirstName, policy.showLastName, policy.showEmail, policy.showPhone].some(Boolean)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['showFirstName'],
                message: 'At least one guest identity field must be visible'
            })
        }
    })

export type GuestIntakePolicy = z.infer<typeof guestIntakePolicySchema>

export const DEFAULT_GUEST_INTAKE_POLICY: GuestIntakePolicy = {
    showFirstName: true,
    requireFirstName: true,
    showLastName: true,
    requireLastName: true,
    showEmail: false,
    requireEmail: false,
    showPhone: false,
    requirePhone: false,
    captchaEnabled: false
}
