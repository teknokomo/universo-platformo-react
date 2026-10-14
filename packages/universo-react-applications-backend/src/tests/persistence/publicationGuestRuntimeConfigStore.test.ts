import type { DbExecutor } from '@universo-react/utils'
import { mergeApplicationGuestRuntimeConfig } from '../../persistence/applicationsStore'
import { findPublicationGuestRuntimeConfig } from '../../persistence/connectorsStore'

const makeExecutor = (rows: unknown[] = []) =>
    ({ query: jest.fn().mockResolvedValue(rows) } as unknown as DbExecutor & { query: jest.Mock })

describe('publication guest runtime configuration persistence', () => {
    const publicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
    const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
    const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
    const guestConfig = {
        objects: { quizzes: 'Quizzes', accessLinks: 'AccessLinks' },
        fields: { accessLink: { slug: 'Slug' } }
    }

    it('reads the active publication snapshot setting and unwraps the settings envelope', async () => {
        const executor = makeExecutor([{ settingValue: { _value: guestConfig } }])

        await expect(findPublicationGuestRuntimeConfig(executor, publicationId)).resolves.toEqual(guestConfig)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('metahubs.doc_publications')
        expect(sql).toContain('metahubs.doc_publication_versions')
        expect(sql).toContain("setting_entry->>'key' = $2")
        expect(sql).toContain("version.snapshot_json->'settings'")
        expect(parameters).toEqual([publicationId, 'application.publicRuntime.guest'])
    })

    it('returns null for missing or non-object publication settings', async () => {
        const executor = makeExecutor([{ settingValue: null }])

        await expect(findPublicationGuestRuntimeConfig(executor, publicationId)).resolves.toBeNull()
    })

    it('merges guest settings atomically without replacing unrelated application settings', async () => {
        const executor = makeExecutor([{ id: applicationId }])

        await expect(
            mergeApplicationGuestRuntimeConfig(executor, { applicationId, guestRuntimeConfig: guestConfig, userId })
        ).resolves.toBe(true)

        const [sql, parameters] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('jsonb_set(')
        expect(sql).toContain("'{publicRuntime}'")
        expect(sql).toContain("application.settings->'publicRuntime'")
        expect(sql).toContain("application.settings #> '{publicRuntime,guest}'")
        expect(sql).toContain('RETURNING application.id')
        expect(parameters).toEqual([applicationId, JSON.stringify(guestConfig), userId])
    })

    it('fails closed when another guest configuration is already installed', async () => {
        const executor = makeExecutor([])

        await expect(
            mergeApplicationGuestRuntimeConfig(executor, { applicationId, guestRuntimeConfig: guestConfig, userId })
        ).resolves.toBe(false)
        expect(executor.query).toHaveBeenCalledTimes(1)
    })
})
