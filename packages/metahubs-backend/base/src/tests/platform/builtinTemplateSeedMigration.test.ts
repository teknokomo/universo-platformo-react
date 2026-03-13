jest.mock('@universo/database', () => ({
    createKnexExecutor: jest.fn(() => ({ tag: 'executor' }))
}))

jest.mock('../../domains/templates/services/TemplateSeeder', () => ({
    seedTemplates: jest.fn(async () => undefined)
}))

import { createKnexExecutor } from '@universo/database'
import { seedTemplates } from '../../domains/templates/services/TemplateSeeder'
import { seedBuiltinTemplatesMigration } from '../../platform/migrations'

describe('seedBuiltinTemplatesMigration', () => {
    it('runs built-in template seeding through the unified migration flow in fail-fast mode', async () => {
        const knex = { tag: 'knex' }

        await seedBuiltinTemplatesMigration.up({
            knex: knex as never,
            logger: console,
            runId: 'run-1',
            scope: seedBuiltinTemplatesMigration.scope,
            raw: jest.fn()
        })

        expect(createKnexExecutor).toHaveBeenCalledWith(knex)
        expect(seedTemplates).toHaveBeenCalledWith(
            { tag: 'executor' },
            expect.objectContaining({
                failFast: true
            })
        )
    })
})
