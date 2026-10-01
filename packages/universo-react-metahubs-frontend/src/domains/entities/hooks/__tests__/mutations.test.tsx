import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
    entitiesApi: {
        updateEntityType: vi.fn()
    }
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: mocks.t,
        i18n: { language: 'en' }
    })
}))

vi.mock('../../api', () => mocks.entitiesApi)

import * as entitiesApi from '../../api'
import { useUpdateEntityType } from '../mutations'

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

describe('entity type update mutations', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(entitiesApi.updateEntityType).mockReset()
    })

    it('shows localized guidance when layouts prevent disabling layout configuration', async () => {
        const apiError = Object.assign(new Error('Entity type cannot disable custom layouts while scoped layouts still exist'), {
            isAxiosError: true,
            response: {
                data: { code: 'ENTITY_TYPE_LAYOUTS_EXIST' },
                status: 409
            }
        })
        vi.mocked(entitiesApi.updateEntityType).mockRejectedValue(apiError)

        let updateEntityType: ReturnType<typeof useUpdateEntityType> | undefined
        function Probe() {
            updateEntityType = useUpdateEntityType()
            return null
        }

        const queryClient = createTestQueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <Probe />
            </QueryClientProvider>
        )

        await act(async () => {
            await expect(
                updateEntityType!.mutateAsync({
                    metahubId: 'metahub-1',
                    entityTypeId: 'entity-type-1',
                    data: {} as never
                })
            ).rejects.toBe(apiError)
        })

        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith(
            'Remove the layouts attached to instances of this entity type before disabling layout configuration.',
            { variant: 'error' }
        )
        expect(mocks.enqueueSnackbar).not.toHaveBeenCalledWith(apiError.message, { variant: 'error' })
    })
})
