/** Public guest assessment flow values shared by the backend and isolated app template. */
import { z } from 'zod'

export const GUEST_ASSESSMENT_ATTEMPT_PHASES = ['block_intro', 'question'] as const
export const guestAssessmentAttemptPhaseSchema = z.enum(GUEST_ASSESSMENT_ATTEMPT_PHASES)
export type GuestAssessmentAttemptPhase = z.infer<typeof guestAssessmentAttemptPhaseSchema>

export const GUEST_ASSESSMENT_TIMER_STATES = ['untimed', 'running', 'paused'] as const
export const guestAssessmentTimerStateSchema = z.enum(GUEST_ASSESSMENT_TIMER_STATES)
export type GuestAssessmentTimerState = z.infer<typeof guestAssessmentTimerStateSchema>

export const GUEST_ASSESSMENT_NUMBERING_MODES = ['global', 'block'] as const
export const guestAssessmentNumberingModeSchema = z.enum(GUEST_ASSESSMENT_NUMBERING_MODES)
export type GuestAssessmentNumberingMode = z.infer<typeof guestAssessmentNumberingModeSchema>

export const guestAssessmentBlockIntroSchema = z
    .object({
        title: z.string().trim().min(1).max(255),
        introduction: z.string().max(10000)
    })
    .strict()

export type GuestAssessmentBlockIntro = z.infer<typeof guestAssessmentBlockIntroSchema>
