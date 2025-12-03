import { StatusCodes } from 'http-status-codes'
import { DataSource } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { Lead } from '../database/entities/Lead'
import type { ILead, CreateLeadBody } from '../Interface'

/**
 * Zod schema for input validation
 */
export const createLeadSchema = z.object({
    canvasId: z.string().uuid('Invalid canvasId format'),
    chatId: z.string().optional(),
    name: z.string().optional(),
    email: z
        .string()
        .email('Invalid email format')
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
    phone: z.string().optional()
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
    createLead: (body: CreateLeadBody) => Promise<ILead>
    getAllLeads: (canvasId: string) => Promise<ILead[]>
}

/**
 * Factory function to create leads service with dependency injection
 */
export function createLeadsService(config: LeadsServiceConfig): ILeadsService {
    const { getDataSource } = config

    const createLead = async (body: CreateLeadBody): Promise<ILead> => {
        try {
            const validatedData = createLeadSchema.parse(body)
            const chatId = validatedData.chatId ?? uuidv4()

            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Lead)

            const newLead = repo.create({
                canvasId: validatedData.canvasId,
                chatId,
                name: validatedData.name,
                email: validatedData.email,
                phone: validatedData.phone,
                points: 0
            })

            return await repo.save(newLead)
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new LeadsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
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

export type { CreateLeadBody } from '../Interface'
