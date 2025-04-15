import { StatusCodes } from 'http-status-codes'
import {
    addAPIKey as addAPIKey_json,
    deleteAPIKey as deleteAPIKey_json,
    generateAPIKey,
    generateSecretHash,
    getApiKey as getApiKey_json,
    getAPIKeys as getAPIKeys_json,
    updateAPIKey as updateAPIKey_json,
    replaceAllAPIKeys as replaceAllAPIKeys_json,
    importKeys as importKeys_json
} from '../../utils/apiKey'
import { addChatflowsCount } from '../../utils/addChatflowsCount'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ApiKey } from '../../database/entities/ApiKey'
import { appConfig } from '../../AppConfig'
import { randomBytes } from 'crypto'
import { Not, IsNull } from 'typeorm'

const _apikeysStoredInJson = (): boolean => {
    return appConfig.apiKeys.storageType === 'json'
}

const _apikeysStoredInDb = (): boolean => {
    return appConfig.apiKeys.storageType === 'db'
}

const getAllApiKeys = async (unikId?: string) => {
    try {
        if (_apikeysStoredInJson()) {
            const keys = await getAPIKeys_json()
            return await addChatflowsCount(keys)
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            
            // Universo Platformo | In DB mode, unikId is mandatory
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            let queryBuilder = appServer.AppDataSource.getRepository(ApiKey)
                .createQueryBuilder('apikey')
                .where('apikey.unik_id = :unikId', { unikId })
            
            let keys = await queryBuilder.getMany()
            
            // Universo Platformo | If no keys exist, create a default key
            if (keys.length === 0) {
                await createApiKey('DefaultKey', unikId)
                keys = await queryBuilder.getMany()
            }
            
            return await addChatflowsCount(keys)
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.getAllApiKeys - ${getErrorMessage(error)}`)
    }
}

const getApiKey = async (apiKey: string) => {
    try {
        if (_apikeysStoredInJson()) {
            return getApiKey_json(apiKey)
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            const currentKey = await appServer.AppDataSource.getRepository(ApiKey).findOneBy({
                apiKey: apiKey
            })
            if (!currentKey) {
                return undefined
            }
            return currentKey
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.createApiKey - ${getErrorMessage(error)}`)
    }
}

const createApiKey = async (keyName: string, unikId?: string) => {
    try {
        if (_apikeysStoredInJson()) {
            const keys = await addAPIKey_json(keyName)
            return await addChatflowsCount(keys)
        } else if (_apikeysStoredInDb()) {
            const apiKey = generateAPIKey()
            const apiSecret = generateSecretHash(apiKey)
            const appServer = getRunningExpressApp()
            const newKey = new ApiKey()
            newKey.id = randomBytes(16).toString('hex')
            newKey.apiKey = apiKey
            newKey.apiSecret = apiSecret
            newKey.keyName = keyName
            
            // Universo Platformo | Check if unikId exists, it is mandatory for the table
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            // Universo Platformo | Establish relation with Unik via object
            newKey.unik = { id: unikId } as any
            
            const key = appServer.AppDataSource.getRepository(ApiKey).create(newKey)
            await appServer.AppDataSource.getRepository(ApiKey).save(key)
            
            return getAllApiKeys(unikId)
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.createApiKey - ${getErrorMessage(error)}`)
    }
}

// Universo Platformo | Update api key
const updateApiKey = async (id: string, keyName: string, unikId?: string) => {
    try {
        if (_apikeysStoredInJson()) {
            const keys = await updateAPIKey_json(id, keyName)
            return await addChatflowsCount(keys)
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            
            // Universo Platformo | In DB mode, unikId is mandatory
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            const currentKey = await appServer.AppDataSource.getRepository(ApiKey).findOne({
                where: { id: id, unik: { id: unikId } },
                relations: ['unik']
            })
            
            if (!currentKey) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
            }
            
            currentKey.keyName = keyName
            await appServer.AppDataSource.getRepository(ApiKey).save(currentKey)
            
            return getAllApiKeys(unikId)
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.updateApiKey - ${getErrorMessage(error)}`)
    }
}

const deleteApiKey = async (id: string, unikId?: string) => {
    try {
        if (_apikeysStoredInJson()) {
            const keys = await deleteAPIKey_json(id)
            return await addChatflowsCount(keys)
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            
            // Universo Platformo | In DB mode, unikId is mandatory
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            const whereClause = { id: id, unik: { id: unikId } }
            
            const dbResponse = await appServer.AppDataSource.getRepository(ApiKey).delete(whereClause)
            
            if (!dbResponse.affected || dbResponse.affected === 0) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ApiKey ${id} not found`)
            }
            
            return getAllApiKeys(unikId)
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.deleteApiKey - ${getErrorMessage(error)}`)
    }
}

const importKeys = async (body: any, unikId?: string) => {
    try {
        const jsonFile = body.jsonFile
        const splitDataURI = jsonFile.split(',')
        if (splitDataURI[0] !== 'data:application/json;base64') {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Invalid dataURI`)
        }
        const bf = Buffer.from(splitDataURI[1] || '', 'base64')
        const plain = bf.toString('utf8')
        const keys = JSON.parse(plain)
        if (_apikeysStoredInJson()) {
            if (body.importMode === 'replaceAll') {
                await replaceAllAPIKeys_json(keys)
            } else {
                await importKeys_json(keys, body.importMode)
            }
            return await addChatflowsCount(keys)
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            
            // Universo Platformo | In DB mode, unikId is mandatory
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            // Universo Platformo | Get all API keys for this Unik
            let allApiKeys = await appServer.AppDataSource.getRepository(ApiKey)
                .createQueryBuilder('apikey')
                .where('apikey.unik_id = :unikId', { unikId })
                .getMany()
            
            if (body.importMode === 'replaceAll') {
                // Universo Platformo | Delete all existing keys for this Unik
                await appServer.AppDataSource.getRepository(ApiKey).delete({
                    unik: { id: unikId }
                })
            }
            if (body.importMode === 'errorIfExist') {
                // Universo Platformo | If importMode is errorIfExist, check for existing keys and raise error before any modification to the DB
                for (const key of keys) {
                    const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
                    if (keyNameExists) {
                        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Key with name ${key.keyName} already exists`)
                    }
                }
            }
            // iterate through the keys and add them to the database
            for (const key of keys) {
                const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
                if (keyNameExists) {
                    const keyIndex = allApiKeys.findIndex((k) => k.keyName === key.keyName)
                    switch (body.importMode) {
                        case 'overwriteIfExist': {
                            const currentKey = allApiKeys[keyIndex]
                            currentKey.id = key.id
                            currentKey.apiKey = key.apiKey
                            currentKey.apiSecret = key.apiSecret
                            await appServer.AppDataSource.getRepository(ApiKey).save(currentKey)
                            break
                        }
                        case 'ignoreIfExist': {
                            // ignore this key and continue
                            continue
                        }
                        case 'errorIfExist': {
                            // we already checked for errors above, skip
                            break
                        }
                    }
                } else {
                    // Add the key to the database
                    const newKey = new ApiKey()
                    newKey.id = key.id || randomBytes(16).toString('hex')
                    newKey.apiKey = key.apiKey
                    newKey.apiSecret = key.apiSecret
                    newKey.keyName = key.keyName
                    // Universo Platformo | Establish relation with Unik
                    newKey.unik = { id: unikId } as any
                    
                    await appServer.AppDataSource.getRepository(ApiKey).save(newKey)
                }
            }
            return getAllApiKeys(unikId)
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: apikeyService.importKeys - ${getErrorMessage(error)}`)
    }
}

const verifyApiKey = async (paramApiKey: string, unikId?: string): Promise<string> => {
    try {
        if (_apikeysStoredInJson()) {
            const apiKey = await getApiKey_json(paramApiKey)
            if (!apiKey) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
            }
            return 'OK'
        } else if (_apikeysStoredInDb()) {
            const appServer = getRunningExpressApp()
            
            // Universo Platformo | In DB mode, unikId is mandatory
            if (!unikId) {
                throw new InternalFlowiseError(StatusCodes.PRECONDITION_FAILED, `unikId is required when APIKEY_STORAGE_TYPE=db`)
            }
            
            const whereClause = { apiKey: paramApiKey, unik: { id: unikId } }
            
            const apiKey = await appServer.AppDataSource.getRepository(ApiKey).findOne({
                where: whereClause,
                relations: ['unik']
            })
            
            if (!apiKey) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, `Unauthorized`)
            }
            return 'OK'
        } else {
            throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `UNKNOWN APIKEY_STORAGE_TYPE`)
        }
    } catch (error) {
        if (error instanceof InternalFlowiseError && error.statusCode === StatusCodes.UNAUTHORIZED) {
            throw error
        } else {
            throw new InternalFlowiseError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                `Error: apikeyService.verifyApiKey - ${getErrorMessage(error)}`
            )
        }
    }
}

export default {
    createApiKey,
    deleteApiKey,
    getAllApiKeys,
    updateApiKey,
    verifyApiKey,
    getApiKey,
    importKeys
}
