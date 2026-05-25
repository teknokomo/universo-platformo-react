import { Flags } from '@oclif/core'
import {
    applyRegisteredSystemAppSchemaGenerationPlans,
    bootstrapRegisteredSystemAppStructureMetadata,
    compileRegisteredSystemAppSchemaDefinitionArtifacts,
    planRegisteredSystemAppSchemaGenerationPlans
} from '@universo/migrations-platform'
import { destroyKnex, initKnex, getKnex } from '@universo/database'
import logger from '../utils/logger'
import { BaseCommand } from './base'

export default class SystemAppSchema extends BaseCommand {
    static description = 'Plan or apply registered fixed system-app schema generation waves'

    static flags = {
        ...BaseCommand.flags,
        action: Flags.string({
            options: ['plan', 'apply', 'bootstrap'],
            default: 'plan',
            description: 'Choose whether to preview, apply, or bootstrap the selected system-app schema plans'
        }),
        stage: Flags.string({
            options: ['current', 'target'],
            default: 'target',
            description: 'Choose whether to use current-state or target-state system-app plans'
        }),
        keys: Flags.string({
            description: 'Optional comma-separated list of system-app keys to limit the wave'
        })
    }

    async run(): Promise<void> {
        const { flags } = await this.parse(SystemAppSchema)
        const stage = flags.stage as 'current' | 'target'
        const keys = flags.keys
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean)

        initKnex()

        try {
            let payload: unknown

            if (flags.action === 'apply') {
                payload = await applyRegisteredSystemAppSchemaGenerationPlans(getKnex(), {
                    stage,
                    keys
                })
            } else if (flags.action === 'bootstrap') {
                payload = await bootstrapRegisteredSystemAppStructureMetadata(getKnex(), {
                    stage,
                    keys
                })
            } else {
                payload = {
                    stage,
                    plans: planRegisteredSystemAppSchemaGenerationPlans(stage, keys),
                    compiledArtifacts: compileRegisteredSystemAppSchemaDefinitionArtifacts(stage, keys)
                }
            }

            this.log(JSON.stringify(payload, null, 2))
        } catch (error) {
            logger.error('[system-app-schema] Command failed', error as Error)
            throw error
        } finally {
            await destroyKnex()
        }
    }
}
