import { describe, expect, it } from 'vitest'
import { buildMessengerLaunchUrl, validateBotUsername } from './messengerBotUsername'

describe('Messenger bot username helpers', () => {
    it('canonicalizes Telegram usernames and warns when the optional bot suffix is missing', () => {
        expect(validateBotUsername('telegram', ' @SupportTeam ')).toEqual({
            valid: true,
            value: 'supportteam',
            warning: 'telegram-suffix'
        })
    })

    it('accepts Telegram usernames without a bot suffix and validates MAX independently', () => {
        expect(validateBotUsername('telegram', 'my_support_bot')).toEqual({
            valid: true,
            value: 'my_support_bot',
            warning: null
        })
        expect(validateBotUsername('max', 'MaxHelper12bot')).toEqual({ valid: true, value: 'maxhelper12bot', warning: null })
        expect(validateBotUsername('max', 'MaxHelper12_BOT')).toEqual({ valid: true, value: 'maxhelper12_bot', warning: null })
        expect(validateBotUsername('max', 'MAXhelper123')).toMatchObject({ valid: false, reason: 'max-format' })
        expect(validateBotUsername('max', '1maxhelper23')).toMatchObject({ valid: false, reason: 'max-format' })
        expect(validateBotUsername('max', '@MaxHelper12bot')).toMatchObject({ valid: false, reason: 'max-at' })
        expect(validateBotUsername('max', 'max@helper12bot')).toMatchObject({ valid: false, reason: 'max-at' })
    })

    it('creates launch links from the server-issued identifier without changing it', () => {
        const shortId = 'aBcdefGhijkLmNopQrStUv'
        expect(buildMessengerLaunchUrl('telegram', 'support_bot', shortId)).toBe('https://t.me/support_bot?startapp=aBcdefGhijkLmNopQrStUv')
        expect(buildMessengerLaunchUrl('max', 'support_bot', shortId)).toBe('https://max.ru/support_bot?startapp=aBcdefGhijkLmNopQrStUv')
    })
})
