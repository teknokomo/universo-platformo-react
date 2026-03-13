import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectorDiffDialog } from '../ConnectorDiffDialog'
import { useApplicationDiff } from '../../hooks/useConnectorSync'

vi.mock('../../hooks/useConnectorSync', () => ({
    useApplicationDiff: vi.fn()
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params && fallback) {
                return Object.entries(params).reduce(
                    (message, [paramKey, value]) => message.replace(`{{${paramKey}}}`, String(value)),
                    fallback
                )
            }
            return fallback ?? _key
        }
    })
}))

const baseConnector = {
    id: 'connector-1',
    applicationId: 'app-1',
    name: { en: 'Connector 1' },
    sortOrder: 1,
    createdAt: '2026-03-12T00:00:00.000Z',
    updatedAt: '2026-03-12T00:00:00.000Z'
}

const createDiffQuery = (overrides?: Record<string, unknown>) =>
    ({
        data: {
            schemaExists: true,
            diff: {
                hasChanges: true,
                additive: [],
                destructive: [],
                ...((overrides?.data as Record<string, unknown> | undefined)?.diff ?? {})
            },
            ...((overrides?.data as Record<string, unknown> | undefined) ?? {})
        },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
        ...overrides
    } as unknown as ReturnType<typeof useApplicationDiff>)

describe('ConnectorDiffDialog', () => {
    it('applies safe changes with confirmDestructive=false', async () => {
        const onSync = vi.fn().mockResolvedValue(undefined)
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: true,
                    diff: {
                        hasChanges: true,
                        additive: ['add column'],
                        destructive: []
                    }
                }
            })
        )

        render(
            <ConnectorDiffDialog
                open
                connector={baseConnector}
                applicationId='app-1'
                onClose={vi.fn()}
                onSync={onSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Changes' }))

        expect(onSync).toHaveBeenCalledWith(false)
    })

    it('offers safe-only and destructive apply actions when destructive changes exist', async () => {
        const safeSync = vi.fn().mockResolvedValue(undefined)
        const destructiveSync = vi.fn().mockResolvedValue(undefined)

        vi.mocked(useApplicationDiff)
            .mockReturnValueOnce(
                createDiffQuery({
                    data: {
                        schemaExists: true,
                        diff: {
                            hasChanges: true,
                            additive: ['safe change'],
                            destructive: ['drop column']
                        }
                    }
                })
            )
            .mockReturnValueOnce(
                createDiffQuery({
                    data: {
                        schemaExists: true,
                        diff: {
                            hasChanges: true,
                            additive: ['safe change'],
                            destructive: ['drop column']
                        }
                    }
                })
            )

        const { rerender } = render(
            <ConnectorDiffDialog
                open
                connector={baseConnector}
                applicationId='app-1'
                onClose={vi.fn()}
                onSync={safeSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Safe Changes Only' }))
        expect(safeSync).toHaveBeenCalledWith(false)

        rerender(
            <ConnectorDiffDialog
                open
                connector={baseConnector}
                applicationId='app-1'
                onClose={vi.fn()}
                onSync={destructiveSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        await userEvent.click(screen.getByRole('button', { name: 'Apply Including Destructive' }))
        expect(destructiveSync).toHaveBeenCalledWith(true)
    })

    it('disables sync actions while syncing is in progress', () => {
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: true,
                    diff: {
                        hasChanges: true,
                        additive: ['safe change'],
                        destructive: ['drop column']
                    }
                }
            })
        )

        render(
            <ConnectorDiffDialog
                open
                connector={baseConnector}
                applicationId='app-1'
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
