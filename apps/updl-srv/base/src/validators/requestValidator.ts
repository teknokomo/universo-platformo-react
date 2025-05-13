// Universo Platformo | Request validator for UPDL server
import { Request, Response, NextFunction } from 'express'

interface ValidationSchema {
    [key: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array'
        required?: boolean
        min?: number
        max?: number
        regex?: RegExp
        custom?: (value: any) => boolean
    }
}

interface ValidationError {
    field: string
    message: string
}

/**
 * Validates request body against schema
 * @param schema Validation schema
 */
export const validateBody = (schema: ValidationSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const errors: ValidationError[] = []

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field]

            // Check required
            if (rules.required && (value === undefined || value === null)) {
                errors.push({
                    field,
                    message: `${field} is required`
                })
                continue
            }

            // Skip validation if field is not required and value is not provided
            if (!rules.required && (value === undefined || value === null)) {
                continue
            }

            // Type validation
            if (
                typeof value !== rules.type &&
                !(rules.type === 'array' && Array.isArray(value)) &&
                !(rules.type === 'object' && typeof value === 'object' && !Array.isArray(value))
            ) {
                errors.push({
                    field,
                    message: `${field} must be of type ${rules.type}`
                })
                continue
            }

            // Min/max validation for strings and arrays
            if ((typeof value === 'string' || Array.isArray(value)) && rules.min !== undefined && value.length < rules.min) {
                errors.push({
                    field,
                    message: `${field} must be at least ${rules.min} characters long`
                })
            }

            if ((typeof value === 'string' || Array.isArray(value)) && rules.max !== undefined && value.length > rules.max) {
                errors.push({
                    field,
                    message: `${field} must be at most ${rules.max} characters long`
                })
            }

            // Regex validation for strings
            if (typeof value === 'string' && rules.regex && !rules.regex.test(value)) {
                errors.push({
                    field,
                    message: `${field} has invalid format`
                })
            }

            // Custom validation
            if (rules.custom && !rules.custom(value)) {
                errors.push({
                    field,
                    message: `${field} is invalid`
                })
            }
        }

        if (errors.length > 0) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    errors
                }
            })
            return
        }

        next()
    }
}

export default {
    validateBody
}
