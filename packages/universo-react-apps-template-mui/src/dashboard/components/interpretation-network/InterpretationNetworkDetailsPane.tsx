import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import type { GridColDef, GridLocaleText } from '@mui/x-data-grid'
import type { TFunction } from 'i18next'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import { ConfirmDeleteDialog } from '../../../components/dialogs/ConfirmDeleteDialog'
import CustomizedDataGrid from '../CustomizedDataGrid'
import { CatalogToolbar } from './CatalogToolbar'
import { MaterialContentEditor } from './MaterialContentEditor'
import type { MatrixCell, RuntimeRow } from './model'

type MaterialViewMode = 'table' | 'cards'

interface MaterialSummary {
    id: string
    row: RuntimeRow
    title: string
    description: string
    body: string
    isPrimary: boolean
}

export interface InterpretationNetworkDetailsPaneProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    selectedCell?: MatrixCell
    selectedMaterial?: RuntimeRow
    materialSummaries: MaterialSummary[]
    materialTitle: string
    selectedMaterialId: string | null
    materialBodyField?: FieldConfig
    materialBodyValue: unknown
    primaryMaterialId: string | null
    materialSectionId?: string
    dataGridLocaleText?: Partial<GridLocaleText>
    canCreateContent: boolean
    canEditContent: boolean
    canDeleteContent: boolean
    isSavingMaterial: boolean
    isUpdatingPrimary: boolean
    isDeletingMaterial: boolean
    isLoadingMaterialAssociations?: boolean
    materialAssociationsError?: string | null
    materialEditorError: string | null
    primaryActionError: string | null
    deleteMaterialError: string | null
    onOpenCreateMaterial: () => void
    onOpenEditMaterial: (materialId: string) => void
    onSelectMaterial: (materialId: string) => void
    onCloseMaterial: () => void
    onSetPrimaryMaterial: (materialId: string) => void
    onClearPrimaryMaterial: () => void
    onDeleteMaterial: (materialId: string) => Promise<void>
    onSaveMaterialBody: (data: Record<string, unknown>) => Promise<void>
}

export function InterpretationNetworkDetailsPane({
    t,
    locale,
    selectedCell,
    selectedMaterial,
    materialSummaries,
    materialTitle,
    selectedMaterialId,
    materialBodyField,
    materialBodyValue,
    primaryMaterialId,
    materialSectionId,
    dataGridLocaleText,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    isSavingMaterial,
    isUpdatingPrimary,
    isDeletingMaterial,
    isLoadingMaterialAssociations = false,
    materialAssociationsError = null,
    materialEditorError,
    primaryActionError,
    deleteMaterialError,
    onOpenCreateMaterial,
    onOpenEditMaterial,
    onSelectMaterial,
    onCloseMaterial,
    onSetPrimaryMaterial,
    onClearPrimaryMaterial,
    onDeleteMaterial,
    onSaveMaterialBody
}: InterpretationNetworkDetailsPaneProps) {
    const [viewMode, setViewMode] = useState<MaterialViewMode>('table')
    const [filter, setFilter] = useState('')
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
    const [menuMaterialId, setMenuMaterialId] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const materialTriggerRefs = useRef(new Map<string, HTMLElement>())
    const listRegionRef = useRef<HTMLDivElement | null>(null)
    const focusMaterialOnReturnRef = useRef<string | null>(null)
    const focusListOnReturnRef = useRef(false)
    const normalizedFilter = filter.trim().toLowerCase()
    const selectedMaterialDescription = selectedMaterial
        ? (materialSummaries.find((material) => material.id === selectedMaterial.id)?.description ?? '').trim()
        : ''
    const filteredMaterials = useMemo(
        () =>
            normalizedFilter
                ? materialSummaries.filter((material) =>
                      [material.title, material.description].some((value) => value.toLowerCase().includes(normalizedFilter))
                  )
                : materialSummaries,
        [materialSummaries, normalizedFilter]
    )
    const setMaterialTriggerRef = useCallback((materialId: string, element: HTMLElement | null) => {
        if (element) materialTriggerRefs.current.set(materialId, element)
        else materialTriggerRefs.current.delete(materialId)
    }, [])
    useEffect(() => {
        if (selectedMaterial || (!focusMaterialOnReturnRef.current && !focusListOnReturnRef.current)) return
        const materialId = focusMaterialOnReturnRef.current
        if (focusListOnReturnRef.current) {
            listRegionRef.current?.focus()
            focusListOnReturnRef.current = false
            return
        }

        listRegionRef.current?.focus()
        const timeout = window.setTimeout(() => {
            const trigger = materialId ? materialTriggerRefs.current.get(materialId) : undefined
            if (trigger?.isConnected) trigger.focus()
            focusMaterialOnReturnRef.current = null
        }, 0)

        return () => window.clearTimeout(timeout)
    }, [selectedMaterial])
    const handleSelectMaterial = useCallback(
        (materialId: string) => {
            focusMaterialOnReturnRef.current = materialId
            onSelectMaterial(materialId)
        },
        [onSelectMaterial]
    )
    const handleCloseMaterial = useCallback(() => {
        focusMaterialOnReturnRef.current = selectedMaterialId
        onCloseMaterial()
    }, [onCloseMaterial, selectedMaterialId])
    const closeMaterialMenu = () => {
        setMenuAnchor(null)
        setMenuMaterialId(null)
    }
    const openMaterialMenu = (event: React.MouseEvent<HTMLElement>, materialId: string) => {
        event.preventDefault()
        event.stopPropagation()
        setMenuAnchor(event.currentTarget)
        setMenuMaterialId(materialId)
    }
    const materialColumns = useMemo<GridColDef[]>(() => {
        const columns: GridColDef[] = [
            {
                field: '__rowNumber',
                headerName: '#',
                width: 64,
                sortable: false,
                filterable: false,
                valueGetter: (_value, row) => filteredMaterials.findIndex((material) => material.id === row.id) + 1
            },
            {
                field: 'title',
                headerName: t('workspace.material.columns.title', 'Title'),
                flex: 1,
                minWidth: 180,
                renderCell: (params) => {
                    const materialId = String(params.row.id)
                    const title = String(params.value || t('workspace.material.untitled', 'Untitled material'))
                    return (
                        <Stack direction='row' spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                            <Button
                                ref={(element) => setMaterialTriggerRef(materialId, element)}
                                type='button'
                                size='small'
                                variant='text'
                                onClick={() => handleSelectMaterial(materialId)}
                                sx={{ justifyContent: 'flex-start', px: 0, minWidth: 0, maxWidth: '100%', textAlign: 'left' }}
                            >
                                <Typography variant='body2' noWrap sx={{ maxWidth: '100%' }}>
                                    {title}
                                </Typography>
                            </Button>
                            {params.row.isPrimary ? (
                                <Chip size='small' color='primary' label={t('workspace.material.primaryBadge', 'Primary Material')} />
                            ) : null}
                        </Stack>
                    )
                }
            }
        ]

        if (canEditContent) {
            columns.push(
                {
                    field: 'description',
                    headerName: t('workspace.material.columns.description', 'Description'),
                    flex: 1,
                    minWidth: 220,
                    renderCell: (params) => (
                        <Typography
                            variant='body2'
                            sx={{
                                color: 'text.secondary',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere'
                            }}
                        >
                            {String(params.value || '—')}
                        </Typography>
                    )
                },
                {
                    field: 'actions',
                    headerName: t('workspace.material.columns.actions', 'Actions'),
                    width: 56,
                    sortable: false,
                    filterable: false,
                    disableColumnMenu: true,
                    align: 'center',
                    headerAlign: 'center',
                    renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
                    renderCell: (params) => (
                        <IconButton
                            type='button'
                            size='small'
                            aria-label={t('workspace.material.actionsFor', {
                                defaultValue: 'Material actions: {{title}}',
                                title: String(params.row.title || t('workspace.material.untitled', 'Untitled material'))
                            })}
                            disabled={isUpdatingPrimary}
                            onClick={(event) => openMaterialMenu(event, String(params.row.id))}
                            sx={{ width: 28, height: 28, p: 0.25 }}
                        >
                            <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    )
                }
            )
        }

        return columns
    }, [canEditContent, filteredMaterials, handleSelectMaterial, isUpdatingPrimary, setMaterialTriggerRef, t])

    if (selectedMaterial) {
        return (
            <Box
                data-testid='interpretation-network-details-pane'
                sx={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    width: '100%',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    overflow: 'hidden'
                }}
            >
                <Stack spacing={1.5}>
                    <Stack direction='row' spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                        <Tooltip title={t('workspace.material.backToMaterials', 'Back to materials')}>
                            <IconButton
                                type='button'
                                size='small'
                                aria-label={t('workspace.material.backToMaterials', 'Back to materials')}
                                onClick={handleCloseMaterial}
                            >
                                <ArrowBackRoundedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                                {materialTitle || t('workspace.material.untitled', 'Untitled material')}
                            </Typography>
                        </Box>
                        {primaryMaterialId && selectedMaterialId === primaryMaterialId ? (
                            <Chip size='small' color='primary' label={t('workspace.material.primaryBadge', 'Primary Material')} />
                        ) : null}
                        {canDeleteContent ? (
                            <Tooltip title={t('workspace.material.delete', 'Delete material')}>
                                <IconButton
                                    type='button'
                                    size='small'
                                    aria-label={t('workspace.material.delete', 'Delete material')}
                                    disabled={isDeletingMaterial}
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <DeleteOutlineRoundedIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        ) : null}
                    </Stack>
                    {selectedMaterialDescription ? (
                        <Typography
                            data-testid='interpretation-network-material-description'
                            variant='body2'
                            sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                            {selectedMaterialDescription}
                        </Typography>
                    ) : null}
                    {primaryActionError ? <Alert severity='error'>{primaryActionError}</Alert> : null}
                    {materialAssociationsError ? <Alert severity='error'>{materialAssociationsError}</Alert> : null}
                    {isLoadingMaterialAssociations ? (
                        <Alert severity='info' role='status'>
                            {t('workspace.material.loading', 'Loading materials…')}
                        </Alert>
                    ) : null}
                    {materialBodyField ? (
                        <MaterialContentEditor
                            t={t}
                            locale={locale}
                            bodyField={materialBodyField}
                            value={materialBodyValue}
                            readOnly={!canEditContent}
                            isSaving={isSavingMaterial}
                            error={materialEditorError}
                            onSave={onSaveMaterialBody}
                        />
                    ) : (
                        <Alert severity='warning'>{t('workspace.material.bodyUnavailable', 'Material body field is not available.')}</Alert>
                    )}
                </Stack>
                <ConfirmDeleteDialog
                    open={deleteDialogOpen}
                    title={t('workspace.material.deleteTitle', 'Delete material?')}
                    description={t('workspace.material.deleteDescription', {
                        defaultValue: 'Delete “{{title}}”? If this is the Primary Material, the cell will return to the materials list.',
                        title: materialTitle || t('workspace.material.untitled', 'Untitled material')
                    })}
                    confirmButtonText={t('workspace.material.delete', 'Delete material')}
                    deletingButtonText={t('workspace.material.deleting', 'Deleting material...')}
                    cancelButtonText={t('workspace.actions.cancel', 'Cancel')}
                    loading={isDeletingMaterial}
                    error={deleteMaterialError ?? undefined}
                    onCancel={() => setDeleteDialogOpen(false)}
                    onConfirm={async () => {
                        await onDeleteMaterial(selectedMaterial.id)
                        setDeleteDialogOpen(false)
                        focusMaterialOnReturnRef.current = null
                        focusListOnReturnRef.current = true
                    }}
                />
            </Box>
        )
    }

    if (!selectedCell) {
        return (
            <Box
                data-testid='interpretation-network-details-pane'
                sx={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    width: '100%',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    overflow: 'hidden'
                }}
            >
                <Stack spacing={1.5}>
                    <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                        {t('workspace.guidance.title', 'How to work with structures')}
                    </Typography>
                    <Alert severity='info'>
                        {t(
                            'workspace.guidance.noCell',
                            'Create or select a structure on the left. After you open a structure, select a matrix cell to manage its materials here.'
                        )}
                    </Alert>
                </Stack>
            </Box>
        )
    }

    return (
        <Box
            ref={listRegionRef}
            tabIndex={-1}
            role='region'
            aria-label={t('workspace.material.title', 'Materials')}
            data-testid='interpretation-network-details-pane'
            sx={{
                flex: '1 1 0%',
                minWidth: 0,
                width: '100%',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                overflow: 'hidden'
            }}
        >
            <Stack spacing={1.5}>
                <CatalogToolbar
                    title={t('workspace.material.title', 'Materials')}
                    filterLabel={t('workspace.material.filter', 'Filter by title')}
                    filterValue={filter}
                    viewMode={viewMode}
                    viewModeLabel={t('workspace.material.viewMode', 'Material view mode')}
                    tableViewLabel={t('workspace.material.tableView', 'Table view')}
                    cardViewLabel={t('workspace.material.cardView', 'Card view')}
                    createLabel={t('workspace.material.create', 'Add material')}
                    createDisabled={!canCreateContent || !canEditContent || !materialSectionId || isSavingMaterial}
                    onFilterChange={setFilter}
                    onViewModeChange={setViewMode}
                    onCreate={onOpenCreateMaterial}
                />

                {primaryActionError ? <Alert severity='error'>{primaryActionError}</Alert> : null}
                {materialAssociationsError ? <Alert severity='error'>{materialAssociationsError}</Alert> : null}
                {isLoadingMaterialAssociations ? (
                    <Alert severity='info' role='status'>
                        {t('workspace.material.loading', 'Loading materials…')}
                    </Alert>
                ) : null}

                {filteredMaterials.length === 0 && !isLoadingMaterialAssociations && !materialAssociationsError ? (
                    <Alert severity='info'>
                        {normalizedFilter
                            ? t('workspace.material.noFilterResults', 'No materials match the current filter.')
                            : t('workspace.noMaterial', 'The selected cell has no attached material yet.')}
                    </Alert>
                ) : null}

                {filteredMaterials.length > 0 && viewMode === 'table' ? (
                    <Box
                        data-testid='interpretation-network-material-table'
                        sx={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}
                    >
                        <CustomizedDataGrid
                            rows={filteredMaterials.map((material) => ({
                                id: material.id,
                                title: material.title,
                                description: material.description,
                                selected: material.id === selectedMaterialId,
                                isPrimary: material.isPrimary
                            }))}
                            columns={materialColumns}
                            rowHeight='auto'
                            hideFooter
                            localeText={dataGridLocaleText}
                        />
                    </Box>
                ) : null}

                {filteredMaterials.length > 0 && viewMode === 'cards' ? (
                    <Box
                        data-testid='interpretation-network-material-cards'
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1
                        }}
                    >
                        {filteredMaterials.map((material) => (
                            <Card
                                key={material.id}
                                variant='outlined'
                                sx={{
                                    borderRadius: 1,
                                    minHeight: 128,
                                    display: 'flex',
                                    position: 'relative',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: 'action.hover'
                                    }
                                }}
                            >
                                <CardActionArea
                                    ref={(element) => setMaterialTriggerRef(material.id, element)}
                                    onClick={() => handleSelectMaterial(material.id)}
                                    sx={{ alignItems: 'stretch', display: 'flex', width: '100%', minHeight: 128, textAlign: 'left' }}
                                >
                                    <CardContent sx={{ width: '100%', pr: 5 }}>
                                        <Stack direction='row' spacing={1} sx={{ minWidth: 0, alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant='subtitle2' sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                                                {material.title}
                                            </Typography>
                                            {material.isPrimary ? (
                                                <Chip
                                                    size='small'
                                                    color='primary'
                                                    label={t('workspace.material.primaryBadge', 'Primary Material')}
                                                />
                                            ) : null}
                                        </Stack>
                                        <Typography
                                            variant='body2'
                                            sx={{
                                                color: 'text.secondary',
                                                whiteSpace: 'pre-wrap'
                                            }}
                                        >
                                            {material.description || t('workspace.material.noDescription', 'No description')}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                                {canEditContent ? (
                                    <IconButton
                                        type='button'
                                        size='small'
                                        aria-label={t('workspace.material.actionsFor', {
                                            defaultValue: 'Material actions: {{title}}',
                                            title: material.title
                                        })}
                                        disabled={isUpdatingPrimary}
                                        onClick={(event) => openMaterialMenu(event, material.id)}
                                        sx={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, p: 0.25 }}
                                    >
                                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                ) : null}
                            </Card>
                        ))}
                    </Box>
                ) : null}
                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMaterialMenu}>
                    <MenuItem
                        disabled={!menuMaterialId || !canEditContent}
                        onClick={() => {
                            const targetId = menuMaterialId
                            closeMaterialMenu()
                            if (targetId) onOpenEditMaterial(targetId)
                        }}
                    >
                        <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('workspace.material.edit', 'Edit material')}
                    </MenuItem>
                    {menuMaterialId && materialSummaries.find((material) => material.id === menuMaterialId)?.isPrimary ? (
                        <MenuItem
                            disabled={isUpdatingPrimary}
                            onClick={() => {
                                closeMaterialMenu()
                                onClearPrimaryMaterial()
                            }}
                        >
                            <StarBorderRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('workspace.material.clearPrimary', 'Clear Primary Material')}
                        </MenuItem>
                    ) : menuMaterialId ? (
                        <MenuItem
                            disabled={isUpdatingPrimary}
                            onClick={() => {
                                const targetId = menuMaterialId
                                closeMaterialMenu()
                                onSetPrimaryMaterial(targetId)
                            }}
                        >
                            <StarRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {primaryMaterialId
                                ? t('workspace.material.replacePrimary', 'Replace Primary Material')
                                : t('workspace.material.setPrimary', 'Set as Primary Material')}
                        </MenuItem>
                    ) : null}
                </Menu>
            </Stack>
        </Box>
    )
}
