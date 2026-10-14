import type { DbExecutor } from '@universo-react/utils'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'

jest.mock('../../shared/publicRuntimeAccess', () => ({
    listActivePublicWorkspaceIds: jest.fn(),
    resolvePublicRuntimeObject: jest.fn(),
    resolveTopLevelComponents: jest.fn(),
    setPublicWorkspaceContext: jest.fn()
}))

import {
    listActivePublicWorkspaceIds,
    resolvePublicRuntimeObject,
    resolveTopLevelComponents,
    setPublicWorkspaceContext
} from '../../shared/publicRuntimeAccess'
import { createGuestAccessLinkService } from '../../controllers/runtimeGuest/accessLinkService'
import {
    encodeGuestSessionToken,
    encodeStoredGuestSessionState,
    hashGuestSessionSecret
} from '../../controllers/runtimeGuest/guestSessionTokens'

const mockListActivePublicWorkspaceIds = jest.mocked(listActivePublicWorkspaceIds)
const mockResolvePublicRuntimeObject = jest.mocked(resolvePublicRuntimeObject)
const mockResolveTopLevelComponents = jest.mocked(resolveTopLevelComponents)
const mockSetPublicWorkspaceContext = jest.mocked(setPublicWorkspaceContext)

const workspaceA = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const workspaceB = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
const participantId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
const copiedParticipantId = '019ccefc-2f7b-7b36-82f4-85cdb1312274'
const accessLink = {
    id: '019ccefc-2f7b-7b36-82f4-85cdb1312271',
    slug: 'grade-5',
    target_type: 'quiz',
    target_id: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
    is_active: true,
    shows_first_name: true,
    requires_first_name: true,
    shows_last_name: true,
    requires_last_name: true
}

const runtimeConfig = {
    objects: { accessLinks: 'AccessLinks' },
    fields: {
        accessLink: {
            slug: 'Slug',
            targetType: 'TargetType',
            targetId: 'TargetId',
            isActive: 'IsActive',
            showFirstName: 'ShowFirstName',
            requireFirstName: 'RequireFirstName',
            showLastName: 'ShowLastName',
            requireLastName: 'RequireLastName',
            showEmail: 'ShowEmail',
            requireEmail: 'RequireEmail',
            showPhone: 'ShowPhone',
            requirePhone: 'RequirePhone',
            captchaEnabled: 'CaptchaEnabled'
        }
    }
} as unknown as PublicGuestRuntimeConfig

const makeExecutor = (rows: Array<Record<string, unknown>> = [accessLink]) =>
    ({
        query: jest.fn().mockResolvedValue(rows)
    } as unknown as DbExecutor)

describe('guest access-link workspace resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolvePublicRuntimeObject.mockResolvedValue({ tableName: 'obj_access_links' } as never)
        mockResolveTopLevelComponents.mockReturnValue([
            { codename: 'Slug', column_name: 'slug' },
            { codename: 'TargetType', column_name: 'target_type' },
            { codename: 'TargetId', column_name: 'target_id' },
            { codename: 'IsActive', column_name: 'is_active' },
            { codename: 'ShowFirstName', column_name: 'show_first_name' },
            { codename: 'RequireFirstName', column_name: 'require_first_name' },
            { codename: 'ShowLastName', column_name: 'show_last_name' },
            { codename: 'RequireLastName', column_name: 'require_last_name' },
            { codename: 'ShowEmail', column_name: 'show_email' },
            { codename: 'RequireEmail', column_name: 'require_email' },
            { codename: 'ShowPhone', column_name: 'show_phone' },
            { codename: 'RequirePhone', column_name: 'require_phone' },
            { codename: 'CaptchaEnabled', column_name: 'captcha_enabled' }
        ] as never)
        mockSetPublicWorkspaceContext.mockResolvedValue(true)
        mockListActivePublicWorkspaceIds.mockResolvedValue([workspaceA, workspaceB])
    })

    it('resolves a repeated slug in the explicitly validated workspace only', async () => {
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()

        const result = await service.loadAccessLinkRecord(executor, schemaName, runtimeConfig, true, 'grade-5', false, workspaceB)

        expect(result).toMatchObject({ id: accessLink.id, workspaceId: workspaceB })
        expect(mockSetPublicWorkspaceContext).toHaveBeenCalledWith(executor, schemaName, workspaceB)
        expect(mockListActivePublicWorkspaceIds).not.toHaveBeenCalled()
        const [sql, parameters] = (executor.query as jest.Mock).mock.calls[0]
        expect(String(sql)).toContain('AND "workspace_id" = $2')
        expect(parameters).toEqual(['grade-5', workspaceB])
    })

    it('sets workspace context before locking an access-link row in that workspace', async () => {
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()

        const result = await service.resolveAccessLinkRecordBy(
            executor,
            schemaName,
            runtimeConfig,
            true,
            { type: 'id', value: accessLink.id },
            true,
            workspaceB
        )

        expect(result).toMatchObject({ id: accessLink.id, workspaceId: workspaceB })
        expect(mockSetPublicWorkspaceContext).toHaveBeenCalledWith(executor, schemaName, workspaceB)
        const [sql, parameters] = (executor.query as jest.Mock).mock.calls[0]
        expect(String(sql)).toContain('AND "workspace_id" = $2')
        expect(String(sql)).toContain('FOR UPDATE')
        expect(parameters).toEqual([accessLink.id, workspaceB])
        expect(mockSetPublicWorkspaceContext.mock.invocationCallOrder[0]).toBeLessThan(
            (executor.query as jest.Mock).mock.invocationCallOrder[0]
        )
    })

    it('fails closed when the supplied workspace is inactive, personal, foreign, or missing', async () => {
        mockSetPublicWorkspaceContext.mockResolvedValue(false)
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()

        await expect(
            service.loadAccessLinkRecord(executor, schemaName, runtimeConfig, true, 'grade-5', false, workspaceB)
        ).resolves.toBeNull()
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('retains fail-closed unscoped lookup when the slug matches multiple active workspaces', async () => {
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()

        await expect(service.loadAccessLinkRecord(executor, schemaName, runtimeConfig, true, 'grade-5')).resolves.toBeNull()
        expect(mockListActivePublicWorkspaceIds).toHaveBeenCalledWith(executor, schemaName)
        expect(executor.query).toHaveBeenCalledTimes(2)
        expect(mockSetPublicWorkspaceContext).toHaveBeenLastCalledWith(executor, schemaName, null)
    })

    it('accepts explicit null only when workspace support is disabled', async () => {
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()

        await expect(
            service.loadAccessLinkRecord(executor, schemaName, runtimeConfig, false, 'grade-5', false, null)
        ).resolves.toMatchObject({ id: accessLink.id, workspaceId: null })
        await expect(
            service.loadAccessLinkRecord(executor, schemaName, runtimeConfig, false, 'grade-5', false, workspaceA)
        ).resolves.toBeNull()
        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it('rejects a bearer token when its participant claim is edited to match a copied row', async () => {
        const executor = makeExecutor([
            {
                id: copiedParticipantId,
                guest_session_token: encodeStoredGuestSessionState({
                    participantId,
                    linkId: accessLink.id,
                    secretHash: hashGuestSessionSecret('shared-secret'),
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    workspaceId: null
                })
            }
        ])
        const service = createGuestAccessLinkService()
        const configWithParticipantFields = {
            ...runtimeConfig,
            objects: { ...runtimeConfig.objects, participants: 'Students' },
            fields: {
                ...runtimeConfig.fields,
                participant: { isGuest: 'IsGuest', guestSessionToken: 'GuestSessionToken' }
            }
        } as unknown as PublicGuestRuntimeConfig
        mockResolvePublicRuntimeObject.mockResolvedValue({ tableName: 'obj_students' } as never)
        mockResolveTopLevelComponents.mockReturnValue([
            { codename: 'IsGuest', column_name: 'is_guest' },
            { codename: 'GuestSessionToken', column_name: 'guest_session_token' }
        ] as never)

        const tokenWithEditedClaim = encodeGuestSessionToken({
            participantId: copiedParticipantId,
            linkId: accessLink.id,
            secret: 'shared-secret',
            workspaceId: null
        })

        await expect(
            service.validateGuestSession(
                executor,
                schemaName,
                false,
                configWithParticipantFields,
                copiedParticipantId,
                tokenWithEditedClaim
            )
        ).resolves.toMatchObject({ isValid: false, accessLinkId: null })
    })

    it('rejects a bearer token presented for another participant before loading participant data', async () => {
        const executor = makeExecutor()
        const service = createGuestAccessLinkService()
        const token = encodeGuestSessionToken({
            participantId,
            linkId: accessLink.id,
            secret: 'shared-secret',
            workspaceId: null
        })

        await expect(
            service.validateGuestSession(executor, schemaName, false, runtimeConfig, copiedParticipantId, token)
        ).resolves.toMatchObject({ isValid: false, accessLinkId: null })
        expect(executor.query).not.toHaveBeenCalled()
        expect(mockResolvePublicRuntimeObject).not.toHaveBeenCalled()
    })
})
