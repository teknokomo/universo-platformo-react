import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { GridFilterModel, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { isPendingInteractionBlocked } from '@universo-react/utils'
import type { CreateTargetDefault } from '@universo-react/types'
import {
    EMPTY_KEY_PREFIX,
    appendCopySuffixToFirstStringField,
    buildSafeCreateInitialData,
    readInitialObjectCollectionId,
    readRuntimeRowVersion,
    resolveRuntimeObjectCollectionForSection,
    stripReadOnlyEnumerationLabelFields
} from './useCrudDashboard.helpers'
import { useCrudDashboardMutations } from './useCrudDashboard.mutations'
import type { CrudDashboardState, RelationBuilderCreateWizard, UseCrudDashboardOptions } from './useCrudDashboard.types'
export type { CrudDashboardState, UseCrudDashboardOptions } from './useCrudDashboard.types'
import type { AppDataResponse } from '../api/api'
import type { RuntimeRecordCommand, RuntimeRelationScope } from '../api/types'
import { revealPendingEntityFeedback } from './optimisticCrud'
import { toGridColumns, toFieldConfigs } from '../utils/columns'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { mapGridFilterModel, mapGridSortModel } from '../utils/runtimeListQuery'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'

const hasExpectedVersionsForRows = (rowIds: string[], versionsByRowId: Record<string, number>): boolean =>
    rowIds.length > 0 &&
    rowIds.every((rowId) => {
        const version = versionsByRowId[rowId]
        return Number.isSafeInteger(version) && version > 0
    })

// ---------------------------------------------------------------------------
//  Hook implementation
// ---------------------------------------------------------------------------

export function useCrudDashboard(options: UseCrudDashboardOptions): CrudDashboardState {
    const {
        adapter,
        locale,
        i18nNamespace = 'apps',
        defaultPageSize = 20,
        pageSizeOptions = [10, 20, 50],
        staleTime = 0,
        initialSectionId,
        onRuntimeDataChanged,
        workspaceId,
        cellRenderers,
        createDefaultContext: createDefaultContextOption
    } = options

    const { t } = useTranslation(i18nNamespace)
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    // ----- Pagination & section selection -----
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: defaultPageSize
    })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [searchValue, setSearchValueState] = useState('')
    const [selectedObjectCollectionId, setSelectedObjectCollectionId] = useState<string | undefined>(() =>
        initialSectionId ? undefined : readInitialObjectCollectionId()
    )
    const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(
        () => initialSectionId ?? readInitialObjectCollectionId()
    )

    // ----- CRUD dialog state -----
    const [formOpen, setFormOpen] = useState(false)
    const [editRowId, setEditRowId] = useState<string | null>(null)
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [copyRowId, setCopyRowId] = useState<string | null>(null)
    const [formRelationScope, setFormRelationScope] = useState<RuntimeRelationScope | undefined>(undefined)
    const [deleteRelationScope, setDeleteRelationScope] = useState<RuntimeRelationScope | undefined>(undefined)
    const [formExpectedVersion, setFormExpectedVersion] = useState<number | null>(null)
    const [deleteExpectedVersion, setDeleteExpectedVersion] = useState<number | null>(null)
    const [createInitialData, setCreateInitialData] = useState<Record<string, unknown> | undefined>(undefined)
    const [createWizard, setCreateWizard] = useState<RelationBuilderCreateWizard>(undefined)
    const [formError, setFormError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [copyError, setCopyError] = useState<string | null>(null)

    // ----- Row actions menu state -----
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)

    // ----- Schema fingerprint (M4) -----
    const formColumnsRef = useRef<string | null>(null)
    const formRequestIdRef = useRef(0)
    const deleteRequestIdRef = useRef(0)
    const previousInitialSectionIdRef = useRef(initialSectionId)

    // ----- Derived values -----
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const runtimeSort = useMemo(() => mapGridSortModel(sortModel), [sortModel])
    const runtimeFilters = useMemo(() => mapGridFilterModel(filterModel), [filterModel])
    const normalizedSearchValue = searchValue.trim()
    const normalizedWorkspaceId = workspaceId?.trim() || null

    const setSortModel = useCallback((model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const setFilterModel = useCallback((model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const setSearchValue = useCallback((value: string) => {
        setSearchValueState(value)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const resetSectionScopedListState = useCallback(() => {
        setPaginationModel((current) => ({ ...current, page: 0 }))
        setSortModelState([])
        setFilterModelState({ items: [] })
    }, [])

    // Query key helpers. Explicit workspace routes get a dedicated prefix so
    // optimistic updates cannot modify another workspace's cached rows.
    const baseQueryKeyPrefix = adapter?.queryKeyPrefix ?? EMPTY_KEY_PREFIX
    const queryKeyPrefix = useMemo(
        () => (normalizedWorkspaceId ? [...baseQueryKeyPrefix, 'workspace', normalizedWorkspaceId] : baseQueryKeyPrefix),
        [baseQueryKeyPrefix, normalizedWorkspaceId]
    )
    const pendingInteractionMessage = t('app.pendingCreateBlocked', {
        defaultValue: 'This item is still being created. Please wait a moment and try again.'
    })
    const listKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'list',
                selectedSectionId,
                selectedObjectCollectionId,
                {
                    limit,
                    offset,
                    locale,
                    workspaceId: normalizedWorkspaceId,
                    search: normalizedSearchValue,
                    sort: runtimeSort,
                    filters: runtimeFilters
                }
            ] as const,
        [
            queryKeyPrefix,
            selectedSectionId,
            selectedObjectCollectionId,
            limit,
            offset,
            locale,
            normalizedWorkspaceId,
            normalizedSearchValue,
            runtimeFilters,
            runtimeSort
        ]
    )

    const sourceRowId = copyRowId ?? editRowId

    // ----- List query -----
    const listQuery = useQuery({
        queryKey: listKey,
        queryFn: () =>
            adapter!.fetchList({
                limit,
                offset,
                locale,
                objectCollectionId: selectedObjectCollectionId,
                sectionId: selectedSectionId,
                ...(normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {}),
                search: normalizedSearchValue || undefined,
                sort: runtimeSort,
                filters: runtimeFilters
            }),
        enabled: Boolean(adapter),
        staleTime,
        placeholderData: (previousData, previousQuery) => {
            const previousKeyTail = previousQuery?.queryKey.at(-1)
            if (!previousKeyTail || typeof previousKeyTail !== 'object' || !('workspaceId' in previousKeyTail)) {
                return previousData
            }
            return previousKeyTail.workspaceId === normalizedWorkspaceId ? previousData : undefined
        }
    })

    const appData = listQuery.data
    const applyWorkspaceLimitDelta = useCallback(
        (delta: number) => {
            queryClient.setQueriesData<AppDataResponse>({ queryKey: queryKeyPrefix }, (old) => {
                if (!old?.workspaceLimit) {
                    return old
                }

                const nextCurrentRows = Math.max(0, old.workspaceLimit.currentRows + delta)
                const maxRows = old.workspaceLimit.maxRows
                return {
                    ...old,
                    workspaceLimit: {
                        ...old.workspaceLimit,
                        currentRows: nextCurrentRows,
                        canCreate: maxRows === null ? true : nextCurrentRows < maxRows
                    }
                }
            })
        },
        [queryClient, queryKeyPrefix]
    )
    const guardPendingRowInteraction = useCallback(
        (rowId: string) => {
            const queryEntries = queryClient.getQueriesData<AppDataResponse>({ queryKey: queryKeyPrefix })
            const pendingRow = queryEntries.flatMap(([, data]) => data?.rows ?? []).find((row) => row.id === rowId)

            if (!pendingRow || !isPendingInteractionBlocked(pendingRow)) return false

            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix,
                entityId: rowId
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
            return true
        },
        [enqueueSnackbar, pendingInteractionMessage, queryClient, queryKeyPrefix]
    )
    const backendActiveSectionId =
        appData?.activeSectionId ?? appData?.section?.id ?? appData?.activeObjectCollectionId ?? appData?.objectCollection.id
    const backendActiveObjectCollectionId = appData?.activeObjectCollectionId ?? appData?.objectCollection.id ?? backendActiveSectionId

    useEffect(() => {
        if (!initialSectionId) {
            previousInitialSectionIdRef.current = initialSectionId
            return
        }

        const didInitialSectionChange = previousInitialSectionIdRef.current !== initialSectionId
        previousInitialSectionIdRef.current = initialSectionId

        if (didInitialSectionChange) {
            setSelectedSectionId((current) => {
                if (current === initialSectionId) return current
                resetSectionScopedListState()
                return initialSectionId
            })
            if (appData) {
                setSelectedObjectCollectionId(resolveRuntimeObjectCollectionForSection(appData, initialSectionId))
            }
            return
        }

        if (!appData || selectedSectionId !== initialSectionId) return
        const nextObjectCollectionId = resolveRuntimeObjectCollectionForSection(appData, initialSectionId)
        setSelectedObjectCollectionId((current) => (current === nextObjectCollectionId ? current : nextObjectCollectionId))
    }, [appData, initialSectionId, resetSectionScopedListState, selectedSectionId])

    const isResolvingSelectedSection = Boolean(
        appData && selectedSectionId && backendActiveSectionId && selectedSectionId !== backendActiveSectionId && listQuery.isFetching
    )
    const isSuppressingStaleSectionData = isResolvingSelectedSection
    const displayAppData = isSuppressingStaleSectionData ? undefined : appData
    const activeSectionId = selectedSectionId ?? (isSuppressingStaleSectionData ? undefined : backendActiveSectionId)
    const selectedSectionObjectCollectionId = selectedSectionId
        ? resolveRuntimeObjectCollectionForSection(appData, selectedSectionId)
        : undefined
    const activeObjectCollectionId = selectedSectionId
        ? selectedSectionObjectCollectionId
        : selectedObjectCollectionId ?? (isSuppressingStaleSectionData ? undefined : backendActiveObjectCollectionId)
    const activeRuntimeTarget = useMemo(
        () => ({
            objectCollectionId: activeObjectCollectionId,
            sectionId: selectedSectionId ?? activeSectionId,
            ...(normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {})
        }),
        [activeObjectCollectionId, activeSectionId, normalizedWorkspaceId, selectedSectionId]
    )
    const makeRowKey = useCallback(
        (rowId: string | null | undefined) =>
            [
                ...queryKeyPrefix,
                'row',
                activeRuntimeTarget.sectionId ?? null,
                activeRuntimeTarget.objectCollectionId ?? null,
                activeRuntimeTarget.workspaceId ?? null,
                rowId ?? null
            ] as const,
        [activeRuntimeTarget.objectCollectionId, activeRuntimeTarget.sectionId, activeRuntimeTarget.workspaceId, queryKeyPrefix]
    )
    const rowKey = useMemo(() => makeRowKey(sourceRowId), [makeRowKey, sourceRowId])
    const tableColumnRefs = useMemo(
        () =>
            (displayAppData?.columns ?? [])
                .filter((column) => column.dataType === 'TABLE')
                .map((column) => ({
                    fieldId: column.field,
                    componentId: column.id
                })),
        [displayAppData?.columns]
    )
    const copyTablesKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'copy-table-data',
                activeRuntimeTarget.sectionId ?? null,
                activeRuntimeTarget.objectCollectionId ?? null,
                activeRuntimeTarget.workspaceId ?? null,
                sourceRowId,
                tableColumnRefs.map((column) => column.fieldId).join(',')
            ] as const,
        [
            activeRuntimeTarget.objectCollectionId,
            activeRuntimeTarget.sectionId,
            activeRuntimeTarget.workspaceId,
            queryKeyPrefix,
            sourceRowId,
            tableColumnRefs
        ]
    )

    // Schema fingerprint (M4)
    const currentSchemaFingerprint = useMemo(() => {
        if (!displayAppData?.columns) return null
        return displayAppData.columns
            .map((c) => c.field)
            .sort()
            .join(',')
    }, [displayAppData?.columns])
    const fieldConfigs = useMemo(() => (displayAppData ? toFieldConfigs(displayAppData) : []), [displayAppData])
    const rows = useMemo(() => (displayAppData ? displayAppData.rows : []), [displayAppData])
    const canPersistRowReorder = Boolean(adapter?.reorderRows)
    const canPersistRelationRowReorder = Boolean(adapter?.reorderRows)
    const createDefaultContext = useMemo(() => {
        if (typeof createDefaultContextOption === 'function') {
            return createDefaultContextOption(displayAppData)
        }
        return createDefaultContextOption
    }, [createDefaultContextOption, displayAppData])

    // Initialize the selected runtime target from the effective layout route or backend default.
    useEffect(() => {
        if (!appData || selectedSectionId) return
        const bootstrapSectionId = backendActiveSectionId
        if (bootstrapSectionId) {
            setSelectedSectionId(bootstrapSectionId)
            setSelectedObjectCollectionId(resolveRuntimeObjectCollectionForSection(appData, bootstrapSectionId))
        }
    }, [appData, selectedSectionId, backendActiveSectionId])

    // ----- Row query (for edit) -----
    const rowQuery = useQuery({
        queryKey: rowKey,
        queryFn: () => adapter!.fetchRow(sourceRowId!, activeRuntimeTarget),
        enabled: Boolean(adapter && sourceRowId),
        staleTime: 0,
        gcTime: 0
    })

    useEffect(() => {
        if (!sourceRowId || formExpectedVersion !== null || !rowQuery.data) return
        const rawVersion = rowQuery.data.version
        const expectedVersion =
            typeof rawVersion === 'number'
                ? rawVersion
                : typeof rawVersion === 'string' && rawVersion.trim().length > 0
                ? Number(rawVersion)
                : Number.NaN
        if (Number.isSafeInteger(expectedVersion) && expectedVersion > 0) setFormExpectedVersion(expectedVersion)
    }, [formExpectedVersion, rowQuery.data, sourceRowId])

    const copyTablesQuery = useQuery({
        queryKey: copyTablesKey,
        queryFn: async () => {
            const fetchTabularRows = adapter?.fetchTabularRows
            if (!fetchTabularRows || !sourceRowId || tableColumnRefs.length === 0) {
                return {} as Record<string, Array<Record<string, unknown>>>
            }

            const entries = await Promise.all(
                tableColumnRefs.map(async (column) => {
                    const rows = await fetchTabularRows({
                        parentRowId: sourceRowId,
                        componentId: column.componentId,
                        objectCollectionId: activeRuntimeTarget.objectCollectionId,
                        sectionId: activeRuntimeTarget.sectionId,
                        ...(activeRuntimeTarget.workspaceId ? { workspaceId: activeRuntimeTarget.workspaceId } : {})
                    })
                    return [column.fieldId, rows] as const
                })
            )

            return Object.fromEntries(entries)
        },
        enabled: Boolean(copyRowId && adapter?.fetchTabularRows && sourceRowId && tableColumnRefs.length > 0),
        staleTime: 0,
        gcTime: 0
    })

    const { createMutation, copyMutation, updateMutation, deleteMutation, reorderMutation, recordCommandMutation, workflowActionMutation } =
        useCrudDashboardMutations({
            adapter,
            activeRuntimeTarget,
            applyWorkspaceLimitDelta,
            copyRowId,
            makeRowKey,
            queryClient,
            queryKeyPrefix,
            onRuntimeDataChanged
        })

    const getRuntimeMutationErrorMessage = useCallback(
        (err: unknown) => extractRuntimeErrorMessage(err, t('app.errorGenericMessage', 'Please try again or reload the page.'), locale),
        [locale, t]
    )

    // ----- CRUD handlers -----
    const handleOpenCreate = useCallback(
        (
            createDefaults?: readonly CreateTargetDefault[],
            createDefaultContextOverride?: Record<string, unknown>,
            relationScope?: RuntimeRelationScope,
            createWizard?: RelationBuilderCreateWizard
        ) => {
            if (displayAppData?.workspaceLimit?.canCreate === false) {
                enqueueSnackbar(
                    t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this section has been reached ({{current}} / {{max}}).',
                        current: displayAppData.workspaceLimit.currentRows,
                        max: displayAppData.workspaceLimit.maxRows ?? '∞'
                    }),
                    { variant: 'info' }
                )
                return
            }
            formRequestIdRef.current += 1
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(null)
            setFormExpectedVersion(null)
            setFormRelationScope(relationScope)
            setCreateWizard(createWizard)
            setFormError(null)
            const effectiveCreateDefaultContext = createDefaultContextOverride
                ? { ...(createDefaultContext ?? {}), ...createDefaultContextOverride }
                : createDefaultContext
            setCreateInitialData(buildSafeCreateInitialData(createDefaults, fieldConfigs, effectiveCreateDefaultContext))
            formColumnsRef.current = currentSchemaFingerprint
            setFormOpen(true)
        },
        [displayAppData?.workspaceLimit, currentSchemaFingerprint, createDefaultContext, enqueueSnackbar, fieldConfigs, t]
    )

    const handleOpenEdit = useCallback(
        (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => {
            if (guardPendingRowInteraction(rowId)) return
            formRequestIdRef.current += 1
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(rowId)
            const currentRow = rows.find((row) => String(row.id) === rowId)
            setFormExpectedVersion(
                typeof expectedVersion === 'number' && Number.isSafeInteger(expectedVersion) && expectedVersion > 0
                    ? expectedVersion
                    : readRuntimeRowVersion(currentRow)
            )
            setFormRelationScope(relationScope)
            setCreateWizard(undefined)
            setFormError(null)
            setCreateInitialData(undefined)
            formColumnsRef.current = currentSchemaFingerprint
            setFormOpen(true)
        },
        [currentSchemaFingerprint, guardPendingRowInteraction, rows]
    )

    const handleCloseForm = useCallback(() => {
        formRequestIdRef.current += 1
        setFormOpen(false)
        setEditRowId(null)
        setCopyRowId(null)
        setFormExpectedVersion(null)
        setFormRelationScope(undefined)
        setCreateWizard(undefined)
        setCreateInitialData(undefined)
        setFormError(null)
        setCopyError(null)
        formColumnsRef.current = null
    }, [])

    const handleFormSubmit = useCallback(
        (data: Record<string, unknown>) => {
            if (formColumnsRef.current && currentSchemaFingerprint && formColumnsRef.current !== currentSchemaFingerprint) {
                setFormError(
                    t('app.errorSchemaChanged', {
                        defaultValue: 'Schema has changed since this form was opened. Please close and try again.'
                    })
                )
                return Promise.resolve()
            }

            const sanitizedData = stripReadOnlyEnumerationLabelFields({
                payload: data,
                fieldConfigs
            })
            const currentEditRowId = editRowId
            const currentCopyRowId = copyRowId
            const currentRelationScope = formRelationScope
            const isCopyMode = Boolean(currentCopyRowId)
            const requestId = formRequestIdRef.current
            const submittedSchemaFingerprint = formColumnsRef.current

            const sourceCopyRow = currentCopyRowId ? rows.find((row) => String(row.id) === currentCopyRowId) : null
            const copyExpectedVersion = formExpectedVersion ?? readRuntimeRowVersion(sourceCopyRow)
            const sourceEditRow = currentEditRowId ? rows.find((row) => String(row.id) === currentEditRowId) : null
            const editExpectedVersion = formExpectedVersion ?? readRuntimeRowVersion(sourceEditRow)
            const expectedVersion = isCopyMode ? copyExpectedVersion : editExpectedVersion
            const requiresExpectedVersion = isCopyMode || currentEditRowId !== null
            const mutationExpectedVersion =
                typeof expectedVersion === 'number' && Number.isSafeInteger(expectedVersion) && expectedVersion > 0
                    ? expectedVersion
                    : undefined
            if (requiresExpectedVersion && mutationExpectedVersion === undefined) {
                const message = t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.')
                setFormError(message)
                setCopyError(isCopyMode ? message : null)
                return Promise.resolve()
            }

            const reopenFormWithError = (err: unknown) => {
                if (formRequestIdRef.current !== requestId) return

                const msg = getRuntimeMutationErrorMessage(err)
                const resolvedError = isCopyMode
                    ? t('app.errorCopy', {
                          defaultValue: 'Copy failed: {{message}}',
                          message: msg
                      })
                    : currentEditRowId
                    ? t('app.errorUpdate', {
                          defaultValue: 'Update failed: {{message}}',
                          message: msg
                      })
                    : t('app.errorCreate', {
                          defaultValue: 'Create failed: {{message}}',
                          message: msg
                      })

                setEditRowId(currentEditRowId)
                setCopyRowId(currentCopyRowId)
                setFormError(resolvedError)
                if (isCopyMode) {
                    setCopyError(resolvedError)
                } else {
                    setCopyError(null)
                }
                formColumnsRef.current = submittedSchemaFingerprint
                setFormOpen(true)
            }

            setFormError(null)
            setCopyError(null)
            setFormOpen(false)

            const mutationPromise = isCopyMode
                ? copyMutation.mutateAsync({
                      rowId: currentCopyRowId!,
                      data: sanitizedData,
                      expectedVersion: mutationExpectedVersion,
                      relationScope: currentRelationScope
                  })
                : currentEditRowId
                ? updateMutation.mutateAsync({
                      rowId: currentEditRowId,
                      data: sanitizedData,
                      expectedVersion: mutationExpectedVersion,
                      relationScope: currentRelationScope
                  })
                : createMutation.mutateAsync({ data: sanitizedData, relationScope: currentRelationScope })

            void mutationPromise
                .then(() => {
                    if (formRequestIdRef.current !== requestId) return

                    setEditRowId(null)
                    setCopyRowId(null)
                    setFormExpectedVersion(null)
                    setFormRelationScope(undefined)
                    setCreateWizard(undefined)
                    setCreateInitialData(undefined)
                    setFormError(null)
                    setCopyError(null)
                    formColumnsRef.current = null
                })
                .catch((err: unknown) => {
                    reopenFormWithError(err)
                })

            return Promise.resolve()
        },
        [
            copyRowId,
            editRowId,
            formRelationScope,
            formExpectedVersion,
            fieldConfigs,
            rows,
            copyMutation,
            updateMutation,
            createMutation,
            t,
            currentSchemaFingerprint,
            getRuntimeMutationErrorMessage
        ]
    )

    const handleOpenDelete = useCallback(
        (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => {
            if (guardPendingRowInteraction(rowId)) return
            deleteRequestIdRef.current += 1
            setDeleteRowId(rowId)
            setDeleteRelationScope(relationScope)
            const currentRow = rows.find((row) => String(row.id) === rowId)
            setDeleteExpectedVersion(
                typeof expectedVersion === 'number' && Number.isSafeInteger(expectedVersion) && expectedVersion > 0
                    ? expectedVersion
                    : readRuntimeRowVersion(currentRow)
            )
            setDeleteError(null)
        },
        [guardPendingRowInteraction, rows]
    )

    const handleCloseDelete = useCallback(() => {
        deleteRequestIdRef.current += 1
        setDeleteRowId(null)
        setDeleteRelationScope(undefined)
        setDeleteExpectedVersion(null)
        setDeleteError(null)
    }, [])

    const handleConfirmDelete = useCallback(() => {
        if (!deleteRowId) return Promise.resolve()

        const currentDeleteRowId = deleteRowId
        const currentRelationScope = deleteRelationScope
        const requestId = deleteRequestIdRef.current
        const currentRow = rows.find((row) => String(row.id) === currentDeleteRowId)
        const expectedVersion = deleteExpectedVersion ?? readRuntimeRowVersion(currentRow)

        if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
            setDeleteError(t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.'))
            return Promise.resolve()
        }

        setDeleteError(null)
        setDeleteRowId(null)

        void deleteMutation
            .mutateAsync({ rowId: currentDeleteRowId, expectedVersion, relationScope: currentRelationScope })
            .then(() => {
                if (deleteRequestIdRef.current === requestId) {
                    setDeleteRelationScope(undefined)
                    setDeleteExpectedVersion(null)
                }
            })
            .catch((err: unknown) => {
                if (deleteRequestIdRef.current !== requestId) return

                const msg = getRuntimeMutationErrorMessage(err)
                setDeleteError(
                    t('app.errorDelete', {
                        defaultValue: 'Delete failed: {{message}}',
                        message: msg
                    })
                )
                setDeleteRowId(currentDeleteRowId)
            })

        return Promise.resolve()
    }, [deleteExpectedVersion, deleteRelationScope, deleteRowId, deleteMutation, rows, t, getRuntimeMutationErrorMessage])

    const handleOpenCopy = useCallback(
        (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => {
            if (guardPendingRowInteraction(rowId)) return
            if (displayAppData?.workspaceLimit?.canCreate === false) {
                enqueueSnackbar(
                    t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this section has been reached ({{current}} / {{max}}).',
                        current: displayAppData.workspaceLimit.currentRows,
                        max: displayAppData.workspaceLimit.maxRows ?? '∞'
                    }),
                    { variant: 'info' }
                )
                return
            }
            formRequestIdRef.current += 1
            setFormOpen(true)
            setCopyError(null)
            setFormError(null)
            setCreateInitialData(undefined)
            setCopyRowId(rowId)
            const currentRow = rows.find((row) => String(row.id) === rowId)
            setFormExpectedVersion(
                typeof expectedVersion === 'number' && Number.isSafeInteger(expectedVersion) && expectedVersion > 0
                    ? expectedVersion
                    : readRuntimeRowVersion(currentRow)
            )
            setFormRelationScope(relationScope)
            setCreateWizard(undefined)
            setEditRowId(null)
            formColumnsRef.current = currentSchemaFingerprint
        },
        [displayAppData?.workspaceLimit, currentSchemaFingerprint, enqueueSnackbar, guardPendingRowInteraction, rows, t]
    )

    const handleCloseCopy = useCallback(() => {
        handleCloseForm()
    }, [handleCloseForm])

    const handlePersistRowReorder = useCallback(
        async (params: { objectCollectionCodename: string; orderedRowIds: string[]; expectedVersionsByRowId: Record<string, number> }) => {
            if (!adapter?.reorderRows || params.orderedRowIds.length === 0) return

            const requestedCodename = params.objectCollectionCodename.trim().toLowerCase()
            const matchingTargets = (displayAppData?.objectCollections ?? []).filter(
                ({ codename }) => typeof codename === 'string' && codename.trim().toLowerCase() === requestedCodename
            )
            const target = matchingTargets.length === 1 ? matchingTargets[0] : undefined
            if (!target?.id || !requestedCodename) {
                enqueueSnackbar(t('app.targetActionUnavailable', 'This action is not available for this row.'), { variant: 'error' })
                return
            }
            if (!hasExpectedVersionsForRows(params.orderedRowIds, params.expectedVersionsByRowId)) {
                enqueueSnackbar(t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.'), {
                    variant: 'error'
                })
                return
            }

            try {
                await reorderMutation.mutateAsync({
                    objectCollectionId: target.id,
                    orderedRowIds: params.orderedRowIds,
                    expectedVersionsByRowId: params.expectedVersionsByRowId
                })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorReorder', {
                        defaultValue: 'Reorder failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
                throw err
            }
        },
        [adapter?.reorderRows, displayAppData?.objectCollections, enqueueSnackbar, reorderMutation, t, getRuntimeMutationErrorMessage]
    )

    const handlePersistRelationRowReorder = useCallback(
        async (params: {
            objectCollectionCodename: string
            parentFieldCodename: string
            parentRecordId: string
            orderedRowIds: string[]
            expectedVersionsByRowId: Record<string, number>
        }) => {
            if (!adapter?.reorderRows || params.orderedRowIds.length === 0) return
            const requestedCodename = params.objectCollectionCodename.trim().toLowerCase()
            const target = (displayAppData?.objectCollections ?? []).find(
                ({ codename }) => typeof codename === 'string' && codename.trim().toLowerCase() === requestedCodename
            )
            if (!target?.id) {
                enqueueSnackbar(t('app.targetActionUnavailable', 'This action is not available for this row.'), { variant: 'error' })
                return
            }
            if (!hasExpectedVersionsForRows(params.orderedRowIds, params.expectedVersionsByRowId)) {
                enqueueSnackbar(t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.'), {
                    variant: 'error'
                })
                return
            }

            try {
                await reorderMutation.mutateAsync({
                    objectCollectionId: target.id,
                    orderedRowIds: params.orderedRowIds,
                    expectedVersionsByRowId: params.expectedVersionsByRowId,
                    parentScope: {
                        fieldCodename: params.parentFieldCodename,
                        parentRecordId: params.parentRecordId
                    }
                })
            } catch (err) {
                enqueueSnackbar(
                    t('app.errorReorder', {
                        defaultValue: 'Reorder failed: {{message}}',
                        message: getRuntimeMutationErrorMessage(err)
                    }),
                    { variant: 'error' }
                )
            }
        },
        [adapter?.reorderRows, displayAppData?.objectCollections, enqueueSnackbar, getRuntimeMutationErrorMessage, reorderMutation, t]
    )

    const handleRecordCommand = useCallback(
        async (rowId: string, command: RuntimeRecordCommand) => {
            if (guardPendingRowInteraction(rowId)) return
            const row = rows.find((candidate) => candidate.id === rowId) ?? null
            const expectedVersion = readRuntimeRowVersion(row)
            if (!expectedVersion) {
                enqueueSnackbar(t('app.errorRuntimeRowVersionRequired', 'This record has no current version. Reload it and try again.'), {
                    variant: 'error'
                })
                return
            }

            try {
                await recordCommandMutation.mutateAsync({ rowId, command, expectedVersion })
                const messageKey =
                    command === 'post' ? 'app.recordPosted' : command === 'unpost' ? 'app.recordUnposted' : 'app.recordVoided'
                const defaultValue = command === 'post' ? 'Record posted.' : command === 'unpost' ? 'Record unposted.' : 'Record voided.'
                enqueueSnackbar(t(messageKey, defaultValue), { variant: 'success' })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorRecordCommand', {
                        defaultValue: 'Record command failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
            }
        },
        [enqueueSnackbar, guardPendingRowInteraction, recordCommandMutation, rows, t, getRuntimeMutationErrorMessage]
    )

    const handleWorkflowAction = useCallback(
        async (rowId: string, actionCodename: string) => {
            if (guardPendingRowInteraction(rowId)) return

            const row = rows.find((candidate) => candidate.id === rowId) ?? null
            const expectedVersion = readRuntimeRowVersion(row)
            if (!expectedVersion) {
                enqueueSnackbar(
                    t('app.errorWorkflowVersionRequired', {
                        defaultValue: 'Workflow action requires a current row version. Please reload and try again.'
                    }),
                    { variant: 'error' }
                )
                return
            }

            try {
                await workflowActionMutation.mutateAsync({ rowId, actionCodename, expectedVersion })
                enqueueSnackbar(t('app.workflowActionCompleted', 'Workflow action completed.'), { variant: 'success' })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorWorkflowAction', {
                        defaultValue: 'Workflow action failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
            }
        },
        [enqueueSnackbar, guardPendingRowInteraction, rows, t, workflowActionMutation, getRuntimeMutationErrorMessage]
    )

    // ----- Row actions menu -----
    const handleOpenMenu = useCallback(
        (event: React.MouseEvent<HTMLElement>, rowId: string) => {
            event.stopPropagation()
            if (guardPendingRowInteraction(rowId)) return
            setMenuAnchorEl(event.currentTarget)
            setMenuRowId(rowId)
        },
        [guardPendingRowInteraction]
    )

    const handleCloseMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    // ----- Section select handler -----
    const onSelectObjectCollection = useCallback(
        (objectCollectionId: string) => {
            if (!objectCollectionId || (objectCollectionId === activeObjectCollectionId && objectCollectionId === activeSectionId)) return
            resetSectionScopedListState()
            setSelectedSectionId(objectCollectionId)
            setSelectedObjectCollectionId(objectCollectionId)
        },
        [activeObjectCollectionId, activeSectionId, resetSectionScopedListState]
    )
    const onSelectSection = useCallback(
        (sectionId: string) => {
            if (!sectionId || sectionId === activeSectionId) return
            resetSectionScopedListState()
            setSelectedSectionId(sectionId)
            setSelectedObjectCollectionId(undefined)
        },
        [activeSectionId, resetSectionScopedListState]
    )

    // ----- Derived: columns, fieldConfigs, rows -----
    const columns = useMemo(() => {
        if (!displayAppData) return []

        const permissions = displayAppData.permissions
        const canOpenRowActions =
            permissions?.editContent === true || permissions?.createContent === true || permissions?.deleteContent === true

        return toGridColumns(displayAppData, {
            onMenuOpen: canOpenRowActions ? handleOpenMenu : undefined,
            actionsAriaLabel: t('app.actions', 'Actions'),
            cellRenderers,
            locale
        })
    }, [displayAppData, t, handleOpenMenu, cellRenderers, locale])

    const rowCount = displayAppData?.pagination.total
    const localeText = useMemo(() => getDataGridLocaleText(locale), [locale])

    // Form initial data
    const formInitialData = useMemo(() => {
        if (!sourceRowId) return createInitialData
        if (rowQuery.data) {
            const raw = rowQuery.data as Record<string, unknown>
            const sourceData = ((raw.data as Record<string, unknown>) ?? raw) as Record<string, unknown>
            if (copyRowId) {
                const withCopySuffix = appendCopySuffixToFirstStringField({
                    sourceData,
                    fieldConfigs,
                    locale
                })
                const tableData = copyTablesQuery.data ?? {}
                return {
                    ...withCopySuffix,
                    ...tableData
                }
            }
            return sourceData
        }
        return undefined
    }, [sourceRowId, createInitialData, copyRowId, fieldConfigs, rowQuery.data, copyTablesQuery.data, locale])

    const isCopyTablesReady = !copyRowId || tableColumnRefs.length === 0 || !adapter?.fetchTabularRows || Boolean(copyTablesQuery.data)
    const isFormReady = !sourceRowId || (Boolean(rowQuery.data) && isCopyTablesReady)

    return {
        // Data
        rawAppData: appData,
        appData: displayAppData,
        isLoading: listQuery.isLoading || isSuppressingStaleSectionData,
        isFetching: listQuery.isFetching,
        isError: listQuery.isError,

        // Table
        columns,
        fieldConfigs,
        rows,
        rowCount,
        paginationModel,
        setPaginationModel,
        sortModel,
        setSortModel,
        filterModel,
        setFilterModel,
        searchValue,
        setSearchValue,
        pageSizeOptions,
        localeText,
        handlePendingInteractionAttempt: guardPendingRowInteraction,

        // Section aliases
        activeSectionId,
        selectedSectionId,
        onSelectSection,

        // Object compatibility
        activeObjectCollectionId,
        selectedObjectCollectionId,
        onSelectObjectCollection,

        // CRUD form
        formOpen,
        editRowId,
        formError,
        formInitialData,
        createWizard,
        isFormReady,
        isSubmitting: createMutation.isPending || updateMutation.isPending,
        isReordering: reorderMutation.isPending,
        canPersistRowReorder,
        canPersistRelationRowReorder,
        handleOpenCreate,
        handleOpenEdit,
        handleCloseForm,
        handleFormSubmit,
        handlePersistRowReorder,
        handlePersistRelationRowReorder,

        // Delete dialog
        deleteRowId,
        deleteError,
        isDeleting: deleteMutation.isPending,
        handleOpenDelete,
        handleCloseDelete,
        handleConfirmDelete,
        copyRowId,
        copyError,
        isCopying: Boolean(copyRowId) && copyMutation.isPending,
        handleOpenCopy,
        handleCloseCopy,

        // Row menu
        menuAnchorEl,
        menuRowId,
        handleOpenMenu,
        handleCloseMenu,
        handleRecordCommand: adapter?.recordCommand ? handleRecordCommand : undefined,
        isRecordCommandPending: recordCommandMutation.isPending,
        handleWorkflowAction: adapter?.workflowAction ? handleWorkflowAction : undefined,
        isWorkflowActionPending: workflowActionMutation.isPending
    }
}
