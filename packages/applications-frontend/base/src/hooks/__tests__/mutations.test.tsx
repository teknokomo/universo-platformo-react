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
        const templateMuiMock = {
            applyOptimisticCreate: vi.fn().mockResolvedValue({ previousSnapshots: [], optimisticId: 'opt-1' }),
            applyOptimisticUpdate: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            applyOptimisticDelete: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            getNextOptimisticSortOrderFromQueries: vi.fn(() => 1),
            safeInvalidateQueries: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any })
                })
            }),
            safeInvalidateQueriesInactive: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any, refetchType: 'inactive' })
                })
            }),
            makePendingMarkers: vi.fn(() => ({}))
        }

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => templateMuiMock)

        const applicationsApi = {
            createApplication: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            updateApplication: vi.fn().mockResolvedValue({ data: { id: 'm1' } }),
            deleteApplication: vi.fn().mockResolvedValue({ data: {} }),
            copyApplication: vi.fn().mockResolvedValue({ data: { id: 'm2' } }),
            joinApplication: vi.fn().mockResolvedValue({ data: { status: 'joined' } }),
            leaveApplication: vi.fn().mockResolvedValue({ data: { status: 'left' } }),
            inviteApplicationMember: vi.fn().mockResolvedValue({ data: { id: 'u2' } }),
            updateApplicationMemberRole: vi.fn().mockResolvedValue({ data: {} }),
            removeApplicationMember: vi.fn().mockResolvedValue({ data: {} })
        }

        const connectorsApi = {
            createConnector: vi.fn().mockResolvedValue({ data: { id: 'h1' } }),
            updateConnector: vi.fn().mockResolvedValue({ data: { id: 'h1' } }),
            deleteConnector: vi.fn().mockResolvedValue({ data: {} }),
            syncApplication: vi.fn().mockResolvedValue({ status: 'created' })
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
        let joinApplication: ReturnType<typeof hooks.useJoinApplication> | undefined
        let leaveApplication: ReturnType<typeof hooks.useLeaveApplication> | undefined

        let memberMutations: ReturnType<typeof hooks.useMemberMutations> | undefined
        let connectorMutations: ReturnType<typeof hooks.useConnectorMutations> | undefined

        function Probe() {
            createApplication = hooks.useCreateApplication()
            updateApplication = hooks.useUpdateApplication()
            deleteApplication = hooks.useDeleteApplication()
            copyApplication = hooks.useCopyApplication()
            joinApplication = hooks.useJoinApplication()
            leaveApplication = hooks.useLeaveApplication()

            memberMutations = hooks.useMemberMutations('m1')
            connectorMutations = hooks.useConnectorMutations('m1')

            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await createApplication!.mutateAsync({
                name: { en: 'Name' },
                description: { en: 'Desc' },
                namePrimaryLocale: 'en',
                descriptionPrimaryLocale: 'en'
            })
            await updateApplication!.mutateAsync({
                id: 'm1',
                data: {
                    name: { en: 'Name2' },
                    namePrimaryLocale: 'en'
                }
            })
            await deleteApplication!.mutateAsync('m1')
            await copyApplication!.mutateAsync({
                id: 'm1',
                data: { name: { en: 'Name copy' }, copyConnector: true, createSchema: true, copyAccess: true }
            })
            await joinApplication!.mutateAsync({ id: 'm3' })
            await leaveApplication!.mutateAsync({ id: 'm3' })

            await memberMutations!.inviteMember({ email: 'a@b.c', role: 'viewer' as any })
            await memberMutations!.updateMemberRole('u1', { role: 'admin' as any })
            await memberMutations!.removeMember('u1')

            await connectorMutations!.createConnector({ name: { en: 'Connector 1' } })
            await connectorMutations!.updateConnector('h1', { name: { en: 'Connector 2' } })
            await connectorMutations!.deleteConnector('h1')
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
        expect(applicationsApi.copyApplication).toHaveBeenCalledWith('m1', {
            name: { en: 'Name copy' },
            copyConnector: true,
            createSchema: true,
            copyAccess: true
        })
        expect(applicationsApi.joinApplication).toHaveBeenCalledWith('m3')
        expect(applicationsApi.leaveApplication).toHaveBeenCalledWith('m3')
        expect(connectorsApi.syncApplication).toHaveBeenCalledWith('m2', false)

        expect(applicationsApi.inviteApplicationMember).toHaveBeenCalledWith('m1', { email: 'a@b.c', role: 'viewer' })
        expect(applicationsApi.updateApplicationMemberRole).toHaveBeenCalledWith('m1', 'u1', { role: 'admin' })
        expect(applicationsApi.removeApplicationMember).toHaveBeenCalledWith('m1', 'u1')

        expect(connectorsApi.createConnector).toHaveBeenCalledWith('m1', { name: { en: 'Connector 1' } })
        expect(connectorsApi.updateConnector).toHaveBeenCalledWith('m1', 'h1', { name: { en: 'Connector 2' } })
        expect(connectorsApi.deleteConnector).toHaveBeenCalledWith('m1', 'h1')

        expect(templateMuiMock.confirmOptimisticCreate).toHaveBeenCalledWith(
            queryClient,
            ['applications', 'list'],
            'opt-1',
            'm1',
            expect.objectContaining({ serverEntity: expect.objectContaining({ id: 'm1' }) })
        )
        expect(templateMuiMock.confirmOptimisticCreate).toHaveBeenCalledWith(
            queryClient,
            ['applications', 'detail', 'm1', 'members'],
            'opt-1',
            'u2',
            expect.objectContaining({ serverEntity: expect.objectContaining({ id: 'u2' }) })
        )
        expect(templateMuiMock.confirmOptimisticCreate).toHaveBeenCalledWith(
            queryClient,
            ['applications', 'detail', 'm1', 'connectors'],
            'opt-1',
            'h1',
            expect.objectContaining({ serverEntity: expect.objectContaining({ id: 'h1' }) })
        )
        expect(templateMuiMock.confirmOptimisticCreate).toHaveBeenCalledWith(
            queryClient,
            ['applications', 'list'],
            'opt-1',
            'm2',
            expect.objectContaining({ serverEntity: expect.objectContaining({ id: 'm2' }) })
        )
        expect(invalidateSpy).toHaveBeenCalled()
        expect(enqueueSnackbar).toHaveBeenCalled()
    })

    it('runs error flow: enqueues error snackbar using error.message', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => ({
            applyOptimisticCreate: vi.fn().mockResolvedValue({ previousSnapshots: [], optimisticId: 'opt-1' }),
            applyOptimisticUpdate: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            applyOptimisticDelete: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            safeInvalidateQueries: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any })
                })
            }),
            safeInvalidateQueriesInactive: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any, refetchType: 'inactive' })
                })
            }),
            makePendingMarkers: vi.fn(() => ({}))
        }))

        const applicationsApi = {
            createApplication: vi.fn().mockRejectedValue(new Error('boom')),
            updateApplication: vi.fn(),
            deleteApplication: vi.fn(),
            copyApplication: vi.fn(),
            joinApplication: vi.fn(),
            leaveApplication: vi.fn(),
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
            await expect(
                createApplication!.mutateAsync({
                    name: { en: 'Name' },
                    namePrimaryLocale: 'en'
                })
            ).rejects.toThrow('boom')
        })

        expect(enqueueSnackbar).toHaveBeenCalled()
        const firstCall = enqueueSnackbar.mock.calls[0]
        expect(firstCall[0]).toContain('boom')
        expect(firstCall[1]).toMatchObject({ variant: 'error' })
    })

    it('invalidates lists and shows partial-failure message when copy succeeds but sync fails', async () => {
        const enqueueSnackbar = vi.fn()
        const templateMuiMock = {
            applyOptimisticCreate: vi.fn().mockResolvedValue({ previousSnapshots: [], optimisticId: 'opt-1' }),
            applyOptimisticUpdate: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            applyOptimisticDelete: vi.fn().mockResolvedValue({ previousSnapshots: [] }),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            safeInvalidateQueries: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any })
                })
            }),
            safeInvalidateQueriesInactive: vi.fn((queryClient: QueryClient, _domain: unknown, ...queryKeys: unknown[]) => {
                queryKeys.forEach((queryKey) => {
                    queryClient.invalidateQueries({ queryKey: queryKey as any, refetchType: 'inactive' })
                })
            }),
            makePendingMarkers: vi.fn(() => ({}))
        }

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => templateMuiMock)

        const applicationsApi = {
            copyApplication: vi.fn().mockResolvedValue({ data: { id: 'copied-app-id' } })
        }

        const connectorsApi = {
            syncApplication: vi.fn().mockRejectedValue(new Error('sync failed'))
        }

        vi.doMock('../../api/applications', () => applicationsApi)
        vi.doMock('../../api/connectors', () => connectorsApi)

        const hooks = await import('../mutations')
        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        let copyApplication: ReturnType<typeof hooks.useCopyApplication> | undefined

        function Probe() {
            copyApplication = hooks.useCopyApplication()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(
                copyApplication!.mutateAsync({
                    id: 'app-1',
                    data: { name: { en: 'Copied' }, copyConnector: true, createSchema: true, copyAccess: false }
                })
            ).rejects.toThrow('sync failed')
        })

        expect(applicationsApi.copyApplication).toHaveBeenCalledWith('app-1', {
            name: { en: 'Copied' },
            copyConnector: true,
            createSchema: true,
            copyAccess: false
        })
        expect(connectorsApi.syncApplication).toHaveBeenCalledWith('copied-app-id', false)
        expect(invalidateSpy).toHaveBeenCalled()

        const partialFailureCall = enqueueSnackbar.mock.calls.find((call) =>
            String(call?.[0] ?? '').includes('Application was copied, but schema creation failed')
        )
        expect(partialFailureCall).toBeTruthy()
        expect(partialFailureCall?.[1]).toMatchObject({ variant: 'warning' })
        expect(templateMuiMock.rollbackOptimisticSnapshots).not.toHaveBeenCalled()
    })

    it('shows warning snackbar and invalidates application queries when sync requires confirmation', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => ({
            applyOptimisticCreate: vi.fn(),
            applyOptimisticUpdate: vi.fn(),
            applyOptimisticDelete: vi.fn(),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            getNextOptimisticSortOrderFromQueries: vi.fn(() => 1),
            safeInvalidateQueries: vi.fn(),
            safeInvalidateQueriesInactive: vi.fn(),
            makePendingMarkers: vi.fn(() => ({}))
        }))

        const connectorsApi = {
            syncApplication: vi.fn().mockResolvedValue({ status: 'pending_confirmation' })
        }

        vi.doMock('../../api/applications', () => ({}))
        vi.doMock('../../api/connectors', () => connectorsApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        let syncConnector: ReturnType<typeof hooks.useSyncConnector> | undefined

        function Probe() {
            syncConnector = hooks.useSyncConnector()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await syncConnector!.mutateAsync({ applicationId: 'app-1', confirmDestructive: false })
        })

        expect(connectorsApi.syncApplication).toHaveBeenCalledWith('app-1', false)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'detail', 'app-1'] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'detail', 'app-1', 'diff'] })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'detail', 'app-1', 'connectors'] })
        expect(enqueueSnackbar).toHaveBeenCalledWith('Destructive changes detected. Confirm to proceed.', { variant: 'warning' })
    })

    it('shows success snackbar when connector sync completes without confirmation step', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => ({
            applyOptimisticCreate: vi.fn(),
            applyOptimisticUpdate: vi.fn(),
            applyOptimisticDelete: vi.fn(),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            getNextOptimisticSortOrderFromQueries: vi.fn(() => 1),
            safeInvalidateQueries: vi.fn(),
            safeInvalidateQueriesInactive: vi.fn(),
            makePendingMarkers: vi.fn(() => ({}))
        }))

        const connectorsApi = {
            syncApplication: vi.fn().mockResolvedValue({ status: 'synced' })
        }

        vi.doMock('../../api/applications', () => ({}))
        vi.doMock('../../api/connectors', () => connectorsApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        let syncConnector: ReturnType<typeof hooks.useSyncConnector> | undefined

        function Probe() {
            syncConnector = hooks.useSyncConnector()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await syncConnector!.mutateAsync({ applicationId: 'app-2', confirmDestructive: true })
        })

        expect(connectorsApi.syncApplication).toHaveBeenCalledWith('app-2', true)
        expect(enqueueSnackbar).toHaveBeenCalledWith('Schema synchronized', { variant: 'success' })
    })

    it('shows sync error snackbar when connector sync fails', async () => {
        const enqueueSnackbar = vi.fn()

        vi.doMock('notistack', () => ({
            useSnackbar: () => ({ enqueueSnackbar })
        }))

        vi.doMock('react-i18next', () => ({
            initReactI18next: { type: '3rdParty', init: () => {} },
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

        vi.doMock('@universo/template-mui', () => ({
            applyOptimisticCreate: vi.fn(),
            applyOptimisticUpdate: vi.fn(),
            applyOptimisticDelete: vi.fn(),
            rollbackOptimisticSnapshots: vi.fn(),
            confirmOptimisticUpdate: vi.fn(),
            confirmOptimisticCreate: vi.fn(),
            generateOptimisticId: vi.fn(() => 'opt-1'),
            getNextOptimisticSortOrderFromQueries: vi.fn(() => 1),
            safeInvalidateQueries: vi.fn(),
            safeInvalidateQueriesInactive: vi.fn(),
            makePendingMarkers: vi.fn(() => ({}))
        }))

        const connectorsApi = {
            syncApplication: vi.fn().mockRejectedValue(new Error('sync failed'))
        }

        vi.doMock('../../api/applications', () => ({}))
        vi.doMock('../../api/connectors', () => connectorsApi)

        const hooks = await import('../mutations')

        const queryClient = createTestQueryClient()
        let syncConnector: ReturnType<typeof hooks.useSyncConnector> | undefined

        function Probe() {
            syncConnector = hooks.useSyncConnector()
            return null
        }

        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(syncConnector!.mutateAsync({ applicationId: 'app-3' })).rejects.toThrow('sync failed')
        })

        expect(enqueueSnackbar).toHaveBeenCalledWith('sync failed', { variant: 'error' })
    })
})
