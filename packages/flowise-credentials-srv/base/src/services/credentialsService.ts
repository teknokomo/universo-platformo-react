import { StatusCodes } from 'http-status-codes'
import { DataSource, In, QueryRunner } from 'typeorm'
import { validate as validateUuid } from 'uuid'
import { omit } from 'lodash'
import { z } from 'zod'
import { Credential } from '../database/entities/Credential'
import type { Unik } from '@universo/uniks-srv'

/**
 * Zod schemas for input validation
 */
export const createCredentialSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    credentialName: z.string().min(1, 'Credential name is required').max(255, 'Credential name too long'),
    plainDataObj: z.record(z.unknown()),
    unikId: z.string().uuid('Invalid unikId format')
})

export const updateCredentialSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    plainDataObj: z.record(z.unknown()).optional(),
    unikId: z.string().uuid().optional()
})

/**
 * Error class for Credentials service
 */
export class CredentialsServiceError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string
    ) {
        super(message)
        this.name = 'CredentialsServiceError'
    }
}

/**
 * Component credentials interface for password redaction
 */
export interface IComponentCredentials {
    [key: string]: {
        inputs?: Array<{ type: string; name: string }>
    }
}

/**
 * Configuration for credentials service factory
 */
export interface CredentialsServiceConfig {
    getDataSource: () => DataSource
    encryptCredentialData: (plainData: Record<string, unknown>) => Promise<string>
    decryptCredentialData: (
        encryptedData: string,
        componentCredentialName?: string,
        componentCredentials?: IComponentCredentials
    ) => Promise<Record<string, unknown>>
}

/**
 * Credentials service interface
 */
export interface ICredentialsService {
    createCredential: (requestBody: CreateCredentialBody) => Promise<Credential>
    deleteCredential: (credentialId: string, unikId?: string) => Promise<{ affected?: number }>
    getAllCredentials: (paramCredentialName: string | string[] | undefined, unikId?: string) => Promise<Credential[]>
    getCredentialById: (credentialId: string, unikId?: string) => Promise<CredentialWithPlainData>
    updateCredential: (credentialId: string, requestBody: UpdateCredentialBody, unikId?: string) => Promise<Credential>
    importCredentials: (newCredentials: Partial<Credential>[], queryRunner?: QueryRunner) => Promise<unknown>
}

export interface CreateCredentialBody {
    name: string
    credentialName: string
    plainDataObj: Record<string, unknown>
    unikId: string
}

export interface UpdateCredentialBody {
    name?: string
    plainDataObj?: Record<string, unknown>
    unikId?: string
}

export interface CredentialWithPlainData extends Omit<Credential, 'encryptedData'> {
    plainDataObj: Record<string, unknown>
}

/**
 * Factory function to create credentials service with dependency injection
 */
export function createCredentialsService(config: CredentialsServiceConfig): ICredentialsService {
    const { getDataSource, encryptCredentialData, decryptCredentialData } = config

    const createCredential = async (requestBody: CreateCredentialBody): Promise<Credential> => {
        try {
            const validatedData = createCredentialSchema.parse(requestBody)
            
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Credential)

            const encryptedData = await encryptCredentialData(validatedData.plainDataObj)

            const newCredential = repo.create({
                name: validatedData.name,
                credentialName: validatedData.credentialName,
                encryptedData,
                unik: { id: validatedData.unikId } as Pick<Unik, 'id'>
            })

            return await repo.save(newCredential)
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new CredentialsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map(e => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.createCredential - ${message}`)
        }
    }

    const deleteCredential = async (credentialId: string, unikId?: string): Promise<{ affected?: number }> => {
        try {
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Credential)

            const whereClause: Record<string, unknown> = { id: credentialId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }

            const dbResponse = await repo.delete(whereClause)
            return { affected: dbResponse.affected ?? undefined }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.deleteCredential - ${message}`)
        }
    }

    const getAllCredentials = async (paramCredentialName: string | string[] | undefined, unikId?: string): Promise<Credential[]> => {
        try {
            const dataSource = getDataSource()
            const dbResponse: Credential[] = []
            let queryBuilder = dataSource.getRepository(Credential).createQueryBuilder('credential')

            if (unikId) {
                queryBuilder = queryBuilder.where('credential.unik_id = :unikId', { unikId })
            }

            if (paramCredentialName) {
                if (Array.isArray(paramCredentialName)) {
                    for (const name of paramCredentialName) {
                        const credentials = await queryBuilder
                            .andWhere('credential.credentialName = :name', { name })
                            .getMany()
                        dbResponse.push(...credentials)
                    }
                } else {
                    const credentials = await queryBuilder
                        .andWhere('credential.credentialName = :name', { name: paramCredentialName })
                        .getMany()
                    dbResponse.push(...credentials)
                }
            } else {
                const credentials = await queryBuilder.getMany()
                for (const credential of credentials) {
                    dbResponse.push(omit(credential, ['encryptedData']) as Credential)
                }
            }
            return dbResponse
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.getAllCredentials - ${message}`)
        }
    }

    const getCredentialById = async (credentialId: string, unikId?: string): Promise<CredentialWithPlainData> => {
        try {
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Credential)

            const whereClause: Record<string, unknown> = { id: credentialId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }

            const credential = await repo.findOneBy(whereClause)
            if (!credential) {
                throw new CredentialsServiceError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
            }

            const decryptedData = await decryptCredentialData(
                credential.encryptedData,
                credential.credentialName
            )

            const result = omit(credential, ['encryptedData']) as CredentialWithPlainData
            result.plainDataObj = decryptedData

            return result
        } catch (error) {
            if (error instanceof CredentialsServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.getCredentialById - ${message}`)
        }
    }

    const updateCredential = async (credentialId: string, requestBody: UpdateCredentialBody, unikId?: string): Promise<Credential> => {
        try {
            const validatedData = updateCredentialSchema.parse(requestBody)
            
            const dataSource = getDataSource()
            const repo = dataSource.getRepository(Credential)

            const whereClause: Record<string, unknown> = { id: credentialId }
            if (unikId) {
                whereClause.unik = { id: unikId }
            }

            const credential = await repo.findOneBy(whereClause)
            if (!credential) {
                throw new CredentialsServiceError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
            }

            // Merge existing decrypted data with new data
            const existingData = await decryptCredentialData(credential.encryptedData)
            const mergedData = { ...existingData, ...validatedData.plainDataObj }
            const encryptedData = await encryptCredentialData(mergedData)

            const updateData: Partial<Credential> = {
                encryptedData
            }
            if (validatedData.name) {
                updateData.name = validatedData.name
            }

            repo.merge(credential, updateData)
            return await repo.save(credential)
        } catch (error) {
            if (error instanceof CredentialsServiceError) {
                throw error
            }
            if (error instanceof z.ZodError) {
                throw new CredentialsServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map(e => e.message).join(', ')}`)
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.updateCredential - ${message}`)
        }
    }

    const importCredentials = async (newCredentials: Partial<Credential>[], queryRunner?: QueryRunner): Promise<unknown> => {
        try {
            for (const data of newCredentials) {
                if (data.id && !validateUuid(data.id)) {
                    throw new CredentialsServiceError(StatusCodes.PRECONDITION_FAILED, 'Error: importCredentials - invalid id!')
                }
            }

            const dataSource = getDataSource()
            const repository = queryRunner ? queryRunner.manager.getRepository(Credential) : dataSource.getRepository(Credential)

            if (newCredentials.length === 0) return

            const credentialIds = newCredentials
                .map((cred) => cred.id)
                .filter((id): id is string => id !== undefined && id !== null)

            const selectResponse = credentialIds.length > 0
                ? await repository.find({
                    where: { id: In(credentialIds) },
                    select: ['id']
                })
                : []
            const foundIds = selectResponse.map((response) => response.id)

            const prepCredentials: Partial<Credential>[] = newCredentials.map((newCred) => {
                const id = newCred.id ?? ''
                if (foundIds.includes(id)) {
                    return { ...newCred, id: undefined, name: (newCred.name ?? '') + ' (1)' }
                }
                return newCred
            })

            return await repository.insert(prepCredentials)
        } catch (error) {
            if (error instanceof CredentialsServiceError) {
                throw error
            }
            const message = error instanceof Error ? error.message : String(error)
            throw new CredentialsServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: credentialsService.importCredentials - ${message}`)
        }
    }

    return {
        createCredential,
        deleteCredential,
        getAllCredentials,
        getCredentialById,
        updateCredential,
        importCredentials
    }
}
