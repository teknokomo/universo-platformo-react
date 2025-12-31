import { StatusCodes } from 'http-status-codes'
import { DataSource } from 'typeorm'
import { uuid } from '@universo/utils'
import type { ILead, CreateLeadPayload } from '@universo/types'
import { z } from 'zod'
import { Lead } from '../database/entities/Lead'

// Helper to transform null/empty string to undefined
const nullableString = z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val === null || val === '' ? undefined : val))

// Helper for UUID that accepts null/empty
const nullableUuid = z
    .string()
    .uuid('Invalid canvasId format')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === null || val === '' ? undefined : val))

// Helper for email that accepts null/empty
const nullableEmail = z
    .string()
    .email('Invalid email format')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === null || val === '' ? undefined : val))

/**
 * Zod schema for input validation
 * Handles null values from frontend (JavaScript null vs undefined)
 */
export const createLeadSchema = z.object({
    canvasId: nullableUuid,
    chatId: nullableString,
    name: nullableString,
    email: nullableEmail,
    phone: nullableString,
    points: z
        .number()
        .int()
        .nonnegative('Points must be non-negative')
        .optional()
        .nullable()
        .transform((val) => val ?? 0),
    // Consent fields - optional, default to false if not provided
    termsAccepted: z.boolean().optional().default(false),
    privacyAccepted: z.boolean().optional().default(false)
})

/**
 * Error class for Leads service
 */
export class LeadsServiceError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'LeadsServiceError'
    }
}

/**
 * Configuration for leads service factory
 */
export interface LeadsServiceConfig {
    getDataSource: () => DataSource
}

/**
 * Leads service interface
 */
export interface ILeadsService {
    createLead: (body: CreateLeadPayload) => Promise<ILead>
    getAllLeads: (canvasId: string) => Promise<ILead[]>
}

/**
 * Factory function to create leads service with dependency injection
 */
export function createLeadsService(config: LeadsServiceConfig): ILeadsService {
    const { getDataSource } = config

    const createLead = async (body: CreateLeadPayload): Promise<ILead> => {
        console.log('[leads-backend] createLead received body:', JSON.stringify(body))
        try {
            const validatedData = createLeadSchema.parse(body)
            console.log('[leads-backend] Zod validation passed:', JSON.stringify(validatedData))

            const chatId = validatedData.chatId ?? uuid.generateUuidV7()
            const now = new Date()

            // Get legal document versions from environment
            const termsVersion = process.env.LEGAL_TERMS_VERSION || '1.0.0'
            const privacyVersion = process.env.LEGAL_PRIVACY_VERSION || '1.0.0'

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Lead)

            const newLead = repo.create({
                canvasId: validatedData.canvasId,
                chatId,
                name: validatedData.name,
                email: validatedData.email,
                phone: validatedData.phone,
                points: validatedData.points ?? 0,
                // Consent fields
                terms_accepted: validatedData.termsAccepted ?? false,
                terms_accepted_at: validatedData.termsAccepted ? now : undefined,
                privacy_accepted: validatedData.privacyAccepted ?? false,
                privacy_accepted_at: validatedData.privacyAccepted ? now : undefined,
                terms_version: validatedData.termsAccepted ? termsVersion : undefined,
                privacy_version: validatedData.privacyAccepted ? privacyVersion : undefined
            })

            console.log(
                '[leads-backend] Creating lead with data:',
                JSON.stringify({
                    canvasId: newLead.canvasId,
                    chatId: newLead.chatId,
                    name: newLead.name,
                    email: newLead.email,
                    phone: newLead.phone,
                    points: newLead.points,
                    terms_accepted: newLead.terms_accepted,
                    privacy_accepted: newLead.privacy_accepted
                })
            )

            const saved = await repo.save(newLead)
            console.log('[leads-backend] Lead saved successfully, id:', saved.id)
            return saved
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('[leads-backend] Zod validation error:', JSON.stringify(error.errors))
                throw new LeadsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
            console.error('[leads-backend] createLead error:', message)
            throw new LeadsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: leadsService.createLead - ${message}`)
        }
    }

    const getAllLeads = async (canvasId: string): Promise<ILead[]> => {
        try {
            const dataSource = getDataSource()
            return await dataSource.getRepository(Lead).find({
                where: { canvasId }
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new LeadsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: leadsService.getAllLeads - ${message}`)
        }
    }

    return { createLead, getAllLeads }
}

// Re-export for backwards compatibility
export type { CreateLeadPayload as CreateLeadBody } from '@universo/types'
