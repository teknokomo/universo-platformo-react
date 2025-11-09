import { describe, it, expect, vi } from 'vitest'
import { notifyError } from '../createEntityActions'

describe('createEntityActions', () => {
    describe('notifyError', () => {
        const mockEnqueueSnackbar = vi.fn()
        const mockT = vi.fn((key: string, defaultValue?: string) => defaultValue || key)

        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('should extract message from Axios error response', () => {
            const axiosError = {
                response: {
                    data: {
                        message: 'Invalid request data'
                    }
                }
            }

            notifyError(mockT, mockEnqueueSnackbar, axiosError)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Invalid request data', { variant: 'error' })
        })

        it('should extract message from Error instance', () => {
            const error = new Error('Network timeout')

            notifyError(mockT, mockEnqueueSnackbar, error)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Network timeout', { variant: 'error' })
        })

        it('should use string error directly', () => {
            const error = 'Something went wrong'

            notifyError(mockT, mockEnqueueSnackbar, error)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Something went wrong', { variant: 'error' })
        })

        it('should use fallback message for unknown error types', () => {
            const error = { unknown: true }

            notifyError(mockT, mockEnqueueSnackbar, error)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
        })

        it('should use fallback message for null error', () => {
            notifyError(mockT, mockEnqueueSnackbar, null)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
        })

        it('should use fallback message for undefined error', () => {
            notifyError(mockT, mockEnqueueSnackbar, undefined)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
        })

        it('should use fallback when Axios error message is empty', () => {
            const axiosError = {
                response: {
                    data: {
                        message: ''
                    }
                }
            }

            notifyError(mockT, mockEnqueueSnackbar, axiosError)

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
        })

        it('should handle missing enqueueSnackbar gracefully', () => {
            expect(() => {
                notifyError(mockT, null, new Error('Test error'))
            }).not.toThrow()
        })

        it('should handle undefined enqueueSnackbar gracefully', () => {
            expect(() => {
                notifyError(mockT, undefined, new Error('Test error'))
            }).not.toThrow()
        })

        it('should support notistack v3 API (object parameter)', () => {
            const mockEnqueueV3 = vi.fn()

            // Simulate v3 API with single parameter
            mockEnqueueV3.length = 1

            const error = new Error('V3 test error')
            notifyError(mockT, mockEnqueueV3, error)

            // Should call with object parameter for v3
            expect(mockEnqueueV3).toHaveBeenCalledWith({
                message: 'V3 test error',
                options: { variant: 'error' }
            })
        })

        it('should use custom translation fallback from t function', () => {
            const customT = vi.fn((key: string, defaultValue?: string) => {
                if (key === 'common.error') return 'Custom Error Message'
                return defaultValue || key
            })

            notifyError(customT, mockEnqueueSnackbar, {})

            expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Custom Error Message', { variant: 'error' })
        })

        describe('Edge Cases', () => {
            it('should handle Axios error without response', () => {
                const axiosError = {
                    message: 'Request failed'
                }

                notifyError(mockT, mockEnqueueSnackbar, axiosError)

                // Should fall back to common.error since no response.data.message
                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle Axios error with null data', () => {
                const axiosError = {
                    response: {
                        data: null
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, axiosError)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle Axios error with non-string message', () => {
                const axiosError = {
                    response: {
                        data: {
                            message: 12345
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, axiosError)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle Error with empty message', () => {
                const error = new Error('')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle numeric error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, 404)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle boolean error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, false)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })

            it('should handle array error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, ['error1', 'error2'])

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Operation failed', { variant: 'error' })
            })
        })

        describe('Real-world Error Scenarios', () => {
            it('should handle 400 Bad Request error', () => {
                const error = {
                    response: {
                        status: 400,
                        data: {
                            message: 'Invalid metaverse name: must be unique'
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Invalid metaverse name: must be unique', { variant: 'error' })
            })

            it('should handle 401 Unauthorized error', () => {
                const error = {
                    response: {
                        status: 401,
                        data: {
                            message: 'Authentication required'
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Authentication required', { variant: 'error' })
            })

            it('should handle 403 Forbidden error', () => {
                const error = {
                    response: {
                        status: 403,
                        data: {
                            message: 'Insufficient permissions to delete this metaverse'
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Insufficient permissions to delete this metaverse', {
                    variant: 'error'
                })
            })

            it('should handle 404 Not Found error', () => {
                const error = {
                    response: {
                        status: 404,
                        data: {
                            message: 'Metaverse not found'
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Metaverse not found', { variant: 'error' })
            })

            it('should handle 500 Internal Server Error', () => {
                const error = {
                    response: {
                        status: 500,
                        data: {
                            message: 'Internal server error'
                        }
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Internal server error', { variant: 'error' })
            })

            it('should handle network timeout', () => {
                const error = new Error('timeout of 5000ms exceeded')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('timeout of 5000ms exceeded', { variant: 'error' })
            })

            it('should handle connection refused', () => {
                const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expect(mockEnqueueSnackbar).toHaveBeenCalledWith('connect ECONNREFUSED 127.0.0.1:3000', { variant: 'error' })
            })
        })
    })
})
