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

    it('renders predefined TABLE child field values in schema creation preview', async () => {
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: false,
                    diff: {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        details: {
                            create: {
                                tables: [
                                    {
                                        id: 'catalog-1',
                                        codename: 'Resources',
                                        tableName: 'cat_resources',
                                        fields: [
                                            {
                                                id: 'field-name',
                                                codename: 'Name',
                                                dataType: 'STRING',
                                                isRequired: true,
                                                parentAttributeId: null
                                            },
                                            {
                                                id: 'field-table',
                                                codename: 'NestedResources',
                                                dataType: 'TABLE',
                                                isRequired: false,
                                                parentAttributeId: null
                                            },
                                            {
                                                id: 'field-child-name',
                                                codename: 'NestedTitle',
                                                dataType: 'STRING',
                                                isRequired: true,
                                                parentAttributeId: 'field-table'
                                            },
                                            {
                                                id: 'field-child-amount',
                                                codename: 'NestedAmount',
                                                dataType: 'NUMBER',
                                                isRequired: false,
                                                parentAttributeId: 'field-table'
                                            }
                                        ],
                                        predefinedElementsCount: 1,
                                        predefinedElementsPreview: [
                                            {
                                                id: 'row-1',
                                                sortOrder: 0,
                                                data: {
                                                    Name: {
                                                        _schema: '1',
                                                        _primary: 'ru',
                                                        locales: {
                                                            ru: {
                                                                content: 'Лимонад',
                                                                version: 1,
                                                                isActive: true
                                                            }
                                                        }
                                                    },
                                                    NestedResources: [
                                                        {
                                                            NestedTitle: {
                                                                _schema: '1',
                                                                _primary: 'ru',
                                                                locales: {
                                                                    ru: {
                                                                        content: 'Чистая вода',
                                                                        version: 1,
                                                                        isActive: true
                                                                    }
                                                                }
                                                            },
                                                            NestedAmount: 0.7
                                                        },
                                                        {
                                                            NestedTitle: {
                                                                _schema: '1',
                                                                _primary: 'ru',
                                                                locales: {
                                                                    ru: {
                                                                        content: 'Сахар',
                                                                        version: 1,
                                                                        isActive: true
                                                                    }
                                                                }
                                                            },
                                                            NestedAmount: 0.2
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
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
                isSyncing={false}
                uiLocale='ru'
                schemaStatus='draft'
            />
        )

        await userEvent.click(screen.getByText('Resources'))

        expect(screen.getByText('Чистая вода, Сахар')).toBeInTheDocument()
        expect(screen.getByText('0.7, 0.2')).toBeInTheDocument()
    })

    it('renders direct child preview values safely when parent lookup metadata is missing', async () => {
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: false,
                    diff: {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        details: {
                            create: {
                                tables: [
                                    {
                                        id: 'catalog-1',
                                        codename: 'Resources',
                                        tableName: 'cat_resources',
                                        fields: [
                                            {
                                                id: 'field-child-name',
                                                codename: 'NestedTitle',
                                                dataType: 'STRING',
                                                isRequired: true,
                                                parentAttributeId: 'missing-parent'
                                            }
                                        ],
                                        predefinedElementsCount: 1,
                                        predefinedElementsPreview: [
                                            {
                                                id: 'row-1',
                                                sortOrder: 0,
                                                data: {
                                                    NestedTitle: {
                                                        _schema: '1',
                                                        _primary: 'ru',
                                                        locales: {
                                                            ru: {
                                                                content: 'Чистая вода',
                                                                version: 1,
                                                                isActive: true
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
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
                isSyncing={false}
                uiLocale='ru'
                schemaStatus='draft'
            />
        )

        await userEvent.click(screen.getByText('Resources'))

        expect(screen.getByText('Чистая вода')).toBeInTheDocument()
    })
})
