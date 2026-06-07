import type { Server as HttpServer } from 'node:http'
import {
    attachPlayCanvasEditorFullBootRuntime,
    type PlayCanvasEditorRealtimeRuntimeHandle
} from '@universo-react/playcanvas-editor-backend'
import type { DbExecutor } from '../../../utils'
import { ensureMetahubAccess } from '../../shared/guards'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { PlayCanvasProjectsService } from '../services/PlayCanvasProjectsService'

export interface PlayCanvasEditorFullBootRuntimeDeps {
    server: HttpServer
    getTrustedDbExecutor: () => DbExecutor
    tokenService: Parameters<typeof attachPlayCanvasEditorFullBootRuntime>[0]['tokenService']
}

const createAuthorizedService = async (
    deps: PlayCanvasEditorFullBootRuntimeDeps,
    input: { userId: string; metahubId: string }
): Promise<PlayCanvasProjectsService> => {
    const exec = deps.getTrustedDbExecutor()
    await ensureMetahubAccess(exec, input.userId, input.metahubId, 'manageMetahub')
    return new PlayCanvasProjectsService(exec, new MetahubSchemaService(exec))
}

export const attachMetahubPlayCanvasEditorFullBootRuntime = (
    deps: PlayCanvasEditorFullBootRuntimeDeps
): PlayCanvasEditorRealtimeRuntimeHandle =>
    attachPlayCanvasEditorFullBootRuntime({
        server: deps.server,
        tokenService: deps.tokenService,
        authorize: async () => {
            // The full-boot token is issued only by the manager-gated REST config route.
            // Document load/persist still re-check metahub access through the trusted DB boundary below.
        },
        documentPort: {
            loadDocument: async (input) => {
                const service = await createAuthorizedService(deps, input)
                return service.loadEditorRealtimeDocument(input)
            },
            persistDocument: async (input) => {
                const service = await createAuthorizedService(deps, input)
                return service.persistEditorRealtimeDocument(input)
            }
        }
    })
