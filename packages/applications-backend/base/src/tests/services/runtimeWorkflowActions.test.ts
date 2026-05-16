import { UpdateFailure } from '../../shared/runtimeHelpers'
import { applyWorkflowAction } from '../../services/runtimeWorkflowActions'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('runtimeWorkflowActions', () => {
    const action = {
        codename: 'AcceptSubmission',
        title: 'Accept submission',
        from: ['PendingReview'],
        to: 'Accepted',
        requiredCapabilities: ['assignment.review'],
        postingCommand: 'post' as const
    }

    const baseParams = {
        schemaName: 'app_018f8a787b8f7c1da111222233334500',
        tableName: 'obj_assignments',
        objectId: '018f8a78-7b8f-7c1d-a111-222233334501',
        rowId: '018f8a78-7b8f-7c1d-a111-222233334502',
        action,
        capabilities: { 'assignment.review': true },
        userId: '018f8a78-7b8f-7c1d-a111-222233334503',
        expectedVersion: 4,
        workspaceId: '018f8a78-7b8f-7c1d-a111-222233334504',
        hasWorkspaceColumn: true
    }

    it('applies a metadata-backed workflow action with optimistic locking and audit', async () => {
        const { executor } = createMockDbExecutor()
        executor.query
            .mockResolvedValueOnce([
                {
                    id: baseParams.rowId,
                    _app_record_state: 'PendingReview',
                    _upl_version: 4,
                    _upl_locked: false
                }
            ])
            .mockResolvedValueOnce([{ id: baseParams.rowId, _app_record_state: 'Accepted', _upl_version: 5 }])
            .mockResolvedValueOnce([])

        await expect(
            applyWorkflowAction({
                executor,
                ...baseParams,
                auditMetadata: { source: 'unit-test' }
            })
        ).resolves.toEqual({
            id: baseParams.rowId,
            actionCodename: 'AcceptSubmission',
            fromStatus: 'PendingReview',
            toStatus: 'Accepted',
            version: 5,
            postingCommand: 'post'
        })

        expect(executor.query).toHaveBeenCalledTimes(3)
        expect(String(executor.query.mock.calls[1][0])).toContain('COALESCE("_upl_version", 1) = $4')
        expect(String(executor.query.mock.calls[1][0])).toContain('"workspace_id" = $5')
        expect(String(executor.query.mock.calls[1][0])).toContain('"_app_record_state" = $2')
        expect(executor.query.mock.calls[1][1]).toEqual([
            baseParams.rowId,
            'Accepted',
            baseParams.userId,
            4,
            baseParams.workspaceId,
            ['PendingReview']
        ])
        expect(String(executor.query.mock.calls[2][0])).toContain('_app_workflow_action_audit')
        expect(executor.query.mock.calls[2][1]).toEqual([
            baseParams.objectId,
            baseParams.tableName,
            baseParams.rowId,
            baseParams.workspaceId,
            'AcceptSubmission',
            'PendingReview',
            'Accepted',
            'post',
            JSON.stringify({ source: 'unit-test' }),
            baseParams.userId
        ])
    })

    it('fails closed when required capabilities are missing', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([
            {
                id: baseParams.rowId,
                _app_record_state: 'PendingReview',
                _upl_version: 4,
                _upl_locked: false
            }
        ])

        await expect(
            applyWorkflowAction({
                executor,
                ...baseParams,
                capabilities: {}
            })
        ).rejects.toMatchObject({
            statusCode: 403,
            body: {
                code: 'WORKFLOW_ACTION_UNAVAILABLE',
                reason: 'missingCapability',
                missingCapabilities: ['assignment.review']
            }
        })

        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it('requires the current row version before mutating', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            applyWorkflowAction({
                executor,
                ...baseParams,
                expectedVersion: 0
            })
        ).rejects.toThrow(UpdateFailure)

        expect(executor.query).not.toHaveBeenCalled()
    })

    it('blocks unsupported scoped capabilities until their predicates are implemented', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([
            {
                id: baseParams.rowId,
                _app_record_state: 'PendingReview',
                _upl_version: 4,
                _upl_locked: false
            }
        ])

        await expect(
            applyWorkflowAction({
                executor,
                ...baseParams,
                action: {
                    ...action,
                    requiredCapabilities: ['recordOwner:assignment.review']
                },
                capabilities: ['recordOwner:assignment.review']
            })
        ).rejects.toMatchObject({
            statusCode: 403,
            body: {
                reason: 'unsupportedScope',
                unsupportedScopes: ['recordOwner']
            }
        })
    })
})
