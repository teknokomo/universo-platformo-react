import { describe, expect, it } from 'vitest'
import { parseMessengerBotUsername } from '../messengerBotUsername'

describe('parseMessengerBotUsername', () => {
    it('normalizes Telegram usernames and permits an optional leading at sign', () => {
        expect(parseMessengerBotUsername('telegram', ' @SupportTeam ')).toEqual({ valid: true, value: 'supportteam' })
        expect(parseMessengerBotUsername('telegram', ' @ SupportTeam ')).toEqual({
            valid: false,
            value: ' supportteam',
            reason: 'telegram-format'
        })
    })

    it('applies the MAX bot suffix and length constraints after normalization', () => {
        expect(parseMessengerBotUsername('max', 'MaxHelper12bot')).toEqual({ valid: true, value: 'maxhelper12bot' })
        expect(parseMessengerBotUsername('max', 'MaxHelper12')).toMatchObject({ valid: false, reason: 'max-format' })
        expect(parseMessengerBotUsername('max', '@MaxHelper12bot')).toMatchObject({ valid: false, reason: 'max-at' })
    })
})
