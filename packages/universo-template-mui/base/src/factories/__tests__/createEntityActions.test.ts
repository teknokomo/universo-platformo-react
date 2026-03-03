import { notifyError } from '../createEntityActions'

describe('createEntityActions', () => {
    describe('notifyError', () => {
        const mockEnqueueSnackbar = jest.fn()
        const mockT = jest.fn((key: string, defaultValue?: string) => defaultValue || key)
        const expectErrorNotification = (message: string) => {
            expect(mockEnqueueSnackbar).toHaveBeenCalledWith({
                message,
                options: { variant: 'error' }
            })
        }

        beforeEach(() => {
            jest.clearAllMocks()
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

            expectErrorNotification('Invalid request data')
        })

        it('should extract message from Error instance', () => {
            const error = new Error('Network timeout')

            notifyError(mockT, mockEnqueueSnackbar, error)

            expectErrorNotification('Network timeout')
        })

        it('should use string error directly', () => {
            const error = 'Something went wrong'

            notifyError(mockT, mockEnqueueSnackbar, error)

            expectErrorNotification('Something went wrong')
        })

        it('should use fallback message for unknown error types', () => {
            const error = { unknown: true }

            notifyError(mockT, mockEnqueueSnackbar, error)

            expectErrorNotification('Operation failed')
        })

        it('should use fallback message for null error', () => {
            notifyError(mockT, mockEnqueueSnackbar, null)

            expectErrorNotification('Operation failed')
        })

        it('should use fallback message for undefined error', () => {
            notifyError(mockT, mockEnqueueSnackbar, undefined)

            expectErrorNotification('Operation failed')
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

            expectErrorNotification('Operation failed')
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
            const mockEnqueueV3 = jest.fn((payload: unknown) => payload)

            const error = new Error('V3 test error')
            notifyError(mockT, mockEnqueueV3, error)

            // Should call with object parameter for v3
            expect(mockEnqueueV3).toHaveBeenCalledWith({
                message: 'V3 test error',
                options: { variant: 'error' }
            })
        })

        it('should use custom translation fallback from t function', () => {
            const customT = jest.fn((key: string, defaultValue?: string) => {
                if (key === 'common:error') return 'Custom Error Message'
                return defaultValue || key
            })

            notifyError(customT, mockEnqueueSnackbar, {})

            expectErrorNotification('Custom Error Message')
        })

        describe('Edge Cases', () => {
            it('should handle Axios error without response', () => {
                const axiosError = {
                    message: 'Request failed'
                }

                notifyError(mockT, mockEnqueueSnackbar, axiosError)

                // Should fall back to common.error since no response.data.message
                expectErrorNotification('Operation failed')
            })

            it('should handle Axios error with null data', () => {
                const axiosError = {
                    response: {
                        data: null
                    }
                }

                notifyError(mockT, mockEnqueueSnackbar, axiosError)

                expectErrorNotification('Operation failed')
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

                expectErrorNotification('Operation failed')
            })

            it('should handle Error with empty message', () => {
                const error = new Error('')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expectErrorNotification('Operation failed')
            })

            it('should handle numeric error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, 404)

                expectErrorNotification('Operation failed')
            })

            it('should handle boolean error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, false)

                expectErrorNotification('Operation failed')
            })

            it('should handle array error value', () => {
                notifyError(mockT, mockEnqueueSnackbar, ['error1', 'error2'])

                expectErrorNotification('Operation failed')
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

                expectErrorNotification('Invalid metaverse name: must be unique')
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

                expectErrorNotification('Authentication required')
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

                expectErrorNotification('Insufficient permissions to delete this metaverse')
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

                expectErrorNotification('Metaverse not found')
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

                expectErrorNotification('Internal server error')
            })

            it('should handle network timeout', () => {
                const error = new Error('timeout of 5000ms exceeded')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expectErrorNotification('timeout of 5000ms exceeded')
            })

            it('should handle connection refused', () => {
                const error = new Error('connect ECONNREFUSED 127.0.0.1:3000')

                notifyError(mockT, mockEnqueueSnackbar, error)

                expectErrorNotification('connect ECONNREFUSED 127.0.0.1:3000')
            })
        })
    })
})
