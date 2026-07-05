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
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { GridColDef } from '@mui/x-data-grid'
import type { GridLocaleText } from '@mui/x-data-grid'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import CustomizedDataGrid from '../../CustomizedDataGrid'
import { CatalogToolbar } from '../CatalogToolbar'
import { readColumnText, type RuntimeColumnLike, type RuntimeRow } from '../model'

export type StructureViewMode = 'table' | 'cards'

export interface StructureSummary {
    id: string
    row: RuntimeRow
    title: string
    description: string
    interpretationId: string | null
}

export interface StructurePaneProps {
    t: TFunction<'interpretationNetwork'>
    selectedConcept: RuntimeRow | undefined
    conceptColumns: RuntimeColumnLike[] | undefined
    conceptNameField: string
    locale: string
    structureFilter: string
    structureViewMode: StructureViewMode
    filteredStructures: StructureSummary[]
    dataGridLocaleText?: Partial<GridLocaleText>
    canCreateStructure: boolean
    structureFieldsReady: boolean
    createStructureError: boolean
    normalizedStructureFilter: string
    matrixWorkspace: ReactNode
    structureMenuAnchor: HTMLElement | null
    structureMenuId: string | null
    canEditStructure: boolean
    canDeleteStructure: boolean
    onFilterChange: (value: string) => void
    onViewModeChange: (value: StructureViewMode) => void
    onOpenCreateStructure: () => void
    onOpenStructure: (structure: StructureSummary) => void
    onOpenStructureMenu: (anchor: HTMLElement, structureId: string) => void
    onCloseStructureMenu: () => void
    onEditStructure: (structureId: string) => void
    onDeleteStructure: (structureId: string) => void
    onBackToList: () => void
}

export function StructurePane({
    t,
    selectedConcept,
    conceptColumns,
    conceptNameField,
    locale,
    structureFilter,
    structureViewMode,
    filteredStructures,
    dataGridLocaleText,
    canCreateStructure,
    structureFieldsReady,
    createStructureError,
    normalizedStructureFilter,
    matrixWorkspace,
    structureMenuAnchor,
    structureMenuId,
    canEditStructure,
    canDeleteStructure,
    onFilterChange,
    onViewModeChange,
    onOpenCreateStructure,
    onOpenStructure,
    onOpenStructureMenu,
    onCloseStructureMenu,
    onEditStructure,
    onDeleteStructure,
    onBackToList
}: StructurePaneProps) {
    const selectedConceptTitle = selectedConcept
        ? readColumnText(selectedConcept, conceptColumns, conceptNameField, locale) || t('workspace.untitledConcept', 'Untitled concept')
        : ''
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
                        const structure = filteredStructures.find((candidate) => candidate.id === String(params.row.id))
                        if (structure) onOpenStructure(structure)
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
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: '100%' }}>
                    <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {String(params.value || '—')}
                    </Typography>
                </Box>
            )
        },
        {
            field: 'actions',
            headerName: t('workspace.structure.columns.actions', 'Actions'),
            width: 56,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            hideable: false,
            align: 'center',
            headerAlign: 'center',
            renderHeader: () => <MoreVertRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                    <IconButton
                        type='button'
                        size='small'
                        aria-label={t('workspace.structure.actionsFor', {
                            defaultValue: 'Structure actions: {{title}}',
                            title: String(params.row.title || t('workspace.untitledConcept', 'Untitled concept'))
                        })}
                        disabled={!canEditStructure && !canDeleteStructure}
                        onClick={(event) => {
                            event.stopPropagation()
                            onOpenStructureMenu(event.currentTarget, String(params.row.id))
                        }}
                        sx={{ width: 28, height: 28, p: 0.25 }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            )
        }
    ]

    return (
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
                            createDisabled={!canCreateStructure || !structureFieldsReady}
                            onFilterChange={onFilterChange}
                            onViewModeChange={onViewModeChange}
                            onCreate={onOpenCreateStructure}
                        />
                    </Box>
                    {!canCreateStructure ? (
                        <Alert severity='info' sx={{ mb: 1 }}>
                            {t(
                                'workspace.permissions.readOnly',
                                'You can view this workspace, but content editing is not available for your role.'
                            )}
                        </Alert>
                    ) : null}
                    {createStructureError ? (
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
                                        position: 'relative',
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
                                        onClick={() => onOpenStructure(structure)}
                                        sx={{
                                            alignItems: 'stretch',
                                            display: 'flex',
                                            width: '100%',
                                            minHeight: 128,
                                            textAlign: 'left'
                                        }}
                                    >
                                        <CardContent sx={{ width: '100%', pr: 5 }}>
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
                                    <IconButton
                                        type='button'
                                        size='small'
                                        aria-label={t('workspace.structure.actionsFor', {
                                            defaultValue: 'Structure actions: {{title}}',
                                            title: structure.title
                                        })}
                                        disabled={!canEditStructure && !canDeleteStructure}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onOpenStructureMenu(event.currentTarget, structure.id)
                                        }}
                                        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, width: 28, height: 28, p: 0.25 }}
                                    >
                                        <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Card>
                            ))}
                        </Box>
                    ) : null}
                    <Menu anchorEl={structureMenuAnchor} open={Boolean(structureMenuAnchor)} onClose={onCloseStructureMenu}>
                        <MenuItem
                            disabled={!structureMenuId || !canEditStructure}
                            onClick={() => structureMenuId && onEditStructure(structureMenuId)}
                        >
                            <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('workspace.actions.edit', 'Edit')}
                        </MenuItem>
                        <MenuItem
                            disabled={!structureMenuId || !canDeleteStructure}
                            onClick={() => structureMenuId && onDeleteStructure(structureMenuId)}
                            sx={{ color: 'error.main' }}
                        >
                            <DeleteRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('workspace.actions.delete', 'Delete')}
                        </MenuItem>
                    </Menu>
                </>
            ) : (
                <Stack spacing={1.5}>
                    <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0 }}>
                        <IconButton
                            type='button'
                            size='small'
                            aria-label={t('workspace.structure.backToList', 'Structures')}
                            onClick={onBackToList}
                        >
                            <ArrowBackRoundedIcon fontSize='small' />
                        </IconButton>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                                {selectedConceptTitle}
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
    )
}
