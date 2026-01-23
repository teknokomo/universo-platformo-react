import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
    metahubsApi: {
        createMetahub: vi.fn(),
        updateMetahub: vi.fn(),
        deleteMetahub: vi.fn(),
        inviteMetahubMember: vi.fn(),
        updateMetahubMemberRole: vi.fn(),
        removeMetahubMember: vi.fn()
    }
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: mocks.t,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: mocks.t
    })
}))

vi.mock('../../api', () => mocks.metahubsApi)

import * as hooks from '../mutations'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.metahubsApi.createMetahub.mockReset()
    mocks.metahubsApi.updateMetahub.mockReset()
    mocks.metahubsApi.deleteMetahub.mockReset()
    mocks.metahubsApi.inviteMetahubMember.mockReset()
    mocks.metahubsApi.updateMetahubMemberRole.mockReset()
    mocks.metahubsApi.removeMetahubMember.mockReset()
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
        mocks.metahubsApi.createMetahub.mockResolvedValue({ data: { id: 'm1' } })
        mocks.metahubsApi.updateMetahub.mockResolvedValue({ data: { id: 'm1' } })
        mocks.metahubsApi.deleteMetahub.mockResolvedValue({ data: {} })
        mocks.metahubsApi.inviteMetahubMember.mockResolvedValue({ data: {} })
        mocks.metahubsApi.updateMetahubMemberRole.mockResolvedValue({ data: {} })
        mocks.metahubsApi.removeMetahubMember.mockResolvedValue({ data: {} })

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

        expect(mocks.metahubsApi.createMetahub).toHaveBeenCalledTimes(1)
        expect(mocks.metahubsApi.createMetahub).toHaveBeenCalledWith({
            codename: 'name',
            name: { en: 'Name' },
            description: { en: 'Desc' },
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: 'en'
        })
        expect(mocks.metahubsApi.updateMetahub).toHaveBeenCalledWith('m1', {
            codename: 'name2',
            name: { en: 'Name2' },
            description: undefined,
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: undefined
        })
        expect(mocks.metahubsApi.deleteMetahub).toHaveBeenCalledWith('m1')

        expect(mocks.metahubsApi.inviteMetahubMember).toHaveBeenCalledWith('m1', { email: 'a@b.c', role: 'viewer' })
        expect(mocks.metahubsApi.updateMetahubMemberRole).toHaveBeenCalledWith('m1', 'u1', { role: 'admin' })
        expect(mocks.metahubsApi.removeMetahubMember).toHaveBeenCalledWith('m1', 'u1')

        expect(invalidateSpy).toHaveBeenCalled()
        expect(mocks.enqueueSnackbar).toHaveBeenCalled()
    })

    it('runs error flow: enqueues error snackbar using error.message', async () => {
        mocks.metahubsApi.createMetahub.mockRejectedValue(new Error('boom'))

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

        expect(mocks.enqueueSnackbar).toHaveBeenCalled()
        const firstCall = mocks.enqueueSnackbar.mock.calls[0]
        expect(firstCall[0]).toContain('boom')
        expect(firstCall[1]).toMatchObject({ variant: 'error' })
    })
})
