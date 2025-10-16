const TIMER_POSITIONS = new Set(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-right'])

export type TimerPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface TimerConfig {
    enabled: boolean
    limitSeconds: number
    position: TimerPosition
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
    enabled: false,
    limitSeconds: 60,
    position: 'top-center'
}

const clampTimerLimitSeconds = (value: unknown): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return DEFAULT_TIMER_CONFIG.limitSeconds
    }

    const rounded = Math.round(value)
    if (!Number.isFinite(rounded)) {
        return DEFAULT_TIMER_CONFIG.limitSeconds
    }

    const min = 10
    const max = 3600
    return Math.min(max, Math.max(min, rounded))
}

export const normalizeTimerConfig = (config: Partial<TimerConfig> | null | undefined): TimerConfig => {
    if (!config || typeof config !== 'object') {
        return { ...DEFAULT_TIMER_CONFIG }
    }

    const enabled = config.enabled === true
    const limitSeconds = clampTimerLimitSeconds(config.limitSeconds)
    const position = TIMER_POSITIONS.has(config.position as TimerPosition)
        ? (config.position as TimerPosition)
        : DEFAULT_TIMER_CONFIG.position

    return {
        enabled,
        limitSeconds,
        position
    }
}

export const sanitizeTimerInput = (
    enabled: boolean,
    limitSeconds: unknown,
    position: unknown
): TimerConfig => {
    const normalized = normalizeTimerConfig({
        enabled,
        limitSeconds: typeof limitSeconds === 'number' ? limitSeconds : Number(limitSeconds),
        position: typeof position === 'string' ? (position as TimerPosition) : undefined
    })

    return normalized
}
