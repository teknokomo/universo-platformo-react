import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

// jest-environment-jsdom does not expose TextEncoder/TextDecoder, but
// react-router 7 instantiates `new TextEncoder()` at module scope, which
// breaks every suite whose import graph reaches react-router-dom.
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder
}

// Mock i18n to avoid runtime errors
jest.mock('@universo-react/i18n', () => ({
    __esModule: true,
    default: {
        t: (key: string) => key,
        language: 'en'
    }
}))

jest.mock('react-i18next', () => ({
    useTranslation: (namespace?: string) => ({
        t: (key: string) => `${namespace ? namespace + '.' : ''}${key}`
    })
}))
