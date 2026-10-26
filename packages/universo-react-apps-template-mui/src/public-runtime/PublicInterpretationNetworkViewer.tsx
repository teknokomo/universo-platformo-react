import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import type { PageBlockContent } from '@universo-react/types'
import { InterpretationNetworkWorkspaceContent } from '../dashboard/components/interpretation-network/workspace/InterpretationNetworkWorkspaceContent'
import { WorkspaceLoading } from '../dashboard/components/interpretation-network/workspace/WorkspaceStatus'
import type { DetailsPaneBridgeProps } from '../dashboard/components/interpretation-network/workspace/DetailsPaneBridge'
import type { MatrixWorkspaceBridgeProps } from '../dashboard/components/interpretation-network/workspace/MatrixWorkspaceBridge'
import { EMPTY_MATRIX_DROP_STATE } from '../dashboard/components/interpretation-network/workspace/workspaceState'
import type { MatrixView } from '../dashboard/components/interpretation-network/model'
import { usePublicInterpretationNetworkReader, type PublicInterpretationNetworkViewerProps } from './usePublicInterpretationNetworkReader'

type PublicWorkspaceStructure = Parameters<typeof InterpretationNetworkWorkspaceContent>[0]['structure']

const EMPTY_BLOCK_CONTENT: PageBlockContent = { format: 'editorjs', data: { blocks: [] } }
const noMutation = async (): Promise<void> => undefined
const noMutationWithData = async (_data: Record<string, unknown>): Promise<void> => undefined
const noPrimaryMutation = (_materialId: string | null): void => undefined

export type { PublicInterpretationNetworkViewerProps } from './usePublicInterpretationNetworkReader'

/** Anonymous read-only controller; its only data transport is the public runtime API. */
export function PublicInterpretationNetworkViewer(props: PublicInterpretationNetworkViewerProps) {
    const { t } = useTranslation('publicInterpretationNetwork', { lng: props.locale })
    if (props.workspaceAvailable === false) {
        return (
            <Stack
                data-testid='public-interpretation-network-empty-state'
                spacing={2}
                sx={{ width: '100%', maxWidth: 1200, mx: 'auto', py: { xs: 2, sm: 3 } }}
            >
                <Alert severity='info'>{t('publicViewer.noWorkspaces')}</Alert>
            </Stack>
        )
    }
    return <PublicInterpretationNetworkReader {...props} />
}

function PublicInterpretationNetworkReader(props: PublicInterpretationNetworkViewerProps) {
    const reader = usePublicInterpretationNetworkReader(props)
    const {
        t,
        publicT,
        widgetConfig,
        structuresQuery,
        structures,
        selectedStructure,
        selectedConcept,
        selectedInterpretation,
        interpretationsQuery,
        matrixQuery,
        cells,
        effectiveSelectedCellId,
        matrixTableModel,
        matrixCells,
        matrixHierarchyRows,
        matrixPositionLabels,
        independentMatrixRows,
        matrixView,
        setMatrixViewOverride,
        selectedCellHandle,
        materialsQuery,
        materials,
        selectedCell,
        selectedMaterial,
        selectedMaterialId,
        openedMaterialId,
        setSelectedMaterialId,
        setOpenedMaterialId,
        structureFilter,
        structureViewMode,
        filteredStructures,
        normalizedStructureFilter,
        setStructureFilter,
        setStructureViewMode,
        onOpenStructure,
        onBackToStructureList,
        selectCell
    } = reader

    if (structuresQuery.isPending) return <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
    if (structuresQuery.isError)
        return (
            <Alert
                severity='error'
                action={
                    <Button color='inherit' size='small' onClick={() => void structuresQuery.refetch()}>
                        {publicT('publicViewer.retry')}
                    </Button>
                }
            >
                {publicT('publicViewer.error')}
            </Alert>
        )
    if (structures.length === 0) return <Alert severity='info'>{publicT('publicViewer.empty.structures')}</Alert>

    const matrixFallback = selectedConcept ? (
        interpretationsQuery.isPending ? (
            <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
        ) : interpretationsQuery.isError ? (
            <Alert severity='error'>{publicT('publicViewer.error')}</Alert>
        ) : !selectedInterpretation ? (
            <Alert severity='info'>{publicT('publicViewer.empty.interpretations')}</Alert>
        ) : matrixQuery.isPending ? (
            <WorkspaceLoading label={t('workspace.loading', 'Loading interpretation network')} />
        ) : matrixQuery.isError ? (
            <Alert severity='error'>{publicT('publicViewer.error')}</Alert>
        ) : cells.length === 0 ? (
            <Alert severity='info'>{publicT('publicViewer.empty.matrix')}</Alert>
        ) : null
    ) : null

    const matrix: MatrixWorkspaceBridgeProps | null =
        selectedConcept && selectedInterpretation && !matrixQuery.isPending && !matrixQuery.isError && cells.length > 0
            ? {
                  t,
                  locale: props.locale,
                  mode: widgetConfig.matrixMode,
                  matrixView,
                  allowedMatrixViews: widgetConfig.allowedMatrixViews,
                  tableProjection: widgetConfig.tableProjection,
                  toolbarLayout: widgetConfig.toolbarLayout,
                  showHierarchicalTableHeaders: widgetConfig.showHierarchicalTableHeaders,
                  showHierarchicalTableHeaderCard: widgetConfig.showHierarchicalTableHeaderCard,
                  showMatrixTreeTotalCells: widgetConfig.showMatrixTreeTotalCells,
                  colorBreadcrumbsByCell: widgetConfig.colorBreadcrumbsByCell,
                  hierarchyRows: matrixHierarchyRows,
                  hierarchicalTableModel: matrixTableModel,
                  positionLabels: matrixPositionLabels,
                  cells: matrixCells,
                  visibleCells: matrixTableModel.visibleCells,
                  rows: independentMatrixRows,
                  materialCountByCellId: new Map(
                      materials.length && effectiveSelectedCellId ? [[effectiveSelectedCellId, materials.length]] : []
                  ),
                  cellIds: matrixCells.map((cell) => cell.id),
                  selectedCell,
                  dropState: EMPTY_MATRIX_DROP_STATE,
                  dragPreview: null,
                  disabled: true,
                  axisActionsDisabled: true,
                  addCellDisabled: true,
                  canSaveTemplate: false,
                  hasTemplates: false,
                  canInsertTemplate: false,
                  savingCell: false,
                  movingCell: false,
                  errors: { rows: null, saveCell: null, moveCell: null },
                  permissions: { canCreateContent: false, canEditContent: false, canDeleteContent: false },
                  menu: { anchor: null, cell: undefined, moves: [] },
                  deletingCell: false,
                  sensors: [],
                  onChangeMatrixView: (view: MatrixView) => {
                      if (widgetConfig.allowedMatrixViews.includes(view)) setMatrixViewOverride(view)
                  },
                  actions: {
                      openCellDialog: () => undefined,
                      addTableRow: () => undefined,
                      addTableColumn: () => undefined,
                      moveSelectedToSlot: () => undefined,
                      selectCell,
                      openCellMenu: () => undefined,
                      closeCellMenu: () => undefined,
                      requestDeleteCell: () => undefined,
                      dragStart: () => undefined,
                      dragMove: () => undefined,
                      dragOver: () => undefined,
                      dragCancel: () => undefined,
                      dragEnd: () => undefined
                  }
              }
            : null

    const structure: PublicWorkspaceStructure = {
        a11yIdPrefix: `public-interpretation-network-${props.instanceKey.replace(/[^a-zA-Z0-9_-]+/gu, '-')}`,
        t,
        selectedConcept,
        conceptColumns: undefined,
        conceptNameField: 'Name',
        locale: props.locale,
        structureFilter,
        structureViewMode,
        filteredStructures,
        templates: [],
        showTemplatesInStructureList: false,
        showTemplatesInMatrix: false,
        canCreateStructure: false,
        canSaveTemplate: false,
        canCreateFromTemplate: false,
        structureFieldsReady: false,
        createStructureError: false,
        normalizedStructureFilter,
        structureMenuAnchor: null,
        structureMenuId: null,
        canEditStructure: false,
        canDeleteStructure: false,
        canEditTemplate: false,
        canDeleteTemplate: false,
        onFilterChange: setStructureFilter,
        onViewModeChange: setStructureViewMode,
        onOpenCreateStructure: () => undefined,
        onOpenStructure,
        onOpenStructureMenu: () => undefined,
        onCloseStructureMenu: () => undefined,
        onEditStructure: () => undefined,
        onDeleteStructure: () => undefined,
        onBackToList: onBackToStructureList,
        onStructureOpenControl: undefined
    }

    const details: DetailsPaneBridgeProps = {
        t,
        locale: props.locale,
        selectedCell,
        selectedMaterial,
        cellMaterials: materials,
        selectedMaterialId,
        openedMaterialId,
        materialBodyField: {
            id: 'Body',
            codename: 'Body',
            label: t('workspace.material.editorHint', 'Material content'),
            type: 'JSON'
        },
        materialBodyValue: selectedMaterial?.Body ?? EMPTY_BLOCK_CONTENT,
        canCreateContent: false,
        canEditContent: false,
        canDeleteContent: false,
        isSavingMaterial: false,
        isUpdatingPrimary: false,
        isDeletingMaterial: false,
        isLoadingMaterialAssociations: Boolean(selectedCellHandle) && materialsQuery.isPending,
        materialAssociationsError: materialsQuery.isError ? publicT('publicViewer.error') : null,
        materialEditorError: null,
        primaryActionError: null,
        deleteMaterialError: null,
        materials,
        materialColumns: undefined,
        materialTitleField: 'Title',
        saveMaterialBodyMutation: { mutateAsync: noMutationWithData },
        setPrimaryMaterialMutation: { mutate: noPrimaryMutation },
        deleteMaterialMutation: { mutateAsync: noMutation },
        actions: {
            setMaterialDialogError: () => undefined,
            setEditingMaterialId: () => undefined,
            setMaterialDialogMode: () => undefined,
            setSelectedMaterialId,
            setOpenedMaterialId
        }
    }

    return (
        <InterpretationNetworkWorkspaceContent
            matrix={matrix}
            matrixFallback={matrixFallback}
            structure={structure}
            details={details}
            splitPaneEnabled={widgetConfig.splitPane.enabled}
            singleSystemMode={widgetConfig.structureMode === 'singleSystem'}
            structureReturnFocusId={selectedStructure ? selectedStructure.id : null}
            onBackToStructureList={onBackToStructureList}
        />
    )
}
