import { createCodenameVLC, updateLocalizedContentLocale } from '@universo/utils/vlc'
import { syncCodenamePayloadText } from '../../domains/shared/codenamePayload'

describe('codenamePayload', () => {
    it('normalizes every locale entry when style context is provided', () => {
        let value = createCodenameVLC('en', 'Hello World')
        value = updateLocalizedContentLocale(value, 'ru', 'Привет Мир')

        const synced = syncCodenamePayloadText(value, 'en', 'hello-world', 'kebab-case', 'en-ru')

        expect(synced?.locales.en?.content).toBe('hello-world')
        expect(synced?.locales.ru?.content).toBe('привет-мир')
    })
})
