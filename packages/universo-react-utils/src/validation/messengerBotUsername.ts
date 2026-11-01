export type MessengerBotPlatform = 'max' | 'telegram'

export type MessengerBotUsernameFailureReason = 'telegram-format' | 'max-format' | 'max-at'

export type MessengerBotUsernameValidation =
    | { valid: true; value: string }
    | { valid: false; value: string; reason: MessengerBotUsernameFailureReason }

/** Normalizes the public bot username format shared by the management UI and API. */
export const parseMessengerBotUsername = (platform: MessengerBotPlatform, input: string): MessengerBotUsernameValidation => {
    const trimmed = input.trim()
    const withoutTelegramPrefix = platform === 'telegram' && trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
    const value = withoutTelegramPrefix.toLowerCase()

    if (platform === 'telegram') {
        return /^[a-z0-9_]{5,32}$/u.test(value) ? { valid: true, value } : { valid: false, value, reason: 'telegram-format' }
    }

    if (value.includes('@')) return { valid: false, value, reason: 'max-at' }
    const validMaxUsername =
        value.length >= 11 && value.length <= 60 && (/^[a-z][a-z0-9_]{7,56}bot$/u.test(value) || /^[a-z][a-z0-9_]{6,55}_bot$/u.test(value))

    return validMaxUsername ? { valid: true, value } : { valid: false, value, reason: 'max-format' }
}
