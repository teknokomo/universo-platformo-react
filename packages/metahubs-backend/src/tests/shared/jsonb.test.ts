import { toJsonbValue } from '../../domains/shared/jsonb'

describe('toJsonbValue', () => {
    it('returns null for undefined and null', () => {
        expect(toJsonbValue(undefined)).toBeNull()
        expect(toJsonbValue(null)).toBeNull()
    })

    it('keeps objects and arrays as-is', () => {
        const objectValue = { a: 1, b: 'text' }
        const arrayValue = [1, 'two', false]

        expect(toJsonbValue(objectValue)).toBe(objectValue)
        expect(toJsonbValue(arrayValue)).toBe(arrayValue)
    })

    it('serializes primitive scalars to valid JSON tokens', () => {
        expect(toJsonbValue('hello')).toBe('"hello"')
        expect(toJsonbValue(42)).toBe('42')
        expect(toJsonbValue(true)).toBe('true')
        expect(toJsonbValue(false)).toBe('false')
    })
})
