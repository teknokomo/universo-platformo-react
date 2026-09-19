import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { axiosCreateMock, axiosInstancesQueue, createMockAxiosInstance } = vi.hoisted(() => {
    const axiosInstancesQueue: any[] = []

    const createMockAxiosInstance = () => {
        const requestHandlers: Array<{ fulfilled?: (value: any) => any | Promise<any>; rejected?: (error: any) => any }> = []
        const responseHandlers: Array<{ fulfilled?: (value: any) => any | Promise<any>; rejected?: (error: any) => any }> = []

        const instance = Object.assign(
            vi.fn(async (config: any = {}) => {
                let nextConfig = {
                    ...config,
                    headers:
                        config?.headers && typeof config.headers === 'object' && !Array.isArray(config.headers)
                            ? { ...config.headers }
                            : config?.headers ?? {}
                }

                for (const handler of requestHandlers) {
                    if (handler.fulfilled) {
                        nextConfig = await handler.fulfilled(nextConfig)
                    }
                }

                return {
                    status: 200,
                    config: nextConfig,
                    data: null
                }
            }),
            {
                defaults: {
                    headers: {
                        common: {}
                    }
                },
                interceptors: {
                    request: {
                        handlers: requestHandlers,
                        use: (fulfilled: (value: any) => any, rejected?: (error: any) => any) => {
                            requestHandlers.push({ fulfilled, rejected })
                            return requestHandlers.length - 1
                        }
                    },
                    response: {
                        handlers: responseHandlers,
                        use: (fulfilled: (value: any) => any, rejected?: (error: any) => any) => {
                            responseHandlers.push({ fulfilled, rejected })
                            return responseHandlers.length - 1
                        }
                    }
                },
                get: vi.fn()
            }
        )

        return instance
    }

    const axiosCreateMock = vi.fn(() => axiosInstancesQueue.shift() ?? createMockAxiosInstance())

    return {
        axiosCreateMock,
        axiosInstancesQueue,
        createMockAxiosInstance
    }
})

vi.mock('axios', () => ({
    default: {
        create: axiosCreateMock
    },
    create: axiosCreateMock
}))

const utilsMock = vi.hoisted(() => ({
    isPublicRoute: vi.fn(() => false)
}))

vi.mock('@universo-react/utils', () => ({
    isDevelopment: () => false,
    isPublicRoute: utilsMock.isPublicRoute
}))

import { AUTH_CSRF_STORAGE_KEY, createAuthClient } from '../client'

const createInterceptedClient = () => {
    const apiInstance = createMockAxiosInstance()
    const csrfInstance = createMockAxiosInstance()
    axiosInstancesQueue.push(apiInstance, csrfInstance)
    createAuthClient({ baseURL: '/api/v1', redirectOn401: 'auto' })

    const responseInterceptor = apiInstance.interceptors.response.handlers[0]?.rejected
    expect(responseInterceptor).toBeTypeOf('function')
    return { apiInstance, responseInterceptor: responseInterceptor! }
}

describe('createAuthClient', () => {
    beforeEach(() => {
        axiosInstancesQueue.length = 0
        axiosCreateMock.mockClear()
        window.sessionStorage.clear()
        utilsMock.isPublicRoute.mockReset()
        utilsMock.isPublicRoute.mockReturnValue(false)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('retries a csrf-protected request once after a 419 response with a fresh token', async () => {
        const apiInstance = createMockAxiosInstance()
        const csrfInstance = createMockAxiosInstance()
        axiosInstancesQueue.push(apiInstance, csrfInstance)
        csrfInstance.get.mockResolvedValueOnce({ data: { csrfToken: 'fresh-token' } })

        window.sessionStorage.setItem(AUTH_CSRF_STORAGE_KEY, 'stale-token')
        createAuthClient({ baseURL: '/api/v1' })

        const requestInterceptor = apiInstance.interceptors.request.handlers[0]?.fulfilled
        const responseInterceptor = apiInstance.interceptors.response.handlers[0]?.rejected

        const initialConfig = await requestInterceptor({ method: 'post', headers: {} })
        expect(initialConfig.headers['X-CSRF-Token']).toBe('stale-token')

        const retriedResponse = await responseInterceptor({
            response: { status: 419 },
            config: initialConfig
        })

        expect(csrfInstance.get).toHaveBeenCalledWith('auth/csrf')
        expect(apiInstance).toHaveBeenCalledTimes(1)
        expect(retriedResponse.config.headers['X-CSRF-Token']).toBe('fresh-token')
        expect(window.sessionStorage.getItem(AUTH_CSRF_STORAGE_KEY)).toBe('fresh-token')
    })

    it('does not retry indefinitely after the csrf refresh attempt is exhausted', async () => {
        const apiInstance = createMockAxiosInstance()
        const csrfInstance = createMockAxiosInstance()
        axiosInstancesQueue.push(apiInstance, csrfInstance)

        window.sessionStorage.setItem(AUTH_CSRF_STORAGE_KEY, 'stale-token')
        createAuthClient({ baseURL: '/api/v1' })

        const requestInterceptor = apiInstance.interceptors.request.handlers[0]?.fulfilled
        const responseInterceptor = apiInstance.interceptors.response.handlers[0]?.rejected

        const initialConfig = await requestInterceptor({ method: 'post', headers: {} })
        const exhaustedRetryError = {
            response: { status: 419 },
            config: {
                ...initialConfig,
                __csrfRetryCount: 1
            }
        }

        await expect(responseInterceptor(exhaustedRetryError)).rejects.toBe(exhaustedRetryError)
        expect(apiInstance).not.toHaveBeenCalled()
        expect(csrfInstance.get).not.toHaveBeenCalled()
        expect(window.sessionStorage.getItem(AUTH_CSRF_STORAGE_KEY)).toBeNull()
    })

    it('redirects an expired session on the dual public/private application runtime URL', async () => {
        const locationStub = { pathname: '/a/private-app', href: '' }
        vi.stubGlobal('location', locationStub)
        utilsMock.isPublicRoute.mockReturnValue(false)

        const { responseInterceptor } = createInterceptedClient()
        await responseInterceptor({
            response: { status: 401 },
            config: { method: 'get', headers: { Authorization: 'Bearer expired-token' } }
        }).catch(() => undefined)

        expect(utilsMock.isPublicRoute).toHaveBeenCalledWith('/a/private-app')
        // The anonymous public probe never flows through axios, so the runtime
        // prefix must not suppress the sign-in redirect for the authenticated
        // fallback that shares the same URL.
        expect(locationStub.href).toBe('/auth')
    })

    it('keeps anonymous visitors on the public runtime when a session-less request returns 401', async () => {
        const locationStub = { pathname: '/a/public-app', href: '' }
        vi.stubGlobal('location', locationStub)
        utilsMock.isPublicRoute.mockReturnValue(false)

        const { responseInterceptor } = createInterceptedClient()
        await responseInterceptor({ response: { status: 401 }, config: { method: 'get', headers: {} } }).catch(() => undefined)

        // The auth bootstrap 401 for an anonymous visitor must not bounce the
        // public runtime page to the login screen before its probe runs.
        expect(locationStub.href).toBe('')
    })

    it('suppresses the 401 redirect only when the route is actually public', async () => {
        const locationStub = { pathname: '/auth', href: '' }
        vi.stubGlobal('location', locationStub)
        utilsMock.isPublicRoute.mockReturnValue(true)

        const { responseInterceptor } = createInterceptedClient()
        await responseInterceptor({ response: { status: 401 }, config: { method: 'get' } }).catch(() => undefined)

        expect(utilsMock.isPublicRoute).toHaveBeenCalledWith('/auth')
        expect(locationStub.href).toBe('')
    })
})
