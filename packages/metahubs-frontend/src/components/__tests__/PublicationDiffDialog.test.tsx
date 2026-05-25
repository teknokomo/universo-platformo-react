import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublicationDiffDialog } from '../PublicationDiffDialog'
import { usePublicationDiff } from '../../domains/publications'

vi.mock('../../domains/publications', () => ({
    usePublicationDiff: vi.fn()
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

const basePublication = {
    id: 'publication-1',
    metahubId: 'metahub-1',
    name: { en: 'Publication 1' },
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z'
}

const createDiffQuery = (overrides?: Record<string, unknown>) =>
    ({
        data: {
            diff: {
                hasChanges: true,
                additive: [],
                destructive: [],
                ...((overrides?.data as Record<string, unknown> | undefined)?.diff ?? {})
            },
            ...((overrides?.data as Record<string, unknown> | undefined) ?? {})
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        ...overrides
    } as unknown as ReturnType<typeof usePublicationDiff>)

describe('PublicationDiffDialog', () => {
    it('applies safe publication changes with confirmDestructive=false', async () => {
        const onSync = vi.fn().mockResolvedValue(undefined)
        vi.mocked(usePublicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    diff: {
                        hasChanges: true,
                        additive: ['add table'],
                        destructive: []
                    }
                }
            })
        )

        render(
            <PublicationDiffDialog
                open
                publication={basePublication as never}
                metahubId='metahub-1'
                onClose={vi.fn()}
                onSync={onSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Changes' }))

        expect(onSync).toHaveBeenCalledWith(false)
    })

    it('offers safe-only and destructive publication apply actions when destructive changes exist', async () => {
        const safeSync = vi.fn().mockResolvedValue(undefined)
        const destructiveSync = vi.fn().mockResolvedValue(undefined)

        vi.mocked(usePublicationDiff)
            .mockReturnValueOnce(
                createDiffQuery({
                    data: {
                        diff: {
                            hasChanges: true,
                            additive: ['safe change'],
                            destructive: ['drop table']
                        }
                    }
                })
            )
            .mockReturnValueOnce(
                createDiffQuery({
                    data: {
                        diff: {
                            hasChanges: true,
                            additive: ['safe change'],
                            destructive: ['drop table']
                        }
                    }
                })
            )

        const { rerender } = render(
            <PublicationDiffDialog
                open
                publication={basePublication as never}
                metahubId='metahub-1'
                onClose={vi.fn()}
                onSync={safeSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Safe Changes Only' }))
        expect(safeSync).toHaveBeenCalledWith(false)

        rerender(
            <PublicationDiffDialog
                open
                publication={basePublication as never}
                metahubId='metahub-1'
                onClose={vi.fn()}
                onSync={destructiveSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Including Destructive' }))
        expect(destructiveSync).toHaveBeenCalledWith(true)
    })

    it('disables publication sync actions while syncing is in progress', () => {
        vi.mocked(usePublicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    diff: {
                        hasChanges: true,
                        additive: ['safe change'],
                        destructive: ['drop table']
                    }
                }
            })
        )

        render(
            <PublicationDiffDialog
                open
                publication={basePublication as never}
                metahubId='metahub-1'
                onClose={vi.fn()}
                onSync={vi.fn()}
                isSyncing
                uiLocale='en'
            />
        )

        expect(screen.getByRole('button', { name: 'Apply Safe Changes Only' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled()
    })
})
