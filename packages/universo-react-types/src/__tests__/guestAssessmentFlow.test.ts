import { describe, expect, it } from 'vitest'

import {
    guestAssessmentAttemptPhaseSchema,
    guestAssessmentBlockIntroSchema,
    guestAssessmentNumberingModeSchema,
    guestAssessmentTimerStateSchema
} from '../common/guestAssessmentFlow'

describe('guest assessment flow contracts', () => {
    it('accepts only supported phases, timer states, and numbering modes', () => {
        expect(guestAssessmentAttemptPhaseSchema.parse('block_intro')).toBe('block_intro')
        expect(guestAssessmentAttemptPhaseSchema.safeParse('result').success).toBe(false)
        expect(guestAssessmentTimerStateSchema.parse('paused')).toBe('paused')
        expect(guestAssessmentTimerStateSchema.safeParse('stopped').success).toBe(false)
        expect(guestAssessmentNumberingModeSchema.parse('block')).toBe('block')
        expect(guestAssessmentNumberingModeSchema.safeParse('per_block').success).toBe(false)
    })

    it('rejects malformed or extended public block intro payloads', () => {
        expect(guestAssessmentBlockIntroSchema.parse({ title: 'Block 1', introduction: 'Read carefully.' })).toEqual({
            title: 'Block 1',
            introduction: 'Read carefully.'
        })
        expect(guestAssessmentBlockIntroSchema.safeParse({ title: '  ', introduction: '' }).success).toBe(false)
        expect(guestAssessmentBlockIntroSchema.safeParse({ title: 'Block 1', introduction: '', blockKey: 'secret' }).success).toBe(false)
    })
})
