import { StatusCodes } from 'http-status-codes'
import { DataSource } from 'typeorm'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { ApiKey, type IApiKey } from '../database/entities'
import {
    generateAPIKey,
    generateSecretHash,
    getAPIKeysFromJson,
    getApiKeyFromJson,
    addAPIKeyToJson,
    updateAPIKeyInJson,
    deleteAPIKeyFromJson,
    replaceAllAPIKeysInJson,
    importKeysToJson,
    getDefaultAPIKeyPath,
    type JsonApiKey
} from '../utils'
import type { Unik } from '@universo/uniks-srv'

/**
 * Zod schemas for input validation
 */
export const createApiKeySchema = z.object({
    keyName: z.string().min(1, 'Key name is required').max(255, 'Key name too long')
})

export const updateApiKeySchema = z.object({
    keyName: z.string().min(1, 'Key name is required').max(255, 'Key name too long')
})

export const importKeysSchema = z.object({
    jsonFile: z.string().min(1, 'JSON file is required'),
    importMode: z.enum(['overwriteIfExist', 'ignoreIfExist', 'errorIfExist', 'replaceAll'])
})

/**
 * Error class for ApiKey service
 */
export class ApikeyServiceError extends Error {
    constructor(public readonly statusCode: number, message: string) {
        super(message)
        this.name = 'ApikeyServiceError'
    }
}

/**
 * Storage configuration for ApiKey service
 */
export interface ApikeyStorageConfig {
    type: 'json' | 'db'
    jsonPath?: string
}

/**
 * Configuration for ApiKey service factory
 */
export interface ApikeyServiceConfig {
    getDataSource: () => DataSource
    storageConfig: ApikeyStorageConfig
}

/**
 * Interface for canvas count info (for usage display)
 * Union type to support both DB entity (updatedDate) and JSON storage (createdAt)
 */
interface ApiKeyWithCount {
    id: string
    keyName: string
    apiKey: string
    apiSecret: string
    updatedDate?: Date
    createdAt?: string
    chatFlows?: { flowName: string; updatedDate: Date; category?: string }[]
}

/**
 * ApiKey service interface
 */
export interface IApikeyService {
    getAllApiKeys: (unikId?: string) => Promise<ApiKeyWithCount[]>
    getApiKey: (apiKey: string, unikId?: string) => Promise<IApiKey | JsonApiKey | undefined>
    createApiKey: (keyName: string, unikId?: string) => Promise<ApiKeyWithCount[]>
    updateApiKey: (id: string, keyName: string, unikId?: string) => Promise<ApiKeyWithCount[]>
    deleteApiKey: (id: string, unikId?: string) => Promise<ApiKeyWithCount[]>
    importKeys: (body: { jsonFile: string; importMode: string }, unikId?: string) => Promise<ApiKeyWithCount[]>
    verifyApiKey: (paramApiKey: string, unikId?: string) => Promise<string>
}

export interface CreateApiKeyBody {
    keyName: string
}

export interface UpdateApiKeyBody {
    keyName: string
}

export interface ImportKeysBody {
    jsonFile: string
    importMode: string
}

/**
 * Add canvas count to API keys (for usage display)
 */
async function addCanvasCount(keys: (IApiKey | JsonApiKey)[], getDataSource?: () => DataSource): Promise<ApiKeyWithCount[]> {
    if (!getDataSource) {
        return keys.map((k) => ({ ...k, chatFlows: [] }))
    }

    try {
        const dataSource = getDataSource()
        // Check if chat_flow table exists
        const hasTable = await dataSource.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_flow')`)
        if (!hasTable[0]?.exists) {
            return keys.map((k) => ({ ...k, chatFlows: [] }))
        }

        const result: ApiKeyWithCount[] = []
        for (const key of keys) {
            const chatFlows = await dataSource.query(
                `SELECT name as "flowName", "updatedDate", category FROM chat_flow WHERE apikeyid = $1`,
                [key.id]
            )
            result.push({ ...key, chatFlows: chatFlows || [] })
        }
        return result
    } catch {
        return keys.map((k) => ({ ...k, chatFlows: [] }))
    }
}

/**
 * Factory function to create ApiKey service with dependency injection
 */
export function createApikeyService(config: ApikeyServiceConfig): IApikeyService {
    const { getDataSource, storageConfig } = config

    const isJsonMode = (): boolean => storageConfig.type === 'json'
    const isDbMode = (): boolean => storageConfig.type === 'db'
    const getJsonPath = (): string => storageConfig.jsonPath || getDefaultAPIKeyPath()

    const getAllApiKeys = async (unikId?: string): Promise<ApiKeyWithCount[]> => {
        try {
            if (isJsonMode()) {
                const keys = await getAPIKeysFromJson(getJsonPath())
                return addCanvasCount(keys, getDataSource)
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const dataSource = getDataSource()
                let keys = await dataSource
                    .getRepository(ApiKey)
                    .createQueryBuilder('apikey')
                    .where('apikey.unik_id = :unikId', { unikId })
                    .getMany()

                // If no keys exist, create a default key
                if (keys.length === 0) {
                    await createApiKey('DefaultKey', unikId)
                    keys = await dataSource
                        .getRepository(ApiKey)
                        .createQueryBuilder('apikey')
                        .where('apikey.unik_id = :unikId', { unikId })
                        .getMany()
                }

                return addCanvasCount(keys, getDataSource)
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.getAllApiKeys - ${message}`)
        }
    }

    const getApiKey = async (apiKeyValue: string, unikId?: string): Promise<IApiKey | JsonApiKey | undefined> => {
        try {
            if (isJsonMode()) {
                return getApiKeyFromJson(getJsonPath(), apiKeyValue)
            }

            if (isDbMode()) {
                const dataSource = getDataSource()
                const whereClause: Record<string, unknown> = { apiKey: apiKeyValue }
                if (unikId) {
                    whereClause.unik = { id: unikId }
                }

                const currentKey = await dataSource.getRepository(ApiKey).findOne({
                    where: whereClause,
                    relations: unikId ? ['unik'] : undefined
                })
                return currentKey || undefined
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.getApiKey - ${message}`)
        }
    }

    const createApiKey = async (keyName: string, unikId?: string): Promise<ApiKeyWithCount[]> => {
        try {
            // Validate input
            createApiKeySchema.parse({ keyName })

            if (isJsonMode()) {
                const keys = await addAPIKeyToJson(getJsonPath(), keyName)
                return addCanvasCount(keys, getDataSource)
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const apiKey = generateAPIKey()
                const apiSecret = generateSecretHash(apiKey)
                const dataSource = getDataSource()

                const newKey = new ApiKey()
                newKey.id = randomBytes(16).toString('hex')
                newKey.apiKey = apiKey
                newKey.apiSecret = apiSecret
                newKey.keyName = keyName
                newKey.unik = { id: unikId } as Pick<Unik, 'id'> as Unik

                const repo = dataSource.getRepository(ApiKey)
                const key = repo.create(newKey)
                await repo.save(key)

                return getAllApiKeys(unikId)
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ApikeyServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`)
            }
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.createApiKey - ${message}`)
        }
    }

    const updateApiKey = async (id: string, keyName: string, unikId?: string): Promise<ApiKeyWithCount[]> => {
        try {
            // Validate input
            updateApiKeySchema.parse({ keyName })

            if (isJsonMode()) {
                const keys = await updateAPIKeyInJson(getJsonPath(), id, keyName)
                return addCanvasCount(keys, getDataSource)
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const dataSource = getDataSource()
                const currentKey = await dataSource.getRepository(ApiKey).findOne({
                    where: { id, unik: { id: unikId } },
                    relations: ['unik']
                })

                if (!currentKey) {
                    throw new ApikeyServiceError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
                }

                currentKey.keyName = keyName
                await dataSource.getRepository(ApiKey).save(currentKey)

                return getAllApiKeys(unikId)
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ApikeyServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`)
            }
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.updateApiKey - ${message}`)
        }
    }

    const deleteApiKey = async (id: string, unikId?: string): Promise<ApiKeyWithCount[]> => {
        try {
            if (isJsonMode()) {
                const keys = await deleteAPIKeyFromJson(getJsonPath(), id)
                return addCanvasCount(keys, getDataSource)
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const dataSource = getDataSource()
                const dbResponse = await dataSource.getRepository(ApiKey).delete({
                    id,
                    unik: { id: unikId }
                })

                if (!dbResponse.affected || dbResponse.affected === 0) {
                    throw new ApikeyServiceError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
                }

                return getAllApiKeys(unikId)
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.deleteApiKey - ${message}`)
        }
    }

    const importKeys = async (body: ImportKeysBody, unikId?: string): Promise<ApiKeyWithCount[]> => {
        try {
            // Validate input
            importKeysSchema.parse(body)

            const { jsonFile, importMode } = body
            const splitDataURI = jsonFile.split(',')
            if (splitDataURI[0] !== 'data:application/json;base64') {
                throw new ApikeyServiceError(StatusCodes.BAD_REQUEST, 'Invalid dataURI format')
            }

            const bf = Buffer.from(splitDataURI[1] || '', 'base64')
            const plain = bf.toString('utf8')
            const keys = JSON.parse(plain) as JsonApiKey[]

            if (isJsonMode()) {
                if (importMode === 'replaceAll') {
                    await replaceAllAPIKeysInJson(getJsonPath(), keys)
                } else {
                    await importKeysToJson(getJsonPath(), keys, importMode)
                }
                const allKeys = await getAPIKeysFromJson(getJsonPath())
                return addCanvasCount(allKeys, getDataSource)
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const dataSource = getDataSource()
                const repo = dataSource.getRepository(ApiKey)

                // Get existing keys for this Unik
                const existingKeys = await repo.createQueryBuilder('apikey').where('apikey.unik_id = :unikId', { unikId }).getMany()

                if (importMode === 'replaceAll') {
                    // Delete all existing keys for this Unik
                    await repo.delete({ unik: { id: unikId } })
                }

                if (importMode === 'errorIfExist') {
                    // Pre-check for existing keys
                    for (const key of keys) {
                        const keyNameExists = existingKeys.find((k) => k.keyName === key.keyName)
                        if (keyNameExists) {
                            throw new ApikeyServiceError(StatusCodes.CONFLICT, `Key with name ${key.keyName} already exists`)
                        }
                    }
                }

                // Import keys
                for (const key of keys) {
                    const keyNameExists = existingKeys.find((k) => k.keyName === key.keyName)
                    if (keyNameExists) {
                        const existingKey = existingKeys.find((k) => k.keyName === key.keyName)
                        switch (importMode) {
                            case 'overwriteIfExist':
                                if (existingKey) {
                                    existingKey.id = key.id || existingKey.id
                                    existingKey.apiKey = key.apiKey
                                    existingKey.apiSecret = key.apiSecret
                                    await repo.save(existingKey)
                                }
                                break
                            case 'ignoreIfExist':
                                continue
                            case 'errorIfExist':
                                // Already checked above
                                break
                        }
                    } else {
                        // Add new key
                        const newKey = new ApiKey()
                        newKey.id = key.id || randomBytes(16).toString('hex')
                        newKey.apiKey = key.apiKey
                        newKey.apiSecret = key.apiSecret
                        newKey.keyName = key.keyName
                        newKey.unik = { id: unikId } as Pick<Unik, 'id'> as Unik
                        await repo.save(newKey)
                    }
                }

                return getAllApiKeys(unikId)
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new ApikeyServiceError(StatusCodes.BAD_REQUEST, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`)
            }
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.importKeys - ${message}`)
        }
    }

    const verifyApiKey = async (paramApiKey: string, unikId?: string): Promise<string> => {
        try {
            if (isJsonMode()) {
                const key = await getApiKeyFromJson(getJsonPath(), paramApiKey)
                if (!key) {
                    throw new ApikeyServiceError(StatusCodes.UNAUTHORIZED, 'Unauthorized')
                }
                return 'OK'
            }

            if (isDbMode()) {
                if (!unikId) {
                    throw new ApikeyServiceError(StatusCodes.PRECONDITION_FAILED, 'unikId is required when APIKEY_STORAGE_TYPE=db')
                }

                const dataSource = getDataSource()
                const key = await dataSource.getRepository(ApiKey).findOne({
                    where: { apiKey: paramApiKey, unik: { id: unikId } },
                    relations: ['unik']
                })

                if (!key) {
                    throw new ApikeyServiceError(StatusCodes.UNAUTHORIZED, 'Unauthorized')
                }
                return 'OK'
            }

            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, 'Unknown APIKEY_STORAGE_TYPE')
        } catch (error) {
            if (error instanceof ApikeyServiceError && error.statusCode === StatusCodes.UNAUTHORIZED) {
                throw error
            }
            if (error instanceof ApikeyServiceError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ApikeyServiceError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.verifyApiKey - ${message}`)
        }
    }

    return {
        getAllApiKeys,
        getApiKey,
        createApiKey,
        updateApiKey,
        deleteApiKey,
        importKeys,
        verifyApiKey
    }
}
