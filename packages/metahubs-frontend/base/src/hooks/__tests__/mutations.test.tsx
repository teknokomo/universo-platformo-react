import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

describe('metahubs mutation hooks', () => {
    it('runs success flows: calls APIs, invalidates queries, and enqueues success snackbars', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (_key: string, fallback?: string) => fallback ?? _key,
                i18n: { language: 'en' }
            })
        }))

        vi.doMock('@universo/i18n', () => ({
            useCommonTranslations: () => ({
                t: (key: string) => key
            })
        }))

        const metahubsApi = {
            createMetahub: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            updateMetahub: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            deleteMetahub: vi.fn().mockResolvedValue({ data: {} }),
            inviteMetahubMember: vi.fn().mockResolvedValue({ data: {} }),
            updateMetahubMemberRole: vi.fn().mockResolvedValue({ data: {} }),
            removeMetahubMember: vi.fn().mockResolvedValue({ data: {} })
        }

        const hubsApi = {
            createHub: vi.fn().mockResolvedValue({ id: 'h1' }),
            updateHub: vi.fn().mockResolvedValue({ id: 'h1' }),
            deleteHub: vi.fn().mockResolvedValue({ data: {} })
        }

        const catalogsApi = {
            createCatalog: vi.fn().mockResolvedValue({ id: 'c1' }),
            updateCatalog: vi.fn().mockResolvedValue({ id: 'c1' }),
            deleteCatalog: vi.fn().mockResolvedValue({ data: {} })
        }

        vi.doMock('../../api/metahubs', () => metahubsApi)
        vi.doMock('../../api/hubs', () => hubsApi)
        vi.doMock('../../api/catalogs', () => catalogsApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        let createMetahub: ReturnType<typeof hooks.useCreateMetahub> | undefined
        let updateMetahub: ReturnType<typeof hooks.useUpdateMetahub> | undefined
        let deleteMetahub: ReturnType<typeof hooks.useDeleteMetahub> | undefined

        let memberMutations: ReturnType<typeof hooks.useMemberMutations> | undefined

        function Probe() {
            createMetahub = hooks.useCreateMetahub()
            updateMetahub = hooks.useUpdateMetahub()
            deleteMetahub = hooks.useDeleteMetahub()

            memberMutations = hooks.useMemberMutations('m1')

            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await createMetahub!.mutateAsync({ name: 'Name', description: 'Desc' })
            await updateMetahub!.mutateAsync({ id: 'm1', data: { name: 'Name2' } })
            await deleteMetahub!.mutateAsync('m1')

            await memberMutations!.inviteMember({ email: 'a@b.c', role: 'viewer' as any })
            await memberMutations!.updateMemberRole('u1', { role: 'admin' as any })
            await memberMutations!.removeMember('u1')
        })

        expect(metahubsApi.createMetahub).toHaveBeenCalledTimes(1)
        expect(metahubsApi.createMetahub).toHaveBeenCalledWith({
            name: { en: 'Name' },
            description: { en: 'Desc' },
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: 'en'
        })
        expect(metahubsApi.updateMetahub).toHaveBeenCalledWith('m1', {
            name: { en: 'Name2' },
            description: undefined,
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: undefined
        })
        expect(metahubsApi.deleteMetahub).toHaveBeenCalledWith('m1')

        expect(metahubsApi.inviteMetahubMember).toHaveBeenCalledWith('m1', { email: 'a@b.c', role: 'viewer' })
        expect(metahubsApi.updateMetahubMemberRole).toHaveBeenCalledWith('m1', 'u1', { role: 'admin' })
        expect(metahubsApi.removeMetahubMember).toHaveBeenCalledWith('m1', 'u1')

        expect(invalidateSpy).toHaveBeenCalled()
        expect(enqueueSnackbar).toHaveBeenCalled()
    })

    it('runs error flow: enqueues error snackbar using error.message', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (_key: string, fallback?: string) => fallback ?? _key,
                i18n: { language: 'en' }
            })
        }))

        vi.doMock('@universo/i18n', () => ({
            useCommonTranslations: () => ({
                t: (key: string) => key
            })
        }))

        const metahubsApi = {
            createMetahub: vi.fn().mockRejectedValue(new Error('boom')),
            updateMetahub: vi.fn(),
            deleteMetahub: vi.fn(),
            inviteMetahubMember: vi.fn(),
            updateMetahubMemberRole: vi.fn(),
            removeMetahubMember: vi.fn()
        }

        vi.doMock('../../api/metahubs', () => metahubsApi)
        vi.doMock('../../api/hubs', () => ({
            createHub: vi.fn(),
            updateHub: vi.fn(),
            deleteHub: vi.fn()
        }))
        vi.doMock('../../api/catalogs', () => ({
            createCatalog: vi.fn(),
            updateCatalog: vi.fn(),
            deleteCatalog: vi.fn()
        }))

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        let createMetahub: ReturnType<typeof hooks.useCreateMetahub> | undefined

        function Probe() {
            createMetahub = hooks.useCreateMetahub()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(createMetahub!.mutateAsync({ name: 'Name' })).rejects.toThrow('boom')
        })

        expect(enqueueSnackbar).toHaveBeenCalled()
        const firstCall = enqueueSnackbar.mock.calls[0]
        expect(firstCall[0]).toContain('boom')
        expect(firstCall[1]).toMatchObject({ variant: 'error' })
    })
})
