const mockResolveGuestConfig = jest.fn()
const mockResolveParticipantObject = jest.fn()
const mockRevokeReplay = jest.fn()
const mockLockPublicWorkspaceForMutation = jest.fn()

jest.mock('../../services/publicGuestRuntimeConfig', () => ({
    resolvePublicGuestRuntimeConfig: (...args: unknown[]) => mockResolveGuestConfig(...args)
}))

jest.mock('../../shared/publicRuntimeAccess', () => ({
    lockPublicWorkspaceForMutation: (...args: unknown[]) => mockLockPublicWorkspaceForMutation(...args),
    resolvePublicRuntimeObject: (...args: unknown[]) => mockResolveParticipantObject(...args),
    resolveTopLevelComponents: (binding: { attrs: unknown[] }) => binding.attrs
}))

jest.mock('../../persistence/guestSessionIdempotencyStore', () => ({
    revokeGuestSessionIdempotencyForAccessLink: (...args: unknown[]) => mockRevokeReplay(...args)
}))

import type { DbExecutor } from '@universo-react/utils'
import { lockGuestAccessLinkWorkspace, revokeGuestSessionsForAccessLink } from '../../services/guestAccessLinkRevocation'

const config = {
    objects: { participants: 'Participants' },
    fields: { participant: { isGuest: 'IsGuest', guestSessionToken: 'GuestSessionToken' } }
}
const participantBinding = {
    tableName: 'participants',
    attrs: [
        { codename: 'IsGuest', column_name: 'is_guest', parent_component_id: null },
        { codename: 'GuestSessionToken', column_name: 'guest_session_token', parent_component_id: null }
    ]
}
const executor = { query: jest.fn().mockResolvedValue([]) } as unknown as DbExecutor
const input = {
    executor,
    applicationId: '018f8a78-7b8f-7c1d-a111-222233334441',
    schemaName: 'app_018f8a787b8f7c1da111222233334441',
    settings: { publicRuntime: { guest: {} } },
    workspacesEnabled: true,
    workspaceId: '018f8a78-7b8f-7c1d-a111-222233334442',
    accessLinkId: '018f8a78-7b8f-7c1d-a111-222233334443',
    actorUserId: '018f8a78-7b8f-7c1d-a111-222233334444'
}

describe('guest access-link revocation', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        mockResolveGuestConfig.mockReturnValue(config)
        mockResolveParticipantObject.mockResolvedValue(participantBinding)
        mockRevokeReplay.mockResolvedValue(1)
        ;(executor.query as jest.Mock).mockResolvedValue([{ id: '018f8a78-7b8f-7c1d-a111-222233334445' }])
    })

    it('clears bearer session state and replay credentials within the supplied transaction', async () => {
        await expect(revokeGuestSessionsForAccessLink(input)).resolves.toBe(1)

        expect(mockRevokeReplay).toHaveBeenCalledWith(executor, input.applicationId, input.accessLinkId, input.workspaceId)
        const [sql, parameters] = (executor.query as jest.Mock).mock.calls[0] as [string, unknown[]]
        expect(sql).toContain('UPDATE "app_018f8a787b8f7c1da111222233334441"."participants"')
        expect(sql).toContain('AND "workspace_id" = $2')
        expect(sql).toContain('POSITION($1 IN "guest_session_token") > 0')
        expect(sql).toContain('"_upl_version" = COALESCE("_upl_version", 1) + 1')
        expect(parameters).toEqual(['"linkId":"018f8a78-7b8f-7c1d-a111-222233334443"', input.workspaceId, input.actorUserId])
    })

    it('normalizes access-link UUID casing before matching bearer session tokens', async () => {
        await revokeGuestSessionsForAccessLink({ ...input, accessLinkId: input.accessLinkId.toUpperCase() })

        const [, parameters] = (executor.query as jest.Mock).mock.calls[0] as [string, unknown[]]
        expect(parameters[0]).toBe('"linkId":"018f8a78-7b8f-7c1d-a111-222233334443"')
    })

    it('deletes encrypted replay credentials even when guest runtime mapping has been removed', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(revokeGuestSessionsForAccessLink({ ...input, settings: {} })).resolves.toBe(0)

        expect(mockRevokeReplay).toHaveBeenCalledWith(executor, input.applicationId, input.accessLinkId, input.workspaceId)
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('fails closed for an incomplete configured mapping after replay deletion so the caller can roll back', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(
            revokeGuestSessionsForAccessLink({ ...input, settings: { publicRuntime: { guest: { objects: {} } } } })
        ).rejects.toThrow('Guest runtime mapping is incomplete during access-link revocation')

        expect(mockRevokeReplay).toHaveBeenCalledTimes(1)
    })
})

describe('lockGuestAccessLinkWorkspace', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        mockLockPublicWorkspaceForMutation.mockResolvedValue(true)
    })

    it('locks the active workspace row before access-link rows are touched', async () => {
        const query = jest.fn().mockResolvedValue([{ id: input.workspaceId }])
        const transaction = { query } as unknown as DbExecutor

        await lockGuestAccessLinkWorkspace({
            executor: transaction,
            schemaName: input.schemaName,
            workspacesEnabled: true,
            workspaceId: input.workspaceId
        })

        expect(mockLockPublicWorkspaceForMutation).toHaveBeenCalledWith(transaction, input.schemaName, input.workspaceId)
        expect(query).not.toHaveBeenCalled()
    })

    it('fails closed when the workspace is no longer active', async () => {
        mockLockPublicWorkspaceForMutation.mockResolvedValue(false)
        const transaction = { query: jest.fn() } as unknown as DbExecutor

        await expect(
            lockGuestAccessLinkWorkspace({
                executor: transaction,
                schemaName: input.schemaName,
                workspacesEnabled: true,
                workspaceId: input.workspaceId
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
