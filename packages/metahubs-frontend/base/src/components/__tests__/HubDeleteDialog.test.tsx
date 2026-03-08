import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import HubDeleteDialog from '../HubDeleteDialog'
import type { Hub } from '../../types'

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key
        })
    }
})

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQuery: () => ({
            data: {
                blockingCatalogs: [],
                blockingEnumerations: [],
                blockingSets: [],
                blockingChildHubs: []
            },
            isLoading: false,
            isFetching: false,
            isError: false
        })
    }
})

const createVlc = (value: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content: value,
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
})

describe('HubDeleteDialog', () => {
    const hub: Hub = {
        id: 'hub-1',
        codename: 'MainHub',
        name: createVlc('Main hub'),
        description: createVlc('Hub description'),
        sortOrder: 1,
        parentHubId: null,
        version: 1,
        createdAt: '2026-03-08T00:00:00.000Z',
        updatedAt: '2026-03-08T00:00:00.000Z'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('closes immediately after confirm to stop blocker refetches during delete', () => {
        const onClose = vi.fn()
        const onConfirm = vi.fn()

        render(
            <HubDeleteDialog
                open
                hub={hub}
                metahubId='metahub-1'
                onClose={onClose}
                onConfirm={onConfirm}
                isDeleting={false}
                uiLocale='en'
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onConfirm).toHaveBeenCalledWith(hub)
    })
})
