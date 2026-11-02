import { OptimisticLockError } from '@universo-react/utils'
import {
    createApplicationBotBindingInTransaction,
    listApplicationBotBindings,
    releaseActiveApplicationBotBindingsForApplication,
    releaseApplicationBotBindingInTransaction,
    resolveMessengerBindingAttribution,
    updateApplicationBotBindingInTransaction
} from '../../persistence/applicationBotBindingsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const bindingId = '019ccefc-2f7b-7b36-82f4-85cdb1312299'
const shortId = 'abCDefghijKLMN_opQRSTU'

const buildBinding = (overrides: Record<string, unknown> = {}) => ({
    id: bindingId,
    applicationId,
    platform: 'telegram' as const,
    botUsername: 'messengerbot',
    displayName: null,
    status: 'draft' as const,
    shortId,
    releasedAt: null,
    version: 1,
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
    ...overrides
})

describe('Application bot binding persistence', () => {
    it('creates through the database-owned boundary without accepting IDs, actors, or short IDs', async () => {
        const { txExecutor } = createMockDbExecutor()
        const binding = buildBinding()
        txExecutor.query.mockResolvedValueOnce([binding])

        const created = await createApplicationBotBindingInTransaction(txExecutor, {
            applicationId,
            platform: 'telegram',
            botUsername: 'messengerbot',
            displayName: null
        })

        expect(created).toEqual(binding)
        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('applications.create_application_bot_binding')
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual([applicationId, 'telegram', 'messengerbot', null])
        expect(txExecutor.query.mock.calls[0]?.[0]).not.toContain('INSERT INTO applications.rel_application_control_audits')
    })

    it('fails closed when the database boundary reports a missing or deleted Application', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockRejectedValueOnce(
            Object.assign(new Error('Application was not found or is already deleted'), { code: 'P0002' })
        )

        await expect(
            createApplicationBotBindingInTransaction(txExecutor, {
                applicationId,
                platform: 'max',
                botUsername: 'mabcdefghijbot',
                displayName: null
            })
        ).rejects.toThrow('Application was not found or is already deleted')
    })

    it('passes only the changed field patch and expectedVersion to the atomic update boundary', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([buildBinding({ version: 3 })])
            .mockResolvedValueOnce([buildBinding({ botUsername: 'mnewnamebot', version: 4 })])

        const updated = await updateApplicationBotBindingInTransaction(txExecutor, {
            applicationId,
            bindingId,
            expectedVersion: 3,
            botUsername: 'mnewnamebot'
        })

        expect(updated?.version).toBe(4)
        expect(txExecutor.query).toHaveBeenCalledTimes(2)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('FROM applications.rel_application_bot_bindings')
        expect(txExecutor.query.mock.calls[0]?.[0]).not.toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('applications.update_application_bot_binding')
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual([applicationId, bindingId, 3, JSON.stringify({ botUsername: 'mnewnamebot' })])
    })

    it('validates expectedVersion atomically for a no-op update without changing the record version', async () => {
        const { txExecutor } = createMockDbExecutor()
        const current = buildBinding()
        txExecutor.query.mockResolvedValueOnce([current]).mockResolvedValueOnce([current])

        const unchanged = await updateApplicationBotBindingInTransaction(txExecutor, {
            applicationId,
            bindingId,
            expectedVersion: current.version,
            botUsername: current.botUsername
        })

        expect(unchanged).toEqual(current)
        expect(unchanged?.version).toBe(current.version)
        expect(txExecutor.query).toHaveBeenCalledTimes(2)
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('applications.update_application_bot_binding')
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual([
            applicationId,
            bindingId,
            current.version,
            JSON.stringify({ botUsername: current.botUsername })
        ])
    })

    it('rejects stale update and release versions before invoking mutation functions', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([buildBinding({ version: 5 })])

        await expect(
            updateApplicationBotBindingInTransaction(txExecutor, {
                applicationId,
                bindingId,
                expectedVersion: 4,
                status: 'active'
            })
        ).rejects.toMatchObject({
            conflict: expect.objectContaining({
                entityId: bindingId,
                entityType: 'application_bot_binding',
                expectedVersion: 4,
                actualVersion: 5,
                updatedBy: null
            })
        })
        expect(txExecutor.query).toHaveBeenCalledTimes(1)

        txExecutor.query.mockReset().mockResolvedValueOnce([buildBinding({ version: 5 })])
        await expect(
            releaseApplicationBotBindingInTransaction(txExecutor, {
                applicationId,
                bindingId,
                expectedVersion: 4
            })
        ).rejects.toMatchObject({
            constructor: OptimisticLockError,
            conflict: expect.objectContaining({
                entityId: bindingId,
                entityType: 'application_bot_binding',
                expectedVersion: 4,
                actualVersion: 5,
                updatedBy: null
            })
        })
        expect(txExecutor.query).toHaveBeenCalledTimes(1)
    })

    it('does not include another editor identity in a database version conflict', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([buildBinding()]).mockRejectedValueOnce(
            Object.assign(new Error('Application bot binding version conflict'), {
                code: '40001',
                detail: JSON.stringify({
                    expectedVersion: 1,
                    actualVersion: 2,
                    updatedAt: '2026-10-31T00:01:00.000Z',
                    updatedBy: '019ccefc-2f7b-7b36-82f4-85cdb1312400'
                })
            })
        )

        await expect(
            updateApplicationBotBindingInTransaction(txExecutor, {
                applicationId,
                bindingId,
                expectedVersion: 1,
                status: 'active'
            })
        ).rejects.toMatchObject({
            conflict: expect.objectContaining({
                expectedVersion: 1,
                actualVersion: 2,
                updatedBy: null
            })
        })
    })

    it('releases through the atomic canonical release function', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([buildBinding({ status: 'active', version: 2 })])
            .mockResolvedValueOnce([buildBinding({ status: 'disabled', releasedAt: new Date(), version: 3 })])

        const released = await releaseApplicationBotBindingInTransaction(txExecutor, {
            applicationId,
            bindingId,
            expectedVersion: 2
        })

        expect(released?.status).toBe('disabled')
        expect(txExecutor.query).toHaveBeenCalledTimes(2)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('FROM applications.rel_application_bot_bindings')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('applications.release_application_bot_binding')
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual([applicationId, bindingId, 2])
    })

    it('releases all retained bindings through the authorized Application-delete boundary', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([{ releasedCount: 2 }])

        await expect(releaseActiveApplicationBotBindingsForApplication(txExecutor, applicationId)).resolves.toBe(2)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('applications.release_application_bot_bindings_for_application')
        expect(txExecutor.query.mock.calls[0]?.[1]).toEqual([applicationId])
    })

    it('filters management lists by Application and resolves attribution only for active public bindings', async () => {
        const { txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([buildBinding()]).mockResolvedValueOnce([{ platform: 'telegram' }])

        await expect(listApplicationBotBindings(txExecutor, applicationId)).resolves.toHaveLength(1)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('b.application_id = $1')
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('b._app_deleted = false')

        await expect(resolveMessengerBindingAttribution(txExecutor, applicationId, shortId)).resolves.toEqual({ platform: 'telegram' })
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('b.application_id = $1')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('b.short_id = $2')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain("b.status = 'active'")
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('a.is_public = true')
        expect(txExecutor.query.mock.calls[1]?.[0]).not.toContain('init_data')
        expect(txExecutor.query.mock.calls[1]?.[1]).toEqual([applicationId, shortId])
    })

    it('returns attribution fallback for malformed short IDs without querying storage', async () => {
        const { txExecutor } = createMockDbExecutor()
        await expect(resolveMessengerBindingAttribution(txExecutor, applicationId, 'unknown')).resolves.toBeNull()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })
})
