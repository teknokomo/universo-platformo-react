import React from 'react'
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

describe('metaverses mutation hooks', () => {
    it('runs success flows: calls APIs, invalidates queries, and enqueues success snackbars', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (_key: string, fallback?: string) => fallback ?? _key
            })
        }))

        vi.doMock('@universo/i18n', () => ({
            useCommonTranslations: () => ({
                t: (key: string) => key
            })
        }))

        const metaversesApi = {
            createMetaverse: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            updateMetaverse: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            deleteMetaverse: vi.fn().mockResolvedValue({ data: {} }),
            inviteMetaverseMember: vi.fn().mockResolvedValue({ data: {} }),
            updateMetaverseMemberRole: vi.fn().mockResolvedValue({ data: {} }),
            removeMetaverseMember: vi.fn().mockResolvedValue({ data: {} })
        }

        const sectionsApi = {
            createSection: vi.fn().mockResolvedValue({ data: { id: 's1' } }),
            updateSection: vi.fn().mockResolvedValue({ data: { id: 's1' } }),
            deleteSection: vi.fn().mockResolvedValue({ data: {} })
        }

        const entitiesApi = {
            createEntity: vi.fn().mockResolvedValue({ data: { id: 'e1' } }),
            updateEntity: vi.fn().mockResolvedValue({ data: { id: 'e1' } }),
            deleteEntity: vi.fn().mockResolvedValue({ data: {} })
        }

        vi.doMock('../../api/metaverses', () => metaversesApi)
        vi.doMock('../../api/sections', () => sectionsApi)
        vi.doMock('../../api/entities', () => entitiesApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        let createMetaverse: ReturnType<typeof hooks.useCreateMetaverse> | undefined
        let updateMetaverse: ReturnType<typeof hooks.useUpdateMetaverse> | undefined
        let deleteMetaverse: ReturnType<typeof hooks.useDeleteMetaverse> | undefined

        let createSection: ReturnType<typeof hooks.useCreateSection> | undefined
        let updateSection: ReturnType<typeof hooks.useUpdateSection> | undefined
        let deleteSection: ReturnType<typeof hooks.useDeleteSection> | undefined

        let createEntity: ReturnType<typeof hooks.useCreateEntity> | undefined
        let updateEntity: ReturnType<typeof hooks.useUpdateEntity> | undefined
        let deleteEntity: ReturnType<typeof hooks.useDeleteEntity> | undefined

        let memberMutations: ReturnType<typeof hooks.useMemberMutations> | undefined

        function Probe() {
            createMetaverse = hooks.useCreateMetaverse()
            updateMetaverse = hooks.useUpdateMetaverse()
            deleteMetaverse = hooks.useDeleteMetaverse()

            createSection = hooks.useCreateSection()
            updateSection = hooks.useUpdateSection()
            deleteSection = hooks.useDeleteSection()

            createEntity = hooks.useCreateEntity()
            updateEntity = hooks.useUpdateEntity()
            deleteEntity = hooks.useDeleteEntity()

            memberMutations = hooks.useMemberMutations('m1')

            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await createMetaverse!.mutateAsync({ name: 'Name', description: 'Desc' })
            await updateMetaverse!.mutateAsync({ id: 'm1', data: { name: 'Name2' } })
            await deleteMetaverse!.mutateAsync('m1')

            await createSection!.mutateAsync({ name: 'S', metaverseId: 'm1', description: 'd' })
            await updateSection!.mutateAsync({ id: 's1', data: { name: 'S2' } })
            await deleteSection!.mutateAsync('s1')

            await createEntity!.mutateAsync({ name: 'E', sectionId: 's1', description: 'd' })
            await updateEntity!.mutateAsync({ id: 'e1', data: { name: 'E2' } })
            await deleteEntity!.mutateAsync('e1')

            await memberMutations!.inviteMember({ email: 'a@b.c', role: 'viewer' as any })
            await memberMutations!.updateMemberRole('u1', { role: 'admin' as any })
            await memberMutations!.removeMember('u1')
        })

        expect(metaversesApi.createMetaverse).toHaveBeenCalledTimes(1)
        expect(metaversesApi.updateMetaverse).toHaveBeenCalledWith('m1', { name: 'Name2' })
        expect(metaversesApi.deleteMetaverse).toHaveBeenCalledWith('m1')

        expect(sectionsApi.createSection).toHaveBeenCalledTimes(1)
        expect(sectionsApi.updateSection).toHaveBeenCalledWith('s1', { name: 'S2' })
        expect(sectionsApi.deleteSection).toHaveBeenCalledWith('s1')

        expect(entitiesApi.createEntity).toHaveBeenCalledTimes(1)
        expect(entitiesApi.updateEntity).toHaveBeenCalledWith('e1', { name: 'E2' })
        expect(entitiesApi.deleteEntity).toHaveBeenCalledWith('e1')

        expect(metaversesApi.inviteMetaverseMember).toHaveBeenCalledWith('m1', { email: 'a@b.c', role: 'viewer' })
        expect(metaversesApi.updateMetaverseMemberRole).toHaveBeenCalledWith('m1', 'u1', { role: 'admin' })
        expect(metaversesApi.removeMetaverseMember).toHaveBeenCalledWith('m1', 'u1')

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
                t: (_key: string, fallback?: string) => fallback ?? _key
            })
        }))

        vi.doMock('@universo/i18n', () => ({
            useCommonTranslations: () => ({
                t: (key: string) => key
            })
        }))

        const metaversesApi = {
            createMetaverse: vi.fn().mockRejectedValue(new Error('boom')),
            updateMetaverse: vi.fn(),
            deleteMetaverse: vi.fn(),
            inviteMetaverseMember: vi.fn(),
            updateMetaverseMemberRole: vi.fn(),
            removeMetaverseMember: vi.fn()
        }

        vi.doMock('../../api/metaverses', () => metaversesApi)
        vi.doMock('../../api/sections', () => ({
            createSection: vi.fn(),
            updateSection: vi.fn(),
            deleteSection: vi.fn()
        }))
        vi.doMock('../../api/entities', () => ({
            createEntity: vi.fn(),
            updateEntity: vi.fn(),
            deleteEntity: vi.fn()
        }))

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        let createMetaverse: ReturnType<typeof hooks.useCreateMetaverse> | undefined

        function Probe() {
            createMetaverse = hooks.useCreateMetaverse()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(createMetaverse!.mutateAsync({ name: 'Name' })).rejects.toThrow('boom')
        })

        expect(enqueueSnackbar).toHaveBeenCalled()
        const firstCall = enqueueSnackbar.mock.calls[0]
        expect(firstCall[0]).toContain('boom')
        expect(firstCall[1]).toMatchObject({ variant: 'error' })
    })
})
