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

const vlc = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

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

        expect(onSync).toHaveBeenCalledWith(false, undefined)
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
        expect(safeSync).toHaveBeenCalledWith(false, undefined)

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
        expect(destructiveSync).toHaveBeenCalledWith(true, undefined)
    })

    it('requires an explicit layout conflict policy before enabling sync for structured layout conflicts', async () => {
        const onSync = vi.fn().mockResolvedValue(undefined)
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: true,
                    diff: {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        details: {
                            layoutChanges: [
                                {
                                    type: 'LAYOUT_CONFLICT',
                                    scope: 'global',
                                    sourceLayoutId: 'layout-source-1',
                                    applicationLayoutId: 'layout-app-1',
                                    title: { en: 'Homepage' },
                                    message: 'Conflict detected.'
                                }
                            ]
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
                onSync={onSync}
                isSyncing={false}
                uiLocale='en'
            />
        )

        const applyButton = screen.getByRole('button', { name: 'Apply Changes' })
        expect(applyButton).toBeDisabled()

        await userEvent.click(screen.getAllByRole('combobox')[0])
        await userEvent.click(screen.getByRole('option', { name: 'Keep the application layout' }))

        expect(applyButton).toBeEnabled()

        await userEvent.click(applyButton)

        expect(onSync).toHaveBeenCalledWith(false, {
            default: 'keep_local'
        })
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
                                        recordsCount: 1,
                                        recordsPreview: [
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
                                        recordsCount: 1,
                                        recordsPreview: [
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

    it('renders full entity groups with localized labels in schema creation preview', async () => {
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: false,
                    diff: {
                        hasChanges: true,
                        additive: [],
                        destructive: [],
                        summaryKey: 'schema.create.summary',
                        summaryParams: { entitiesCount: 2, tablesCount: 1 },
                        details: {
                            create: {
                                entityGroups: [
                                    {
                                        kindKey: 'hub',
                                        typeName: vlc('Hubs', 'Хабы'),
                                        typeCodename: vlc('Hub', 'Хаб'),
                                        entities: [
                                            {
                                                id: 'hub-1',
                                                kind: 'hub',
                                                name: vlc('Learning', 'Обучение'),
                                                codename: vlc('Learning', 'Обучение'),
                                                fields: [],
                                                recordsCount: 0,
                                                recordsPreview: [],
                                                metrics: [{ key: 'linkedEntities', count: 2 }]
                                            }
                                        ]
                                    },
                                    {
                                        kindKey: 'page',
                                        typeName: vlc('Pages', 'Страницы'),
                                        typeCodename: vlc('Page', 'Страница'),
                                        entities: [
                                            {
                                                id: 'page-1',
                                                kind: 'page',
                                                name: vlc('Welcome', 'Добро пожаловать'),
                                                codename: vlc('LearnerHome', 'ДоброПожаловать'),
                                                fields: [],
                                                recordsCount: 0,
                                                recordsPreview: [],
                                                metrics: [{ key: 'blocks', count: 2 }]
                                            }
                                        ]
                                    },
                                    {
                                        kindKey: 'catalog',
                                        typeName: vlc('Catalogs', 'Каталоги'),
                                        typeCodename: vlc('Catalog', 'Каталог'),
                                        entities: [
                                            {
                                                id: 'catalog-1',
                                                kind: 'catalog',
                                                name: vlc('Classes', 'Классы'),
                                                codename: vlc('Classes', 'Классы'),
                                                fields: [
                                                    {
                                                        id: 'field-name',
                                                        codename: vlc('Name', 'Название'),
                                                        name: vlc('Name', 'Название'),
                                                        dataType: 'STRING',
                                                        isRequired: true,
                                                        parentAttributeId: null
                                                    }
                                                ],
                                                recordsCount: 1,
                                                recordsPreview: [
                                                    {
                                                        id: 'row-1',
                                                        sortOrder: 0,
                                                        data: {
                                                            Name: vlc('Learning Design Cohort', 'Когорта учебного дизайна')
                                                        }
                                                    }
                                                ],
                                                metrics: [
                                                    { key: 'fields', count: 1 },
                                                    { key: 'elements', count: 1 }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        kindKey: 'set',
                                        typeName: vlc('Sets', 'Наборы'),
                                        typeCodename: vlc('Set', 'Набор'),
                                        entities: [
                                            {
                                                id: 'set-1',
                                                kind: 'set',
                                                name: vlc('LMS Settings', 'Настройки LMS'),
                                                codename: vlc('LmsConfiguration', 'НастройкиLMS'),
                                                fields: [],
                                                recordsCount: 0,
                                                recordsPreview: [],
                                                metrics: [{ key: 'constants', count: 2 }]
                                            }
                                        ]
                                    },
                                    {
                                        kindKey: 'enumeration',
                                        typeName: vlc('Enumerations', 'Перечисления'),
                                        typeCodename: vlc('Enumeration', 'Перечисление'),
                                        entities: [
                                            {
                                                id: 'enum-1',
                                                kind: 'enumeration',
                                                name: vlc('Module Status', 'Статус модуля'),
                                                codename: vlc('ModuleStatus', 'СтатусМодуля'),
                                                fields: [],
                                                recordsCount: 0,
                                                recordsPreview: [],
                                                metrics: [{ key: 'values', count: 3 }]
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

        expect(screen.getByText('Entities to be created')).toBeInTheDocument()
        expect(screen.getByText('Хабы')).toBeInTheDocument()
        expect(screen.getAllByText('2 linked entities').length).toBeGreaterThan(0)
        expect(screen.getByText('Страницы')).toBeInTheDocument()
        expect(screen.getByText('Страница')).toBeInTheDocument()
        expect(screen.getByText('ДоброПожаловать')).toBeInTheDocument()
        expect(screen.getAllByText('2 blocks').length).toBeGreaterThan(0)
        expect(screen.getByText('Каталоги')).toBeInTheDocument()
        expect(screen.getByText('Наборы')).toBeInTheDocument()
        expect(screen.getAllByText('2 constants').length).toBeGreaterThan(0)
        expect(screen.getByText('Перечисления')).toBeInTheDocument()
        expect(screen.getAllByText('3 values').length).toBeGreaterThan(0)
        expect(screen.queryByText('0 fields, 0 elements')).not.toBeInTheDocument()
        const localizedClassLabels = screen.getAllByText('Классы')
        expect(localizedClassLabels.length).toBeGreaterThanOrEqual(2)
        await userEvent.click(localizedClassLabels[0])
        expect(screen.getAllByText('Название').length).toBeGreaterThan(0)
        expect(screen.getByText('Когорта учебного дизайна')).toBeInTheDocument()
    })

    it('uses primary VLC labels in schema creation preview when localized labels are disabled', () => {
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
                                entityGroups: [
                                    {
                                        kindKey: 'catalog',
                                        typeName: vlc('Catalogs', 'Каталоги'),
                                        typeCodename: vlc('Catalog', 'Каталог'),
                                        entities: [
                                            {
                                                id: 'catalog-1',
                                                kind: 'catalog',
                                                name: vlc('Classes', 'Классы'),
                                                codename: vlc('Classes', 'Классы'),
                                                fields: [],
                                                recordsCount: 0,
                                                recordsPreview: []
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
                useLocalizedSchemaDiffLabels={false}
            />
        )

        expect(screen.getByText('Catalogs')).toBeInTheDocument()
        expect(screen.getAllByText('Classes').length).toBeGreaterThan(0)
        expect(screen.queryByText('Каталоги')).not.toBeInTheDocument()
        expect(screen.queryByText('Классы')).not.toBeInTheDocument()
    })

    it('requires acknowledgement before first-time optional workspace enablement', async () => {
        const onSync = vi.fn().mockResolvedValue(undefined)
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: false,
                    workspaceMode: {
                        policy: 'optional',
                        requested: null,
                        applicationWorkspacesEnabled: false,
                        effectiveWorkspacesEnabled: false,
                        schemaAlreadyInstalled: false,
                        requiresAcknowledgement: true,
                        canChoose: true
                    },
                    diff: {
                        hasChanges: true,
                        additive: [],
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
                schemaStatus='draft'
            />
        )

        await userEvent.click(screen.getByRole('radio', { name: 'Create application workspaces' }))
        const applyButton = screen.getByRole('button', { name: 'Create Schema' })
        expect(applyButton).toBeDisabled()

        await userEvent.click(
            screen.getByRole('checkbox', {
                name: 'I understand that workspaces cannot be turned off after they are enabled for this application.'
            })
        )
        expect(applyButton).toBeEnabled()

        await userEvent.click(applyButton)

        expect(onSync).toHaveBeenCalledWith(false, undefined, {
            workspaceModeRequested: 'enabled',
            acknowledgeIrreversibleWorkspaceEnablement: true
        })
    })

    it('locks workspace mode on without acknowledgement when required publication policy enables workspaces', async () => {
        const onSync = vi.fn().mockResolvedValue(undefined)
        vi.mocked(useApplicationDiff).mockReturnValue(
            createDiffQuery({
                data: {
                    schemaExists: false,
                    workspaceMode: {
                        policy: 'required',
                        requested: 'enabled',
                        applicationWorkspacesEnabled: false,
                        effectiveWorkspacesEnabled: true,
                        schemaAlreadyInstalled: false,
                        requiresAcknowledgement: false,
                        canChoose: false
                    },
                    diff: {
                        hasChanges: true,
                        additive: [],
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
                schemaStatus='draft'
            />
        )

        const applyButton = screen.getByRole('button', { name: 'Create Schema' })
        expect(applyButton).toBeEnabled()
        expect(screen.queryByRole('checkbox', { name: /workspaces cannot be turned off/i })).not.toBeInTheDocument()
        expect(screen.getByRole('switch', { name: 'Application workspaces are enabled' })).toBeDisabled()
        expect(
            screen.getByText(
                'Application workspaces are enabled because the source metahub requires workspace-isolated application data. The schema will be created with workspace isolation automatically.'
            )
        ).toBeInTheDocument()

        await userEvent.click(applyButton)

        expect(onSync).toHaveBeenCalledWith(false, undefined, {
            workspaceModeRequested: 'enabled'
        })
    })
})
