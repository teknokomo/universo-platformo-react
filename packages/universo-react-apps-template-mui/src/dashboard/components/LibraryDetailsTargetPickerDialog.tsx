import { useId, type ReactNode } from 'react'
import { type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AppDataResponse } from '../../api/api'
import { StandardDialog } from '../../components/dialogs'
import { PaginationControls } from '../../components/runtime-ui'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { formatTargetOptionLabel, PICKER_PAGE_SIZE, type TargetPickerConfig } from './libraryDetailsTableUtils'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'

interface LibraryDetailsTargetPickerDialogProps {
    open: boolean
    config: TargetPickerConfig | undefined
    title: string
    label: string
    help: string
    submitLabel: string
    submitIcon: ReactNode
    query: UseQueryResult<AppDataResponse, Error>
    selectedId: string
    onSelectedIdChange: (value: string) => void
    onClose: () => void
    onSubmit: () => void
    pending: boolean
    mutationError: unknown
    queryErrorFallback: string
    mutationErrorFallback: string
    pageOffset: number
    onPageOffsetChange: (offset: number) => void
    untitledFallback: string
}

/** Shared target selector for move and restore actions. */
export default function LibraryDetailsTargetPickerDialog({
    open,
    config,
    title,
    label,
    help,
    submitLabel,
    submitIcon,
    query,
    selectedId,
    onSelectedIdChange,
    onClose,
    onSubmit,
    pending,
    mutationError,
    queryErrorFallback,
    mutationErrorFallback,
    pageOffset,
    onPageOffsetChange,
    untitledFallback
}: LibraryDetailsTargetPickerDialogProps) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const options = query.data?.rows ?? []
    const pickerLabelId = 'library-target-picker-' + useId().replace(/:/g, '')
    const totalItems = query.data?.pagination.total ?? options.length
    const pageSize = query.data?.pagination.limit ?? PICKER_PAGE_SIZE
    const currentPage = Math.floor(pageOffset / pageSize) + 1
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

    return (
        <StandardDialog
            open={open}
            onClose={onClose}
            title={title}
            maxWidth='xs'
            isBusy={pending}
            actions={
                <>
                    <Button type='button' onClick={onClose} disabled={pending}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={submitIcon}
                        disabled={pending || query.isFetching || !selectedId}
                        onClick={onSubmit}
                    >
                        {submitLabel}
                    </Button>
                </>
            }
        >
            <Stack spacing={1.5} sx={{ pt: 1 }}>
                {query.isFetching ? <LinearProgress /> : null}
                {query.isError ? <Alert severity='error'>{queryErrorFallback}</Alert> : null}
                {mutationError ? (
                    <Alert severity='error'>
                        {extractRuntimeErrorMessage(mutationError, mutationErrorFallback, details?.locale ?? 'en')}
                    </Alert>
                ) : null}
                <FormControl fullWidth size='small' disabled={pending || query.isFetching}>
                    <InputLabel id={pickerLabelId}>{label}</InputLabel>
                    <Select
                        labelId={pickerLabelId}
                        label={label}
                        value={selectedId}
                        onChange={(event) => onSelectedIdChange(String(event.target.value))}
                    >
                        {options.map((option) => (
                            <MenuItem key={option.id} value={option.id}>
                                {formatTargetOptionLabel(option, config, query.data?.columns, details?.locale ?? 'en', untitledFallback)}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>{help}</FormHelperText>
                </FormControl>
                {totalPages > 1 ? (
                    <PaginationControls
                        rowsPerPageOptions={[pageSize]}
                        pagination={{
                            currentPage,
                            pageSize,
                            totalItems,
                            totalPages,
                            hasNextPage: currentPage < totalPages,
                            hasPreviousPage: currentPage > 1
                        }}
                        actions={{
                            goToPage: (page) => onPageOffsetChange((page - 1) * pageSize),
                            nextPage: () => onPageOffsetChange(Math.min((totalPages - 1) * pageSize, pageOffset + pageSize)),
                            previousPage: () => onPageOffsetChange(Math.max(0, pageOffset - pageSize)),
                            setPageSize: () => undefined,
                            setSearch: () => undefined,
                            setSort: () => undefined
                        }}
                        isLoading={query.isFetching}
                    />
                ) : null}
            </Stack>
        </StandardDialog>
    )
}
