import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import { randomBytes } from 'crypto'
import { generateAPIKey, generateSecretHash } from './apiKeyUtils'

export interface JsonApiKey {
    id: string
    keyName: string
    apiKey: string
    apiSecret: string
    createdAt: string
}

/**
 * Get all API keys from JSON file
 */
export async function getAPIKeysFromJson(apiKeyPath: string): Promise<JsonApiKey[]> {
    try {
        const content = await fs.promises.readFile(apiKeyPath, 'utf8')
        return JSON.parse(content)
    } catch {
        // If file doesn't exist or is invalid, create default key
        const keyName = 'DefaultKey'
        const apiKey = generateAPIKey()
        const apiSecret = generateSecretHash(apiKey)
        const content: JsonApiKey[] = [
            {
                keyName,
                apiKey,
                apiSecret,
                createdAt: dayjs().format('DD-MMM-YY'),
                id: randomBytes(16).toString('hex')
            }
        ]
        await fs.promises.writeFile(apiKeyPath, JSON.stringify(content), 'utf8')
        return content
    }
}

/**
 * Get single API key from JSON by key value
 */
export async function getApiKeyFromJson(apiKeyPath: string, apiKey: string): Promise<JsonApiKey | undefined> {
    const existingAPIKeys = await getAPIKeysFromJson(apiKeyPath)
    return existingAPIKeys.find((key) => key.apiKey === apiKey)
}

/**
 * Add new API key to JSON file
 */
export async function addAPIKeyToJson(apiKeyPath: string, keyName: string): Promise<JsonApiKey[]> {
    const existingAPIKeys = await getAPIKeysFromJson(apiKeyPath)
    const apiKey = generateAPIKey()
    const apiSecret = generateSecretHash(apiKey)
    const content: JsonApiKey[] = [
        ...existingAPIKeys,
        {
            keyName,
            apiKey,
            apiSecret,
            createdAt: dayjs().format('DD-MMM-YY'),
            id: randomBytes(16).toString('hex')
        }
    ]
    await fs.promises.writeFile(apiKeyPath, JSON.stringify(content), 'utf8')
    return content
}

/**
 * Update API key name in JSON file
 */
export async function updateAPIKeyInJson(apiKeyPath: string, keyIdToUpdate: string, newKeyName: string): Promise<JsonApiKey[]> {
    const existingAPIKeys = await getAPIKeysFromJson(apiKeyPath)
    const keyIndex = existingAPIKeys.findIndex((key) => key.id === keyIdToUpdate)
    if (keyIndex < 0) return existingAPIKeys
    existingAPIKeys[keyIndex].keyName = newKeyName
    await fs.promises.writeFile(apiKeyPath, JSON.stringify(existingAPIKeys), 'utf8')
    return existingAPIKeys
}

/**
 * Delete API key from JSON file
 */
export async function deleteAPIKeyFromJson(apiKeyPath: string, keyIdToDelete: string): Promise<JsonApiKey[]> {
    const existingAPIKeys = await getAPIKeysFromJson(apiKeyPath)
    const result = existingAPIKeys.filter((key) => key.id !== keyIdToDelete)
    await fs.promises.writeFile(apiKeyPath, JSON.stringify(result), 'utf8')
    return result
}

/**
 * Replace all API keys in JSON file
 */
export async function replaceAllAPIKeysInJson(apiKeyPath: string, content: JsonApiKey[]): Promise<void> {
    await fs.promises.writeFile(apiKeyPath, JSON.stringify(content), 'utf8')
}

/**
 * Import keys to JSON file with different modes
 */
export async function importKeysToJson(apiKeyPath: string, keys: JsonApiKey[], importMode: string): Promise<JsonApiKey[]> {
    const allApiKeys = await getAPIKeysFromJson(apiKeyPath)

    // Pre-check for errorIfExist mode
    if (importMode === 'errorIfExist') {
        for (const key of keys) {
            const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
            if (keyNameExists) {
                throw new Error(`Key with name ${key.keyName} already exists`)
            }
        }
    }

    for (const key of keys) {
        const keyNameExists = allApiKeys.find((k) => k.keyName === key.keyName)
        if (keyNameExists) {
            const keyIndex = allApiKeys.findIndex((k) => k.keyName === key.keyName)
            switch (importMode) {
                case 'overwriteIfExist':
                    allApiKeys[keyIndex] = key
                    continue
                case 'ignoreIfExist':
                    continue
                case 'errorIfExist':
                    // Already checked above
                    break
                default:
                    throw new Error(`Unknown import mode: ${importMode}`)
            }
        } else {
            allApiKeys.push(key)
        }
    }

    await fs.promises.writeFile(apiKeyPath, JSON.stringify(allApiKeys), 'utf8')
    return allApiKeys
}

/**
 * Get default API key path
 */
export function getDefaultAPIKeyPath(): string {
    return process.env.APIKEY_PATH ? path.join(process.env.APIKEY_PATH, 'api.json') : path.join(process.cwd(), 'api.json')
}
