/**
 * Public facade for PlayCanvas project operations.
 *
 * The historical import path remains stable while focused aggregate services
 * provide the implementation through a single inheritance chain. This keeps
 * constructor and method contracts compatible with controllers and tests.
 */
import type { DbExecutor } from '@universo-react/utils/database'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { PlayCanvasProjectFileService } from './PlayCanvasProjectFileService'
import { PlayCanvasProjectsServiceSourceFiles } from './playCanvasProjectsServiceSourceFiles'

export class PlayCanvasProjectsService extends PlayCanvasProjectsServiceSourceFiles {
    constructor(exec: DbExecutor, schemaService: MetahubSchemaService, fileService = new PlayCanvasProjectFileService()) {
        super(exec, schemaService, fileService)
    }
}
