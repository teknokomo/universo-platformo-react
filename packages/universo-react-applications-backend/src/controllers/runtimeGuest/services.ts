import type { DbExecutor } from '@universo-react/utils'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { createPublicRuntimeContextRunner } from './contextRunner'
import { createGuestAccessLinkService } from './accessLinkService'
import { createGuestRuntimePayloadBuilder } from './payloadBuilder'

export const createRuntimeGuestServices = (getDbExecutor: () => DbExecutor) => {
    const modulesService = new RuntimeModulesService()
    const context = createPublicRuntimeContextRunner(getDbExecutor)
    const accessLinks = createGuestAccessLinkService()
    const payloads = createGuestRuntimePayloadBuilder(accessLinks)
    const createUuidV7 = async (executor: DbExecutor): Promise<string> => {
        const rows = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        const id = rows[0]?.id
        if (!id) throw new Error('Database UUID v7 generation failed')
        return id
    }

    return { ...context, ...accessLinks, ...payloads, createUuidV7, modulesService }
}

export type RuntimeGuestServices = ReturnType<typeof createRuntimeGuestServices>
