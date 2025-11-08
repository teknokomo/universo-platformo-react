import { describe, it, expect } from 'vitest'
import { memberFormSchema, emailSchema, roleSchema } from '../member'
import type { MemberFormData } from '../member'

describe('emailSchema', () => {
    it('should accept valid email addresses', () => {
        const validEmails = ['user@example.com', 'test.user@domain.co.uk', 'name+tag@company.org']

        validEmails.forEach((email) => {
            const result = emailSchema.safeParse(email)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toBe(email)
            }
        })
    })

    it('should reject empty email', () => {
        const result = emailSchema.safeParse('')

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.errors[0].message).toBe('Email is required')
        }
    })

    it('should reject whitespace-only email', () => {
        const result = emailSchema.safeParse('   ')

        expect(result.success).toBe(false)
        if (!result.success) {
            // Zod trims and validates as email, so whitespace fails email validation
            expect(result.error.errors[0].message).toBe('Invalid email address')
        }
    })

    it('should reject invalid email format', () => {
        const invalidEmails = ['not-an-email', '@example.com', 'user@', 'user..name@example.com', 'user @example.com']

        invalidEmails.forEach((email) => {
            const result = emailSchema.safeParse(email)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.errors[0].message).toBe('Invalid email address')
            }
        })
    })
})

describe('roleSchema', () => {
    it('should accept valid role values', () => {
        const validRoles = ['admin', 'editor', 'member']

        validRoles.forEach((role) => {
            const result = roleSchema.safeParse(role)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data).toBe(role)
            }
        })
    })

    it('should reject invalid role values', () => {
        const invalidRoles = ['owner', 'guest', 'moderator', '']

        invalidRoles.forEach((role) => {
            const result = roleSchema.safeParse(role)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.errors[0].message).toBe('Please select a valid role')
            }
        })
    })

    it('should reject non-string role values', () => {
        const invalidValues = [123, null, undefined, {}, []]

        invalidValues.forEach((value) => {
            const result = roleSchema.safeParse(value)
            expect(result.success).toBe(false)
        })
    })
})

describe('memberFormSchema', () => {
    it('should accept valid member form data', () => {
        const validData: MemberFormData = {
            email: 'user@example.com',
            role: 'editor',
            comment: 'Welcome to the team!'
        }

        const result = memberFormSchema.safeParse(validData)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(validData)
        }
    })

    it('should accept data without optional comment', () => {
        const validData = {
            email: 'admin@example.com',
            role: 'admin'
        }

        const result = memberFormSchema.safeParse(validData)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.email).toBe('admin@example.com')
            expect(result.data.role).toBe('admin')
            expect(result.data.comment).toBeUndefined()
        }
    })

    it('should accept empty string comment', () => {
        const validData = {
            email: 'user@example.com',
            role: 'member',
            comment: ''
        }

        const result = memberFormSchema.safeParse(validData)

        expect(result.success).toBe(true)
    })

    it('should reject data with invalid email', () => {
        const invalidData = {
            email: 'invalid-email',
            role: 'member'
        }

        const result = memberFormSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
        if (!result.success) {
            const emailError = result.error.errors.find((err) => err.path[0] === 'email')
            expect(emailError).toBeDefined()
            expect(emailError?.message).toBe('Invalid email address')
        }
    })

    it('should reject data with empty email', () => {
        const invalidData = {
            email: '',
            role: 'editor'
        }

        const result = memberFormSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
        if (!result.success) {
            const emailError = result.error.errors.find((err) => err.path[0] === 'email')
            expect(emailError?.message).toBe('Email is required')
        }
    })

    it('should reject data with invalid role', () => {
        const invalidData = {
            email: 'user@example.com',
            role: 'invalid-role'
        }

        const result = memberFormSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
        if (!result.success) {
            const roleError = result.error.errors.find((err) => err.path[0] === 'role')
            expect(roleError).toBeDefined()
            expect(roleError?.message).toBe('Please select a valid role')
        }
    })

    it('should reject data with missing required fields', () => {
        const invalidData = {
            comment: 'Only comment provided'
        }

        const result = memberFormSchema.safeParse(invalidData)

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.errors.length).toBeGreaterThanOrEqual(2)
            const emailError = result.error.errors.find((err) => err.path[0] === 'email')
            const roleError = result.error.errors.find((err) => err.path[0] === 'role')
            expect(emailError).toBeDefined()
            expect(roleError).toBeDefined()
        }
    })

    it('should validate type inference for MemberFormData', () => {
        const data: MemberFormData = {
            email: 'test@example.com',
            role: 'admin',
            comment: 'Test comment'
        }

        // Type check - this will fail at compile time if MemberFormData type is incorrect
        const email: string = data.email
        const role: 'admin' | 'editor' | 'member' = data.role
        const comment: string | undefined = data.comment

        expect(email).toBe('test@example.com')
        expect(role).toBe('admin')
        expect(comment).toBe('Test comment')
    })
})
