import type { Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import type { PublicRuntimeSchemaContext } from '../../shared/publicRuntimeAccess'
import type { RuntimeGuestServices } from '../../controllers/runtimeGuest/services'
import { createGuestProgressHandler } from '../../controllers/runtimeGuest/guestProgressHandler'

const participantId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const contentNodeId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const contentItemId = '019ccefc-2f7b-7b36-82f4-85cdb1312271'
const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'

describe('guest progress response commit boundary', () => {
    it('does not send success when the outer public runtime transaction fails to commit', async () => {
        const config = {
            fields: {
                contentProgress: {
                    studentId: 'StudentId',
                    contentNodeId: 'ContentNodeId',
                    status: 'Status',
                    progressPercent: 'ProgressPercent',
                    startedAt: 'StartedAt',
                    completedAt: 'CompletedAt',
                    lastAccessedItemIndex: 'LastAccessedItemIndex'
                }
            }
        }
        const query = jest.fn(async (_sql: string, _parameters?: unknown[]) => [])
        const transaction = jest.fn(async (work: (executor: DbExecutor) => Promise<unknown>) => work({ query } as unknown as DbExecutor))
        const manager = { query, transaction } as unknown as DbExecutor
        const binding = {
            tableName: 'content_progress',
            attrs: Object.entries(config.fields.contentProgress).map(([key, codename]) => ({
                id: key,
                codename,
                column_name: key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
                parent_component_id: null
            }))
        }

        const services = {
            withPublicRuntimeContext: jest.fn(
                async (_applicationId: string, _response: Response, work: (ctx: PublicRuntimeSchemaContext) => Promise<void>) => {
                    await work({
                        applicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312272',
                        schemaName,
                        schemaIdent: 'app_test',
                        settings: {},
                        manager,
                        workspacesEnabled: false,
                        currentWorkspaceId: null
                    })
                    throw new Error('outer transaction commit failed')
                }
            ),
            requirePublicGuestRuntimeConfig: jest.fn(() => config),
            validateGuestSession: jest.fn().mockResolvedValue({ isValid: true, accessLinkId, workspaceId: null }),
            setPublicWorkspaceContext: jest.fn().mockResolvedValue(true),
            loadAccessLinkRecordBy: jest.fn().mockResolvedValue({ id: accessLinkId, isActive: true, workspaceId: null }),
            assertAccessLinkAvailable: jest.fn().mockReturnValue({ ok: true }),
            resolveAllowedRuntimeTarget: jest.fn().mockResolvedValue({ type: 'content', id: contentNodeId }),
            buildContentPayload: jest.fn().mockResolvedValue({ type: 'content', id: contentNodeId, contentItems: [{ id: contentItemId }] }),
            resolveContentProgressBinding: jest.fn().mockResolvedValue(binding),
            createUuidV7: jest.fn().mockResolvedValue('019ccefc-2f7b-7b36-82f4-85cdb1312273')
        } as unknown as RuntimeGuestServices

        const handler = createGuestProgressHandler(services)
        const response = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            headersSent: false
        } as unknown as Response
        const request = {
            params: { applicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312272' },
            body: { participantId, sessionToken: 'valid-session-token', contentNodeId, contentItemId, action: 'view' }
        } as never

        await expect(handler(request, response)).rejects.toThrow('outer transaction commit failed')

        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.any(Array))
        expect(response.json).not.toHaveBeenCalledWith({ ok: true })
    })
})
