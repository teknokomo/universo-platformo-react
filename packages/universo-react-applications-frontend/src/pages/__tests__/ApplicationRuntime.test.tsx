import { useState, type MouseEvent, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ApplicationRuntime from '../ApplicationRuntime'
import { createRuntimeAdapter } from '../../api/runtimeAdapter'
import { applicationsQueryKeys } from '../../api/queryKeys'

const runtimeMocks = vi.hoisted(() => ({
    capturedCellRenderers: null as any,
    capturedCrudOptions: null as any,
    mutate: vi.fn(),
    handlePendingInteractionAttempt: vi.fn(() => false),
    handleOpenCreate: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleOpenCopy: vi.fn(),
    handleOpenDelete: vi.fn(),
    handleCloseForm: vi.fn(),
    onSelectObjectCollection: vi.fn(),
    updateLearningContentProgress: vi.fn().mockResolvedValue({ persisted: true }),
    fetchList: vi.fn(),
    fetchRow: vi.fn(),
    recordCommand: vi.fn(),
    workflowAction: vi.fn(),
    invalidateQueries: vi.fn(),
    enqueueSnackbar: vi.fn(),
    capturedRowActionsContext: null as null | Record<string, any>,
    setPaginationModel: vi.fn(),
    dashboardStateOverrides: {} as Record<string, unknown>,
    templateKey: 'dashboard',
    templateQueryOptions: undefined as { queryKey?: unknown; queryFn?: () => Promise<unknown> } | undefined,
    applicationDetailsData: { name: { en: 'Test application', ru: 'Тестовое приложение' } } as Record<string, unknown>,
    getApplication: vi.fn(),
    getApplicationEffectiveLayout: vi.fn(),
    effectiveLayoutRefetch: vi.fn().mockResolvedValue({}),
    effectiveLayoutZone: undefined as string | undefined,
    effectiveLayoutWidgets: undefined as unknown[] | undefined,
    resolvedEntityTypeId: undefined as string | undefined,
    capturedDashboardProps: null as {
        layoutConfig?: Record<string, unknown>
        zoneWidgets?: unknown
        details?: {
            locale?: string
            workspacesEnabled?: boolean
            currentWorkspaceId?: string | null
            settings?: Record<string, unknown>
            footerMetadata?: { siteName: string }
        }
    } | null,
    capturedMarketingProps: null as {
        locale?: string
        target?: unknown
        effectiveLayoutWidgets?: unknown
        effectiveLayoutConfig?: unknown
    } | null,
    triggerRerender: undefined as undefined | (() => void)
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, options?: string | { defaultValue?: string; [key: string]: unknown }) => {
            if (typeof options === 'string') {
                return options
            }

            const template = options?.defaultValue ?? _key
            return template.replace('{{current}}', String(options?.current ?? '')).replace('{{max}}', String(options?.max ?? ''))
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/auth-frontend', () => ({
    useAuth: () => ({ user: { id: 'runtime-user', email: 'member@example.com' } })
}))

// Dashboard interaction tests exercise the existing runtime surface. The
// template-dispatch query is covered by the marketing runtime contract tests;
// keep this suite deterministic and independent from a QueryClient provider.
vi.mock('@tanstack/react-query', async () => {
    const React = await import('react')
    return {
        useQuery: vi.fn((options: { queryKey?: unknown; enabled?: boolean; queryFn?: () => Promise<unknown> }) => {
            const isBoundRowActionQuery = Array.isArray(options.queryKey) && options.queryKey[0] === 'runtime-bound-row-actions'
            const isApplicationDetailQuery =
                Array.isArray(options.queryKey) &&
                options.queryKey.length === 3 &&
                options.queryKey[0] === 'applications' &&
                options.queryKey[1] === 'detail'
            const [boundResult, setBoundResult] = React.useState<{
                isLoading: boolean
                isError: boolean
                data: unknown
            }>({ isLoading: false, isError: false, data: null })
            const queryFnRef = React.useRef(options.queryFn)
            queryFnRef.current = options.queryFn
            const serializedKey = JSON.stringify(options.queryKey)

            React.useEffect(() => {
                if (!isBoundRowActionQuery || !options.enabled || !queryFnRef.current) {
                    return undefined
                }
                let cancelled = false
                setBoundResult({ isLoading: true, isError: false, data: null })
                void queryFnRef.current().then(
                    (data) => {
                        if (!cancelled) setBoundResult({ isLoading: false, isError: false, data })
                    },
                    () => {
                        if (!cancelled) setBoundResult({ isLoading: false, isError: true, data: null })
                    }
                )
                return () => {
                    cancelled = true
                }
            }, [isBoundRowActionQuery, options.enabled, serializedKey])

            if (isBoundRowActionQuery) {
                return boundResult
            }

            if (isApplicationDetailQuery) {
                return {
                    isLoading: false,
                    isError: false,
                    data: options.enabled ? runtimeMocks.applicationDetailsData : undefined
                }
            }

            runtimeMocks.templateQueryOptions = options
            return {
                isLoading: false,
                isError: false,
                refetch: runtimeMocks.effectiveLayoutRefetch,
                data: {
                    status: 'ok',
                    resolvedEntityTypeId: runtimeMocks.resolvedEntityTypeId,
                    layout: {
                        templateKey: runtimeMocks.templateKey,
                        config: { sideMenu: { availableModes: ['wide', 'compact'], primaryMode: 'compact', rememberUserChoice: true } }
                    },
                    widgets: runtimeMocks.effectiveLayoutWidgets ?? [
                        {
                            id: 'effective-widget-1',
                            layoutId: 'effective-layout-1',
                            zone:
                                runtimeMocks.effectiveLayoutZone ??
                                (runtimeMocks.templateKey === 'marketing-page' ? 'marketing-header' : 'left'),
                            widgetKey: runtimeMocks.templateKey === 'marketing-page' ? 'languageSwitcher' : 'menuWidget',
                            sortOrder: 1,
                            config: {},
                            ...(runtimeMocks.templateKey === 'dashboard'
                                ? {
                                      runtimeData: {
                                          status: 'ready',
                                          data: {
                                              kind: 'menu',
                                              title: 'Main',
                                              showTitle: false,
                                              overflowLabel: 'More',
                                              items: [
                                                  {
                                                      key: 'object:details',
                                                      label: 'Details',
                                                      icon: null,
                                                      kind: 'section',
                                                      target: { kind: 'object', codename: 'details' }
                                                  }
                                              ],
                                              overflowItems: []
                                          }
                                      }
                                  }
                                : {}),
                            sourceWidgetId: null,
                            sourceBaseWidgetId: null,
                            isActive: true,
                            version: 1
                        }
                    ]
                }
            }
        }),
        useMutation: (options: {
            mutationFn: (variables: any) => Promise<unknown>
            onSuccess?: (result: unknown, variables: any) => void | Promise<void>
            onError?: (error: unknown, variables: any) => void
        }) => ({
            mutate: (variables: any) => {
                void options.mutationFn(variables).then(
                    async (result) => {
                        await options.onSuccess?.(result, variables)
                    },
                    (error) => {
                        options.onError?.(error, variables)
                    }
                )
            },
            isPending: false,
            variables: undefined
        }),
        useQueryClient: () => ({ invalidateQueries: runtimeMocks.invalidateQueries })
    }
})

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: runtimeMocks.enqueueSnackbar })
}))

vi.mock('../../api/applications', () => ({
    getApplication: runtimeMocks.getApplication,
    getApplicationEffectiveLayout: runtimeMocks.getApplicationEffectiveLayout
}))

vi.mock('../../api/runtimeAdapter', () => ({
    createRuntimeAdapter: vi.fn(() => ({
        queryKeyPrefix: ['runtime', 'app-1'],
        fetchList: runtimeMocks.fetchList,
        fetchRow: runtimeMocks.fetchRow,
        recordCommand: runtimeMocks.recordCommand,
        workflowAction: runtimeMocks.workflowAction
    }))
}))

vi.mock('../../api/mutations', () => ({
    useUpdateRuntimeCell: vi.fn(() => ({ mutate: runtimeMocks.mutate })),
    usePendingRuntimeCellMutations: vi.fn(() => []),
    buildPendingRuntimeCellMap: vi.fn(() => new Map()),
    getRuntimeCellPendingKey: vi.fn((rowId: string, field: string) => `${rowId}:${field}`)
}))

vi.mock('@universo-react/apps-template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo-react/apps-template-mui')>()
    return {
        ...actual,
        getRuntimeLayoutErrorCode: vi.fn(() => null),
        AppMainLayout: ({ children }: { children: ReactNode }) => <div data-testid='app-main-layout'>{children}</div>,
        MarketingRuntimeContent: (props: {
            locale?: string
            target?: unknown
            layoutIdentity?: unknown
            effectiveLayoutWidgets?: unknown
            effectiveLayoutConfig?: unknown
        }) => {
            runtimeMocks.capturedMarketingProps = props
            return <div data-testid='marketing-runtime-content'>marketing</div>
        },
        AppsDashboard: ({
            details,
            layoutConfig,
            zoneWidgets
        }: {
            details?: {
                title?: string
                actions?: ReactNode
                banner?: ReactNode
                content?: ReactNode
                locale?: string
                sections?: Array<{ id: string; codename: string }>
                objectCollections?: Array<{ id: string; codename: string }>
                workspacesEnabled?: boolean
                currentWorkspaceId?: string | null
                settings?: Record<string, unknown>
                footerMetadata?: { siteName: string }
                pagePlayer?: {
                    showOutline?: boolean
                    showProgressHeader?: boolean
                    completeButtonMode?: string
                    progressStorageKey?: string
                    onProgressChange?: (payload: {
                        action: 'view' | 'complete'
                        target?: { objectCodename: string; recordHandle: string }
                    }) => Promise<void> | void
                }
                onOpenCreateTarget?: (target: {
                    id: string
                    label: string
                    sectionCodename?: string
                    objectCollectionCodename?: string
                    createDefaults?: Array<{
                        fieldCodename: string
                        enumCodename?: string
                        resourceSourceType?: string
                        contextPath?: string
                    }>
                }) => void
                onOpenRowTarget?: (
                    target: {
                        rowId: string
                        expectedVersion?: number
                        sectionCodename?: string
                        objectCollectionCodename?: string
                    },
                    action: 'edit' | 'copy' | 'delete'
                ) => void
                onOpenRowMenu?: (
                    event: MouseEvent<HTMLElement>,
                    rowId: string,
                    target?: { entityCodename: string; recordHandle: string }
                ) => void
            }
            layoutConfig?: Record<string, unknown>
            zoneWidgets?: unknown
        }) => {
            runtimeMocks.capturedDashboardProps = { layoutConfig, zoneWidgets, details }
            return (
                <div data-testid='apps-dashboard'>
                    <div data-testid='apps-dashboard-layout'>{JSON.stringify(layoutConfig ?? {})}</div>
                    <div data-testid='apps-dashboard-zone-widgets'>{JSON.stringify(zoneWidgets ?? {})}</div>
                    <div data-testid='apps-dashboard-runtime-navigation'>
                        {JSON.stringify({
                            zoneWidgets,
                            workspacesEnabled: details?.workspacesEnabled,
                            currentWorkspaceId: details?.currentWorkspaceId
                        })}
                    </div>
                    <div data-testid='apps-dashboard-banner'>{details?.banner}</div>
                    <div data-testid='apps-dashboard-title'>{details?.title}</div>
                    <div data-testid='apps-dashboard-details'>
                        {JSON.stringify({
                            locale: details?.locale,
                            sections: details?.sections,
                            objectCollections: details?.objectCollections,
                            pagePlayer: details?.pagePlayer
                                ? {
                                      showOutline: details.pagePlayer.showOutline,
                                      showProgressHeader: details.pagePlayer.showProgressHeader,
                                      completeButtonMode: details.pagePlayer.completeButtonMode,
                                      progressStorageKey: details.pagePlayer.progressStorageKey,
                                      hasProgressHandler: typeof details.pagePlayer.onProgressChange === 'function'
                                  }
                                : null
                        })}
                    </div>
                    <button
                        data-testid='apps-dashboard-complete-page'
                        onClick={() => void details?.pagePlayer?.onProgressChange?.({ action: 'complete' })}
                        type='button'
                    >
                        complete
                    </button>
                    <button
                        data-testid='apps-dashboard-complete-course-item'
                        onClick={() =>
                            void details?.pagePlayer?.onProgressChange?.({
                                action: 'complete',
                                target: { objectCodename: 'CourseItems', recordHandle: 'rh1.test-course-item' }
                            })
                        }
                        type='button'
                    >
                        complete course item
                    </button>
                    <button
                        data-testid='apps-dashboard-open-course-target'
                        onClick={() =>
                            details?.onOpenCreateTarget?.({
                                id: 'create-course',
                                label: 'Course',
                                sectionCodename: 'Courses',
                                createDefaults: [{ fieldCodename: 'Status', enumCodename: 'Draft' }]
                            })
                        }
                        type='button'
                    >
                        create course target
                    </button>
                    <button
                        data-testid='apps-dashboard-open-details-target'
                        onClick={() =>
                            details?.onOpenCreateTarget?.({
                                id: 'create-details',
                                label: 'Details',
                                sectionCodename: 'details'
                            })
                        }
                        type='button'
                    >
                        create details target
                    </button>
                    <button
                        data-testid='apps-dashboard-open-course-row-edit'
                        onClick={() =>
                            details?.onOpenRowTarget?.({ rowId: 'course-row-1', sectionCodename: 'Courses', expectedVersion: 7 }, 'edit')
                        }
                        type='button'
                    >
                        edit course row
                    </button>
                    <button
                        data-testid='apps-dashboard-open-course-row-actions'
                        onClick={(event) =>
                            details?.onOpenRowMenu?.(event, 'course-row-2', {
                                entityCodename: 'Courses',
                                recordHandle: 'rh1.test-course-row-2'
                            })
                        }
                        type='button'
                    >
                        open course row actions
                    </button>
                    <div data-testid='apps-dashboard-actions'>{details?.actions}</div>
                    <div data-testid='apps-dashboard-content'>{details?.content}</div>
                </div>
            )
        },
        CrudDialogs: ({
            state,
            surface,
            renderForm = true,
            renderDelete = true
        }: {
            state?: { handleFormSubmit?: (data: Record<string, unknown>) => Promise<void> | void }
            surface?: 'dialog' | 'page'
            renderForm?: boolean
            renderDelete?: boolean
        }) => (
            <>
                {renderForm ? (
                    <div data-testid='crud-dialogs-surface'>
                        {surface ?? 'dialog'}
                        <button data-testid='crud-dialogs-submit' onClick={() => void state?.handleFormSubmit?.({})} type='button'>
                            submit
                        </button>
                    </div>
                ) : null}
                {renderDelete ? <div data-testid='crud-dialogs-delete'>delete</div> : null}
            </>
        ),
        RowActionsMenu: ({ runtimeContext }: { runtimeContext?: Record<string, any> }) => {
            runtimeMocks.capturedRowActionsContext = runtimeContext ?? null
            const recordState = runtimeContext?.row?._app_record_state === 'posted' ? 'posted' : 'draft'
            return runtimeContext ? (
                <div data-testid='bound-row-actions-menu'>
                    <span>{String(runtimeContext.row?.title ?? '')}</span>
                    <button
                        type='button'
                        onClick={() => {
                            runtimeContext.onCloseMenu?.()
                            runtimeContext.onRecordCommand?.(runtimeContext.menuRowId, recordState === 'posted' ? 'unpost' : 'post')
                        }}
                    >
                        {recordState === 'posted' ? 'Unpost bound row' : 'Post bound row'}
                    </button>
                </div>
            ) : null
        },
        updateLearningContentProgress: runtimeMocks.updateLearningContentProgress,
        RuntimeWorkspacesPage: ({
            applicationId,
            routeWorkspaceId,
            routeSection
        }: {
            applicationId: string
            routeWorkspaceId?: string | null
            routeSection?: string
        }) => (
            <div data-testid='runtime-workspaces-page'>
                workspaces:{applicationId}:{routeWorkspaceId ?? 'list'}:{routeSection ?? 'dashboard'}
            </div>
        ),
        useCrudDashboard: (options: any) => {
            runtimeMocks.capturedCrudOptions = options
            runtimeMocks.capturedCellRenderers = options.cellRenderers
            const overrides = runtimeMocks.dashboardStateOverrides as any
            const baseAppData = {
                settings: { sectionLinksEnabled: true },
                permissions: {
                    manageMembers: true,
                    manageApplication: true,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: true
                },
                workspacesEnabled: true,
                currentWorkspaceId: null,
                section: { name: 'Details', codename: 'details' },
                sections: [{ id: 'object-1', codename: 'details' }],
                objectCollection: { name: 'Details' },
                objectCollections: [{ id: 'object-1', codename: 'details' }]
            }
            const overrideAppData = overrides.appData as Record<string, unknown> | null | undefined
            const mergedAppData =
                overrideAppData === null
                    ? null
                    : overrideAppData === undefined
                    ? baseAppData
                    : {
                          ...overrideAppData,
                          permissions: Object.prototype.hasOwnProperty.call(overrideAppData, 'permissions')
                              ? overrideAppData.permissions
                              : baseAppData.permissions,
                          settings: Object.prototype.hasOwnProperty.call(overrideAppData, 'settings')
                              ? overrideAppData.settings
                              : baseAppData.settings,
                          workspacesEnabled: Object.prototype.hasOwnProperty.call(overrideAppData, 'workspacesEnabled')
                              ? overrideAppData.workspacesEnabled
                              : baseAppData.workspacesEnabled
                      }

            return {
                isLoading: false,
                isFetching: false,
                isError: false,
                columns: [],
                fieldConfigs: [],
                rows: [],
                rowCount: 0,
                paginationModel: { page: 0, pageSize: 50 },
                setPaginationModel: runtimeMocks.setPaginationModel,
                pageSizeOptions: [10, 25, 50, 100],
                localeText: undefined,
                handlePendingInteractionAttempt: runtimeMocks.handlePendingInteractionAttempt,
                activeSectionId: 'object-1',
                selectedSectionId: 'object-1',
                onSelectSection: vi.fn(),
                activeObjectCollectionId: 'object-1',
                selectedObjectCollectionId: 'object-1',
                onSelectObjectCollection: runtimeMocks.onSelectObjectCollection,
                formOpen: false,
                editRowId: null,
                formError: null,
                formInitialData: undefined,
                isFormReady: true,
                isSubmitting: false,
                handleOpenCreate: runtimeMocks.handleOpenCreate,
                handleOpenEdit: runtimeMocks.handleOpenEdit,
                handleCloseForm: runtimeMocks.handleCloseForm,
                handleFormSubmit: vi.fn().mockResolvedValue(undefined),
                deleteRowId: null,
                deleteError: null,
                isDeleting: false,
                handleOpenDelete: runtimeMocks.handleOpenDelete,
                handleCloseDelete: vi.fn(),
                handleConfirmDelete: vi.fn().mockResolvedValue(undefined),
                copyRowId: null,
                copyError: null,
                isCopying: false,
                handleOpenCopy: runtimeMocks.handleOpenCopy,
                handleCloseCopy: vi.fn(),
                menuAnchorEl: null,
                menuRowId: null,
                handleOpenMenu: vi.fn(),
                handleCloseMenu: vi.fn(),
                ...overrides,
                appData: mergedAppData
            }
        }
    }
})

function renderRuntimePage() {
    return renderRuntimePageAt('/applications/app-1/runtime')
}

function RuntimeLocationProbe() {
    const location = useLocation()

    return <div data-testid='runtime-location-search'>{location.search}</div>
}

function RuntimeRouteElement() {
    return (
        <>
            <ApplicationRuntime />
            <RuntimeLocationProbe />
        </>
    )
}

function renderRuntimePageAt(route: string) {
    return render(
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/applications/:applicationId/runtime/*' element={<RuntimeRouteElement />} />
            </Routes>
        </MemoryRouter>
    )
}

function RuntimeHarness({ route }: { route: string }) {
    const [, setTick] = useState(0)

    runtimeMocks.triggerRerender = () => {
        setTick((value) => value + 1)
    }

    return (
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/applications/:applicationId/runtime/*' element={<RuntimeRouteElement />} />
            </Routes>
        </MemoryRouter>
    )
}

function renderRuntimeHarness(route: string) {
    return render(<RuntimeHarness route={route} />)
}

function renderBooleanCell(rowId: string) {
    const renderer = runtimeMocks.capturedCellRenderers?.BOOLEAN
    if (!renderer) {
        throw new Error('BOOLEAN cell renderer was not captured')
    }

    return render(
        renderer({
            value: false,
            rowId,
            field: 'isEnabled',
            column: {
                id: 'col-enabled',
                field: 'isEnabled',
                headerName: 'Enabled',
                dataType: 'BOOLEAN',
                isRequired: false,
                validationRules: {},
                uiConfig: {}
            }
        })
    )
}

describe('ApplicationRuntime pending interaction safety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        runtimeMocks.capturedCellRenderers = null
        runtimeMocks.capturedCrudOptions = null
        runtimeMocks.handlePendingInteractionAttempt.mockReturnValue(false)
        runtimeMocks.handleCloseForm.mockReset()
        runtimeMocks.handleOpenEdit.mockReset()
        runtimeMocks.handleOpenCopy.mockReset()
        runtimeMocks.handleOpenDelete.mockReset()
        runtimeMocks.updateLearningContentProgress.mockClear()
        runtimeMocks.fetchList.mockReset()
        runtimeMocks.fetchRow.mockReset()
        runtimeMocks.recordCommand.mockReset()
        runtimeMocks.workflowAction.mockReset()
        runtimeMocks.invalidateQueries.mockReset()
        runtimeMocks.enqueueSnackbar.mockReset()
        runtimeMocks.capturedRowActionsContext = null
        runtimeMocks.dashboardStateOverrides = {}
        runtimeMocks.templateKey = 'dashboard'
        runtimeMocks.templateQueryOptions = undefined
        runtimeMocks.applicationDetailsData = { name: { en: 'Test application', ru: 'Тестовое приложение' } }
        runtimeMocks.getApplication.mockReset()
        runtimeMocks.getApplicationEffectiveLayout.mockReset()
        runtimeMocks.effectiveLayoutRefetch.mockReset().mockResolvedValue({})
        runtimeMocks.effectiveLayoutZone = undefined
        runtimeMocks.effectiveLayoutWidgets = undefined
        runtimeMocks.resolvedEntityTypeId = undefined
        runtimeMocks.capturedDashboardProps = null
        runtimeMocks.capturedMarketingProps = null
        runtimeMocks.triggerRerender = undefined
    })

    it('dispatches a scoped marketing layout on an entity runtime route', () => {
        runtimeMocks.templateKey = 'marketing-page'

        renderRuntimePageAt(
            '/applications/app-1/runtime/entities/landing?targetKind=page&entityTypeId=019fa968-aac3-7ce7-9717-79e7c6c6e77e&locale=ru'
        )

        expect(screen.getByTestId('marketing-runtime-content')).toHaveTextContent('marketing')
        expect(screen.queryByTestId('apps-dashboard')).not.toBeInTheDocument()
        expect(runtimeMocks.capturedMarketingProps).toMatchObject({
            locale: 'ru',
            target: {
                targetKind: 'page',
                entityTypeId: '019fa968-aac3-7ce7-9717-79e7c6c6e77e',
                entityTypeCodename: null
            }
        })
    })

    it('dispatches the marketing runtime from the effective template at the application root', () => {
        runtimeMocks.templateKey = 'marketing-page'

        renderRuntimePageAt('/applications/app-1/runtime')

        expect(screen.getByTestId('marketing-runtime-content')).toHaveTextContent('marketing')
        expect(screen.queryByTestId('apps-dashboard')).not.toBeInTheDocument()
        expect(runtimeMocks.capturedMarketingProps).toMatchObject({
            locale: 'en',
            target: null,
            effectiveLayoutWidgets: [
                expect.objectContaining({ id: 'effective-widget-1', widgetKey: 'languageSwitcher', zone: 'marketing-header' })
            ],
            effectiveLayoutConfig: expect.objectContaining({ templateKey: 'marketing-page' })
        })
    })

    it('routes marketing applications to the shared workspace runtime surface', () => {
        runtimeMocks.templateKey = 'marketing-page'
        const workspaceId = '00000000-0000-7000-8000-000000000111'

        renderRuntimePageAt(`/applications/app-1/runtime/workspaces/${workspaceId}/settings`)

        expect(screen.getByTestId('app-main-layout')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent(`workspaces:app-1:${workspaceId}:settings`)
        expect(screen.queryByTestId('marketing-runtime-content')).not.toBeInTheDocument()
    })

    it('passes effective dashboard config and widgets to the dashboard renderer', () => {
        renderRuntimePageAt('/applications/app-1/runtime')

        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"primaryMode":"compact"')
        expect(screen.getByTestId('apps-dashboard-zone-widgets')).toHaveTextContent('effective-widget-1')
        expect(runtimeMocks.capturedDashboardProps?.details?.footerMetadata).toEqual({ siteName: 'Test application' })
    })

    it('localizes application metadata passed to the Dashboard footer', () => {
        renderRuntimePageAt('/applications/app-1/runtime?locale=ru')

        expect(runtimeMocks.capturedDashboardProps?.details?.footerMetadata).toEqual({ siteName: 'Тестовое приложение' })
    })

    it('fails closed when effective dashboard layout contains an unknown zone', () => {
        runtimeMocks.effectiveLayoutZone = 'unsupported-zone'

        expect(() => renderRuntimePageAt('/applications/app-1/runtime')).toThrow('Effective layout contains an unsupported Dashboard zone')
    })

    it('loads effective layout with every layout target and excludes content record from layout identity', async () => {
        runtimeMocks.templateKey = 'marketing-page'

        runtimeMocks.getApplicationEffectiveLayout.mockResolvedValue({
            status: 'ok',
            layout: { templateKey: 'marketing-page', config: {} }
        })

        renderRuntimePageAt(
            '/applications/app-1/runtime?targetKind=page&entityTypeCodename=LandingPage&workspaceId=workspace-a&locale=ru&themeVariant=dark&recordKey=content-record-1'
        )

        expect(runtimeMocks.templateQueryOptions?.queryKey).toEqual(
            applicationsQueryKeys.runtimeEffectiveLayout('app-1', {
                targetKind: 'page',
                entityTypeCodename: 'LandingPage',
                workspaceId: 'workspace-a',
                locale: 'ru',
                themeVariant: 'dark'
            })
        )
        expect(JSON.stringify(runtimeMocks.templateQueryOptions?.queryKey)).not.toContain('content-record-1')

        await runtimeMocks.templateQueryOptions?.queryFn?.()
        expect(runtimeMocks.getApplicationEffectiveLayout).toHaveBeenCalledWith('app-1', {
            targetKind: 'page',
            entityTypeId: null,
            entityTypeCodename: 'LandingPage',
            workspaceId: 'workspace-a',
            locale: 'ru',
            themeVariant: 'dark'
        })
        expect(runtimeMocks.capturedMarketingProps).toMatchObject({ locale: 'ru', themeVariant: 'dark', target: { targetKind: 'page' } })
    })

    it('refetches the effective Dashboard layout after runtime content changes', async () => {
        renderRuntimePageAt('/applications/app-1/runtime')

        const onRuntimeDataChanged = runtimeMocks.capturedCrudOptions?.onRuntimeDataChanged
        expect(onRuntimeDataChanged).toEqual(expect.any(Function))

        await act(async () => {
            await onRuntimeDataChanged()
        })

        expect(runtimeMocks.effectiveLayoutRefetch).toHaveBeenCalledTimes(1)
    })

    it('fails closed for an entity selector without a target kind instead of falling back to the global layout', () => {
        renderRuntimePageAt('/applications/app-1/runtime?entityTypeCodename=LandingPage')

        expect(screen.getByRole('alert')).toHaveTextContent('The runtime target in this URL is invalid')
        expect(runtimeMocks.getApplicationEffectiveLayout).not.toHaveBeenCalled()
    })

    it('uses the server-resolved Entity UUID for row loading from a semantic route target', async () => {
        const resolvedEntityTypeId = '019fa968-aac3-7ce7-9717-79e7c6c6e77e'
        runtimeMocks.resolvedEntityTypeId = resolvedEntityTypeId

        renderRuntimePageAt('/applications/app-1/runtime?targetKind=object&entityTypeCodename=Structure&locale=ru')

        expect(runtimeMocks.capturedCrudOptions.initialSectionId).toBe(resolvedEntityTypeId)
        await act(async () => {
            await runtimeMocks.templateQueryOptions?.queryFn?.()
        })
        expect(runtimeMocks.getApplicationEffectiveLayout).toHaveBeenCalledWith(
            'app-1',
            expect.objectContaining({ targetKind: 'object', entityTypeCodename: 'Structure', entityTypeId: null, locale: 'ru' })
        )
    })

    it('shows loading state before runtime data is available', () => {
        runtimeMocks.dashboardStateOverrides = {
            isLoading: true,
            appData: null
        }

        renderRuntimePage()

        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(screen.queryByTestId('apps-dashboard')).not.toBeInTheDocument()
    })

    it('shows error state when runtime data fails to load', () => {
        runtimeMocks.dashboardStateOverrides = {
            isError: true,
            appData: null
        }

        renderRuntimePage()

        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load runtime data')
    })

    it('renders runtime details title and wires the create action button to the dashboard state', async () => {
        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Details')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"locale":"en"')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"sections":[{"id":"object-1","codename":"details"}]')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent(
            '"objectCollections":[{"id":"object-1","codename":"details"}]'
        )

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('waits for the selected create target schema before opening the runtime create form', async () => {
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: 'project-section',
            selectedSectionId: 'project-section',
            activeObjectCollectionId: 'project-section',
            selectedObjectCollectionId: 'project-section',
            appData: {
                section: { id: 'project-section', name: 'Projects', codename: 'ContentProjects' },
                objectCollection: { id: 'project-section', name: 'Projects', codename: 'ContentProjects' },
                activeSectionId: 'project-section',
                activeObjectCollectionId: 'project-section',
                sections: [
                    { id: 'project-section', codename: 'ContentProjects' },
                    { id: 'course-section', codename: 'Courses' }
                ],
                objectCollections: [
                    { id: 'project-section', codename: 'ContentProjects' },
                    { id: 'course-section', codename: 'Courses' }
                ]
            }
        }
        renderRuntimeHarness('/applications/app-1/runtime')

        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-open-course-target'))

        expect(runtimeMocks.onSelectObjectCollection).toHaveBeenCalledWith('course-section')
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()

        runtimeMocks.dashboardStateOverrides = {
            ...runtimeMocks.dashboardStateOverrides,
            activeSectionId: 'course-section',
            selectedSectionId: 'course-section',
            activeObjectCollectionId: 'course-section',
            selectedObjectCollectionId: 'course-section',
            appData: {
                ...(runtimeMocks.dashboardStateOverrides.appData as Record<string, unknown>),
                section: { id: 'course-section', name: 'Courses', codename: 'Courses' },
                objectCollection: { id: 'course-section', name: 'Courses', codename: 'Courses' },
                activeSectionId: 'course-section',
                activeObjectCollectionId: 'course-section'
            }
        }
        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })
        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledWith(
            [{ fieldCodename: 'Status', enumCodename: 'Draft' }],
            undefined,
            undefined,
            undefined
        )
    })

    it('uses the active section over the scoped URL when Dashboard actions switch entity targets', async () => {
        const routeSectionId = '019fa968-aac3-7ce7-9717-79e7c6c6e77e'
        const otherSectionId = '019fa968-aac3-7ce7-9717-79e7c6c6e77f'
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: otherSectionId,
            selectedSectionId: otherSectionId,
            activeObjectCollectionId: otherSectionId,
            selectedObjectCollectionId: otherSectionId,
            appData: {
                section: { id: otherSectionId, name: 'Courses', codename: 'Courses' },
                objectCollection: { id: otherSectionId, name: 'Courses', codename: 'Courses' },
                activeSectionId: otherSectionId,
                activeObjectCollectionId: otherSectionId,
                sections: [
                    { id: routeSectionId, codename: 'details' },
                    { id: otherSectionId, codename: 'Courses' }
                ],
                objectCollections: [
                    { id: routeSectionId, codename: 'details' },
                    { id: otherSectionId, codename: 'Courses' }
                ]
            }
        }
        renderRuntimeHarness(`/applications/app-1/runtime/${routeSectionId}`)

        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-open-details-target'))

        expect(runtimeMocks.onSelectObjectCollection).toHaveBeenCalledWith(routeSectionId)
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()

        runtimeMocks.dashboardStateOverrides = {
            ...runtimeMocks.dashboardStateOverrides,
            activeSectionId: routeSectionId,
            selectedSectionId: routeSectionId,
            activeObjectCollectionId: routeSectionId,
            selectedObjectCollectionId: routeSectionId,
            appData: {
                ...(runtimeMocks.dashboardStateOverrides.appData as Record<string, unknown>),
                section: { id: routeSectionId, name: 'Details', codename: 'details' },
                objectCollection: { id: routeSectionId, name: 'Details', codename: 'details' },
                activeSectionId: routeSectionId,
                activeObjectCollectionId: routeSectionId
            }
        }
        act(() => runtimeMocks.triggerRerender?.())

        await waitFor(() => expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1))

        await user.click(screen.getByTestId('apps-dashboard-open-course-target'))
        expect(runtimeMocks.onSelectObjectCollection).toHaveBeenLastCalledWith(otherSectionId)

        runtimeMocks.dashboardStateOverrides = {
            ...runtimeMocks.dashboardStateOverrides,
            activeSectionId: otherSectionId,
            selectedSectionId: otherSectionId,
            activeObjectCollectionId: otherSectionId,
            selectedObjectCollectionId: otherSectionId,
            appData: {
                ...(runtimeMocks.dashboardStateOverrides.appData as Record<string, unknown>),
                section: { id: otherSectionId, name: 'Courses', codename: 'Courses' },
                objectCollection: { id: otherSectionId, name: 'Courses', codename: 'Courses' },
                activeSectionId: otherSectionId,
                activeObjectCollectionId: otherSectionId
            }
        }
        act(() => runtimeMocks.triggerRerender?.())

        await waitFor(() => expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(2))
    })

    it('waits for the selected row target schema before opening a union source row action', async () => {
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: 'project-section',
            selectedSectionId: 'project-section',
            activeObjectCollectionId: 'project-section',
            selectedObjectCollectionId: 'project-section',
            appData: {
                section: { id: 'project-section', name: 'Projects', codename: 'ContentProjects' },
                objectCollection: { id: 'project-section', name: 'Projects', codename: 'ContentProjects' },
                activeSectionId: 'project-section',
                activeObjectCollectionId: 'project-section',
                sections: [
                    { id: 'project-section', codename: 'ContentProjects' },
                    { id: 'course-section', codename: 'Courses' }
                ],
                objectCollections: [
                    { id: 'project-section', codename: 'ContentProjects' },
                    { id: 'course-section', codename: 'Courses' }
                ]
            }
        }
        renderRuntimeHarness('/applications/app-1/runtime')

        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-open-course-row-edit'))

        expect(runtimeMocks.onSelectObjectCollection).toHaveBeenCalledWith('course-section')
        expect(runtimeMocks.handleOpenEdit).not.toHaveBeenCalled()

        runtimeMocks.dashboardStateOverrides = {
            ...runtimeMocks.dashboardStateOverrides,
            activeSectionId: 'course-section',
            selectedSectionId: 'course-section',
            activeObjectCollectionId: 'course-section',
            selectedObjectCollectionId: 'course-section',
            appData: {
                ...(runtimeMocks.dashboardStateOverrides.appData as Record<string, unknown>),
                section: { id: 'course-section', name: 'Courses', codename: 'Courses' },
                objectCollection: { id: 'course-section', name: 'Courses', codename: 'Courses' },
                activeSectionId: 'course-section',
                activeObjectCollectionId: 'course-section'
            }
        }
        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(runtimeMocks.handleOpenEdit).toHaveBeenCalledWith('course-row-1', undefined, 7)
        })
    })

    it('loads a bound Dashboard row context and routes record commands to the target entity', async () => {
        const permissions = {
            manageMembers: true,
            manageApplication: true,
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: true
        }
        const currentEntity = { id: 'details-section', name: 'Details', codename: 'details' }
        const targetEntity = {
            id: 'course-section',
            name: 'Courses',
            codename: 'Courses',
            recordBehavior: {
                mode: 'transactional',
                posting: { mode: 'manual', targetLedgers: ['ProgressLedger'], moduleCodename: 'EnrollmentPostingModule' },
                immutability: 'posted'
            },
            workflowActions: []
        }
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: currentEntity.id,
            selectedSectionId: currentEntity.id,
            activeObjectCollectionId: currentEntity.id,
            selectedObjectCollectionId: currentEntity.id,
            appData: {
                currentWorkspaceId: 'workspace-1',
                permissions,
                section: currentEntity,
                objectCollection: currentEntity,
                activeSectionId: currentEntity.id,
                activeObjectCollectionId: currentEntity.id,
                sections: [currentEntity, targetEntity],
                objectCollections: [currentEntity, targetEntity],
                settings: {},
                workspacesEnabled: true
            }
        }
        runtimeMocks.fetchList.mockResolvedValue({
            objectCollection: targetEntity,
            columns: [],
            rows: [],
            pagination: { total: 1, limit: 1, offset: 0 },
            permissions
        })
        runtimeMocks.fetchRow
            .mockResolvedValueOnce({
                id: '0190a9b5-3cde-7abc-8def-0123456789d2',
                version: 5,
                data: { title: 'Compliance Refresh Course', _app_record_state: 'draft' }
            })
            .mockResolvedValue({
                id: '0190a9b5-3cde-7abc-8def-0123456789d2',
                version: 6,
                data: { title: 'Compliance Refresh Course', _app_record_state: 'posted' }
            })
        runtimeMocks.recordCommand.mockResolvedValue({ id: '0190a9b5-3cde-7abc-8def-0123456789d2', version: 6 })

        renderRuntimePage()
        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-open-course-row-actions'))

        await waitFor(() => expect(screen.getByTestId('bound-row-actions-menu')).toHaveTextContent('Compliance Refresh Course'))
        expect(runtimeMocks.fetchList).toHaveBeenCalledWith(
            expect.objectContaining({
                objectCollectionId: targetEntity.id,
                sectionId: targetEntity.id,
                workspaceId: 'workspace-1'
            })
        )
        expect(runtimeMocks.fetchRow).toHaveBeenCalledWith(
            'rh1.test-course-row-2',
            expect.objectContaining({ objectCollectionId: targetEntity.id, sectionId: targetEntity.id, workspaceId: 'workspace-1' })
        )
        expect(runtimeMocks.capturedRowActionsContext?.recordBehavior).toEqual(targetEntity.recordBehavior)

        await user.click(screen.getByRole('button', { name: 'Post bound row' }))
        await waitFor(() =>
            expect(runtimeMocks.recordCommand).toHaveBeenCalledWith('rh1.test-course-row-2', 'post', {
                objectCollectionId: targetEntity.id,
                sectionId: targetEntity.id,
                workspaceId: 'workspace-1',
                expectedVersion: 5
            })
        )

        await waitFor(() => expect(screen.queryByTestId('bound-row-actions-menu')).not.toBeInTheDocument())
        await user.click(screen.getByTestId('apps-dashboard-open-course-row-actions'))

        await waitFor(() => expect(screen.getByRole('button', { name: 'Unpost bound row' })).toBeVisible())
        expect(runtimeMocks.fetchRow).toHaveBeenCalledTimes(2)
        expect(runtimeMocks.capturedRowActionsContext?.row).toMatchObject({
            id: 'rh1.test-course-row-2',
            _upl_version: 6,
            _app_record_state: 'posted'
        })
    })

    it('passes Learning Content page player progress settings to the dashboard runtime surface', async () => {
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: 'page-1',
            selectedSectionId: 'page-1',
            activeObjectCollectionId: 'page-1',
            selectedObjectCollectionId: 'page-1',
            appData: {
                currentWorkspaceId: 'workspace-1',
                settings: {
                    sectionLinksEnabled: true,
                    learningContent: {
                        playerPreset: {
                            codename: 'reader',
                            title: { en: 'Reader', ru: 'Читалка' },
                            showOutline: false,
                            showProgressHeader: true,
                            allowResume: true,
                            allowResourcePreview: true,
                            completeButtonMode: 'manual'
                        }
                    }
                },
                permissions: {
                    manageMembers: true,
                    manageApplication: true,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: true
                },
                workspacesEnabled: true,
                section: {
                    id: 'page-1',
                    name: 'Welcome',
                    codename: 'LearnerHome',
                    pageBlocks: [{ id: 'body', type: 'paragraph', data: { text: 'Read' } }]
                },
                sections: [{ id: 'page-1', codename: 'LearnerHome' }],
                objectCollection: { id: 'page-1', name: 'Welcome', codename: 'LearnerHome' },
                objectCollections: [{ id: 'page-1', codename: 'LearnerHome' }]
            }
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"showOutline":false')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"showProgressHeader":true')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent(
            '"progressStorageKey":"learning-content-progress:app-1:workspace-1:page-1"'
        )

        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-complete-page'))

        expect(runtimeMocks.updateLearningContentProgress).toHaveBeenCalledWith({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            targetObjectCodename: 'LearnerHome',
            targetRecordId: 'page-1',
            workspaceId: 'workspace-1',
            action: 'complete'
        })
    })

    it('forwards the learner-player opaque record handle to the progress API', async () => {
        runtimeMocks.dashboardStateOverrides = {
            activeSectionId: 'course-collection-id',
            appData: {
                currentWorkspaceId: 'workspace-1',
                objectCollection: { id: 'course-collection-id', codename: 'Courses' },
                objectCollections: [
                    { id: 'course-collection-id', codename: 'Courses' },
                    { id: 'course-items-collection-id', codename: 'CourseItems' }
                ]
            }
        }

        renderRuntimePage()

        const user = userEvent.setup()
        await user.click(screen.getByTestId('apps-dashboard-complete-course-item'))

        expect(runtimeMocks.updateLearningContentProgress).toHaveBeenCalledWith({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            targetObjectCodename: 'CourseItems',
            targetRecordId: 'rh1.test-course-item',
            workspaceId: 'workspace-1',
            action: 'complete'
        })
    })

    it('keeps Learning Content presentation settings out of the generic runtime dashboard contract', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                settings: {
                    sectionLinksEnabled: true,
                    learningContent: {
                        defaultView: 'cards',
                        courseCompletionPolicy: {
                            navigationMode: 'sequential',
                            completionCondition: 'selectedItems',
                            statusFormat: 'passedFailed'
                        },
                        trackOrderPolicy: {
                            orderMode: 'byDays'
                        },
                        columnPreset: {
                            codename: 'learningContentDefault',
                            title: { en: 'Learning Content default' },
                            columns: [
                                { field: 'type', visible: true, width: 140 },
                                { field: 'title', visible: true, flex: 1 },
                                { field: 'ProjectId', visible: false }
                            ]
                        }
                    }
                },
                permissions: {
                    manageMembers: true,
                    manageApplication: true,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: true
                },
                workspacesEnabled: true,
                section: { id: 'content', name: 'Learning Content', codename: 'LearningResources' },
                sections: [{ id: 'content', codename: 'LearningResources' }],
                objectCollection: { id: 'content', name: 'Learning Content', codename: 'LearningResources' },
                objectCollections: [{ id: 'content', codename: 'LearningResources' }]
            }
        }

        renderRuntimePage()

        expect(runtimeMocks.capturedDashboardProps?.details).not.toHaveProperty('tableDefaults')
        expect(runtimeMocks.capturedDashboardProps?.details).not.toHaveProperty('rows')
        expect(runtimeMocks.capturedDashboardProps?.details).not.toHaveProperty('columns')

        expect(runtimeMocks.capturedCrudOptions.createDefaultContext(runtimeMocks.dashboardStateOverrides.appData)).toMatchObject({
            learningContent: {
                courseCompletionPolicy: {
                    navigationMode: 'sequential',
                    completionCondition: 'selectedItems',
                    statusFormat: 'passedFailed'
                },
                trackOrderPolicy: {
                    orderMode: 'byDays'
                }
            }
        })
    })

    it('renders the workspaces route with Entity-backed Dashboard navigation', () => {
        renderRuntimePageAt('/applications/app-1/runtime/workspaces')

        expect(createRuntimeAdapter).toHaveBeenCalledWith('app-1')
        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Workspaces')
        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent('workspaces:app-1')
        expect(screen.getByTestId('apps-dashboard-layout')).not.toHaveTextContent('showOverviewTitle')
        expect(screen.getByTestId('apps-dashboard-layout')).not.toHaveTextContent('showDetailsTable')
        expect(runtimeMocks.capturedDashboardProps?.zoneWidgets).toMatchObject({ center: [], bottom: [] })
        expect(runtimeMocks.capturedDashboardProps?.details).toMatchObject({ workspacesEnabled: true, currentWorkspaceId: null })
        expect(runtimeMocks.capturedDashboardProps?.zoneWidgets).toMatchObject({
            left: [
                {
                    widgetKey: 'menuWidget',
                    runtimeData: {
                        status: 'ready',
                        data: {
                            kind: 'menu',
                            items: [{ key: 'object:details', target: { kind: 'object', codename: 'details' } }]
                        }
                    }
                }
            ]
        })
        expect(screen.queryByTestId('crud-dialogs-surface')).not.toBeInTheDocument()
    })

    it('passes application navigation settings to the Dashboard placement renderer', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: { settings: { sectionLinksEnabled: false } }
        }

        renderRuntimePage()

        expect(runtimeMocks.capturedDashboardProps?.details?.settings).toEqual({ sectionLinksEnabled: false })
    })

    it('passes the current workspace to the dashboard shell on workspace detail routes', () => {
        const workspaceId = '00000000-0000-7000-8000-000000000111'
        runtimeMocks.dashboardStateOverrides = { appData: { currentWorkspaceId: workspaceId } }

        renderRuntimePageAt(`/applications/app-1/runtime/workspaces/${workspaceId}/access`)

        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent(`workspaces:app-1:${workspaceId}:access`)
        expect(runtimeMocks.capturedDashboardProps?.details).toMatchObject({ workspacesEnabled: true, currentWorkspaceId: workspaceId })
    })

    it('preserves workspace context on settings routes', () => {
        const workspaceId = '00000000-0000-7000-8000-000000000111'
        runtimeMocks.dashboardStateOverrides = { appData: { currentWorkspaceId: workspaceId } }

        renderRuntimePageAt(`/applications/app-1/runtime/workspaces/${workspaceId}/settings`)

        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent(`workspaces:app-1:${workspaceId}:settings`)
        expect(runtimeMocks.capturedDashboardProps?.details).toMatchObject({ workspacesEnabled: true, currentWorkspaceId: workspaceId })
    })

    it('uses a route UUID as the initially selected runtime section', () => {
        const sectionId = '00000000-0000-7000-8000-00000000abcd'

        renderRuntimePageAt(`/applications/app-1/runtime/${sectionId}`)

        expect(runtimeMocks.capturedCrudOptions.initialSectionId).toBe(sectionId)
    })

    it('renders the workspace limit banner inside dashboard details area', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: { name: 'Details' },
                workspaceLimit: {
                    canCreate: false,
                    currentRows: 2,
                    maxRows: 2
                }
            }
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-banner')).toHaveTextContent(
            'The workspace limit for this section has been reached (2 / 2).'
        )
    })

    it('prefers section aliases for dashboard title and inline mutation targeting', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                section: { name: 'Orders', codename: 'orders' },
                objectCollection: { name: 'Legacy Object' }
            },
            activeSectionId: 'section-9',
            selectedSectionId: 'section-9',
            activeObjectCollectionId: 'object-legacy',
            selectedObjectCollectionId: 'object-legacy'
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Orders')

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('row-2')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.mutate).toHaveBeenCalledWith({
            rowId: 'row-2',
            field: 'isEnabled',
            value: true,
            sectionId: 'section-9'
        })
    })

    it('hides the create action when the object runtime config disables it', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { showCreateButton: false }
                }
            }
        }

        renderRuntimePage()

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })

    it('hides the create action and clears direct page create mode when runtime permissions are read-only', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                },
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false
                }
            }
        }

        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
        expect(screen.getByTestId('runtime-location-search')).toBeEmptyDOMElement()
    })

    it.each([
        ['missing', undefined],
        ['null', null],
        ['malformed', { createContent: 'true', editContent: 1, deleteContent: true }]
    ])('fails closed for %s runtime permissions', async (_caseName, permissions) => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                },
                permissions
            }
        }

        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
        expect(screen.getByTestId('runtime-location-search')).toBeEmptyDOMElement()
    })

    it('disables inline boolean editing when editContent is not explicitly allowed', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                section: { name: 'Orders', codename: 'orders' },
                objectCollection: { name: 'Orders' },
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: false,
                    deleteContent: false
                }
            },
            activeSectionId: 'section-9',
            selectedSectionId: 'section-9'
        }

        renderRuntimePage()

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        renderBooleanCell('row-2')

        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).toBeDisabled()

        expect(runtimeMocks.mutate).not.toHaveBeenCalled()
    })

    it('renders page-surface forms inside dashboard content when createSurface is configured as page', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: false
        }

        renderRuntimeHarness('/applications/app-1/runtime')

        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getAllByTestId('crud-dialogs-surface')).toHaveLength(1)
        expect(screen.getByTestId('apps-dashboard-content')).toContainElement(screen.getByTestId('crud-dialogs-surface'))
    })

    it('derives page surface from URL search params on direct navigation', async () => {
        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            formOpen: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('apps-dashboard-content')).toContainElement(screen.getByTestId('crud-dialogs-surface'))
    })

    it('does not reopen an already-consumed create page surface after the form closes', async () => {
        const pageSurfaceAppData = {
            objectCollection: {
                name: 'Details',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false
        }

        const view = renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: true
        }

        view.rerender(
            <MemoryRouter
                initialEntries={['/applications/app-1/runtime?surface=page&mode=create']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <Routes>
                    <Route path='/applications/:applicationId/runtime/*' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        runtimeMocks.handleOpenCreate.mockClear()
        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false
        }

        view.rerender(
            <MemoryRouter
                initialEntries={['/applications/app-1/runtime?surface=page&mode=create']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <Routes>
                    <Route path='/applications/:applicationId/runtime/*' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('blocks direct create page navigation when the object hides the create action', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { showCreateButton: false, createSurface: 'page' }
                }
            },
            handleCloseForm: vi.fn()
        }

        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('clears page surface state when the active object changes', async () => {
        const objectOneData = {
            section: {
                name: 'Object One',
                codename: 'object-one',
                runtimeConfig: { createSurface: 'page' }
            },
            objectCollection: {
                name: 'Object One',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: objectOneData,
            formOpen: false,
            activeSectionId: 'object-1',
            selectedSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            selectedObjectCollectionId: 'object-1'
        }

        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: objectOneData,
            formOpen: true,
            activeSectionId: 'object-1',
            selectedSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            selectedObjectCollectionId: 'object-1'
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })

        runtimeMocks.handleOpenCreate.mockClear()

        runtimeMocks.dashboardStateOverrides = {
            appData: {
                ...objectOneData,
                section: {
                    name: 'Object Two',
                    codename: 'object-two',
                    runtimeConfig: { createSurface: 'page' }
                },
                objectCollection: {
                    name: 'Object Two',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true,
            activeSectionId: 'object-2',
            selectedSectionId: 'object-2',
            activeObjectCollectionId: 'object-2',
            selectedObjectCollectionId: 'object-2'
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(runtimeMocks.handleCloseForm).toHaveBeenCalledTimes(1)
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
        })
        expect(screen.getByTestId('apps-dashboard-content')).toBeEmptyDOMElement()
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('keeps page-surface content mounted until submit settles and then clears URL params', async () => {
        const pageSurfaceAppData = {
            objectCollection: {
                name: 'Details',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: false
        }

        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: true,
            isSubmitting: false
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('runtime-location-search')).toHaveTextContent('?surface=page&mode=create')

        const user = userEvent.setup()
        await user.click(screen.getByTestId('crud-dialogs-submit'))

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('runtime-location-search')).toHaveTextContent('?surface=page&mode=create')

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: false
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('runtime-location-search')).toBeEmptyDOMElement()
        })
        expect(screen.getByTestId('apps-dashboard-content')).toBeEmptyDOMElement()
    })

    it('blocks inline BOOLEAN mutation attempts for pending rows', async () => {
        runtimeMocks.handlePendingInteractionAttempt.mockReturnValue(true)
        renderRuntimePage()

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('optimistic-row-1')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.handlePendingInteractionAttempt).toHaveBeenCalledWith('optimistic-row-1')
        expect(runtimeMocks.mutate).not.toHaveBeenCalled()
    })

    it('keeps inline BOOLEAN mutation working for confirmed rows', async () => {
        renderRuntimePage()

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('row-1')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.handlePendingInteractionAttempt).toHaveBeenCalledWith('row-1')
        expect(runtimeMocks.mutate).toHaveBeenCalledWith({
            rowId: 'row-1',
            field: 'isEnabled',
            value: true,
            sectionId: 'object-1'
        })
    })
})
