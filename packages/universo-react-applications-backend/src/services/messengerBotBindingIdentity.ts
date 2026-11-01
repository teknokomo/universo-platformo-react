import { parseMessengerBotUsername } from '@universo-react/utils'
import type { MessengerBotPlatform } from '../shared/messengerBotBindingIdentity'

export { createMessengerBotBindingShortId } from '../shared/messengerBotBindingIdentity'
export type { MessengerBotBindingShortId, MessengerBotPlatform } from '../shared/messengerBotBindingIdentity'

export class InvalidMessengerBotUsernameError extends Error {
    constructor(platform: MessengerBotPlatform) {
        super(`Invalid ${platform === 'max' ? 'MAX' : 'Telegram'} bot username`)
        this.name = 'InvalidMessengerBotUsernameError'
    }
}

export function normalizeMessengerBotUsername(platform: MessengerBotPlatform, input: string): string {
    const result = parseMessengerBotUsername(platform, input)
    if (!result.valid) {
        throw new InvalidMessengerBotUsernameError(platform)
    }

    return result.value
}
