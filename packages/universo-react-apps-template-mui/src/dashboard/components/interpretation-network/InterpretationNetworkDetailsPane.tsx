import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { GridColDef, GridLocaleText } from '@mui/x-data-grid'
import type { TFunction } from 'i18next'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
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
    materialSectionId?: string
    dataGridLocaleText?: Partial<GridLocaleText>
    canCreateContent: boolean
    canEditContent: boolean
    isSavingMaterial: boolean
    materialEditorError: string | null
    onOpenCreateMaterial: () => void
    onOpenEditMaterial: (materialId: string) => void
    onSelectMaterial: (materialId: string) => void
    onCloseMaterial: () => void
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
    materialSectionId,
    dataGridLocaleText,
    canCreateContent,
    canEditContent,
    isSavingMaterial,
    materialEditorError,
    onOpenCreateMaterial,
    onOpenEditMaterial,
    onSelectMaterial,
    onCloseMaterial,
    onSaveMaterialBody
}: InterpretationNetworkDetailsPaneProps) {
    const [viewMode, setViewMode] = useState<MaterialViewMode>('table')
    const [filter, setFilter] = useState('')
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
    const [menuMaterialId, setMenuMaterialId] = useState<string | null>(null)
    const normalizedFilter = filter.trim().toLowerCase()
    const filteredMaterials = useMemo(
        () =>
            normalizedFilter
                ? materialSummaries.filter((material) =>
                      [material.title, material.description].some((value) => value.toLowerCase().includes(normalizedFilter))
                  )
                : materialSummaries,
        [materialSummaries, normalizedFilter]
    )
    const closeMaterialMenu = () => {
        setMenuPosition(null)
        setMenuMaterialId(null)
    }
    const openMaterialMenu = (event: React.MouseEvent<HTMLElement>, materialId: string) => {
        event.preventDefault()
        event.stopPropagation()
        setMenuPosition({ top: event.clientY + 4, left: event.clientX })
        setMenuMaterialId(materialId)
    }
    const materialColumns = useMemo<GridColDef[]>(
        () => [
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
                renderCell: (params) => (
                    <Button
                        type='button'
                        size='small'
                        variant='text'
                        onClick={() => onSelectMaterial(String(params.row.id))}
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
                headerName: t('workspace.material.columns.description', 'Description'),
                flex: 1,
                minWidth: 220,
                renderCell: (params) => (
                    <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
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
                        disabled={!canEditContent}
                        onClick={(event) => openMaterialMenu(event, String(params.row.id))}
                        sx={{ width: 28, height: 28, p: 0.25 }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                )
            }
        ],
        [canEditContent, filteredMaterials, onSelectMaterial, t]
    )

    if (selectedMaterial) {
        return (
            <Box
                data-testid='interpretation-network-details-pane'
                sx={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    overflow: 'hidden'
                }}
            >
                <Stack spacing={1.5}>
                    <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
                        <Tooltip title={t('workspace.material.backToMaterials', 'Back to materials')}>
                            <IconButton
                                type='button'
                                size='small'
                                aria-label={t('workspace.material.backToMaterials', 'Back to materials')}
                                onClick={onCloseMaterial}
                            >
                                <ArrowBackRoundedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                                {materialTitle || t('workspace.material.untitled', 'Untitled material')}
                            </Typography>
                        </Box>
                    </Stack>
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
            data-testid='interpretation-network-details-pane'
            sx={{
                flex: '1 1 0%',
                minWidth: 0,
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
                    createLabel={t('workspace.actions.create', 'Create')}
                    createDisabled={!canCreateContent || !canEditContent || !materialSectionId || isSavingMaterial}
                    onFilterChange={setFilter}
                    onViewModeChange={setViewMode}
                    onCreate={onOpenCreateMaterial}
                />

                {filteredMaterials.length === 0 ? (
                    <Alert severity='info'>
                        {normalizedFilter
                            ? t('workspace.material.noFilterResults', 'No materials match the current filter.')
                            : t('workspace.noMaterial', 'The selected cell has no attached material yet.')}
                    </Alert>
                ) : null}

                {filteredMaterials.length > 0 && viewMode === 'table' ? (
                    <Box data-testid='interpretation-network-material-table' sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                        <CustomizedDataGrid
                            rows={filteredMaterials.map((material) => ({
                                id: material.id,
                                title: material.title,
                                description: material.description,
                                selected: material.id === selectedMaterialId
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
                                    onClick={() => onSelectMaterial(material.id)}
                                    sx={{ alignItems: 'stretch', display: 'flex', width: '100%', minHeight: 128, textAlign: 'left' }}
                                >
                                    <CardContent sx={{ width: '100%', pr: 5 }}>
                                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }} noWrap>
                                            {material.title}
                                        </Typography>
                                        <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap' }}>
                                            {material.description || t('workspace.material.noDescription', 'No description')}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                                <IconButton
                                    type='button'
                                    size='small'
                                    aria-label={t('workspace.material.actionsFor', {
                                        defaultValue: 'Material actions: {{title}}',
                                        title: material.title
                                    })}
                                    disabled={!canEditContent}
                                    onClick={(event) => openMaterialMenu(event, material.id)}
                                    sx={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, p: 0.25 }}
                                >
                                    <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Card>
                        ))}
                    </Box>
                ) : null}
                <Menu
                    anchorReference='anchorPosition'
                    anchorPosition={menuPosition ?? undefined}
                    open={Boolean(menuPosition)}
                    onClose={closeMaterialMenu}
                >
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
                </Menu>
            </Stack>
        </Box>
    )
}
