import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded'
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import type { GridColDef } from '@mui/x-data-grid'
import { createLocalizedContent, generateUuidV7, normalizeLocale } from '@universo-react/utils'
import {
    type AppDataResponse,
    batchUpdateTabularRows,
    compensateCreatedAppRow,
    createAppRow,
    createTabularRow,
    deleteTabularRow,
    fetchAppData,
    fetchTabularRows,
    updateAppRow,
    updateTabularRow
} from '../../api/api'
import { ConfirmDeleteDialog } from '../../components/dialogs/ConfirmDeleteDialog'
import { FormDialog } from '../../components/dialogs/FormDialog'
import type { FieldConfig } from '../../components/dialogs/FormDialog'
import '../../i18n/interpretationNetwork'
import { getDataGridLocaleText } from '../../utils/getDataGridLocale'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { useDashboardDetails } from '../DashboardDetailsContext'
import CustomizedDataGrid from './CustomizedDataGrid'
import { CellEditDialog } from './interpretation-network/CellEditDialog'
import { CatalogToolbar } from './interpretation-network/CatalogToolbar'
import { InterpretationNetworkDetailsPane } from './interpretation-network/InterpretationNetworkDetailsPane'
import { MatrixCellButton } from './interpretation-network/MatrixCellButton'
import {
    buildDefaultMatrixCellData,
    findColumn,
    findMaterialTitle,
    findMaterialsForCell,
    getSectionId,
    isStyleColumn,
    readColumnText,
    readColumnValue,
    resolveMatrixCellId,
    summarizeEditorJsContent,
    toConfig,
    toFieldConfig,
    toMatrixRows,
    uniqueByKey,
    type RuntimeRow
} from './interpretation-network/model'

type MaterialDialogMode = 'create' | 'edit'
type CellDialogMode = 'create-cell' | 'create-row' | 'edit'
type StructureViewMode = 'table' | 'cards'
type WorkspaceDataRequest = Parameters<typeof fetchAppData>[0]

const WORKSPACE_PAGE_SIZE = 100

interface StructureSummary {
    id: string
    row: RuntimeRow
    title: string
    description: string
    interpretationId: string | null
}

const readSubmittedText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
    const localized = locales?.[locale]?.content ?? locales?.en?.content ?? locales?.ru?.content
    return typeof localized === 'string' ? localized.trim() : ''
}

const readSubmittedTextByField = (data: Record<string, unknown>, locale: string, fields: string[]): string => {
    for (const field of fields) {
        const value = readSubmittedText(data[field], locale)
        if (value) return value
    }
    return ''
}

const readSubmittedTextByConfiguredField = (
    data: Record<string, unknown>,
    locale: string,
    configuredField: string,
    fields: FieldConfig[],
    fallbacks: string[]
): string => {
    const lookupKeys = [configuredField, ...fallbacks]
    for (const lookupKey of lookupKeys) {
        const field = fields.find((candidate) => candidate.codename === lookupKey || candidate.id === lookupKey)
        if (!field?.id) continue
        const value = readSubmittedText(data[field.id], locale)
        if (value) return value
    }
    return readSubmittedTextByField(data, locale, lookupKeys)
}

const readRuntimeRowVersion = (row: RuntimeRow | null | undefined): number | undefined => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : undefined
}

const makeAdjacentMatrixColumnLabel = (targetLabel: string, sameRowLabels: Set<string>): string => {
    const baseLabel = targetLabel.trim() || 'Column'
    let index = 2
    let candidate = `${baseLabel} ${index}`
    while (sameRowLabels.has(candidate)) {
        index += 1
        candidate = `${baseLabel} ${index}`
    }
    return candidate
}

const fetchAllWorkspaceData = async (base: Omit<WorkspaceDataRequest, 'limit' | 'offset'>): Promise<AppDataResponse> => {
    const firstPage = await fetchAppData({ ...base, limit: WORKSPACE_PAGE_SIZE, offset: 0 })
    const total = firstPage.pagination?.total ?? firstPage.rows.length
    if (total <= firstPage.rows.length) return firstPage

    const pages: AppDataResponse[] = [firstPage]
    for (let offset = firstPage.rows.length; offset < total; offset += WORKSPACE_PAGE_SIZE) {
        const page = await fetchAppData({ ...base, limit: WORKSPACE_PAGE_SIZE, offset })
        pages.push(page)
        if (page.rows.length === 0) break
    }

    return {
        ...firstPage,
        rows: pages.flatMap((page) => page.rows),
        pagination: {
            ...firstPage.pagination,
            total,
            limit: total,
            offset: 0
        }
    }
}

const RESERVED_RUNTIME_ROUTE_SEGMENTS = new Set(['admin', 'workspaces'])

const readRuntimePathSegments = (applicationId?: string | null): string[] => {
    if (typeof window === 'undefined' || !applicationId) return []
    const rawSegments = window.location.pathname.split('/').filter(Boolean)
    const appMarkerIndex = rawSegments.findIndex(
        (segment, index) => segment === 'a' && decodeURIComponent(rawSegments[index + 1] ?? '') === applicationId
    )
    if (appMarkerIndex < 0) return []
    return rawSegments.slice(appMarkerIndex + 2).map((segment) => decodeURIComponent(segment))
}

const readRouteStructureId = (applicationId?: string | null): string | null => {
    const segments = readRuntimePathSegments(applicationId)
    if (segments.length < 2 || RESERVED_RUNTIME_ROUTE_SEGMENTS.has(segments[0])) return null
    return segments[segments.length - 1] || null
}

const buildStructureRuntimePath = (
    applicationId: string | undefined,
    structureSectionId: string | null | undefined,
    structureId: string | null
): string | null => {
    if (typeof window === 'undefined' || !applicationId) return null
    const segments = readRuntimePathSegments(applicationId)
    const firstRuntimeSegment = segments[0]
    const baseSegments = ['a', encodeURIComponent(applicationId)]

    if (firstRuntimeSegment && !RESERVED_RUNTIME_ROUTE_SEGMENTS.has(firstRuntimeSegment)) {
        baseSegments.push(encodeURIComponent(firstRuntimeSegment))
    } else if (structureSectionId?.trim()) {
        baseSegments.push(encodeURIComponent(structureSectionId.trim()))
    } else if (structureId) {
        return null
    }

    if (structureId) {
        baseSegments.push(encodeURIComponent(structureId))
    }

    return `/${baseSegments.join('/')}${window.location.search}${window.location.hash}`
}

export function InterpretationNetworkWorkspaceWidget({ config }: { config?: Record<string, unknown> }) {
    const widgetConfig = useMemo(() => toConfig(config), [config])
    const details = useDashboardDetails()
    const { t, i18n } = useTranslation('interpretationNetwork')
    const queryClient = useQueryClient()
    const locale = normalizeLocale(details?.locale ?? i18n.language ?? 'en')
    const enabled = Boolean(details?.apiBaseUrl && details.applicationId)
    const applicationId = details?.applicationId
    const shellNavigate = details?.navigate

    const query = useQuery({
        queryKey: ['interpretationNetworkWorkspace', details?.applicationId, details?.currentWorkspaceId, locale, widgetConfig],
        enabled,
        queryFn: async () => {
            const base = {
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                locale
            }
            const [concepts, interpretations, materials] = await Promise.all([
                fetchAllWorkspaceData({ ...base, objectCollectionCodename: widgetConfig.conceptCodename }),
                fetchAllWorkspaceData({ ...base, objectCollectionCodename: widgetConfig.interpretationCodename }),
                fetchAllWorkspaceData({ ...base, objectCollectionCodename: widgetConfig.materialCodename })
            ])
            return { concepts, interpretations, materials }
        }
    })

    const [selectedInterpretationId, setSelectedInterpretationId] = useState<string | null>(null)
    const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null)
    const [routeStructureId, setRouteStructureId] = useState<string | null>(() => readRouteStructureId(details?.applicationId))
    const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
    const [openedMaterialId, setOpenedMaterialId] = useState<string | null>(null)
    const [structureDialogOpen, setStructureDialogOpen] = useState(false)
    const [structureViewMode, setStructureViewMode] = useState<StructureViewMode>('table')
    const [structureFilter, setStructureFilter] = useState('')
    const [materialDialogMode, setMaterialDialogMode] = useState<MaterialDialogMode | null>(null)
    const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
    const [cellDialogMode, setCellDialogMode] = useState<CellDialogMode | null>(null)
    const [cellMenuAnchor, setCellMenuAnchor] = useState<HTMLElement | null>(null)
    const [cellMenuCellId, setCellMenuCellId] = useState<string | null>(null)
    const [cellDeleteId, setCellDeleteId] = useState<string | null>(null)
    const [structureDialogError, setStructureDialogError] = useState<string | null>(null)
    const [materialDialogError, setMaterialDialogError] = useState<string | null>(null)
    const [cellDialogError, setCellDialogError] = useState<string | null>(null)
    const [cellDeleteError, setCellDeleteError] = useState<string | null>(null)
    const canCreateContent = details?.permissions?.createContent === true
    const canEditContent = details?.permissions?.editContent === true
    const canDeleteContent = details?.permissions?.deleteContent === true

    const conceptSectionId = getSectionId(query.data?.concepts)

    const navigateToStructure = useCallback(
        (structureId: string | null, options: { replace?: boolean } = {}) => {
            const nextPath = buildStructureRuntimePath(applicationId, conceptSectionId, structureId)
            if (!nextPath || typeof window === 'undefined') return
            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
            if (nextPath !== currentPath) {
                if (options.replace) {
                    window.history.replaceState(null, '', nextPath)
                } else if (shellNavigate) {
                    shellNavigate(nextPath)
                } else {
                    window.history.pushState(null, '', nextPath)
                }
            }
            setRouteStructureId(structureId)
        },
        [applicationId, conceptSectionId, shellNavigate]
    )

    const concepts = useMemo(() => (query.data?.concepts.rows ?? []) as RuntimeRow[], [query.data?.concepts.rows])
    const interpretations = useMemo(() => (query.data?.interpretations.rows ?? []) as RuntimeRow[], [query.data?.interpretations.rows])
    const materials = useMemo(() => (query.data?.materials.rows ?? []) as RuntimeRow[], [query.data?.materials.rows])
    const interpretationSectionId = getSectionId(query.data?.interpretations)
    const materialSectionId = getSectionId(query.data?.materials)
    const matrixColumn = findColumn(query.data?.interpretations.columns, widgetConfig.matrixField)
    const materialFields = useMemo(
        () =>
            (query.data?.materials.columns ?? [])
                .filter((column) => [widgetConfig.materialTitleField, 'Description'].includes(column.codename ?? column.field ?? ''))
                .map(toFieldConfig)
                .filter((field) => field.id),
        [query.data?.materials.columns, widgetConfig.materialTitleField]
    )
    const materialBodyField = useMemo(
        () =>
            (query.data?.materials.columns ?? [])
                .filter((column) => (column.codename ?? column.field ?? '') === 'Body')
                .map(toFieldConfig)
                .find((field) => field.id),
        [query.data?.materials.columns]
    )
    const structureFields = useMemo(
        () =>
            (query.data?.concepts.columns ?? [])
                .filter((column) =>
                    [widgetConfig.conceptNameField, widgetConfig.conceptDescriptionField].includes(column.codename ?? column.field ?? '')
                )
                .map(toFieldConfig)
                .filter((field) => field.id),
        [query.data?.concepts.columns, widgetConfig.conceptDescriptionField, widgetConfig.conceptNameField]
    )
    const styleFields = useMemo(
        () =>
            (matrixColumn?.childColumns ?? [])
                .filter(isStyleColumn)
                .map(toFieldConfig)
                .filter((field) => field.id),
        [matrixColumn?.childColumns]
    )
    const cellMetadataFields = useMemo(
        () =>
            (matrixColumn?.childColumns ?? [])
                .filter((column) => ['CellValue', 'CellDescription'].includes(column.codename ?? column.field ?? ''))
                .map(toFieldConfig)
                .filter((field) => field.id),
        [matrixColumn?.childColumns]
    )
    const selectedInterpretation = interpretations.find((row) => row.id === selectedInterpretationId)
    const selectedInterpretationConceptRef = readColumnValue(
        selectedInterpretation,
        query.data?.interpretations.columns,
        widgetConfig.interpretationParentField
    )
    const selectedConcept =
        concepts.find((row) => row.id === selectedConceptId) ??
        concepts.find((row) => typeof selectedInterpretationConceptRef === 'string' && row.id === selectedInterpretationConceptRef)
    const matrixRowsQuery = useQuery({
        queryKey: [
            'interpretationNetworkWorkspaceMatrix',
            details?.applicationId,
            details?.currentWorkspaceId,
            selectedInterpretation?.id,
            matrixColumn?.id
        ],
        enabled: Boolean(
            details?.apiBaseUrl && details.applicationId && interpretationSectionId && selectedInterpretation?.id && matrixColumn?.id
        ),
        queryFn: async () =>
            fetchTabularRows({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details?.currentWorkspaceId,
                parentRecordId: selectedInterpretation!.id,
                componentId: matrixColumn!.id!,
                objectCollectionId: interpretationSectionId!
            })
    })
    const matrixCells = useMemo(
        () => toMatrixRows(matrixRowsQuery.data?.items ?? [], matrixColumn, locale),
        [locale, matrixColumn, matrixRowsQuery.data?.items]
    )
    const rawMatrixRowsByCellId = useMemo(() => {
        const childColumns = matrixColumn?.childColumns ?? []
        return new Map(
            (matrixRowsQuery.data?.items ?? []).flatMap((row, index) => {
                if (!row || typeof row !== 'object' || Array.isArray(row)) return []
                return [[resolveMatrixCellId(row as Record<string, unknown>, childColumns, index), row] as const]
            })
        )
    }, [matrixColumn?.childColumns, matrixRowsQuery.data?.items])
    const matrixRowsSnapshotRef = useRef<{ cells: typeof matrixCells; rawRowsByCellId: typeof rawMatrixRowsByCellId }>({
        cells: [],
        rawRowsByCellId: new Map()
    })
    useEffect(() => {
        matrixRowsSnapshotRef.current = {
            cells: matrixCells,
            rawRowsByCellId: rawMatrixRowsByCellId
        }
    }, [matrixCells, rawMatrixRowsByCellId])
    const selectedCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === selectedCellId) : undefined
    const selectedRawCell = selectedCell ? rawMatrixRowsByCellId.get(selectedCell.id) : undefined
    const menuCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellMenuCellId) : undefined
    const deleteCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellDeleteId) : undefined
    const deleteRawCell = deleteCell ? rawMatrixRowsByCellId.get(deleteCell.id) : undefined
    const cellMaterials = findMaterialsForCell(
        materials,
        query.data?.materials.columns,
        selectedCell?.id,
        selectedCell?.materialRef ?? null
    )
    const selectedMaterial =
        openedMaterialId && cellMaterials.some((material) => material.id === openedMaterialId)
            ? cellMaterials.find((material) => material.id === openedMaterialId)
            : undefined
    const editingMaterial = editingMaterialId
        ? cellMaterials.find((material) => material.id === editingMaterialId) ??
          materials.find((material) => material.id === editingMaterialId)
        : undefined
    const materialInitialData = useMemo(
        () =>
            Object.fromEntries(
                materialFields.map((field) => [field.id, materialDialogMode === 'edit' ? editingMaterial?.[field.id] : undefined])
            ),
        [editingMaterial, materialDialogMode, materialFields]
    )
    const materialEditorInitialData = useMemo(
        () => (materialBodyField ? { [materialBodyField.id]: selectedMaterial?.[materialBodyField.id] } : {}),
        [materialBodyField, selectedMaterial]
    )
    const cellDialogInitialData = useMemo(() => {
        const fields = [...cellMetadataFields, ...styleFields]
        if (cellDialogMode === 'create-cell' || cellDialogMode === 'create-row') {
            return buildDefaultMatrixCellData(matrixColumn?.childColumns, locale, {
                row: cellDialogMode === 'create-cell' && selectedCell ? selectedCell.rowLabel : t('workspace.defaults.newRow', 'New row'),
                column:
                    cellDialogMode === 'create-row' && selectedCell ? selectedCell.colLabel : t('workspace.defaults.newCell', 'New cell'),
                value: t('workspace.defaults.newCell', 'New cell')
            })
        }
        return Object.fromEntries(fields.map((field) => [field.id, selectedRawCell?.[field.id] ?? selectedRawCell?.[field.codename ?? '']]))
    }, [cellDialogMode, cellMetadataFields, locale, matrixColumn?.childColumns, selectedCell, selectedRawCell, styleFields, t])
    const rows = useMemo(() => (selectedInterpretation ? uniqueByKey(matrixCells, 'rowKey') : []), [matrixCells, selectedInterpretation])
    const dataGridLocaleText = useMemo(() => getDataGridLocaleText(locale), [locale])
    const interpretationsByConcept = useMemo(() => {
        const byConcept = new Map<string, RuntimeRow[]>()
        for (const interpretation of interpretations) {
            const parentStructure = readColumnValue(
                interpretation,
                query.data?.interpretations.columns,
                widgetConfig.interpretationParentField
            )
            const conceptId = typeof parentStructure === 'string' ? parentStructure : ''
            byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), interpretation])
        }
        return byConcept
    }, [interpretations, query.data?.interpretations.columns, widgetConfig.interpretationParentField])
    const structureSummaries = useMemo<StructureSummary[]>(
        () =>
            concepts.map((concept) => {
                const childInterpretations = interpretationsByConcept.get(concept.id) ?? []
                return {
                    id: concept.id,
                    row: concept,
                    title:
                        readColumnText(concept, query.data?.concepts.columns, widgetConfig.conceptNameField, locale) ||
                        t('workspace.untitledConcept', 'Untitled concept'),
                    description: readColumnText(concept, query.data?.concepts.columns, widgetConfig.conceptDescriptionField, locale),
                    interpretationId: childInterpretations[0]?.id ?? null
                }
            }),
        [
            concepts,
            interpretationsByConcept,
            locale,
            query.data?.concepts.columns,
            t,
            widgetConfig.conceptDescriptionField,
            widgetConfig.conceptNameField
        ]
    )
    const normalizedStructureFilter = structureFilter.trim().toLowerCase()
    const filteredStructures = useMemo(
        () =>
            normalizedStructureFilter
                ? structureSummaries.filter((structure) =>
                      [structure.title, structure.description].some((value) => value.toLowerCase().includes(normalizedStructureFilter))
                  )
                : structureSummaries,
        [normalizedStructureFilter, structureSummaries]
    )
    const matrixRows = useMemo(
        () =>
            rows.map((row) => ({
                ...row,
                cells: matrixCells.filter((cell) => cell.rowKey === row.rowKey)
            })),
        [matrixCells, rows]
    )
    const matrixCellIds = useMemo(() => matrixCells.map((cell) => cell.id), [matrixCells])
    const pendingMoveKeyRef = useRef<string | null>(null)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        if (selectedInterpretationId && !interpretations.some((row) => row.id === selectedInterpretationId)) {
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
        }
    }, [interpretations, selectedInterpretationId])

    useEffect(() => {
        if (selectedConceptId && !concepts.some((row) => row.id === selectedConceptId)) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
        }
    }, [concepts, selectedConceptId])

    useEffect(() => {
        const handlePopState = () => {
            setRouteStructureId(readRouteStructureId(details?.applicationId))
        }

        handlePopState()
        if (typeof window === 'undefined') return undefined
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [details?.applicationId])

    useEffect(() => {
        if (query.isLoading || query.isFetching) return
        if (!routeStructureId) {
            if (selectedConceptId) {
                setSelectedConceptId(null)
                setSelectedInterpretationId(null)
                setSelectedCellId(null)
                setSelectedMaterialId(null)
                setOpenedMaterialId(null)
            }
            return
        }

        const routeStructure = structureSummaries.find((structure) => structure.id === routeStructureId)
        if (!routeStructure) {
            setSelectedConceptId(null)
            setSelectedInterpretationId(null)
            setSelectedCellId(null)
            setSelectedMaterialId(null)
            setOpenedMaterialId(null)
            return
        }
        if (selectedConceptId === routeStructure.id && selectedInterpretationId === routeStructure.interpretationId) return

        setSelectedConceptId(routeStructure.id)
        setSelectedInterpretationId(routeStructure.interpretationId)
        setSelectedCellId(null)
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
    }, [query.isFetching, query.isLoading, routeStructureId, selectedConceptId, selectedInterpretationId, structureSummaries])

    useEffect(() => {
        if (selectedCellId && !matrixCells.some((cell) => cell.id === selectedCellId)) {
            setSelectedCellId(null)
        }
    }, [matrixCells, selectedCellId])

    useEffect(() => {
        if (!selectedCell) {
            setSelectedMaterialId(null)
            setOpenedMaterialId(null)
            setEditingMaterialId(null)
            setMaterialDialogMode(null)
            return
        }
        if (selectedMaterialId && cellMaterials.some((material) => material.id === selectedMaterialId)) return
        setSelectedMaterialId(cellMaterials[0]?.id ?? null)
    }, [cellMaterials, selectedCell, selectedMaterialId])

    const createStructureMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
            const conceptSectionId = getSectionId(query.data?.concepts)
            if (!details?.apiBaseUrl || !details.applicationId || !conceptSectionId || !interpretationSectionId) return null
            const normalizedLocale = normalizeLocale(locale)
            const structureName =
                readSubmittedTextByConfiguredField(data, normalizedLocale, widgetConfig.conceptNameField, structureFields, [
                    'Name',
                    'Title'
                ]) || t('workspace.structure.newName', 'New structure')
            const concept = await createAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: conceptSectionId,
                data
            })
            if (typeof concept.id !== 'string') return { concept, interpretation: null }
            const conceptId = concept.id

            const interpretationData: Record<string, unknown> = {
                [widgetConfig.interpretationTitleField]: createLocalizedContent(
                    normalizedLocale,
                    t('workspace.structure.newInterpretationTitle', {
                        defaultValue: '{{name}} matrix',
                        name: structureName
                    })
                ),
                [widgetConfig.interpretationParentField]: conceptId
            }
            if (matrixColumn) {
                interpretationData[widgetConfig.matrixField] = [
                    buildDefaultMatrixCellData(matrixColumn.childColumns, normalizedLocale, {
                        row: t('workspace.defaults.definition', 'Definition'),
                        column: t('workspace.defaults.meaning', 'Meaning')
                    })
                ]
            }
            const created = await createAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: interpretationSectionId,
                data: interpretationData
            }).catch(async (error) => {
                await compensateCreatedAppRow({
                    apiBaseUrl: details.apiBaseUrl!,
                    applicationId: details.applicationId!,
                    workspaceId: details.currentWorkspaceId,
                    rowId: conceptId,
                    objectCollectionId: conceptSectionId
                }).catch(() => undefined)
                throw error
            })
            return { concept, interpretation: created }
        },
        onSuccess: async (created) => {
            setStructureDialogOpen(false)
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            let createdConceptId: string | null = null
            if (created?.concept && typeof created.concept.id === 'string') {
                createdConceptId = created.concept.id
                setSelectedConceptId(createdConceptId)
            }
            if (created?.interpretation && typeof created.interpretation.id === 'string') {
                setSelectedInterpretationId(created.interpretation.id)
                setSelectedCellId(null)
            }
            if (createdConceptId) {
                navigateToStructure(createdConceptId)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setStructureDialogError(t('workspace.structure.error', 'Failed to create structure'))
        }
    })

    const saveCellMutation = useMutation({
        mutationFn: async ({ mode, data }: { mode: CellDialogMode; data: Record<string, unknown> }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id
            ) {
                return null
            }
            const normalizedLocale = normalizeLocale(locale)
            if (mode === 'edit') {
                if (!selectedRawCell?.id) throw new Error('cell-not-selected')
                return updateTabularRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    parentRecordId: selectedInterpretation.id,
                    componentId: matrixColumn.id,
                    objectCollectionId: interpretationSectionId,
                    childRowId: selectedRawCell.id,
                    data,
                    expectedVersion: readRuntimeRowVersion(selectedRawCell)
                })
            }

            const source = selectedCell
            const baseData = buildDefaultMatrixCellData(matrixColumn.childColumns, normalizedLocale, {
                row: mode === 'create-cell' && source ? source.rowLabel : t('workspace.defaults.newRow', 'New row'),
                column: mode === 'create-row' && source ? source.colLabel : t('workspace.defaults.newCell', 'New cell'),
                value: t('workspace.defaults.newCell', 'New cell')
            })
            if (source && mode === 'create-cell') {
                baseData.RowKey = source.rowKey
                baseData.RowLabel = createLocalizedContent(normalizedLocale, source.rowLabel)
            }
            if (source && mode === 'create-row') {
                baseData.ColKey = source.colKey
                baseData.ColLabel = createLocalizedContent(normalizedLocale, source.colLabel)
            }
            const saved = await createTabularRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                data: { ...baseData, ...data }
            })
            const generatedCellId = typeof baseData.CellId === 'string' ? baseData.CellId.trim() : ''
            return { saved, generatedCellId }
        },
        onSuccess: async (result) => {
            setCellDialogMode(null)
            setCellDialogError(null)
            if (result && typeof result === 'object' && 'generatedCellId' in result) {
                const rawCellId = result.generatedCellId
                if (typeof rawCellId === 'string' && rawCellId.trim()) {
                    setSelectedCellId(rawCellId.trim())
                }
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setCellDialogError(t('workspace.cell.error', 'Failed to update matrix cells'))
        }
    })
    const matrixMutationsDisabled =
        !canEditContent || !selectedInterpretation || !matrixColumn?.id || matrixRowsQuery.isError || matrixRowsQuery.isFetching

    const moveCellMutation = useMutation({
        mutationFn: async ({
            sourceCellId,
            targetCellId,
            placement = 'after'
        }: {
            sourceCellId: string
            targetCellId: string
            placement?: 'before' | 'after'
        }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id ||
                sourceCellId === targetCellId
            ) {
                return null
            }
            const { cells: currentMatrixCells, rawRowsByCellId: currentRawMatrixRowsByCellId } = matrixRowsSnapshotRef.current
            const source = currentMatrixCells.find((cell) => cell.id === sourceCellId)
            const target = currentMatrixCells.find((cell) => cell.id === targetCellId)
            const sourceRaw = currentRawMatrixRowsByCellId.get(sourceCellId)
            const targetRaw = currentRawMatrixRowsByCellId.get(targetCellId)
            if (!source || !target || !sourceRaw || !targetRaw) return null

            const targetSlot = {
                RowKey: target.rowKey,
                RowLabel: readColumnValue(targetRaw, matrixColumn.childColumns, 'RowLabel'),
                ColKey: source.rowKey === target.rowKey ? source.colKey : `column-${generateUuidV7()}`,
                ColLabel:
                    source.rowKey === target.rowKey
                        ? readColumnValue(sourceRaw, matrixColumn.childColumns, 'ColLabel')
                        : createLocalizedContent(
                              normalizeLocale(locale),
                              makeAdjacentMatrixColumnLabel(
                                  target.colLabel,
                                  new Set(
                                      currentMatrixCells
                                          .filter((cell) => cell.rowKey === target.rowKey && cell.id !== source.id)
                                          .map((cell) => cell.colLabel)
                                  )
                              )
                          )
            }
            const buildMovedCellData = (
                rawCell: RuntimeRow,
                slot: { RowKey: string; RowLabel: unknown; ColKey: string; ColLabel: unknown; _tp_sort_order?: number }
            ) => {
                const data: Record<string, unknown> = {}
                for (const column of matrixColumn.childColumns ?? []) {
                    const field = column.codename ?? column.field ?? column.id
                    if (!field) continue
                    const value = readColumnValue(rawCell, matrixColumn.childColumns, field)
                    if (value !== undefined) {
                        data[field] = value
                    }
                }
                return { ...data, ...slot }
            }
            const rowOrder = Array.from(new Set(currentMatrixCells.map((cell) => cell.rowKey)))
            const cellsByRow = new Map(rowOrder.map((rowKey) => [rowKey, currentMatrixCells.filter((cell) => cell.rowKey === rowKey)]))
            if (source.rowKey === target.rowKey) {
                const rowCells = cellsByRow.get(source.rowKey) ?? []
                const sourceIndex = rowCells.findIndex((cell) => cell.id === sourceCellId)
                const targetIndex = rowCells.findIndex((cell) => cell.id === targetCellId)
                const insertionIndex = placement === 'before' ? targetIndex : targetIndex + 1
                cellsByRow.set(
                    source.rowKey,
                    arrayMove(rowCells, sourceIndex, sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex)
                )
            } else {
                const sourceRowCells = (cellsByRow.get(source.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
                const targetRowCells = (cellsByRow.get(target.rowKey) ?? []).filter((cell) => cell.id !== sourceCellId)
                const targetIndex = targetRowCells.findIndex((cell) => cell.id === targetCellId)
                const insertionIndex = Math.max(0, placement === 'before' ? targetIndex : targetIndex + 1)
                targetRowCells.splice(insertionIndex, 0, {
                    ...source,
                    rowKey: targetSlot.RowKey,
                    rowLabel: target.rowLabel,
                    colKey: targetSlot.ColKey,
                    colLabel: readSubmittedText(targetSlot.ColLabel, normalizeLocale(locale)) || source.colLabel
                })
                cellsByRow.set(source.rowKey, sourceRowCells)
                cellsByRow.set(target.rowKey, targetRowCells)
            }
            const reordered = rowOrder.flatMap((rowKey) => cellsByRow.get(rowKey) ?? [])
            const desiredSortOrderByCellId = new Map(reordered.map((cell, index) => [cell.id, index]))
            const orderUpdates = reordered
                .filter((cell) => cell.id !== sourceCellId && cell.sortOrder !== desiredSortOrderByCellId.get(cell.id))
                .flatMap((cell) => {
                    const rawCell = currentRawMatrixRowsByCellId.get(cell.id)
                    const nextSortOrder = desiredSortOrderByCellId.get(cell.id)
                    if (!rawCell || typeof rawCell.id !== 'string' || nextSortOrder == null) return []
                    return [
                        {
                            childRowId: rawCell.id,
                            data: { _tp_sort_order: nextSortOrder },
                            expectedVersion: readRuntimeRowVersion(rawCell)
                        }
                    ]
                })
            const sourceSortOrder = desiredSortOrderByCellId.get(sourceCellId) ?? target.sortOrder

            await batchUpdateTabularRows({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                updates: [
                    {
                        childRowId: sourceRaw.id,
                        data: buildMovedCellData(sourceRaw, { ...targetSlot, _tp_sort_order: sourceSortOrder }),
                        expectedVersion: readRuntimeRowVersion(sourceRaw)
                    },
                    ...orderUpdates
                ]
            })
            return { selectedCellIdAfterMove: sourceCellId }
        },
        onSuccess: async (result) => {
            if (result?.selectedCellIdAfterMove) {
                setSelectedCellId(result.selectedCellIdAfterMove)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onSettled: async () => {
            pendingMoveKeyRef.current = null
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        }
    })

    const handleMoveCell = useCallback(
        (sourceCellId: string, targetCellId: string, placement: 'before' | 'after' = 'after') => {
            if (!sourceCellId || !targetCellId || sourceCellId === targetCellId) return
            if (matrixMutationsDisabled || moveCellMutation.isPending) return
            const moveKey = `${sourceCellId}:${targetCellId}:${placement}`
            if (pendingMoveKeyRef.current === moveKey) return
            pendingMoveKeyRef.current = moveKey
            moveCellMutation.mutate({ sourceCellId, targetCellId, placement })
        },
        [matrixMutationsDisabled, moveCellMutation]
    )
    const handleMatrixDragEnd = useCallback(
        (event: DragEndEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            if (!targetCellId || sourceCellId === targetCellId) return
            const sourceIndex = matrixCellIds.indexOf(sourceCellId)
            const targetIndex = matrixCellIds.indexOf(targetCellId)
            const placement = sourceIndex >= 0 && targetIndex >= 0 && sourceIndex > targetIndex ? 'before' : 'after'
            handleMoveCell(sourceCellId, targetCellId, placement)
        },
        [handleMoveCell, matrixCellIds]
    )

    const saveMaterialMetadataMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !materialSectionId) return null
            if (!selectedInterpretation?.id || !matrixColumn?.id || !selectedRawCell?.id || !interpretationSectionId) {
                throw new Error('cell-not-selected')
            }

            if (materialDialogMode === 'edit') {
                const targetMaterialId = editingMaterialId
                if (!canEditContent || !targetMaterialId) throw new Error('permission-denied')
                return updateAppRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    objectCollectionId: materialSectionId,
                    rowId: targetMaterialId,
                    data
                })
            }

            if (!canCreateContent || !canEditContent) throw new Error('permission-denied')
            const material = await createAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: materialSectionId,
                data: { ...data, CellId: selectedCell?.id ?? null }
            })
            if (typeof material.id === 'string') {
                await updateTabularRow({
                    apiBaseUrl: details.apiBaseUrl,
                    applicationId: details.applicationId,
                    workspaceId: details.currentWorkspaceId,
                    parentRecordId: selectedInterpretation.id,
                    componentId: matrixColumn.id,
                    objectCollectionId: interpretationSectionId,
                    childRowId: selectedRawCell.id,
                    data: { MaterialRef: material.id },
                    expectedVersion: readRuntimeRowVersion(selectedRawCell)
                }).catch(async (error) => {
                    await compensateCreatedAppRow({
                        apiBaseUrl: details.apiBaseUrl!,
                        applicationId: details.applicationId!,
                        workspaceId: details.currentWorkspaceId,
                        rowId: material.id as string,
                        objectCollectionId: materialSectionId
                    }).catch(() => undefined)
                    throw error
                })
            }
            return material
        },
        onSuccess: async (saved) => {
            setMaterialDialogMode(null)
            setEditingMaterialId(null)
            setMaterialDialogError(null)
            if (saved && typeof saved.id === 'string') {
                setSelectedMaterialId(saved.id)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
        }
    })

    const saveMaterialBodyMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !materialSectionId || !openedMaterialId) return null
            if (!canEditContent) throw new Error('permission-denied')
            return updateAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                objectCollectionId: materialSectionId,
                rowId: openedMaterialId,
                data
            })
        },
        onSuccess: async () => {
            setMaterialDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
        },
        onError: () => {
            setMaterialDialogError(t('workspace.material.error', 'Failed to save material'))
        }
    })

    const deleteCellMutation = useMutation({
        mutationFn: async () => {
            if (
                !canDeleteContent ||
                !details?.apiBaseUrl ||
                !details.applicationId ||
                !interpretationSectionId ||
                !selectedInterpretation?.id ||
                !matrixColumn?.id ||
                !deleteRawCell?.id
            ) {
                throw new Error('permission-denied')
            }
            return deleteTabularRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                workspaceId: details.currentWorkspaceId,
                parentRecordId: selectedInterpretation.id,
                componentId: matrixColumn.id,
                objectCollectionId: interpretationSectionId,
                childRowId: deleteRawCell.id
            })
        },
        onSuccess: async () => {
            if (cellDeleteId === selectedCellId) {
                setSelectedCellId(null)
            }
            setCellDeleteId(null)
            setCellDeleteError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setCellDeleteError(t('workspace.cell.deleteError', 'Failed to delete cell'))
        }
    })

    if (!enabled) {
        return <Alert severity='info'>{t('workspace.missingRuntimeContext', 'Runtime context is not available yet.')}</Alert>
    }

    if (query.isLoading) {
        return (
            <Stack data-testid='interpretation-network-workspace' spacing={1.5}>
                <LinearProgress aria-label={t('workspace.loading', 'Loading interpretation network')} />
                <Typography variant='body2' color='text.secondary'>
                    {t('workspace.loading', 'Loading interpretation network')}
                </Typography>
            </Stack>
        )
    }

    if (query.error) {
        return (
            <Alert severity='error'>
                {extractRuntimeErrorMessage(query.error, t('workspace.error', 'Failed to load interpretation workspace'), locale)}
            </Alert>
        )
    }

    const openStructure = (structure: StructureSummary) => {
        setSelectedConceptId(structure.id)
        setSelectedInterpretationId(structure.interpretationId)
        setSelectedCellId(null)
        setSelectedMaterialId(null)
        setOpenedMaterialId(null)
        setMaterialDialogMode(null)
        setEditingMaterialId(null)
        navigateToStructure(structure.id)
    }
    const openCellDialog = (mode: CellDialogMode, cellId?: string) => {
        if (cellId) setSelectedCellId(cellId)
        setCellDialogError(null)
        setCellDialogMode(mode)
    }
    const closeCellMenu = () => {
        setCellMenuAnchor(null)
        setCellMenuCellId(null)
    }
    const findCellPosition = (cell: typeof selectedCell) => {
        if (!cell) return null
        const rowIndex = matrixRows.findIndex((row) => row.rowKey === cell.rowKey)
        const columnIndex = matrixRows[rowIndex]?.cells.findIndex((candidate) => candidate.id === cell.id) ?? -1
        return rowIndex >= 0 && columnIndex >= 0 ? { rowIndex, columnIndex } : null
    }
    const getMoveTargetForCell = (cell: typeof selectedCell, deltaRow: number, deltaColumn: number) => {
        const position = findCellPosition(cell)
        if (!position) return undefined
        if (deltaColumn !== 0) {
            return matrixRows[position.rowIndex]?.cells[position.columnIndex + deltaColumn]
        }
        const targetRow = matrixRows[position.rowIndex + deltaRow]
        if (!targetRow) return undefined
        return targetRow.cells[Math.min(position.columnIndex, targetRow.cells.length - 1)]
    }
    const moveMenuCell = (deltaRow: number, deltaColumn: number) => {
        if (!menuCell) return
        const target = getMoveTargetForCell(menuCell, deltaRow, deltaColumn)
        closeCellMenu()
        if (target) handleMoveCell(menuCell.id, target.id, deltaColumn < 0 || deltaRow < 0 ? 'before' : 'after')
    }
    const structureColumns: GridColDef[] = [
        {
            field: '__rowNumber',
            headerName: '#',
            width: 64,
            sortable: false,
            filterable: false,
            valueGetter: (_value, row) => filteredStructures.findIndex((structure) => structure.id === row.id) + 1
        },
        {
            field: 'title',
            headerName: t('workspace.structure.columns.title', 'Title'),
            flex: 1,
            minWidth: 180,
            renderCell: (params) => (
                <Button
                    type='button'
                    size='small'
                    variant='text'
                    onClick={() => {
                        const structure = structureSummaries.find((candidate) => candidate.id === String(params.row.id))
                        if (structure) openStructure(structure)
                    }}
                    sx={{ justifyContent: 'flex-start', px: 0, minWidth: 0, maxWidth: '100%', textAlign: 'left' }}
                >
                    <Typography variant='body2' noWrap sx={{ maxWidth: '100%' }}>
                        {String(params.value ?? '')}
                    </Typography>
                </Button>
            )
        },
        {
            field: 'description',
            headerName: t('workspace.structure.columns.description', 'Description'),
            flex: 1,
            minWidth: 220,
            renderCell: (params) => (
                <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {String(params.value || '—')}
                </Typography>
            )
        }
    ]
    const materialTitle = findMaterialTitle(
        materials,
        query.data?.materials.columns,
        selectedMaterial?.id ?? selectedCell?.materialRef ?? null,
        widgetConfig.materialTitleField,
        locale
    )
    const menuMoves = [
        {
            label: t('workspace.cell.moveLeftShort', 'Left'),
            icon: <KeyboardArrowLeftRoundedIcon fontSize='small' />,
            target: getMoveTargetForCell(menuCell, 0, -1),
            action: () => moveMenuCell(0, -1)
        },
        {
            label: t('workspace.cell.moveRightShort', 'Right'),
            icon: <KeyboardArrowRightRoundedIcon fontSize='small' />,
            target: getMoveTargetForCell(menuCell, 0, 1),
            action: () => moveMenuCell(0, 1)
        },
        {
            label: t('workspace.cell.moveUpShort', 'Up'),
            icon: <KeyboardArrowUpRoundedIcon fontSize='small' />,
            target: getMoveTargetForCell(menuCell, -1, 0),
            action: () => moveMenuCell(-1, 0)
        },
        {
            label: t('workspace.cell.moveDownShort', 'Down'),
            icon: <KeyboardArrowDownRoundedIcon fontSize='small' />,
            target: getMoveTargetForCell(menuCell, 1, 0),
            action: () => moveMenuCell(1, 0)
        }
    ].filter((move) => move.target)
    const matrixWorkspace = selectedInterpretation ? (
        <Box data-testid='interpretation-network-matrix-workspace'>
            <Stack direction='row' spacing={1} sx={{ mb: 1 }} useFlexGap flexWrap='wrap'>
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    startIcon={<AddRoundedIcon />}
                    disabled={matrixMutationsDisabled || saveCellMutation.isPending}
                    onClick={() => openCellDialog('create-row')}
                >
                    {t('workspace.cell.addRow', 'Add row')}
                </Button>
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    startIcon={<AddRoundedIcon />}
                    disabled={matrixMutationsDisabled || saveCellMutation.isPending}
                    onClick={() => openCellDialog('create-cell')}
                >
                    {t('workspace.cell.addSibling', 'Add cell')}
                </Button>
            </Stack>
            {matrixRowsQuery.error ? (
                <Alert severity='error' sx={{ mb: 1 }}>
                    {extractRuntimeErrorMessage(matrixRowsQuery.error, t('workspace.matrixError', 'Failed to load matrix cells'), locale)}
                </Alert>
            ) : null}
            {saveCellMutation.error || moveCellMutation.error ? (
                <Alert severity='error' sx={{ mb: 1 }}>
                    {t('workspace.cell.error', 'Failed to update matrix cells')}
                </Alert>
            ) : null}
            {matrixCells.length === 0 ? (
                <Alert severity='info' sx={{ mb: 1 }}>
                    {t('workspace.matrixEmpty', 'Add a cell to start the structure matrix.')}
                </Alert>
            ) : null}
            <Box
                data-testid='interpretation-network-matrix'
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    p: 0.5
                }}
            >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMatrixDragEnd}>
                    <SortableContext items={matrixCellIds} strategy={rectSortingStrategy}>
                        {matrixRows.map((row) => (
                            <Box
                                key={row.rowKey}
                                data-testid='interpretation-network-matrix-row'
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(0, 1fr))`,
                                    gap: 1,
                                    minWidth: 0
                                }}
                            >
                                {row.cells.map((cell) => (
                                    <MatrixCellButton
                                        key={cell.id}
                                        cell={cell}
                                        selected={cell.id === selectedCell?.id}
                                        onSelect={() => setSelectedCellId(cell.id)}
                                        dragLabel={t('workspace.cell.drag', 'Drag cell')}
                                        menuLabel={t('workspace.cell.actionsFor', {
                                            defaultValue: 'Cell actions: {{title}}',
                                            title: cell.title || t('workspace.emptyCell', 'Empty cell')
                                        })}
                                        onOpenMenu={(event) => {
                                            setCellMenuAnchor(event.currentTarget)
                                            setCellMenuCellId(cell.id)
                                        }}
                                        disabled={matrixMutationsDisabled || moveCellMutation.isPending}
                                    >
                                        {cell.title || t('workspace.emptyCell', 'Empty cell')}
                                    </MatrixCellButton>
                                ))}
                            </Box>
                        ))}
                    </SortableContext>
                </DndContext>
            </Box>
            <Menu anchorEl={cellMenuAnchor} open={Boolean(cellMenuAnchor)} onClose={closeCellMenu}>
                <MenuItem
                    disabled={!menuCell || !canEditContent}
                    onClick={() => {
                        const targetId = menuCell?.id
                        closeCellMenu()
                        if (targetId) openCellDialog('edit', targetId)
                    }}
                >
                    <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('workspace.cell.edit', 'Edit')}
                </MenuItem>
                {menuMoves.length > 0 ? <Divider /> : null}
                {menuMoves.map((move) => (
                    <MenuItem key={move.label} disabled={matrixMutationsDisabled || moveCellMutation.isPending} onClick={move.action}>
                        {move.icon}
                        <Box component='span' sx={{ ml: 1 }}>
                            {move.label}
                        </Box>
                    </MenuItem>
                ))}
                <Divider />
                <MenuItem
                    disabled={!menuCell || !canDeleteContent || deleteCellMutation.isPending}
                    onClick={() => {
                        const targetId = menuCell?.id
                        closeCellMenu()
                        if (targetId) {
                            setCellDeleteError(null)
                            setCellDeleteId(targetId)
                        }
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('workspace.cell.delete', 'Delete')}
                </MenuItem>
            </Menu>
        </Box>
    ) : null

    return (
        <Stack data-testid='interpretation-network-workspace' spacing={2} sx={{ minWidth: 0, width: '100%', pt: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ minWidth: 0, alignItems: 'stretch' }}>
                <Box
                    data-testid='interpretation-network-structure-pane'
                    sx={{
                        flex: { xs: '1 1 auto', md: '1 1 0%' },
                        minWidth: 0,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                        overflow: 'hidden'
                    }}
                >
                    {!selectedConcept ? (
                        <>
                            <Box sx={{ mb: 1.5 }}>
                                <CatalogToolbar
                                    title={t('workspace.structure.title', 'Structures')}
                                    filterLabel={t('workspace.structure.filter', 'Filter by title')}
                                    filterValue={structureFilter}
                                    viewMode={structureViewMode}
                                    viewModeLabel={t('workspace.structure.viewMode', 'Structure view mode')}
                                    tableViewLabel={t('workspace.structure.tableView', 'Table view')}
                                    cardViewLabel={t('workspace.structure.cardView', 'Card view')}
                                    createLabel={t('workspace.actions.create', 'Create')}
                                    createDisabled={!canCreateContent || !canEditContent || structureFields.length === 0}
                                    onFilterChange={setStructureFilter}
                                    onViewModeChange={setStructureViewMode}
                                    onCreate={() => {
                                        setStructureDialogError(null)
                                        setStructureDialogOpen(true)
                                    }}
                                />
                            </Box>
                            {!canCreateContent || !canEditContent ? (
                                <Alert severity='info' sx={{ mb: 1 }}>
                                    {t(
                                        'workspace.permissions.readOnly',
                                        'You can view this workspace, but content editing is not available for your role.'
                                    )}
                                </Alert>
                            ) : null}
                            {createStructureMutation.error ? (
                                <Alert severity='error' sx={{ mb: 1 }}>
                                    {t('workspace.structure.error', 'Failed to create structure')}
                                </Alert>
                            ) : null}
                            {filteredStructures.length === 0 ? (
                                <Alert severity='info'>
                                    {normalizedStructureFilter
                                        ? t('workspace.structure.noFilterResults', 'No structures match the current filter.')
                                        : t('workspace.structure.emptyConcepts', 'Create a structure first.')}
                                </Alert>
                            ) : null}
                            {filteredStructures.length > 0 && structureViewMode === 'table' ? (
                                <Box data-testid='interpretation-network-structure-table' sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                                    <CustomizedDataGrid
                                        rows={filteredStructures.map((structure) => ({
                                            id: structure.id,
                                            title: structure.title,
                                            description: structure.description
                                        }))}
                                        columns={structureColumns}
                                        rowHeight='auto'
                                        hideFooter
                                        localeText={dataGridLocaleText}
                                    />
                                </Box>
                            ) : null}
                            {filteredStructures.length > 0 && structureViewMode === 'cards' ? (
                                <Box
                                    data-testid='interpretation-network-structure-cards'
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                        gap: 1
                                    }}
                                >
                                    {filteredStructures.map((structure) => (
                                        <Card
                                            key={structure.id}
                                            variant='outlined'
                                            sx={{
                                                borderRadius: 1,
                                                minHeight: 128,
                                                display: 'flex',
                                                '&:hover': {
                                                    borderColor: 'primary.main',
                                                    bgcolor: 'action.hover'
                                                }
                                            }}
                                        >
                                            <CardActionArea
                                                onClick={() => openStructure(structure)}
                                                sx={{
                                                    alignItems: 'stretch',
                                                    display: 'flex',
                                                    width: '100%',
                                                    minHeight: 128,
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <CardContent sx={{ width: '100%' }}>
                                                    <Typography variant='subtitle2' sx={{ fontWeight: 700 }} noWrap>
                                                        {structure.title}
                                                    </Typography>
                                                    <Typography
                                                        variant='body2'
                                                        color='text.secondary'
                                                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                                                    >
                                                        {structure.description || t('workspace.structure.noDescription', 'No description')}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    ))}
                                </Box>
                            ) : null}
                        </>
                    ) : (
                        <Stack spacing={1.5}>
                            <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
                                <IconButton
                                    type='button'
                                    size='small'
                                    aria-label={t('workspace.structure.backToList', 'Structures')}
                                    onClick={() => {
                                        setSelectedConceptId(null)
                                        setSelectedInterpretationId(null)
                                        setSelectedCellId(null)
                                        setSelectedMaterialId(null)
                                        setOpenedMaterialId(null)
                                        navigateToStructure(null)
                                    }}
                                >
                                    <ArrowBackRoundedIcon fontSize='small' />
                                </IconButton>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                                        {readColumnText(
                                            selectedConcept,
                                            query.data?.concepts.columns,
                                            widgetConfig.conceptNameField,
                                            locale
                                        ) || t('workspace.untitledConcept', 'Untitled concept')}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Box>
                                <Tabs
                                    value='matrix'
                                    aria-label={t('workspace.structure.tabs', 'Structure sections')}
                                    sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                                >
                                    <Tab
                                        value='matrix'
                                        label={t('workspace.matrix', 'Matrix')}
                                        id='interpretation-network-matrix-tab'
                                        aria-controls='interpretation-network-matrix-tabpanel'
                                        sx={{ minHeight: 40 }}
                                    />
                                </Tabs>
                                <Box
                                    role='tabpanel'
                                    id='interpretation-network-matrix-tabpanel'
                                    aria-labelledby='interpretation-network-matrix-tab'
                                    sx={{ pt: 1.5 }}
                                >
                                    {matrixWorkspace}
                                </Box>
                            </Box>
                        </Stack>
                    )}
                </Box>

                <InterpretationNetworkDetailsPane
                    t={t}
                    locale={locale}
                    selectedCell={selectedCell}
                    materialTitle={materialTitle}
                    selectedMaterial={selectedMaterial}
                    materialSummaries={cellMaterials.map((material) => ({
                        id: material.id,
                        row: material,
                        title:
                            findMaterialTitle(
                                materials,
                                query.data?.materials.columns,
                                material.id,
                                widgetConfig.materialTitleField,
                                locale
                            ) || t('workspace.material.untitled', 'Untitled material'),
                        description: readColumnText(material, query.data?.materials.columns, 'Description', locale),
                        body: summarizeEditorJsContent(readColumnValue(material, query.data?.materials.columns, 'Body'), locale)
                    }))}
                    selectedMaterialId={openedMaterialId ?? selectedMaterialId}
                    materialBodyField={materialBodyField}
                    materialBodyValue={materialEditorInitialData[materialBodyField?.id ?? '']}
                    dataGridLocaleText={dataGridLocaleText}
                    canCreateContent={canCreateContent}
                    canEditContent={canEditContent}
                    materialSectionId={materialSectionId}
                    isSavingMaterial={saveMaterialMetadataMutation.isPending || saveMaterialBodyMutation.isPending}
                    materialEditorError={materialDialogError}
                    onOpenCreateMaterial={() => {
                        setMaterialDialogError(null)
                        setEditingMaterialId(null)
                        setMaterialDialogMode('create')
                    }}
                    onOpenEditMaterial={(materialId) => {
                        setMaterialDialogError(null)
                        setEditingMaterialId(materialId)
                        setMaterialDialogMode('edit')
                    }}
                    onSelectMaterial={(materialId) => {
                        setSelectedMaterialId(materialId)
                        setOpenedMaterialId(materialId)
                    }}
                    onCloseMaterial={() => {
                        setOpenedMaterialId(null)
                        setMaterialDialogError(null)
                    }}
                    onSaveMaterialBody={async (data) => {
                        await saveMaterialBodyMutation.mutateAsync(data).catch(() => undefined)
                    }}
                />
            </Stack>
            <FormDialog
                open={structureDialogOpen}
                title={t('workspace.structure.create', 'Create structure')}
                fields={structureFields}
                locale={locale}
                isSubmitting={createStructureMutation.isPending}
                error={structureDialogError}
                saveButtonText={t('workspace.actions.create', 'Create')}
                onClose={() => {
                    if (createStructureMutation.isPending) return
                    setStructureDialogOpen(false)
                    setStructureDialogError(null)
                }}
                onSubmit={async (data) => {
                    await createStructureMutation.mutateAsync(data).catch(() => undefined)
                }}
            />
            <FormDialog
                open={materialDialogMode !== null}
                title={
                    materialDialogMode === 'edit'
                        ? t('workspace.material.editTitle', 'Edit material')
                        : t('workspace.material.createTitle', 'Add material')
                }
                fields={materialFields}
                locale={locale}
                initialData={materialInitialData}
                isSubmitting={saveMaterialMetadataMutation.isPending}
                error={materialDialogError}
                saveButtonText={
                    materialDialogMode === 'edit' ? t('workspace.actions.save', 'Save') : t('workspace.actions.create', 'Create')
                }
                onClose={() => {
                    if (saveMaterialMetadataMutation.isPending) return
                    setMaterialDialogMode(null)
                    setEditingMaterialId(null)
                    setMaterialDialogError(null)
                }}
                onSubmit={async (data) => {
                    await saveMaterialMetadataMutation.mutateAsync(data).catch(() => undefined)
                }}
            />
            <CellEditDialog
                open={cellDialogMode !== null}
                mode={cellDialogMode === 'edit' ? 'edit' : 'create'}
                t={t}
                locale={locale}
                fields={cellMetadataFields}
                styleFields={styleFields}
                initialData={cellDialogInitialData}
                isSubmitting={saveCellMutation.isPending}
                error={cellDialogError}
                onClose={() => {
                    if (saveCellMutation.isPending) return
                    setCellDialogMode(null)
                    setCellDialogError(null)
                }}
                onSubmit={async (data) => {
                    const mode = cellDialogMode
                    if (!mode) return
                    await saveCellMutation.mutateAsync({ mode, data }).catch(() => undefined)
                }}
            />
            <ConfirmDeleteDialog
                open={Boolean(cellDeleteId)}
                title={t('workspace.cell.deleteTitle', 'Delete cell?')}
                description={t('workspace.cell.deleteDescription', {
                    defaultValue: 'Delete the cell “{{title}}”? Materials attached to the cell will stay in the workspace.',
                    title: deleteCell?.title || t('workspace.emptyCell', 'Empty cell')
                })}
                confirmButtonText={t('workspace.actions.delete', 'Delete')}
                deletingButtonText={t('workspace.actions.deleting', 'Deleting...')}
                cancelButtonText={t('workspace.actions.cancel', 'Cancel')}
                loading={deleteCellMutation.isPending}
                error={cellDeleteError ?? undefined}
                onCancel={() => {
                    if (deleteCellMutation.isPending) return
                    setCellDeleteId(null)
                    setCellDeleteError(null)
                }}
                onConfirm={async () => {
                    await deleteCellMutation.mutateAsync().catch(() => undefined)
                }}
            />
        </Stack>
    )
}

export default InterpretationNetworkWorkspaceWidget
