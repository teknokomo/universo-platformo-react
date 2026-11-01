import type { ApplicationBotPlatform } from '../api/applicationBotBindings'
import { parseMessengerBotUsername } from '@universo-react/utils'

export type BotUsernameValidation =
    | { valid: true; value: string; warning: 'telegram-suffix' | null }
    | { valid: false; value: string; reason: 'telegram-format' | 'max-format' | 'max-at' }

export const validateBotUsername = (platform: ApplicationBotPlatform, input: string): BotUsernameValidation => {
    const result = parseMessengerBotUsername(platform, input)
    if (!result.valid) return result

    return {
        ...result,
        warning: platform === 'telegram' && !result.value.endsWith('bot') ? 'telegram-suffix' : null
    }
}

export const buildMessengerLaunchUrl = (platform: ApplicationBotPlatform, botUsername: string, shortId: string): string => {
    const host = platform === 'telegram' ? 'https://t.me/' : 'https://max.ru/'
    return `${host}${encodeURIComponent(botUsername)}?startapp=${encodeURIComponent(shortId)}`
}
