import { omit } from 'lodash'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { Credential } from '../../database/entities/Credential'
import { transformToCredentialEntity, decryptCredentialData } from '../../utils'
import { ICredentialReturnResponse } from '../../Interface'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'

const createCredential = async (requestBody: any) => {
    try {
        const appServer = getRunningExpressApp()
        
        // Ensure unikId is properly passed to the database
        if (requestBody.unikId) {
            // TypeORM expects unik_id instead of unikId
            requestBody.unik_id = requestBody.unikId
            // Remove unikId to avoid duplication
            delete requestBody.unikId
        }
        
        const newCredential = await transformToCredentialEntity(requestBody)
        // Set relationship with Unik
        newCredential.unik = { id: requestBody.unik_id } as any
        
        const credential = await appServer.AppDataSource.getRepository(Credential).create(newCredential)
        const dbResponse = await appServer.AppDataSource.getRepository(Credential).save(credential)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.createCredential - ${getErrorMessage(error)}`
        )
    }
}

// Delete all credentials for a given canvas
const deleteCredentials = async (credentialId: string, unikId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: credentialId }
        if (unikId) {
            whereClause.unik = { id: unikId }
        }
        const dbResponse = await appServer.AppDataSource.getRepository(Credential).delete(whereClause)
        if (!dbResponse) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.deleteCredential - ${getErrorMessage(error)}`
        )
    }
}

const getAllCredentials = async (paramCredentialName: any, unikId?: string) => {
    try {
        const appServer = getRunningExpressApp()
        let dbResponse = []
        let queryBuilder = appServer.AppDataSource.getRepository(Credential)
            .createQueryBuilder('credential')

        // Apply filter by unikId if provided
        if (unikId) {
            queryBuilder = queryBuilder.where('credential.unik_id = :unikId', { unikId })
        }

        if (paramCredentialName) {
            if (Array.isArray(paramCredentialName)) {
                for (let i = 0; i < paramCredentialName.length; i += 1) {
                    const name = paramCredentialName[i] as string
                    const credentials = await queryBuilder
                        .andWhere('credential.credentialName = :name', { name })
                        .getMany()
                    dbResponse.push(...credentials)
                }
            } else {
                const credentials = await queryBuilder
                    .andWhere('credential.credentialName = :name', { name: paramCredentialName })
                    .getMany()
                dbResponse = [...credentials]
            }
        } else {
            const credentials = await queryBuilder.getMany()
            for (const credential of credentials) {
                dbResponse.push(omit(credential, ['encryptedData']))
            }
        }
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.getAllCredentials - ${getErrorMessage(error)}`
        )
    }
}

const getCredentialById = async (credentialId: string, unikId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: credentialId }
        if (unikId) {
            whereClause.unik = { id: unikId }
        }
        const credential = await appServer.AppDataSource.getRepository(Credential).findOneBy(whereClause)
        if (!credential) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        // Decrpyt credentialData
        const decryptedCredentialData = await decryptCredentialData(
            credential.encryptedData,
            credential.credentialName,
            appServer.nodesPool.componentCredentials
        )
        const returnCredential: ICredentialReturnResponse = {
            ...credential,
            plainDataObj: decryptedCredentialData
        }
        const dbResponse = omit(returnCredential, ['encryptedData'])
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.createCredential - ${getErrorMessage(error)}`
        )
    }
}

const updateCredential = async (credentialId: string, requestBody: any, unikId?: string): Promise<any> => {
    try {
        const appServer = getRunningExpressApp()
        let whereClause: any = { id: credentialId }
        if (unikId) {
            whereClause.unik = { id: unikId }
        }
        const credential = await appServer.AppDataSource.getRepository(Credential).findOneBy(whereClause)
        if (!credential) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Credential ${credentialId} not found`)
        }
        const decryptedCredentialData = await decryptCredentialData(credential.encryptedData)
        requestBody.plainDataObj = { ...decryptedCredentialData, ...requestBody.plainDataObj }
        const updateCredential = await transformToCredentialEntity(requestBody)
        await appServer.AppDataSource.getRepository(Credential).merge(credential, updateCredential)
        const dbResponse = await appServer.AppDataSource.getRepository(Credential).save(credential)
        return dbResponse
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: credentialsService.updateCredential - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createCredential,
    deleteCredentials,
    getAllCredentials,
    getCredentialById,
    updateCredential
}
