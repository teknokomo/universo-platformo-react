import { createLeadSchema } from '../leadsService'
import { describe, it, expect } from '@jest/globals'

describe('createLeadSchema', () => {
    describe('valid lead data', () => {
        it('should accept valid lead data with points', () => {
            const valid = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                name: 'Test User',
                email: 'test@example.com',
                points: 10
            }
            const result = createLeadSchema.parse(valid)
            expect(result.canvasId).toBe('019b584f-6d72-7553-899c-6cdb426fc3c1')
            expect(result.name).toBe('Test User')
            expect(result.email).toBe('test@example.com')
            expect(result.points).toBe(10)
        })

        it('should accept all optional fields', () => {
            const valid = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                chatId: '019b584f-test-chatid',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+1234567890',
                points: 25
            }
            const result = createLeadSchema.parse(valid)
            expect(result.chatId).toBe('019b584f-test-chatid')
            expect(result.phone).toBe('+1234567890')
        })
    })

    describe('optional canvasId handling', () => {
        it('should handle missing canvasId', () => {
            const withoutCanvas = {
                name: 'Test',
                points: 5
            }
            const result = createLeadSchema.parse(withoutCanvas)
            expect(result.canvasId).toBeUndefined()
            expect(result.name).toBe('Test')
            expect(result.points).toBe(5)
        })

        it('should transform empty string canvasId to undefined', () => {
            const emptyCanvas = {
                canvasId: '',
                name: 'Test',
                points: 3
            }
            const result = createLeadSchema.parse(emptyCanvas)
            expect(result.canvasId).toBeUndefined()
        })

        it('should reject invalid UUID format for canvasId', () => {
            const invalidUuid = {
                canvasId: 'not-a-valid-uuid',
                name: 'Test'
            }
            expect(() => createLeadSchema.parse(invalidUuid)).toThrow()
        })
    })

    describe('points field validation', () => {
        it('should default points to 0 when not provided', () => {
            const minimal = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1'
            }
            const result = createLeadSchema.parse(minimal)
            expect(result.points).toBe(0)
        })

        it('should accept zero points', () => {
            const zeroPoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: 0
            }
            const result = createLeadSchema.parse(zeroPoints)
            expect(result.points).toBe(0)
        })

        it('should accept positive integer points', () => {
            const positivePoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: 100
            }
            const result = createLeadSchema.parse(positivePoints)
            expect(result.points).toBe(100)
        })

        it('should reject negative points', () => {
            const negativePoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: -5
            }
            expect(() => createLeadSchema.parse(negativePoints)).toThrow(/Points must be non-negative/)
        })

        it('should reject non-integer points', () => {
            const floatPoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: 10.5
            }
            expect(() => createLeadSchema.parse(floatPoints)).toThrow()
        })

        it('should reject non-numeric points', () => {
            const stringPoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: '10'
            }
            expect(() => createLeadSchema.parse(stringPoints)).toThrow()
        })
    })

    describe('email field validation', () => {
        it('should accept valid email addresses', () => {
            const validEmail = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                email: 'user@example.com'
            }
            const result = createLeadSchema.parse(validEmail)
            expect(result.email).toBe('user@example.com')
        })

        it('should reject invalid email format', () => {
            const invalidEmail = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                email: 'not-an-email'
            }
            expect(() => createLeadSchema.parse(invalidEmail)).toThrow(/Invalid email format/)
        })

        it('should transform empty string email to undefined', () => {
            const emptyEmail = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                email: ''
            }
            const result = createLeadSchema.parse(emptyEmail)
            expect(result.email).toBeUndefined()
        })

        it('should allow missing email', () => {
            const noEmail = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                name: 'Test'
            }
            const result = createLeadSchema.parse(noEmail)
            expect(result.email).toBeUndefined()
        })
    })

    describe('minimal valid lead', () => {
        it('should accept lead with only optional fields undefined', () => {
            const minimal = {}
            const result = createLeadSchema.parse(minimal)
            expect(result.canvasId).toBeUndefined()
            expect(result.chatId).toBeUndefined()
            expect(result.name).toBeUndefined()
            expect(result.email).toBeUndefined()
            expect(result.phone).toBeUndefined()
            expect(result.points).toBe(0)
        })
    })

    describe('real-world quiz scenarios', () => {
        it('should handle quiz completion payload with all fields', () => {
            const quizPayload = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                name: 'Quiz Participant',
                email: 'participant@example.com',
                phone: '+1234567890',
                points: 9
            }
            const result = createLeadSchema.parse(quizPayload)
            expect(result.canvasId).toBe('019b584f-6d72-7553-899c-6cdb426fc3c1')
            expect(result.points).toBe(9)
            expect(result.name).toBe('Quiz Participant')
        })

        it('should handle quiz completion payload without contact info', () => {
            const anonymousQuiz = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: 7
            }
            const result = createLeadSchema.parse(anonymousQuiz)
            expect(result.canvasId).toBe('019b584f-6d72-7553-899c-6cdb426fc3c1')
            expect(result.points).toBe(7)
            expect(result.name).toBeUndefined()
            expect(result.email).toBeUndefined()
        })

        it('should handle payload with empty string canvasId (quiz still loading)', () => {
            const earlyPayload = {
                canvasId: '',
                name: 'Early Bird',
                points: 0
            }
            const result = createLeadSchema.parse(earlyPayload)
            expect(result.canvasId).toBeUndefined()
            expect(result.name).toBe('Early Bird')
        })

        it('should handle payload with null values (JavaScript null from JSON)', () => {
            const nullPayload = {
                canvasId: null,
                name: null,
                email: null,
                phone: null,
                points: 8
            }
            const result = createLeadSchema.parse(nullPayload)
            expect(result.canvasId).toBeUndefined()
            expect(result.name).toBeUndefined()
            expect(result.email).toBeUndefined()
            expect(result.phone).toBeUndefined()
            expect(result.points).toBe(8)
        })

        it('should handle real quiz frontend payload with null canvasId', () => {
            // This is the exact payload structure from template-quiz frontend
            const frontendPayload = {
                canvasId: null, // window.canvasId || null
                name: null,
                email: null,
                phone: null,
                points: 8,
                createdDate: new Date().toISOString() // Extra field should be ignored
            }
            const result = createLeadSchema.parse(frontendPayload)
            expect(result.canvasId).toBeUndefined()
            expect(result.points).toBe(8)
        })

        it('should handle null points defaulting to 0', () => {
            const nullPoints = {
                canvasId: '019b584f-6d72-7553-899c-6cdb426fc3c1',
                points: null
            }
            const result = createLeadSchema.parse(nullPoints)
            expect(result.points).toBe(0)
        })
    })
})
