import '@testing-library/jest-dom'

// Mock i18n to avoid runtime errors
jest.mock('@universo/i18n', () => ({
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
