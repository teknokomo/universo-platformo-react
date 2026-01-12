import { describe, it, expect } from 'vitest'
import { escapeLikeWildcards } from '../escaping'

describe('escapeLikeWildcards', () => {
    it('should escape percent sign', () => {
        expect(escapeLikeWildcards('test%data')).toBe('test\\%data')
    })

    it('should escape underscore', () => {
        expect(escapeLikeWildcards('test_data')).toBe('test\\_data')
    })

    it('should escape multiple wildcards', () => {
        expect(escapeLikeWildcards('test%_data%')).toBe('test\\%\\_data\\%')
    })

    it('should handle string without wildcards', () => {
        expect(escapeLikeWildcards('normal text')).toBe('normal text')
    })

    it('should handle empty string', () => {
        expect(escapeLikeWildcards('')).toBe('')
    })

    it('should handle consecutive wildcards', () => {
        expect(escapeLikeWildcards('%%__')).toBe('\\%\\%\\_\\_')
    })

    it('should not escape other special characters', () => {
        expect(escapeLikeWildcards("test'\"\\data")).toBe("test'\"\\data")
    })

    it('should handle wildcards at start and end', () => {
        expect(escapeLikeWildcards('%start_end%')).toBe('\\%start\\_end\\%')
    })

    it('should handle unicode characters with wildcards', () => {
        expect(escapeLikeWildcards('тест%данные_текст')).toBe('тест\\%данные\\_текст')
    })
})
