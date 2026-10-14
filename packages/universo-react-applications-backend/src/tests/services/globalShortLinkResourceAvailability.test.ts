import type { DbExecutor } from '@universo-react/utils'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'
import { isGlobalShortLinkApplicationResourceAvailable } from '../../services/globalShortLinkResourceAvailability'

const mockResolvePublicEntryWorkspace = jest.fn()
const mockResolveEffectiveLayout = jest.fn()

jest.mock('../../services/applicationWorkspaces', () => ({
    PublicEntryWorkspaceError: class PublicEntryWorkspaceError extends Error {},
    resolvePublicEntryWorkspace: (...args: unknown[]) => mockResolvePublicEntryWorkspace(...args)
}))

jest.mock('../../services/effectiveLayoutResolver', () => ({
    resolveEffectiveLayoutForPublicTransaction: (...args: unknown[]) => mockResolveEffectiveLayout(...args)
}))

const executor = { query: jest.fn() } as unknown as DbExecutor
const application = {
    id: '019ccefc-2f7b-7b36-82f4-85cdb1312268',
    schemaName: 'app_018f8a787b8f7c1da111222233334444',
    workspacesEnabled: false
}
const target = {
    kind: 'application-resource' as const,
    applicationId: application.id,
    targetKind: 'page' as const,
    entityTypeCodename: 'home'
}

describe('isGlobalShortLinkApplicationResourceAvailable', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveEffectiveLayout.mockResolvedValue({ status: 'ok' })
    })

    it('delegates resource eligibility to the public effective-layout resolver', async () => {
        await expect(isGlobalShortLinkApplicationResourceAvailable(executor, application, target)).resolves.toBe(true)
        expect(mockResolvePublicEntryWorkspace).not.toHaveBeenCalled()
        expect(mockResolveEffectiveLayout).toHaveBeenCalledWith(
            executor,
            { applicationId: application.id, targetKind: 'page', entityTypeCodename: 'home', locale: 'en' },
            null
        )
    })

    it('requires the public entry workspace when the application enables workspaces', async () => {
        mockResolvePublicEntryWorkspace.mockResolvedValue({ workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312270' })
        await expect(
            isGlobalShortLinkApplicationResourceAvailable(executor, { ...application, workspacesEnabled: true }, target)
        ).resolves.toBe(true)
        expect(mockResolvePublicEntryWorkspace).toHaveBeenCalledWith(executor, application.schemaName)
        expect(mockResolveEffectiveLayout).toHaveBeenCalledWith(executor, expect.any(Object), '019ccefc-2f7b-7b36-82f4-85cdb1312270')
    })

    it('fails closed for unavailable runtime targets but propagates transient resolver failures', async () => {
        mockResolveEffectiveLayout.mockRejectedValueOnce(new EffectiveLayoutError('LAYOUT_TARGET_NOT_FOUND'))
        await expect(isGlobalShortLinkApplicationResourceAvailable(executor, application, target)).resolves.toBe(false)

        const transientError = new EffectiveLayoutError('LAYOUT_RUNTIME_QUERY_FAILED')
        mockResolveEffectiveLayout.mockRejectedValueOnce(transientError)
        await expect(isGlobalShortLinkApplicationResourceAvailable(executor, application, target)).rejects.toBe(transientError)
    })

    it('rejects targets that claim a different application before performing runtime reads', async () => {
        await expect(
            isGlobalShortLinkApplicationResourceAvailable(executor, application, {
                ...target,
                applicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312271'
            })
        ).resolves.toBe(false)
        expect(mockResolveEffectiveLayout).not.toHaveBeenCalled()
    })
})
