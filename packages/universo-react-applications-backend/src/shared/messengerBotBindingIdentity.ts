import { randomBytes } from 'node:crypto'
import type { ApplicationBotBinding, ApplicationBotPlatform } from '@universo-react/types'

export type MessengerBotPlatform = ApplicationBotPlatform
export type MessengerBotBindingShortId = ApplicationBotBinding['shortId']

export function createMessengerBotBindingShortId(): MessengerBotBindingShortId {
    return randomBytes(16).toString('base64url')
}
