import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
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
import SaveAltRoundedIcon from '@mui/icons-material/SaveAltRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import type { GridColDef } from '@mui/x-data-grid'
import type { GridLocaleText } from '@mui/x-data-grid'
import { useState, type ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import type { TFunction } from 'i18next'
import type { InterpretationNetworkTemplateDetail, InterpretationNetworkTemplateSummary } from '../../../../api/interpretationNetwork'
import CustomizedDataGrid from '../../CustomizedDataGrid'
import { CatalogToolbar } from '../CatalogToolbar'
import { readColumnText, type RuntimeColumnLike, type RuntimeRow } from '../model'
import { readInterpretationNetworkTemplateLabel } from './templateDisplay'

const toMenuAnchorPosition = (anchor: HTMLElement | null) => {
    if (!anchor) return undefined
    const rect = anchor.getBoundingClientRect()
    return { top: rect.bottom, left: rect.left }
}

export type StructureViewMode = 'table' | 'cards'
export type StructureListTab = 'structures' | 'templates'
export type StructureDetailTab = 'matrix' | 'templates'

export interface StructureSummary {
    id: string
    row: RuntimeRow
    title: string
    description: string
    interpretationId: string | null
}

export interface StructurePaneProps {
    a11yIdPrefix: string
    t: TFunction<'interpretationNetwork'>
    selectedConcept: RuntimeRow | undefined
    conceptColumns: RuntimeColumnLike[] | undefined
    conceptNameField: string
    locale: string
    structureFilter: string
    structureViewMode: StructureViewMode
    filteredStructures: StructureSummary[]
    templates?: InterpretationNetworkTemplateSummary[]
    structureListTab?: StructureListTab
    structureDetailTab?: StructureDetailTab
    showTemplatesInStructureList?: boolean
    showTemplatesInMatrix?: boolean
    dataGridLocaleText?: Partial<GridLocaleText>
    canCreateStructure: boolean
    canSaveTemplate?: boolean
    canCreateFromTemplate?: boolean
    templateLoading?: boolean
    templateDetailLoading?: boolean
    templateDetailError?: boolean
    templateDetail?: InterpretationNetworkTemplateDetail
    structureFieldsReady: boolean
    createStructureError: boolean
    normalizedStructureFilter: string
    matrixWorkspace: ReactNode
    structureMenuAnchor: HTMLElement | null
    structureMenuId: string | null
    canEditStructure: boolean
    canDeleteStructure: boolean
    canEditTemplate?: boolean
    canDeleteTemplate?: boolean
    onFilterChange: (value: string) => void
    onViewModeChange: (value: StructureViewMode) => void
    onStructureListTabChange?: (value: StructureListTab) => void
    onStructureDetailTabChange?: (value: StructureDetailTab) => void
    onOpenCreateStructure: () => void
    onOpenSaveTemplateForStructure?: (structureId: string) => void
    onEditTemplate?: (templateId: string) => void
    onDeleteTemplate?: (templateId: string) => void
    onOpenTemplate?: (templateId: string) => void
    onCloseTemplate?: () => void
    onOpenStructure: (structure: StructureSummary) => void
    onOpenStructureMenu: (anchor: HTMLElement, structureId: string) => void
    onCloseStructureMenu: () => void
    onEditStructure: (structureId: string) => void | Promise<void>
    onDeleteStructure: (structureId: string) => void
    onBackToList: () => void
    onStructureOpenControl?: (structureId: string, element: HTMLElement | null) => void
    singleSystemMode?: boolean
    hideSelectedHeader?: boolean
    paneSx?: SxProps<Theme>
}

export function StructurePane({
    a11yIdPrefix,
    t,
    selectedConcept,
    conceptColumns,
    conceptNameField,
    locale,
    structureFilter,
    structureViewMode,
    filteredStructures,
    templates = [],
    structureListTab = 'structures',
    structureDetailTab = 'matrix',
    showTemplatesInStructureList = true,
    showTemplatesInMatrix = true,
    dataGridLocaleText,
    canCreateStructure,
    canSaveTemplate = false,
    canCreateFromTemplate = false,
    templateLoading = false,
    templateDetailLoading = false,
    templateDetailError = false,
    templateDetail,
    structureFieldsReady,
    createStructureError,
    normalizedStructureFilter,
    matrixWorkspace,
    structureMenuAnchor,
    structureMenuId,
    canEditStructure,
    canDeleteStructure,
    canEditTemplate = false,
    canDeleteTemplate = false,
    onFilterChange,
    onViewModeChange,
    onStructureListTabChange,
    onStructureDetailTabChange,
    onOpenCreateStructure,
    onOpenSaveTemplateForStructure,
    onEditTemplate,
    onDeleteTemplate,
    onOpenTemplate,
    onCloseTemplate,
    onOpenStructure,
    onOpenStructureMenu,
    onCloseStructureMenu,
    onEditStructure,
    onDeleteStructure,
    onBackToList,
    onStructureOpenControl,
    singleSystemMode = false,
    hideSelectedHeader = false,
    paneSx
}: StructurePaneProps) {
    const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
    const [templateMenuAnchor, setTemplateMenuAnchor] = useState<HTMLElement | null>(null)
    const [templateMenuId, setTemplateMenuId] = useState<string | null>(null)
    const structureListTabIds = {
        structures: `${a11yIdPrefix}-structure-list-structures-tab`,
        templates: `${a11yIdPrefix}-structure-list-templates-tab`
    } as const
    const structureListPanelIds = {
        structures: `${a11yIdPrefix}-structure-list-structures-panel`,
        templates: `${a11yIdPrefix}-structure-list-templates-panel`
    } as const
    const structureDetailTabIds = {
        matrix: `${a11yIdPrefix}-structure-detail-matrix-tab`,
        templates: `${a11yIdPrefix}-structure-detail-templates-tab`
    } as const
    const structureDetailPanelIds = {
        matrix: `${a11yIdPrefix}-structure-detail-matrix-panel`,
        templates: `${a11yIdPrefix}-structure-detail-templates-panel`
    } as const
    const selectedConceptTitle = selectedConcept
        ? readColumnText(selectedConcept, conceptColumns, conceptNameField, locale) || t('workspace.untitledConcept', 'Untitled concept')
        : ''
    const templateRows = templates.map((template, index) => ({
        id: template.id,
        number: index + 1,
        title: readInterpretationNetworkTemplateLabel(template.name, locale) || t('workspace.template.untitled', 'Untitled template'),
        description: readInterpretationNetworkTemplateLabel(template.description, locale) || '—',
        scope: template.includesMaterials
            ? t('workspace.template.withMaterials', 'Structure and materials')
            : t('workspace.template.structureOnly', 'Structure only'),
        version: template.version
    }))
    const openTemplate = templateRows.find((template) => template.id === openTemplateId)
    const readTemplateRowTitle = (row: Record<string, unknown>): string =>
        typeof row.title === 'string' && row.title.trim() ? row.title : t('workspace.template.untitled', 'Untitled template')
    const openTemplateDetail = (templateId: string) => {
        setOpenTemplateId(templateId)
        onOpenTemplate?.(templateId)
    }
    const closeTemplateDetail = () => {
        setOpenTemplateId(null)
        onCloseTemplate?.()
    }
    const templateColumns: GridColDef[] = [
        { field: 'number', headerName: '#', width: 64, sortable: false, filterable: false },
        {
            field: 'title',
            headerName: t('workspace.template.columns.title', 'Template'),
            flex: 1,
            minWidth: 180,
            renderCell: (params) => (
                <Button
                    type='button'
                    color='inherit'
                    size='small'
                    onClick={() => openTemplateDetail(String(params.row.id))}
                    sx={{ minWidth: 0, maxWidth: '100%', justifyContent: 'flex-start', textTransform: 'none' }}
                >
                    <Typography component='span' variant='body2' noWrap>
                        {readTemplateRowTitle(params.row)}
                    </Typography>
                </Button>
            )
        },
        {
            field: 'description',
            headerName: t('workspace.template.columns.description', 'Description'),
            flex: 1,
            minWidth: 220,
            renderCell: (params) => (
                <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {String(params.value || '—')}
                </Typography>
            )
        },
        { field: 'scope', headerName: t('workspace.template.columns.scope', 'Saved data'), flex: 0.8, minWidth: 160 },
        {
            field: 'actions',
            headerName: t('workspace.structure.columns.actions', 'Actions'),
            width: 56,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <IconButton
                    type='button'
                    size='small'
                    data-testid={`interpretation-network-template-actions-${String(params.row.id)}`}
                    aria-label={t('workspace.template.actionsFor', {
                        defaultValue: 'Template actions: {{title}}',
                        title: readTemplateRowTitle(params.row)
                    })}
                    onClick={(event) => {
                        setTemplateMenuAnchor(event.currentTarget)
                        setTemplateMenuId(String(params.row.id))
                    }}
                >
                    <MoreVertRoundedIcon fontSize='small' />
                </IconButton>
            )
        }
    ]
    const closeTemplateMenu = () => {
        setTemplateMenuAnchor(null)
        setTemplateMenuId(null)
    }
    const templateMenuOpen = Boolean(templateMenuAnchor?.isConnected && templateMenuId)
    const structureMenuOpen = Boolean(structureMenuAnchor?.isConnected)
    const templateMenuAnchorPosition = toMenuAnchorPosition(templateMenuAnchor)
    const structureMenuAnchorPosition = toMenuAnchorPosition(structureMenuAnchor)
    const templateManagement = (
        <>
            <Stack spacing={1.5}>
                {templateLoading ? <Alert severity='info'>{t('workspace.template.loading', 'Loading templates...')}</Alert> : null}
                {!templateLoading && templates.length === 0 ? (
                    <Alert severity='info'>{t('workspace.template.empty', 'No saved templates yet.')}</Alert>
                ) : null}
                {templates.length > 0 ? (
                    <Box data-testid='interpretation-network-template-table' sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                        <CustomizedDataGrid
                            rows={templateRows}
                            columns={templateColumns}
                            rowHeight='auto'
                            hideFooter
                            localeText={dataGridLocaleText}
                        />
                        {templateMenuOpen ? (
                            <Menu
                                anchorReference='anchorPosition'
                                anchorPosition={templateMenuAnchorPosition}
                                open
                                onClose={closeTemplateMenu}
                                slotProps={{ list: { 'aria-label': t('workspace.template.actions', 'Template actions') } }}
                            >
                                <MenuItem
                                    disabled={!templateMenuId}
                                    onClick={() => {
                                        if (templateMenuId) openTemplateDetail(templateMenuId)
                                        closeTemplateMenu()
                                    }}
                                >
                                    <VisibilityRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                    {t('workspace.actions.open', 'Open')}
                                </MenuItem>
                                {canEditTemplate ? (
                                    <MenuItem
                                        disabled={!templateMenuId}
                                        onClick={() => {
                                            if (templateMenuId) onEditTemplate?.(templateMenuId)
                                            closeTemplateMenu()
                                        }}
                                    >
                                        <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                        {t('workspace.actions.edit', 'Edit')}
                                    </MenuItem>
                                ) : null}
                                {canDeleteTemplate ? (
                                    <MenuItem
                                        disabled={!templateMenuId}
                                        onClick={() => {
                                            if (templateMenuId) onDeleteTemplate?.(templateMenuId)
                                            closeTemplateMenu()
                                        }}
                                    >
                                        <DeleteRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                        {t('workspace.actions.delete', 'Delete')}
                                    </MenuItem>
                                ) : null}
                            </Menu>
                        ) : null}
                    </Box>
                ) : null}
            </Stack>
            <Dialog open={Boolean(openTemplate)} onClose={closeTemplateDetail} fullWidth maxWidth='sm'>
                <DialogTitle>
                    {readInterpretationNetworkTemplateLabel(templateDetail?.name, locale) ||
                        openTemplate?.title ||
                        t('workspace.template.untitled', 'Untitled template')}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {templateDetailLoading ? (
                            <Alert severity='info'>{t('workspace.template.detailLoading', 'Loading template...')}</Alert>
                        ) : null}
                        {templateDetailError ? (
                            <Alert severity='error'>{t('workspace.template.detailError', 'Failed to load template.')}</Alert>
                        ) : null}
                        <Stack spacing={0.5}>
                            <Typography variant='subtitle2'>{t('workspace.template.description', 'Description')}</Typography>
                            <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                {readInterpretationNetworkTemplateLabel(templateDetail?.description, locale) ||
                                    openTemplate?.description ||
                                    '—'}
                            </Typography>
                        </Stack>
                        <Stack spacing={0.5}>
                            <Typography variant='subtitle2'>{t('workspace.template.copyScope', 'Saved data')}</Typography>
                            <Typography variant='body2'>
                                {templateDetail
                                    ? templateDetail.includesMaterials
                                        ? t('workspace.template.withMaterials', 'Structure and materials')
                                        : t('workspace.template.structureOnly', 'Structure only')
                                    : openTemplate?.scope ?? '—'}
                            </Typography>
                        </Stack>
                        {templateDetail ? (
                            <Stack spacing={0.5}>
                                <Typography variant='subtitle2'>{t('workspace.template.contents', 'Contents')}</Typography>
                                <Typography variant='body2'>
                                    {t('workspace.template.cellCount', {
                                        defaultValue: '{{count}} matrix cells',
                                        count: templateDetail.matrix.cellCount
                                    })}
                                </Typography>
                                <Typography variant='body2'>
                                    {t('workspace.template.rootCount', {
                                        defaultValue: '{{count}} root cells',
                                        count: templateDetail.matrix.rootCount
                                    })}
                                </Typography>
                                <Typography variant='body2'>
                                    {t('workspace.template.maxDepth', {
                                        defaultValue: 'Maximum depth: {{count}}',
                                        count: templateDetail.matrix.maxDepth
                                    })}
                                </Typography>
                                <Typography variant='body2'>
                                    {t('workspace.template.materialCount', {
                                        defaultValue: '{{count}} materials',
                                        count: templateDetail.materialCount
                                    })}
                                </Typography>
                            </Stack>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button type='button' color='inherit' onClick={closeTemplateDetail}>
                        {t('workspace.actions.close', 'Close')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
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
                    ref={(element) => onStructureOpenControl?.(String(params.row.id), element)}
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
            id='interpretation-network-structure-pane'
            data-testid='interpretation-network-structure-pane'
            sx={{
                flex: { xs: '1 1 auto', md: '1 1 0%' },
                minWidth: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                overflow: 'hidden',
                ...paneSx
            }}
        >
            {!selectedConcept && !singleSystemMode ? (
                <>
                    <Box sx={{ mb: 1.5 }}>
                        {showTemplatesInStructureList ? (
                            <Tabs
                                value={structureListTab}
                                onChange={(_event, value: StructureListTab) => onStructureListTabChange?.(value)}
                                aria-label={t('workspace.structure.listTabs', 'Structure list sections')}
                                sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                            >
                                <Tab
                                    value='structures'
                                    label={t('workspace.structure.title', 'Structures')}
                                    id={structureListTabIds.structures}
                                    aria-controls={structureListPanelIds.structures}
                                    sx={{ minHeight: 40 }}
                                />
                                <Tab
                                    value='templates'
                                    label={t('workspace.template.title', 'Templates')}
                                    id={structureListTabIds.templates}
                                    aria-controls={structureListPanelIds.templates}
                                    sx={{ minHeight: 40 }}
                                />
                            </Tabs>
                        ) : null}
                    </Box>
                    <Box
                        role='tabpanel'
                        id={structureListPanelIds[structureListTab]}
                        aria-labelledby={structureListTabIds[structureListTab]}
                    >
                        {!showTemplatesInStructureList || structureListTab === 'structures' ? (
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
                        ) : null}
                        {showTemplatesInStructureList && structureListTab === 'templates' ? templateManagement : null}
                        {(!showTemplatesInStructureList || structureListTab === 'structures') &&
                        canCreateFromTemplate &&
                        templateLoading ? (
                            <Alert severity='info' sx={{ mb: 1 }}>
                                {t('workspace.template.loading', 'Loading templates...')}
                            </Alert>
                        ) : null}
                        {(!showTemplatesInStructureList || structureListTab === 'structures') && !canCreateStructure ? (
                            <Alert severity='info' sx={{ mb: 1 }}>
                                {t(
                                    'workspace.permissions.readOnly',
                                    'You can view this workspace, but content editing is not available for your role.'
                                )}
                            </Alert>
                        ) : null}
                        {(!showTemplatesInStructureList || structureListTab === 'structures') && createStructureError ? (
                            <Alert severity='error' sx={{ mb: 1 }}>
                                {t('workspace.structure.error', 'Failed to create structure')}
                            </Alert>
                        ) : null}
                        {(!showTemplatesInStructureList || structureListTab === 'structures') && filteredStructures.length === 0 ? (
                            <Alert severity='info'>
                                {normalizedStructureFilter
                                    ? t('workspace.structure.noFilterResults', 'No structures match the current filter.')
                                    : t('workspace.structure.emptyConcepts', 'Create a structure first.')}
                            </Alert>
                        ) : null}
                        {(!showTemplatesInStructureList || structureListTab === 'structures') &&
                        filteredStructures.length > 0 &&
                        structureViewMode === 'table' ? (
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
                        {(!showTemplatesInStructureList || structureListTab === 'structures') &&
                        filteredStructures.length > 0 &&
                        structureViewMode === 'cards' ? (
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
                                            ref={(element) => onStructureOpenControl?.(structure.id, element)}
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
                        {structureMenuOpen ? (
                            <Menu
                                anchorReference='anchorPosition'
                                anchorPosition={structureMenuAnchorPosition}
                                open
                                onClose={onCloseStructureMenu}
                            >
                                <MenuItem
                                    disabled={!structureMenuId || !canEditStructure}
                                    onClick={() => {
                                        if (!structureMenuId) return
                                        void onEditStructure(structureMenuId)
                                        onCloseStructureMenu()
                                    }}
                                >
                                    <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                    {t('workspace.actions.edit', 'Edit')}
                                </MenuItem>
                                <MenuItem
                                    disabled={!structureMenuId || !canSaveTemplate}
                                    onClick={() => {
                                        if (structureMenuId) onOpenSaveTemplateForStructure?.(structureMenuId)
                                        onCloseStructureMenu()
                                    }}
                                >
                                    <SaveAltRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                    {t('workspace.template.saveAsTemplate', 'Save as template')}
                                </MenuItem>
                                <MenuItem
                                    disabled={!structureMenuId || !canDeleteStructure}
                                    onClick={() => {
                                        if (!structureMenuId) return
                                        onDeleteStructure(structureMenuId)
                                        onCloseStructureMenu()
                                    }}
                                    sx={{ color: 'error.main' }}
                                >
                                    <DeleteRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                                    {t('workspace.actions.delete', 'Delete')}
                                </MenuItem>
                            </Menu>
                        ) : null}
                    </Box>
                    <Box
                        role='tabpanel'
                        id={structureListPanelIds[structureListTab === 'structures' ? 'templates' : 'structures']}
                        aria-labelledby={structureListTabIds[structureListTab === 'structures' ? 'templates' : 'structures']}
                        hidden
                    />
                </>
            ) : selectedConcept || singleSystemMode ? (
                <Stack spacing={1.5}>
                    {!singleSystemMode && !hideSelectedHeader ? (
                        <Stack direction='row' spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
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
                    ) : null}
                    {singleSystemMode ? (
                        showTemplatesInMatrix ? (
                            <Box>
                                <Tabs
                                    value={structureDetailTab}
                                    onChange={(_event, value: StructureDetailTab) => onStructureDetailTabChange?.(value)}
                                    aria-label={t('workspace.structure.tabs', 'Structure sections')}
                                    sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                                >
                                    <Tab
                                        value='matrix'
                                        label={t('workspace.matrix', 'Matrix')}
                                        id={structureDetailTabIds.matrix}
                                        aria-controls={structureDetailPanelIds.matrix}
                                        sx={{ minHeight: 40 }}
                                    />
                                    <Tab
                                        value='templates'
                                        label={t('workspace.template.title', 'Templates')}
                                        id={structureDetailTabIds.templates}
                                        aria-controls={structureDetailPanelIds.templates}
                                        sx={{ minHeight: 40 }}
                                    />
                                </Tabs>
                                <Box
                                    role='tabpanel'
                                    id={structureDetailPanelIds[structureDetailTab]}
                                    aria-labelledby={structureDetailTabIds[structureDetailTab]}
                                    sx={{ pt: 1.5 }}
                                >
                                    {structureDetailTab === 'templates' ? templateManagement : matrixWorkspace}
                                </Box>
                                <Box
                                    role='tabpanel'
                                    id={structureDetailPanelIds[structureDetailTab === 'matrix' ? 'templates' : 'matrix']}
                                    aria-labelledby={structureDetailTabIds[structureDetailTab === 'matrix' ? 'templates' : 'matrix']}
                                    hidden
                                />
                            </Box>
                        ) : (
                            <Box>{matrixWorkspace}</Box>
                        )
                    ) : (
                        <Box>
                            <Tabs
                                value={showTemplatesInMatrix ? structureDetailTab : 'matrix'}
                                onChange={(_event, value: StructureDetailTab) => onStructureDetailTabChange?.(value)}
                                aria-label={t('workspace.structure.tabs', 'Structure sections')}
                                sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                            >
                                <Tab
                                    value='matrix'
                                    label={t('workspace.matrix', 'Matrix')}
                                    id={structureDetailTabIds.matrix}
                                    aria-controls={structureDetailPanelIds.matrix}
                                    sx={{ minHeight: 40 }}
                                />
                                {showTemplatesInMatrix ? (
                                    <Tab
                                        value='templates'
                                        label={t('workspace.template.title', 'Templates')}
                                        id={structureDetailTabIds.templates}
                                        aria-controls={structureDetailPanelIds.templates}
                                        sx={{ minHeight: 40 }}
                                    />
                                ) : null}
                            </Tabs>
                            <Box
                                role='tabpanel'
                                id={structureDetailPanelIds[showTemplatesInMatrix ? structureDetailTab : 'matrix']}
                                aria-labelledby={structureDetailTabIds[showTemplatesInMatrix ? structureDetailTab : 'matrix']}
                                sx={{ pt: 1.5 }}
                            >
                                {showTemplatesInMatrix && structureDetailTab === 'templates' ? templateManagement : matrixWorkspace}
                            </Box>
                            {showTemplatesInMatrix ? (
                                <Box
                                    role='tabpanel'
                                    id={structureDetailPanelIds[structureDetailTab === 'matrix' ? 'templates' : 'matrix']}
                                    aria-labelledby={structureDetailTabIds[structureDetailTab === 'matrix' ? 'templates' : 'matrix']}
                                    hidden
                                />
                            ) : null}
                        </Box>
                    )}
                </Stack>
            ) : null}
        </Box>
    )
}
