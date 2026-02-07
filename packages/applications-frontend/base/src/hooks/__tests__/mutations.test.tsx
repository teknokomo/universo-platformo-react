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

describe('applications mutation hooks', () => {
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

        const applicationsApi = {
            createApplication: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            updateApplication: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            deleteApplication: vi.fn().mockResolvedValue({ data: {} }),
            copyApplication: vi.fn().mockResolvedValue({ data: { id: 'm2' } }),
            inviteApplicationMember: vi.fn().mockResolvedValue({ data: {} }),
            updateApplicationMemberRole: vi.fn().mockResolvedValue({ data: {} }),
            removeApplicationMember: vi.fn().mockResolvedValue({ data: {} })
        }

        const connectorsApi = {
            createConnector: vi.fn().mockResolvedValue({ id: 'h1' }),
            updateConnector: vi.fn().mockResolvedValue({ id: 'h1' }),
            deleteConnector: vi.fn().mockResolvedValue({ data: {} })
        }

        vi.doMock('../../api/applications', () => applicationsApi)
        vi.doMock('../../api/connectors', () => connectorsApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        let createApplication: ReturnType<typeof hooks.useCreateApplication> | undefined
        let updateApplication: ReturnType<typeof hooks.useUpdateApplication> | undefined
        let deleteApplication: ReturnType<typeof hooks.useDeleteApplication> | undefined
        let copyApplication: ReturnType<typeof hooks.useCopyApplication> | undefined

        let memberMutations: ReturnType<typeof hooks.useMemberMutations> | undefined

        function Probe() {
            createApplication = hooks.useCreateApplication()
            updateApplication = hooks.useUpdateApplication()
            deleteApplication = hooks.useDeleteApplication()
            copyApplication = hooks.useCopyApplication()

            memberMutations = hooks.useMemberMutations('m1')

            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await createApplication!.mutateAsync({ name: 'Name', description: 'Desc' })
            await updateApplication!.mutateAsync({ id: 'm1', data: { name: 'Name2' } })
            await deleteApplication!.mutateAsync('m1')
            await copyApplication!.mutateAsync({ id: 'm1', data: { name: { en: 'Name copy' }, copyAccess: true } })

            await memberMutations!.inviteMember({ email: 'a@b.c', role: 'viewer' as any })
            await memberMutations!.updateMemberRole('u1', { role: 'admin' as any })
            await memberMutations!.removeMember('u1')
        })

        expect(applicationsApi.createApplication).toHaveBeenCalledTimes(1)
        expect(applicationsApi.createApplication).toHaveBeenCalledWith({
            name: { en: 'Name' },
            description: { en: 'Desc' },
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: 'en'
        })
        expect(applicationsApi.updateApplication).toHaveBeenCalledWith('m1', {
            name: { en: 'Name2' },
            description: undefined,
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: undefined
        })
        expect(applicationsApi.deleteApplication).toHaveBeenCalledWith('m1')
        expect(applicationsApi.copyApplication).toHaveBeenCalledWith('m1', { name: { en: 'Name copy' }, copyAccess: true })

        expect(applicationsApi.inviteApplicationMember).toHaveBeenCalledWith('m1', { email: 'a@b.c', role: 'viewer' })
        expect(applicationsApi.updateApplicationMemberRole).toHaveBeenCalledWith('m1', 'u1', { role: 'admin' })
        expect(applicationsApi.removeApplicationMember).toHaveBeenCalledWith('m1', 'u1')

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

        const applicationsApi = {
            createApplication: vi.fn().mockRejectedValue(new Error('boom')),
            updateApplication: vi.fn(),
            deleteApplication: vi.fn(),
            copyApplication: vi.fn(),
            inviteApplicationMember: vi.fn(),
            updateApplicationMemberRole: vi.fn(),
            removeApplicationMember: vi.fn()
        }

        vi.doMock('../../api/applications', () => applicationsApi)
        vi.doMock('../../api/connectors', () => ({
            createConnector: vi.fn(),
            updateConnector: vi.fn(),
            deleteConnector: vi.fn()
        }))

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        let createApplication: ReturnType<typeof hooks.useCreateApplication> | undefined

        function Probe() {
            createApplication = hooks.useCreateApplication()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(createApplication!.mutateAsync({ name: 'Name' })).rejects.toThrow('boom')
        })

        expect(enqueueSnackbar).toHaveBeenCalled()
        const firstCall = enqueueSnackbar.mock.calls[0]
        expect(firstCall[0]).toContain('boom')
        expect(firstCall[1]).toMatchObject({ variant: 'error' })
    })
})
