import type { Request } from 'express'
import type { DbExecutor } from '@universo/utils'
import { getRequestDbExecutor } from '../../utils'
import { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'

export interface MetahubCoreServices {
    exec: DbExecutor
    schemaService: MetahubSchemaService
}

export function createCoreServices(req: Request, getDbExecutor: () => DbExecutor): MetahubCoreServices {
    const exec = getRequestDbExecutor(req, getDbExecutor())
    const schemaService = new MetahubSchemaService(exec)
    return { exec, schemaService }
}
