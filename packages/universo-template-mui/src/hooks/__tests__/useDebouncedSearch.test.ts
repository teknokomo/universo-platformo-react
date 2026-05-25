import { renderHook, act, waitFor } from '@testing-library/react'
import { useDebouncedSearch } from '../useDebouncedSearch'

// Mock timers for debounce testing
jest.useFakeTimers()

describe('useDebouncedSearch', () => {
    afterEach(() => {
        jest.clearAllTimers()
    })

    describe('Initial State', () => {
        it('should initialize with empty string by default', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            expect(result.current.searchValue).toBe('')
        })

        it('should initialize with custom initial value', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() =>
                useDebouncedSearch({
                    onSearchChange: mockOnSearchChange,
                    initialValue: 'initial query'
                })
            )

            expect(result.current.searchValue).toBe('initial query')
        })
    })

    describe('Debounce Timing', () => {
        it('should debounce search changes with default 300ms delay', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            // Simulate user typing
            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Local state updates immediately
            expect(result.current.searchValue).toBe('test')

            // Callback not called yet
            expect(mockOnSearchChange).not.toHaveBeenCalled()

            // Fast-forward time
            act(() => {
                jest.advanceTimersByTime(300)
            })

            // Now callback should be called
            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledWith('test')
            })
        })

        it('should use custom delay when specified', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() =>
                useDebouncedSearch({
                    onSearchChange: mockOnSearchChange,
                    delay: 500
                })
            )

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // After 300ms (default delay) - should not be called
            act(() => {
                jest.advanceTimersByTime(300)
            })
            expect(mockOnSearchChange).not.toHaveBeenCalled()

            // After additional 200ms (total 500ms) - should be called
            act(() => {
                jest.advanceTimersByTime(200)
            })

            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledWith('test')
            })
        })

        it('should cancel previous debounce on rapid typing', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            // Type "t"
            act(() => {
                result.current.handleSearchChange({
                    target: { value: 't' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Wait 100ms
            act(() => {
                jest.advanceTimersByTime(100)
            })

            // Type "te"
            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'te' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Wait 100ms more
            act(() => {
                jest.advanceTimersByTime(100)
            })

            // Type "tes"
            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'tes' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Callback still not called (total 200ms elapsed)
            expect(mockOnSearchChange).not.toHaveBeenCalled()

            // Wait full 300ms from last change
            act(() => {
                jest.advanceTimersByTime(300)
            })

            // Only final value should be passed
            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledTimes(1)
                expect(mockOnSearchChange).toHaveBeenCalledWith('tes')
            })
        })
    })

    describe('Input Change Handler', () => {
        it('should update local state immediately', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'immediate update' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            expect(result.current.searchValue).toBe('immediate update')
        })

        it('should handle empty string', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() =>
                useDebouncedSearch({
                    onSearchChange: mockOnSearchChange,
                    initialValue: 'initial'
                })
            )

            act(() => {
                result.current.handleSearchChange({
                    target: { value: '' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            expect(result.current.searchValue).toBe('')
        })
    })

    describe('Direct Setter', () => {
        it('should update search value programmatically', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.setSearchValue('programmatic value')
            })

            expect(result.current.searchValue).toBe('programmatic value')
        })

        it('should debounce programmatic changes', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.setSearchValue('programmatic')
            })

            expect(mockOnSearchChange).not.toHaveBeenCalled()

            act(() => {
                jest.advanceTimersByTime(300)
            })

            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledWith('programmatic')
            })
        })
    })

    describe('Debounced Utilities', () => {
        it('should provide cancel utility', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Cancel before timeout
            act(() => {
                result.current.debounced.cancel()
            })

            // Wait full delay
            act(() => {
                jest.advanceTimersByTime(300)
            })

            // Callback should not be called
            expect(mockOnSearchChange).not.toHaveBeenCalled()
        })

        it('should provide flush utility', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Flush immediately
            act(() => {
                result.current.debounced.flush()
            })

            // Callback should be called immediately
            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledWith('test')
            })
        })

        it('should provide isPending utility', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            // Initially not pending
            expect(result.current.debounced.isPending()).toBe(false)

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Should be pending after change
            expect(result.current.debounced.isPending()).toBe(true)

            act(() => {
                jest.advanceTimersByTime(300)
            })

            // Not pending after timeout
            waitFor(() => {
                expect(result.current.debounced.isPending()).toBe(false)
            })
        })
    })

    describe('Cleanup on Unmount', () => {
        it('should cancel pending debounce on unmount', () => {
            const mockOnSearchChange = jest.fn()
            const { result, unmount } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'test' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Unmount before timeout
            unmount()

            // Wait full delay
            act(() => {
                jest.advanceTimersByTime(300)
            })

            // Callback should not be called after unmount
            expect(mockOnSearchChange).not.toHaveBeenCalled()
        })
    })

    describe('Integration Scenarios', () => {
        it('should work with multiple rapid changes followed by cancel', () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            // Rapid typing
            ;['t', 'te', 'tes', 'test'].forEach((value) => {
                act(() => {
                    result.current.handleSearchChange({
                        target: { value }
                    } as React.ChangeEvent<HTMLInputElement>)
                })
                act(() => {
                    jest.advanceTimersByTime(50)
                })
            })

            // Cancel before final timeout
            act(() => {
                result.current.debounced.cancel()
            })

            act(() => {
                jest.advanceTimersByTime(500)
            })

            expect(mockOnSearchChange).not.toHaveBeenCalled()
        })

        it('should work with multiple changes followed by flush', async () => {
            const mockOnSearchChange = jest.fn()
            const { result } = renderHook(() => useDebouncedSearch({ onSearchChange: mockOnSearchChange }))

            // Multiple changes
            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'first' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            act(() => {
                jest.advanceTimersByTime(100)
            })

            act(() => {
                result.current.handleSearchChange({
                    target: { value: 'second' }
                } as React.ChangeEvent<HTMLInputElement>)
            })

            // Flush immediately
            act(() => {
                result.current.debounced.flush()
            })

            await waitFor(() => {
                expect(mockOnSearchChange).toHaveBeenCalledTimes(1)
                expect(mockOnSearchChange).toHaveBeenCalledWith('second')
            })
        })
    })
})
