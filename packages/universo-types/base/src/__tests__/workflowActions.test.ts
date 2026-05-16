import { describe, expect, it } from 'vitest'

import { evaluateWorkflowActionAvailability, workflowActionSchema } from '../common/workflowActions'

describe('workflow action contracts', () => {
    const action = workflowActionSchema.parse({
        codename: 'AcceptSubmission',
        title: 'Accept submission',
        from: ['PendingReview'],
        to: 'Accepted',
        requiredCapabilities: ['assignment.review'],
        confirmation: {
            required: true,
            message: 'Accept this submission?'
        },
        scriptCodename: 'AssignmentReviewScript',
        postingCommand: 'post'
    })

    it('models metadata-backed workflow actions without expanding core record commands', () => {
        expect(action).toMatchObject({
            codename: 'AcceptSubmission',
            from: ['PendingReview'],
            to: 'Accepted',
            postingCommand: 'post',
            confirmation: { required: true }
        })
    })

    it('requires matching status and explicit capabilities', () => {
        expect(
            evaluateWorkflowActionAvailability({
                action,
                currentStatus: 'PendingReview',
                capabilities: { 'assignment.review': true }
            })
        ).toEqual({
            actionCodename: 'AcceptSubmission',
            available: true,
            reason: 'available',
            missingCapabilities: [],
            unsupportedScopes: []
        })

        expect(
            evaluateWorkflowActionAvailability({
                action,
                currentStatus: 'PendingReview',
                capabilities: {}
            })
        ).toMatchObject({
            available: false,
            reason: 'missingCapability',
            missingCapabilities: ['assignment.review']
        })

        expect(
            evaluateWorkflowActionAvailability({
                action,
                currentStatus: 'Accepted',
                capabilities: { 'assignment.review': true }
            })
        ).toMatchObject({ available: false, reason: 'statusMismatch' })
    })

    it('fails closed for unsupported scoped capabilities until predicates exist', () => {
        const scopedAction = workflowActionSchema.parse({
            codename: 'SupervisorApprove',
            title: 'Supervisor approve',
            from: ['PendingReview'],
            to: 'Accepted',
            requiredCapabilities: ['recordOwner:assignment.review']
        })

        expect(
            evaluateWorkflowActionAvailability({
                action: scopedAction,
                currentStatus: 'PendingReview',
                capabilities: ['recordOwner:assignment.review']
            })
        ).toMatchObject({
            available: false,
            reason: 'unsupportedScope',
            unsupportedScopes: ['recordOwner']
        })
    })
})
