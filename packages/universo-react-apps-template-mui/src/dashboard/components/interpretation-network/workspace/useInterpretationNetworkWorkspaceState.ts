import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { AppDataResponse } from '../../../../api/api'
import { fetchTabularRows } from '../../../../api/api'
import { getDataGridLocaleText } from '../../../../utils/getDataGridLocale'
import { buildMatrixDragPreview, type MatrixDropState } from '../matrixDrag'
import { buildCellDialogInitialData, type MatrixCellPlacement } from '../matrixCellData'
import { buildMaterialEditorInitialData, buildMaterialInitialData } from '../materialData'
import {
    buildMatrixPositionLabels,
    buildMatrixTree,
    buildMatrixAxisOptions,
    findColumn,
    findMaterialsForCell,
    flattenMatrixTree,
    getSectionId,
    isStyleColumn,
    readColumnText,
    readColumnValue,
    resolveMatrixCellId,
    toFieldConfig,
    toFocusedMatrixHierarchyRows,
    toMatrixHierarchyRows,
    toMatrixRows,
    uniqueByKey,
    type MatrixView,
    type RuntimeRow
} from '../model'
import type { StructureSummary } from './StructurePane'
import type { CellDialogMode, MaterialDialogMode, StructureDialogMode } from './workspaceState'

type WorkspaceDatasetState = {
    concepts: Pick<AppDataResponse, 'columns' | 'rows' | 'section'>
    interpretations: Pick<AppDataResponse, 'columns' | 'rows' | 'section'>
    materials: Pick<AppDataResponse, 'columns' | 'rows' | 'section'>
}

type WorkspaceWidgetConfig = {
    conceptNameField: string
    conceptDescriptionField: string
    interpretationParentField: string
    materialTitleField: string
    matrixField: string
    matrixMode: 'hierarchicalCells' | 'independentRows'
    hierarchyRowMode: 'focusedPath' | 'allNodes'
    positionNumbering: { enabled: boolean; includeRoot: boolean; startIndex: number }
    allowedMatrixViews: MatrixView[]
    defaultMatrixView: MatrixView
}

export type WorkspaceDialogModes = {
    materialDialogMode: MaterialDialogMode | null
    cellDialogMode: CellDialogMode | null
    structureDialogMode: StructureDialogMode | null
}

type UseInterpretationNetworkWorkspaceStateOptions = {
    data: WorkspaceDatasetState | undefined
    details:
        | {
              apiBaseUrl?: string | null
              applicationId?: string | null
              currentWorkspaceId?: string | null
          }
        | null
        | undefined
    locale: string
    widgetConfig: WorkspaceWidgetConfig
    selectedInterpretationId: string | null
    selectedConceptId: string | null
    selectedCellId: string | null
    openedMaterialId: string | null
    editingStructureId: string | null
    editingMaterialId: string | null
    cellDialogSourceCellId: string | null
    cellDialogPlacement: MatrixCellPlacement | null
    cellMenuCellId: string | null
    cellDeleteId: string | null
    matrixViewOverride: MatrixView | null
    matrixDropState: MatrixDropState
    structureFilter: string
    dialogs: WorkspaceDialogModes
    t: TFunction<'interpretationNetwork'>
    onInvalidMatrixViewOverride: () => void
}

const sortMatrixCellsByOrder = (cells: ReturnType<typeof toMatrixRows>): ReturnType<typeof toMatrixRows> =>
    [...cells].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))

export function useInterpretationNetworkWorkspaceState({
    data,
    details,
    locale,
    widgetConfig,
    selectedInterpretationId,
    selectedConceptId,
    selectedCellId,
    openedMaterialId,
    editingStructureId,
    editingMaterialId,
    cellDialogSourceCellId,
    cellDialogPlacement,
    cellMenuCellId,
    cellDeleteId,
    matrixViewOverride,
    matrixDropState,
    structureFilter,
    dialogs,
    t,
    onInvalidMatrixViewOverride
}: UseInterpretationNetworkWorkspaceStateOptions) {
    const concepts = useMemo(() => (data?.concepts.rows ?? []) as RuntimeRow[], [data?.concepts.rows])
    const interpretations = useMemo(() => (data?.interpretations.rows ?? []) as RuntimeRow[], [data?.interpretations.rows])
    const materials = useMemo(() => (data?.materials.rows ?? []) as RuntimeRow[], [data?.materials.rows])
    const interpretationSectionId = getSectionId(data?.interpretations)
    const materialSectionId = getSectionId(data?.materials)
    const matrixColumn = findColumn(data?.interpretations.columns, widgetConfig.matrixField)

    const materialFields = useMemo(
        () =>
            (data?.materials.columns ?? [])
                .filter((column) => [widgetConfig.materialTitleField, 'Description'].includes(column.codename ?? column.field ?? ''))
                .map(toFieldConfig)
                .filter((field) => field.id),
        [data?.materials.columns, widgetConfig.materialTitleField]
    )
    const materialBodyField = useMemo(
        () =>
            (data?.materials.columns ?? [])
                .filter((column) => (column.codename ?? column.field ?? '') === 'Body')
                .map(toFieldConfig)
                .find((field) => field.id),
        [data?.materials.columns]
    )
    const structureFields = useMemo(
        () =>
            (data?.concepts.columns ?? [])
                .filter((column) =>
                    [widgetConfig.conceptNameField, widgetConfig.conceptDescriptionField].includes(column.codename ?? column.field ?? '')
                )
                .map(toFieldConfig)
                .filter((field) => field.id),
        [data?.concepts.columns, widgetConfig.conceptDescriptionField, widgetConfig.conceptNameField]
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
                .filter((column) =>
                    ['RowLabel', 'ColLabel', 'CellValue', 'CellDescription'].includes(column.codename ?? column.field ?? '')
                )
                .map(toFieldConfig)
                .filter((field) => field.id),
        [matrixColumn?.childColumns]
    )

    const selectedInterpretation = interpretations.find((row) => row.id === selectedInterpretationId)
    const selectedInterpretationConceptRef = readColumnValue(
        selectedInterpretation,
        data?.interpretations.columns,
        widgetConfig.interpretationParentField
    )
    const selectedConcept =
        concepts.find((row) => row.id === selectedConceptId) ??
        concepts.find((row) => typeof selectedInterpretationConceptRef === 'string' && row.id === selectedInterpretationConceptRef)
    const editingStructure = editingStructureId ? concepts.find((row) => row.id === editingStructureId) : undefined

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
    const matrixAxisOptions = useMemo(() => buildMatrixAxisOptions(matrixCells), [matrixCells])
    const matrixTree = useMemo(() => buildMatrixTree(matrixCells), [matrixCells])
    const hierarchicalMatrixCells = useMemo(() => flattenMatrixTree(matrixTree), [matrixTree])
    const hierarchicalMatrixRows = useMemo(
        () =>
            widgetConfig.hierarchyRowMode === 'focusedPath'
                ? toFocusedMatrixHierarchyRows(matrixTree, selectedCellId)
                : toMatrixHierarchyRows(hierarchicalMatrixCells),
        [hierarchicalMatrixCells, matrixTree, selectedCellId, widgetConfig.hierarchyRowMode]
    )
    const matrixPositionLabels = useMemo(
        () => buildMatrixPositionLabels(matrixTree, widgetConfig.positionNumbering),
        [matrixTree, widgetConfig.positionNumbering]
    )
    const effectiveMatrixView = widgetConfig.allowedMatrixViews.includes(matrixViewOverride ?? widgetConfig.defaultMatrixView)
        ? matrixViewOverride ?? widgetConfig.defaultMatrixView
        : widgetConfig.allowedMatrixViews[0]

    useEffect(() => {
        if (matrixViewOverride && !widgetConfig.allowedMatrixViews.includes(matrixViewOverride)) {
            onInvalidMatrixViewOverride()
        }
    }, [matrixViewOverride, onInvalidMatrixViewOverride, widgetConfig.allowedMatrixViews])

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
    const cellDialogSourceCell =
        selectedInterpretation && cellDialogSourceCellId ? matrixCells.find((cell) => cell.id === cellDialogSourceCellId) : selectedCell
    const cellDialogSourceRawCell = cellDialogSourceCell ? rawMatrixRowsByCellId.get(cellDialogSourceCell.id) : selectedRawCell
    const menuCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellMenuCellId) : undefined
    const deleteCell = selectedInterpretation ? matrixCells.find((cell) => cell.id === cellDeleteId) : undefined
    const deleteRawCell = deleteCell ? rawMatrixRowsByCellId.get(deleteCell.id) : undefined
    const rootCellId =
        widgetConfig.matrixMode === 'hierarchicalCells'
            ? [...matrixCells]
                  .filter((cell) => cell.parentCellId === null)
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))[0]?.id ?? null
            : null

    const cellMaterials = findMaterialsForCell(materials, data?.materials.columns, selectedCell?.id, selectedCell?.materialRef ?? null)
    const materialCountByCellId = useMemo(() => {
        const materialIdsByCellId = new Map<string, Set<string>>()
        const addMaterial = (cellId: string | null | undefined, materialId: string | null | undefined) => {
            if (!cellId || !materialId) return
            const set = materialIdsByCellId.get(cellId) ?? new Set<string>()
            set.add(materialId)
            materialIdsByCellId.set(cellId, set)
        }

        for (const cell of matrixCells) {
            addMaterial(cell.id, cell.materialRef)
        }
        for (const material of materials) {
            const rawCellId = readColumnValue(material, data?.materials.columns, 'CellId')
            addMaterial(typeof rawCellId === 'string' ? rawCellId : null, material.id)
        }
        return new Map(Array.from(materialIdsByCellId.entries()).map(([cellId, materialIds]) => [cellId, materialIds.size]))
    }, [data?.materials.columns, materials, matrixCells])

    const selectedMaterial =
        openedMaterialId && cellMaterials.some((material) => material.id === openedMaterialId)
            ? cellMaterials.find((material) => material.id === openedMaterialId)
            : undefined
    const editingMaterial = editingMaterialId
        ? cellMaterials.find((material) => material.id === editingMaterialId) ??
          materials.find((material) => material.id === editingMaterialId)
        : undefined
    const materialInitialData = useMemo(
        () => buildMaterialInitialData(materialFields, dialogs.materialDialogMode, editingMaterial),
        [dialogs.materialDialogMode, editingMaterial, materialFields]
    )
    const structureInitialData = useMemo(
        () =>
            Object.fromEntries(
                structureFields.map((field) => [
                    field.id,
                    dialogs.structureDialogMode === 'edit' ? editingStructure?.[field.id] : undefined
                ])
            ),
        [dialogs.structureDialogMode, editingStructure, structureFields]
    )
    const materialEditorInitialData = useMemo(
        () => buildMaterialEditorInitialData(materialBodyField, selectedMaterial),
        [materialBodyField, selectedMaterial]
    )
    const cellDialogInitialData = useMemo(
        () =>
            buildCellDialogInitialData({
                mode: dialogs.cellDialogMode,
                cellMetadataFields,
                styleFields,
                childColumns: matrixColumn?.childColumns,
                locale,
                selectedCell: cellDialogSourceCell,
                selectedRawCell: cellDialogSourceRawCell,
                placement: cellDialogPlacement ?? undefined
            }),
        [
            dialogs.cellDialogMode,
            cellMetadataFields,
            styleFields,
            matrixColumn?.childColumns,
            locale,
            cellDialogSourceCell,
            cellDialogSourceRawCell,
            cellDialogPlacement
        ]
    )

    const rows = useMemo(() => (selectedInterpretation ? uniqueByKey(matrixCells, 'rowKey') : []), [matrixCells, selectedInterpretation])
    const dataGridLocaleText = useMemo(() => getDataGridLocaleText(locale), [locale])
    const interpretationsByConcept = useMemo(() => {
        const byConcept = new Map<string, RuntimeRow[]>()
        for (const interpretation of interpretations) {
            const parentStructure = readColumnValue(interpretation, data?.interpretations.columns, widgetConfig.interpretationParentField)
            const conceptId = typeof parentStructure === 'string' ? parentStructure : ''
            byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), interpretation])
        }
        return byConcept
    }, [data?.interpretations.columns, interpretations, widgetConfig.interpretationParentField])
    const structureSummaries = useMemo<StructureSummary[]>(
        () =>
            concepts.map((concept) => {
                const childInterpretations = interpretationsByConcept.get(concept.id) ?? []
                return {
                    id: concept.id,
                    row: concept,
                    title:
                        readColumnText(concept, data?.concepts.columns, widgetConfig.conceptNameField, locale) ||
                        t('workspace.untitledConcept', 'Untitled concept'),
                    description: readColumnText(concept, data?.concepts.columns, widgetConfig.conceptDescriptionField, locale),
                    interpretationId: childInterpretations[0]?.id ?? null
                }
            }),
        [
            concepts,
            data?.concepts.columns,
            interpretationsByConcept,
            locale,
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
                cells: sortMatrixCellsByOrder(matrixCells.filter((cell) => cell.rowKey === row.rowKey))
            })),
        [matrixCells, rows]
    )
    const visibleMatrixCells = useMemo(
        () =>
            widgetConfig.matrixMode === 'hierarchicalCells'
                ? effectiveMatrixView === 'table'
                    ? hierarchicalMatrixCells
                    : hierarchicalMatrixRows.flatMap((row) => row)
                : matrixCells,
        [effectiveMatrixView, hierarchicalMatrixCells, hierarchicalMatrixRows, matrixCells, widgetConfig.matrixMode]
    )
    const matrixCellIds = useMemo(() => visibleMatrixCells.map((cell) => cell.id), [visibleMatrixCells])
    const matrixDragPreview = useMemo(
        () =>
            widgetConfig.matrixMode === 'hierarchicalCells'
                ? buildMatrixDragPreview(matrixCells, matrixDropState, {
                      hierarchyRowMode: widgetConfig.hierarchyRowMode,
                      selectedCellId
                  })
                : null,
        [matrixCells, matrixDropState, selectedCellId, widgetConfig.hierarchyRowMode, widgetConfig.matrixMode]
    )

    return {
        concepts,
        interpretations,
        materials,
        interpretationSectionId,
        materialSectionId,
        matrixColumn,
        materialFields,
        materialBodyField,
        structureFields,
        styleFields,
        cellMetadataFields,
        selectedInterpretation,
        selectedConcept,
        editingStructure,
        matrixRowsQuery,
        matrixCells,
        matrixAxisOptions,
        hierarchicalMatrixRows,
        matrixPositionLabels,
        effectiveMatrixView,
        matrixRowsSnapshotRef,
        selectedCell,
        selectedRawCell,
        cellDialogSourceCell,
        cellDialogSourceRawCell,
        menuCell,
        deleteCell,
        deleteRawCell,
        rootCellId,
        cellMaterials,
        materialCountByCellId,
        selectedMaterial,
        materialInitialData,
        structureInitialData,
        materialEditorInitialData,
        cellDialogInitialData,
        cellDialogPlacement,
        dataGridLocaleText,
        structureSummaries,
        normalizedStructureFilter,
        filteredStructures,
        matrixRows,
        visibleMatrixCells,
        matrixCellIds,
        matrixDragPreview
    }
}
