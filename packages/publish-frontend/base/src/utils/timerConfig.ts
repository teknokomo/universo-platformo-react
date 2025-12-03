import { publish } from '@universo/utils'

// Re-export timer configuration utilities from shared package
export const DEFAULT_TIMER_CONFIG = publish.DEFAULT_TIMER_CONFIG
export const normalizeTimerConfig = publish.normalizeTimerConfig
export const sanitizeTimerInput = publish.sanitizeTimerInput
export const clampTimerSeconds = publish.clampTimerSeconds
export const isValidTimerPosition = publish.isValidTimerPosition

// Re-export types
export type TimerConfig = publish.TimerConfig
export type TimerPosition = publish.TimerPosition
