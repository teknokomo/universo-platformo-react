import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    FlowListTable,
    PaginationControls,
    EmptyListState,
    APIEmptySVG
} from '@universo/template-mui'
import type { PaginationActions, PaginationState } from '@universo/template-mui'
import { useMetahubMigrationsList, useMetahubMigrationsPlan, useApplyMetahubMigrations } from '../hooks'
import { listBranchOptions } from '../../branches/api/branches'
import { getVLCString } from '../../../types'

type MigrationDisplayRow = {
    id: string
    name: string
    fromVersion: number
    toVersion: number
    schemaDisplay: string
    templateDisplay: string
    appliedAtText: string
    appliedAtTs: number
    kind: string | null
}

const MetahubMigrations = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])

    const [branchId, setBranchId] = useState<string | undefined>(undefined)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    const { data: branchesResponse } = useQuery({
        queryKey: ['metahub-branches', 'options', 'migrations', metahubId],
        queryFn: () => listBranchOptions(metahubId ?? '', { sortBy: 'name', sortOrder: 'asc' }),
        enabled: Boolean(metahubId)
    })

    const branches = useMemo(() => branchesResponse?.items ?? [], [branchesResponse?.items])

    const effectiveBranchId = useMemo(
        () => branchId ?? branchesResponse?.meta?.activeBranchId ?? branchesResponse?.meta?.defaultBranchId ?? branches[0]?.id,
        [branchId, branchesResponse?.meta?.activeBranchId, branchesResponse?.meta?.defaultBranchId, branches]
    )

    const offset = (currentPage - 1) * pageSize

    const migrationsQuery = useMetahubMigrationsList(metahubId ?? '', {
        branchId: effectiveBranchId,
        limit: pageSize,
        offset,
        enabled: Boolean(metahubId && effectiveBranchId)
    })

    const planQuery = useMetahubMigrationsPlan(metahubId ?? '', {
        branchId: effectiveBranchId,
        enabled: Boolean(metahubId && effectiveBranchId)
    })

    const applyMutation = useApplyMetahubMigrations()

    const totalItems = migrationsQuery.data?.total ?? 0
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

    useEffect(() => {
        if (totalPages === 0) {
            if (currentPage !== 1) {
                setCurrentPage(1)
            }
            return
        }

        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const pagination: PaginationState = useMemo(
        () => ({
            currentPage,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: totalPages > 0 ? currentPage < totalPages : false,
            hasPreviousPage: currentPage > 1,
            search: ''
        }),
        [currentPage, pageSize, totalItems, totalPages]
    )

    const paginationActions: PaginationActions = useMemo(
        () => ({
            goToPage: (page: number) => {
                if (totalPages === 0) {
                    setCurrentPage(1)
                    return
                }
                const safePage = Math.max(1, Math.min(page, totalPages))
                setCurrentPage(safePage)
            },
            nextPage: () => {
                if (totalPages === 0) return
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            },
            previousPage: () => {
                setCurrentPage((prev) => Math.max(prev - 1, 1))
            },
            setSearch: () => undefined,
            setSort: () => undefined,
            setPageSize: (nextSize: number) => {
                const safeSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 20
                setPageSize(safeSize)
                setCurrentPage(1)
            }
        }),
        [totalPages]
    )

    const rows = useMemo<MigrationDisplayRow[]>(() => {
        return (migrationsQuery.data?.items ?? []).map((item) => {
            const appliedAt = new Date(item.appliedAt)
            const meta = item.meta as Record<string, unknown> | undefined
            const kind = typeof meta?.kind === 'string' ? meta.kind : null

            // Schema column: for baseline show "0 → N" (from nothing), otherwise "N → M"
            const schemaFrom = kind === 'baseline' ? 0 : item.fromVersion
            const schemaDisplay = `${schemaFrom} → ${item.toVersion}`

            // Template column: for baseline/template_seed show "0/— → version", otherwise "—"
            let templateDisplay = '—'
            if ((kind === 'baseline' || kind === 'template_seed') && typeof meta?.templateVersionLabel === 'string') {
                const fromLabel = kind === 'baseline' ? '0' : '—'
                templateDisplay = `${fromLabel} → ${meta.templateVersionLabel}`
            }

            return {
                id: item.id,
                name: item.name,
                fromVersion: item.fromVersion,
                toVersion: item.toVersion,
                schemaDisplay,
                templateDisplay,
                appliedAtText: appliedAt.toLocaleString(i18n.language),
                appliedAtTs: appliedAt.getTime(),
                kind
            }
        })
    }, [migrationsQuery.data?.items, i18n.language])

    const migrationColumns = useMemo(
        () => [
            {
                id: 'appliedAt',
                label: t('metahubs:migrations.columns.appliedAt', 'Applied at'),
                width: '24%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MigrationDisplayRow) => row.appliedAtTs,
                render: (row: MigrationDisplayRow) => <Typography sx={{ fontSize: 14 }}>{row.appliedAtText}</Typography>
            },
            {
                id: 'name',
                label: t('metahubs:migrations.columns.name', 'Name'),
                width: '48%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MigrationDisplayRow) => row.name.toLowerCase(),
                render: (row: MigrationDisplayRow) => (
                    <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{row.name}</Typography>
                        {row.kind === 'baseline' ? (
                            <Chip size='small' variant='outlined' label={t('metahubs:migrations.baselineLabel', 'Baseline')} />
                        ) : null}
                    </Stack>
                )
            },
            {
                id: 'schema',
                label: t('metahubs:migrations.columns.schema', 'Schema'),
                width: '14%',
                align: 'center' as const,
                render: (row: MigrationDisplayRow) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, fontFamily: 'monospace' }}>{row.schemaDisplay}</Typography>
                )
            },
            {
                id: 'template',
                label: t('metahubs:migrations.columns.template', 'Template'),
                width: '14%',
                align: 'center' as const,
                render: (row: MigrationDisplayRow) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, fontFamily: 'monospace' }}>{row.templateDisplay}</Typography>
                )
            }
        ],
        [t]
    )

    const isBusy = applyMutation.isPending
    const isLoading = migrationsQuery.isLoading || planQuery.isLoading
    const hasPendingMigrations = Boolean(planQuery.data?.structureUpgradeRequired || planQuery.data?.templateUpgradeRequired)

    const handleApply = useCallback(
        (dryRun = false) => {
            if (!metahubId || !effectiveBranchId) return
            applyMutation.mutate({ metahubId, branchId: effectiveBranchId, dryRun, cleanupMode: 'confirm' })
        },
        [applyMutation, effectiveBranchId, metahubId]
    )

    if (!metahubId) {
        return <Alert severity='error'>{t('metahubs:migrations.metahubRequired', 'Metahub ID is required')}</Alert>
    }

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <Stack flexDirection='column' sx={{ gap: 1 }}>
                <ViewHeader title={t('metahubs:migrations.title', 'Migrations')} />

                <Stack sx={{ pb: 2 }} spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                        <FormControl size='small' sx={{ minWidth: 320 }}>
                            <InputLabel>{t('metahubs:migrations.branchLabel', 'Branch')}</InputLabel>
                            <Select
                                value={effectiveBranchId ?? ''}
                                label={t('metahubs:migrations.branchLabel', 'Branch')}
                                onChange={(event) => {
                                    setBranchId(event.target.value || undefined)
                                    setCurrentPage(1)
                                }}
                            >
                                {branches.map((item) => (
                                    <MenuItem key={item.id} value={item.id}>
                                        {`${getVLCString(item.name, i18n.language) || item.codename} (${item.codename})`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Stack direction='row' spacing={1}>
                            <Button variant='outlined' disabled={!effectiveBranchId || isBusy} onClick={() => handleApply(true)}>
                                {t('metahubs:migrations.dryRun', 'Dry run')}
                            </Button>
                            <Button
                                variant='contained'
                                disabled={!effectiveBranchId || isBusy || !hasPendingMigrations}
                                onClick={() => handleApply(false)}
                                startIcon={isBusy ? <CircularProgress size={14} color='inherit' /> : undefined}
                            >
                                {isBusy
                                    ? t('metahubs:migrations.applying', 'Applying...')
                                    : t('metahubs:migrations.apply', 'Apply migrations')}
                            </Button>
                        </Stack>
                    </Stack>

                    {isLoading ? (
                        <Stack direction='row' spacing={1} alignItems='center'>
                            <CircularProgress size={18} />
                            <Typography variant='body2'>{t('metahubs:migrations.loading', 'Loading migration state...')}</Typography>
                        </Stack>
                    ) : null}

                    {planQuery.error ? <Alert severity='error'>{(planQuery.error as Error).message}</Alert> : null}
                    {migrationsQuery.error ? <Alert severity='error'>{(migrationsQuery.error as Error).message}</Alert> : null}
                    {applyMutation.error ? <Alert severity='error'>{(applyMutation.error as Error).message}</Alert> : null}

                    {planQuery.data ? (
                        <Stack spacing={1}>
                            <Typography variant='subtitle2'>{t('metahubs:migrations.planTitle', 'Migration plan')}</Typography>
                            <Stack direction='row' spacing={1} flexWrap='wrap'>
                                <Chip
                                    size='small'
                                    color={planQuery.data.structureUpgradeRequired ? 'warning' : 'success'}
                                    label={
                                        planQuery.data.structureUpgradeRequired
                                            ? t('metahubs:migrations.structureUpgradeNeeded', 'Structure upgrade required')
                                            : t('metahubs:migrations.structureUpToDate', 'Structure up to date')
                                    }
                                />
                                <Chip
                                    size='small'
                                    color={planQuery.data.templateUpgradeRequired ? 'warning' : 'success'}
                                    label={
                                        planQuery.data.templateUpgradeRequired
                                            ? t('metahubs:migrations.templateUpgradeNeeded', 'Template upgrade required')
                                            : t('metahubs:migrations.templateUpToDate', 'Template up to date')
                                    }
                                />
                            </Stack>
                        </Stack>
                    ) : null}

                    {!isLoading && totalItems === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No migrations'
                            title={t('metahubs:migrations.empty', 'No migrations found for selected branch')}
                        />
                    ) : (
                        <>
                            <Box sx={{ mx: { xs: -2, md: -2 } }}>
                                <FlowListTable<MigrationDisplayRow>
                                    data={rows}
                                    images={{}}
                                    isLoading={migrationsQuery.isLoading}
                                    customColumns={migrationColumns}
                                    i18nNamespace='flowList'
                                />
                            </Box>

                            {totalItems > 0 ? (
                                <Box sx={{ mx: { xs: -2, md: -2 }, mt: 2 }}>
                                    <PaginationControls
                                        pagination={pagination}
                                        actions={paginationActions}
                                        isLoading={migrationsQuery.isLoading}
                                        rowsPerPageOptions={[10, 20, 50, 100]}
                                        namespace='common'
                                    />
                                </Box>
                            ) : null}
                        </>
                    )}
                </Stack>
            </Stack>
        </MainCard>
    )
}

export default MetahubMigrations
