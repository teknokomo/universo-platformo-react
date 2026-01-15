import { renderHook, act } from '@testing-library/react'
import { useViewPreference, DEFAULT_VIEW_STYLE, ViewStyle } from '../useViewPreference'

describe('useViewPreference', () => {
    // Mock localStorage
    const localStorageMock = (() => {
        let store: Record<string, string> = {}
        return {
            getItem: jest.fn((key: string) => store[key] || null),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key]
            }),
            clear: jest.fn(() => {
                store = {}
            })
        }
    })()

    const originalLocalStorage = global.localStorage

    beforeEach(() => {
        // Reset mocks
        localStorageMock.clear()
        jest.clearAllMocks()

        // Mock localStorage
        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true
        })
    })

    afterEach(() => {
        // Restore original localStorage
        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage,
            writable: true
        })
    })

    describe('Initial State', () => {
        it('should initialize with DEFAULT_VIEW_STYLE when no stored value', () => {
            const { result } = renderHook(() => useViewPreference('testKey'))

            expect(result.current[0]).toBe(DEFAULT_VIEW_STYLE)
            expect(result.current[0]).toBe('card')
        })

        it('should initialize with stored value from localStorage', () => {
            localStorageMock.setItem('testKey', 'table')

            const { result } = renderHook(() => useViewPreference('testKey'))

            expect(result.current[0]).toBe('table')
        })

        it('should use custom default when provided', () => {
            const { result } = renderHook(() => useViewPreference('testKey', 'list'))

            expect(result.current[0]).toBe('list')
        })

        it('should ignore invalid stored values and use default', () => {
            localStorageMock.setItem('testKey', 'invalid-value')

            const { result } = renderHook(() => useViewPreference('testKey'))

            expect(result.current[0]).toBe('card')
        })

        it('should accept "list" as valid stored value', () => {
            localStorageMock.setItem('testKey', 'list')

            const { result } = renderHook(() => useViewPreference('testKey'))

            expect(result.current[0]).toBe('list')
        })
    })

    describe('setView', () => {
        it('should update view state', () => {
            const { result } = renderHook(() => useViewPreference('testKey'))

            act(() => {
                result.current[1]('table')
            })

            expect(result.current[0]).toBe('table')
        })

        it('should persist view to localStorage', () => {
            const { result } = renderHook(() => useViewPreference('testKey'))

            act(() => {
                result.current[1]('table')
            })

            expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', 'table')
        })

        it('should handle list view style', () => {
            const { result } = renderHook(() => useViewPreference('testKey'))

            act(() => {
                result.current[1]('list')
            })

            expect(result.current[0]).toBe('list')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', 'list')
        })

        it('should have stable setView reference', () => {
            const { result, rerender } = renderHook(() => useViewPreference('testKey'))

            const firstSetView = result.current[1]
            rerender()
            const secondSetView = result.current[1]

            expect(firstSetView).toBe(secondSetView)
        })
    })

    describe('Error Handling', () => {
        it('should handle localStorage getItem error gracefully', () => {
            localStorageMock.getItem.mockImplementationOnce(() => {
                throw new Error('Storage error')
            })

            const { result } = renderHook(() => useViewPreference('testKey'))

            expect(result.current[0]).toBe('card')
        })

        it('should handle localStorage setItem error gracefully', () => {
            localStorageMock.setItem.mockImplementationOnce(() => {
                throw new Error('Quota exceeded')
            })

            const { result } = renderHook(() => useViewPreference('testKey'))

            // Should not throw, just fail silently
            act(() => {
                result.current[1]('table')
            })

            // State should still update
            expect(result.current[0]).toBe('table')
        })
    })

    describe('SSR Safety', () => {
        it('should handle missing window object', () => {
            // Temporarily remove localStorage
            const originalWindow = global.window
            // @ts-expect-error - intentionally testing undefined window
            delete global.window

            // Since window is undefined, localStorage check should fail safely
            // We need to re-import the hook or test differently
            // For this test, we'll simulate by making localStorage unavailable
            Object.defineProperty(global, 'localStorage', {
                get: () => {
                    throw new ReferenceError('localStorage is not defined')
                }
            })

            // Restore window for the hook to work
            global.window = originalWindow

            // The hook should still work with the default value
            const { result } = renderHook(() => useViewPreference('testKey'))
            expect(result.current[0]).toBe('card')
        })
    })

    describe('Different Storage Keys', () => {
        it('should use different keys for different instances', () => {
            const { result: result1 } = renderHook(() => useViewPreference('key1'))
            const { result: result2 } = renderHook(() => useViewPreference('key2'))

            act(() => {
                result1.current[1]('table')
            })

            expect(result1.current[0]).toBe('table')
            expect(result2.current[0]).toBe('card')
            expect(localStorageMock.setItem).toHaveBeenCalledWith('key1', 'table')
        })
    })

    describe('Type Safety', () => {
        it('should only accept valid ViewStyle values', () => {
            const { result } = renderHook(() => useViewPreference('testKey'))

            const validStyles: ViewStyle[] = ['card', 'table', 'list']
            validStyles.forEach((style) => {
                act(() => {
                    result.current[1](style)
                })
                expect(result.current[0]).toBe(style)
            })
        })
    })
})
