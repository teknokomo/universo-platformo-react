import {
    createMessengerBotBindingShortId,
    InvalidMessengerBotUsernameError,
    normalizeMessengerBotUsername
} from '../../services/messengerBotBindingIdentity'

describe('Messenger bot binding identity', () => {
    it('canonicalizes Telegram usernames and accepts a single leading at sign', () => {
        expect(normalizeMessengerBotUsername('telegram', ' @My_TestBot ')).toBe('my_testbot')
    })

    it('requires canonical MAX usernames to end with bot, with or without an underscore separator', () => {
        expect(normalizeMessengerBotUsername('max', 'MABCDEFGbot')).toBe('mabcdefgbot')
        expect(normalizeMessengerBotUsername('max', 'MABCDEFGHIJbot')).toBe('mabcdefghijbot')
        expect(normalizeMessengerBotUsername('max', 'MABCDEFGHIJ_BOT')).toBe('mabcdefghij_bot')
        expect(normalizeMessengerBotUsername('max', `m${'a'.repeat(56)}bot`)).toHaveLength(60)
    })

    it('rejects usernames outside each provider format', () => {
        expect(() => normalizeMessengerBotUsername('telegram', 'four')).toThrow(InvalidMessengerBotUsernameError)
        expect(() => normalizeMessengerBotUsername('max', 'mabcdefbot')).toThrow(InvalidMessengerBotUsernameError)
        expect(() => normalizeMessengerBotUsername('max', 'MABCDEFGHIJ')).toThrow(InvalidMessengerBotUsernameError)
        expect(() => normalizeMessengerBotUsername('max', `m${'a'.repeat(57)}bot`)).toThrow(InvalidMessengerBotUsernameError)
        expect(() => normalizeMessengerBotUsername('max', '@mabcdefghijbot')).toThrow(InvalidMessengerBotUsernameError)
        expect(() => normalizeMessengerBotUsername('max', 'short')).toThrow(InvalidMessengerBotUsernameError)
    })

    it('generates opaque 128-bit unpadded base64url short ids', () => {
        const shortId = createMessengerBotBindingShortId()

        expect(shortId).toMatch(/^[A-Za-z0-9_-]{22}$/)
        expect(Buffer.from(shortId, 'base64url')).toHaveLength(16)
        expect(createMessengerBotBindingShortId()).not.toBe(shortId)
    })
})
