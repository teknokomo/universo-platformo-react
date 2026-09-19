import type { Request, Response } from 'express'
import { UpdateFailure, normalizeLocale, resolveRuntimeSchema, toRuntimeInputFormatErrorBody } from '../../shared/runtimeHelpers'
import { runtimeRecordsUnionBodySchema } from '../runtimeRowSupport/contracts'
import { executeRuntimeRecordsUnionDatasource } from '../runtimeRowSupport/union'

import type { RuntimeRowReadHandlerDeps } from './types'

export const createUnionDatasourceHandler = ({ getDbExecutor, query }: RuntimeRowReadHandlerDeps) => {
    const listRecordsUnionDatasource = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsedBody = runtimeRecordsUnionBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { datasource, limit, offset, locale } = parsedBody.data
        const requestedLocale = normalizeLocale(locale)
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        try {
            const payload = await executeRuntimeRecordsUnionDatasource({
                runtimeContext,
                applicationId,
                datasource,
                limit,
                offset,
                locale: requestedLocale
            })
            return res.json(payload)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            const formatError = toRuntimeInputFormatErrorBody(error)
            if (formatError) {
                return res.status(400).json(formatError)
            }
            throw error
        }
    }
    return listRecordsUnionDatasource
}
