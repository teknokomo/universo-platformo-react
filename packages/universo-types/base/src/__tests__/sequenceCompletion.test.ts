import { describe, expect, it } from 'vitest'

import {
    calculateWeightedProgress,
    evaluateCompletionCondition,
    evaluateCompletionConditions,
    evaluateSequenceStepAvailability,
    isCompletionItemComplete,
    sequencePolicySchema
} from '../common/sequenceCompletion'

describe('sequence and completion engine', () => {
    it('calculates deterministic weighted progress from mixed completion items', () => {
        expect(
            calculateWeightedProgress([
                { id: 'intro', status: 'completed' },
                { id: 'lesson', status: 'inProgress', progressPercent: 50 },
                { id: 'quiz', status: 'failed', scorePercent: 30, weight: 2 }
            ])
        ).toBe(52.5)

        expect(calculateWeightedProgress([])).toBe(0)
    })

    it('evaluates generic completion conditions against records and step collections', () => {
        const record = {
            ProgressPercent: 100,
            Score: 82,
            AttendanceStatus: 'Attended',
            CertificateStatus: 'Issued',
            ManuallyAccepted: true
        }
        const items = [
            { id: 'intro', status: 'completed' as const },
            { id: 'quiz', status: 'passed' as const, scorePercent: 82 }
        ]

        expect(evaluateCompletionCondition({ kind: 'progressPercent', field: 'ProgressPercent', value: 100 }, record)).toBe(true)
        expect(evaluateCompletionCondition({ kind: 'scoreAtLeast', field: 'Score', value: 90 }, record)).toBe(false)
        expect(evaluateCompletionCondition({ kind: 'attendanceMarked', field: 'AttendanceStatus' }, record)).toBe(true)
        expect(evaluateCompletionCondition({ kind: 'certificateIssued', field: 'CertificateStatus' }, record)).toBe(true)
        expect(evaluateCompletionCondition({ kind: 'manual', field: 'ManuallyAccepted', value: true }, record)).toBe(true)
        expect(evaluateCompletionCondition({ kind: 'allStepsCompleted' }, record, items)).toBe(true)
        expect(
            evaluateCompletionConditions(
                [
                    { kind: 'progressPercent', field: 'ProgressPercent', value: 100 },
                    { kind: 'scoreAtLeast', field: 'Score', value: 80 }
                ],
                record
            )
        ).toBe(true)
    })

    it('locks sequential steps until all earlier ordered steps are complete', () => {
        const policy = sequencePolicySchema.parse({ mode: 'sequential' })
        const steps = [
            { id: 'one', order: 1, status: 'completed' as const },
            { id: 'two', order: 2, status: 'inProgress' as const, progressPercent: 50 },
            { id: 'three', order: 3, status: 'notStarted' as const }
        ]

        expect(evaluateSequenceStepAvailability(policy, steps, 'two', new Date('2026-05-15T12:00:00Z'))).toEqual({
            stepId: 'two',
            available: true,
            reason: 'available',
            lockedByStepIds: []
        })
        expect(evaluateSequenceStepAvailability(policy, steps, 'three', new Date('2026-05-15T12:00:00Z'))).toEqual({
            stepId: 'three',
            available: false,
            reason: 'sequentialLocked',
            lockedByStepIds: ['two']
        })
    })

    it('locks scheduled and prerequisite steps with explicit fail-closed reasons', () => {
        const now = new Date('2026-05-15T12:00:00Z')
        expect(
            evaluateSequenceStepAvailability(
                { mode: 'scheduled', completion: [] },
                [{ id: 'future', availableFrom: '2026-05-16T00:00:00.000Z', status: 'notStarted' }],
                'future',
                now
            )
        ).toMatchObject({ available: false, reason: 'scheduledNotStarted' })

        expect(
            evaluateSequenceStepAvailability(
                { mode: 'prerequisite', completion: [] },
                [
                    { id: 'intro', status: 'completed' },
                    { id: 'quiz', status: 'notStarted' },
                    { id: 'certificate', status: 'notStarted', prerequisiteStepIds: ['intro', 'quiz'] }
                ],
                'certificate',
                now
            )
        ).toEqual({
            stepId: 'certificate',
            available: false,
            reason: 'prerequisiteLocked',
            lockedByStepIds: ['quiz']
        })
    })

    it('treats explicit 100 percent progress as complete for imported progress rows', () => {
        expect(isCompletionItemComplete({ status: 'inProgress', progressPercent: 100 })).toBe(true)
    })
})
