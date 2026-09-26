import {
    Alert,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    CircularProgress,
    ListItemText,
    Pagination,
    Stack,
    TextField,
    Typography
} from '@mui/material'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCommonTranslations } from '@universo-react/i18n'
import { getLayoutWidgetDefinition } from '@universo-react/types'
import { StandardDialog } from '@universo-react/template-mui/components/dialogs'

import MarketingHeroRecordFormDialog from './MarketingHeroRecordFormDialog'
import { useMarketingHeroBindingDialog } from './useMarketingHeroBindingDialog'
import { DropdownAutocomplete as Autocomplete } from '@universo-react/template-mui/dropdowns'

const heroBindingAuthoring = getLayoutWidgetDefinition('marketing.hero')?.bindingSlots?.find((slot) => slot.key === 'content')?.authoring

type MarketingHeroBindingDialogProps = {
    open: boolean
    metahubId: string
    layoutId: string
    widgetId: string | null
    widgetVersion: number | null
    heroObjectId: string | null
    locale: string
    canManageLayouts: boolean
    canEditContent: boolean
    initialConfig: Record<string, unknown> | null
    onClose: () => void
    onBindingSaved: () => Promise<void>
    onConfigurePresentation: (recordId: string, config: Record<string, unknown>) => void
}

export default function MarketingHeroBindingDialog({
    open,
    metahubId,
    layoutId,
    widgetId,
    widgetVersion,
    heroObjectId,
    locale: rawLocale,
    canManageLayouts,
    canEditContent,
    initialConfig,
    onClose,
    onBindingSaved,
    onConfigurePresentation
}: MarketingHeroBindingDialogProps) {
    const { t } = useCommonTranslations()
    const navigate = useNavigate()
    const [sourceName, setSourceName] = useState('')
    const [sourceCodename, setSourceCodename] = useState('')
    const [sourceProvisionError, setSourceProvisionError] = useState(false)
    const {
        locale,
        treeEntityId,
        formFields,
        actionFieldIds,
        actionSectionTargets,
        actionSectionTargetsState,
        recordFormInitialData,
        recordFieldError,
        clearRecordFieldError,
        selectedRecordId,
        recordSearch,
        recordPage,
        recordPageCount,
        setRecordPage,
        isRecordSearchActive,
        recordOptions,
        sources,
        sourcesLoading,
        sourceError,
        sharedSourceUsageCount,
        selectedSourceId,
        sharedUsageCount,
        handleSourceChange,
        handleProvisionSource,
        selectedOption,
        currentBindingId,
        isBindingDirty,
        isLoading,
        queryError,
        treeEntityMissing,
        heroEntityMissing,
        selectedRecordError,
        hasSelectedRecord,
        isSelectedRecordFetching,
        isRecordsFetching,
        hasNoRecords,
        bindingError,
        recordFormMode,
        isDirectBoundEdit,
        recordFormError,
        isSavingRecord,
        isSavingBinding,
        selectedBindingReady,
        canConfigure,
        handleRecordInputChange,
        handleRecordChange,
        openRecordForm,
        closeRecordForm,
        chooseAnotherRecord,
        handleSaveBinding,
        handleRecordSubmit,
        handleRetry,
        retrySelectedRecord
    } = useMarketingHeroBindingDialog({
        open,
        metahubId,
        layoutId,
        widgetId,
        widgetVersion,
        heroObjectId,
        locale: rawLocale,
        canManageLayouts,
        canEditContent,
        onClose,
        onBindingSaved
    })
    const title = t('layouts.marketing.heroAuthoring.title', 'Hero content')

    return (
        <>
            <StandardDialog
                open={open && !recordFormMode}
                onClose={onClose}
                title={title}
                maxWidth='md'
                isBusy={isSavingBinding}
                actions={
                    <>
                        <Button onClick={onClose} disabled={isSavingBinding}>
                            {t('actions.cancel', 'Cancel')}
                        </Button>
                        {widgetId ? (
                            <Button
                                variant='outlined'
                                onClick={() => void handleSaveBinding()}
                                disabled={!canManageLayouts || !isBindingDirty || !selectedBindingReady || isSavingBinding}
                            >
                                {isSavingBinding
                                    ? t('layouts.marketing.heroAuthoring.savingContent', 'Saving…')
                                    : t('layouts.marketing.heroAuthoring.saveContentSelection', 'Save')}
                            </Button>
                        ) : null}
                        <Button
                            variant='contained'
                            onClick={() => selectedRecordId && onConfigurePresentation(selectedRecordId, initialConfig ?? {})}
                            disabled={!canConfigure || isSavingBinding}
                        >
                            {t(
                                widgetId
                                    ? 'layouts.marketing.heroAuthoring.configurePresentation'
                                    : 'layouts.marketing.heroAuthoring.configureAndAdd',
                                widgetId ? 'Appearance' : 'Add Hero'
                            )}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2} sx={{ minWidth: 0, pt: 0.5 }}>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t(
                            'layouts.marketing.heroAuthoring.description',
                            'Choose the Entity record shown by this Hero. Entity content and presentation settings are saved separately.'
                        )}
                    </Typography>
                    {queryError || treeEntityMissing || heroEntityMissing ? (
                        <Alert
                            severity='error'
                            action={
                                queryError ? (
                                    <Button color='inherit' size='small' onClick={handleRetry}>
                                        {t('actions.retry', 'Retry')}
                                    </Button>
                                ) : undefined
                            }
                        >
                            {treeEntityMissing || heroEntityMissing
                                ? t('layouts.marketing.heroAuthoring.entityUnavailable', 'Hero content is unavailable in this metahub.')
                                : t('layouts.marketing.heroAuthoring.loadError', 'Hero content could not be loaded. Try again.')}
                        </Alert>
                    ) : null}
                    {bindingError ? <Alert severity='error'>{bindingError}</Alert> : null}
                    {selectedRecordError ? (
                        <Alert
                            severity='warning'
                            action={
                                <Button color='inherit' size='small' onClick={() => retrySelectedRecord()}>
                                    {t('actions.retry', 'Retry')}
                                </Button>
                            }
                        >
                            {t('layouts.marketing.heroAuthoring.recordDetailsError', 'The selected content details could not be loaded.')}
                        </Alert>
                    ) : null}
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : null}
                    <Autocomplete
                        options={recordOptions}
                        value={selectedOption}
                        loading={isRecordsFetching}
                        inputValue={isRecordSearchActive ? recordSearch : selectedOption?.label ?? ''}
                        onInputChange={(_event, value, reason) => handleRecordInputChange(value, reason)}
                        onChange={(_event, option) => handleRecordChange(option)}
                        filterOptions={(options) => options}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        getOptionLabel={(option) => option.label}
                        renderOption={(props, option) => (
                            <li {...props} key={option.id}>
                                <ListItemText
                                    primary={option.label}
                                    secondary={
                                        option.semanticKey
                                            ? t('layouts.marketing.heroAuthoring.recordKey', {
                                                  key: option.semanticKey,
                                                  defaultValue: 'Content key: {{key}}'
                                              })
                                            : undefined
                                    }
                                />
                            </li>
                        )}
                        noOptionsText={t(
                            heroBindingAuthoring?.emptyOptionsKey ?? 'layouts.widgetBindings.noRecords',
                            heroBindingAuthoring?.defaultEmptyOptions ?? 'No compatible content records found.'
                        )}
                        loadingText={t(
                            heroBindingAuthoring?.loadingOptionsKey ?? 'layouts.widgetBindings.loadingRecords',
                            heroBindingAuthoring?.defaultLoadingOptions ?? 'Loading content records…'
                        )}
                        disabled={!canManageLayouts || isLoading || Boolean(queryError) || treeEntityMissing || heroEntityMissing}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t(
                                    heroBindingAuthoring?.labelKey ?? 'layouts.widgetBindings.recordLabel',
                                    heroBindingAuthoring?.defaultLabel ?? 'Content record'
                                )}
                                placeholder={t(
                                    heroBindingAuthoring?.placeholderKey ?? 'layouts.widgetBindings.recordPlaceholder',
                                    heroBindingAuthoring?.defaultPlaceholder ?? 'Search by content title'
                                )}
                                helperText={t(
                                    heroBindingAuthoring?.helperTextKey ?? 'layouts.widgetBindings.recordHelperText',
                                    heroBindingAuthoring?.defaultHelperText ?? 'Choose the Entity record displayed by this widget.'
                                )}
                            />
                        )}
                    />
                    {sharedUsageCount > 0 ? (
                        <Alert severity='info'>
                            {t('layouts.marketing.heroAuthoring.sharedRecordInfo', {
                                count: sharedUsageCount,
                                defaultValue: 'This record is used by {{count}} other Hero placements. Changes will appear there too.'
                            })}
                        </Alert>
                    ) : null}
                    <Accordion disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{t('layouts.marketing.heroAuthoring.advancedSourceSettings', 'Source settings')}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={2}>
                                {sourceError ? (
                                    <Alert severity='error'>
                                        {t(
                                            'layouts.marketing.heroAuthoring.sourceLoadError',
                                            'Compatible content sources could not be loaded.'
                                        )}
                                    </Alert>
                                ) : null}
                                <Autocomplete
                                    options={sources}
                                    value={sources.find((source) => source.entityId === selectedSourceId) ?? null}
                                    loading={sourcesLoading}
                                    onChange={(_event, source) => handleSourceChange(source?.entityId ?? null)}
                                    getOptionLabel={(source) => source.name}
                                    isOptionEqualToValue={(source, value) => source.entityId === value.entityId}
                                    renderInput={(params) => (
                                        <TextField {...params} label={t('layouts.marketing.heroAuthoring.sourceLabel', 'Content source')} />
                                    )}
                                />
                                {sharedSourceUsageCount > 0 ? (
                                    <Alert severity='info'>
                                        {t('layouts.marketing.heroAuthoring.sharedSourceInfo', {
                                            count: sharedSourceUsageCount,
                                            defaultValue:
                                                'This Object source is used by {{count}} other Hero placements. Edits are shared when placements use the same content record.'
                                        })}
                                    </Alert>
                                ) : null}
                                <Button
                                    variant='outlined'
                                    disabled={!selectedSourceId}
                                    onClick={() =>
                                        selectedSourceId &&
                                        navigate(`/metahub/${metahubId}/entities/object/instance/${selectedSourceId}/components`)
                                    }
                                >
                                    {t('layouts.marketing.heroAuthoring.customizeFields', 'Customize component display names')}
                                </Button>
                                {sourceProvisionError ? (
                                    <Alert severity='error'>
                                        {t(
                                            'layouts.marketing.heroAuthoring.sourceCreateError',
                                            'The separate data source could not be created.'
                                        )}
                                    </Alert>
                                ) : null}
                                <TextField
                                    label={t('layouts.marketing.heroAuthoring.newSourceName', 'Object name')}
                                    value={sourceName}
                                    onChange={(event) => setSourceName(event.target.value)}
                                />
                                <TextField
                                    label={t('layouts.marketing.heroAuthoring.newSourceCodename', 'Object codename')}
                                    value={sourceCodename}
                                    onChange={(event) => setSourceCodename(event.target.value)}
                                    error={Boolean(sourceCodename.trim() && !/^[a-z][a-z0-9_]{1,63}$/.test(sourceCodename.trim()))}
                                    helperText={t(
                                        'layouts.marketing.heroAuthoring.sourceCodenameHelp',
                                        'Use 2–64 lowercase letters, numbers, or underscores; start with a letter.'
                                    )}
                                />
                                <Button
                                    variant='contained'
                                    disabled={
                                        !canManageLayouts ||
                                        !canEditContent ||
                                        !sourceName.trim() ||
                                        !/^[a-z][a-z0-9_]{1,63}$/.test(sourceCodename.trim())
                                    }
                                    onClick={() => {
                                        setSourceProvisionError(false)
                                        void handleProvisionSource({ codename: sourceCodename.trim(), name: sourceName.trim() })
                                            .then(() => {
                                                setSourceName('')
                                                setSourceCodename('')
                                            })
                                            .catch(() => setSourceProvisionError(true))
                                    }}
                                >
                                    {t('layouts.marketing.heroAuthoring.createSeparateSource', 'Create separate data model')}
                                </Button>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                    {recordPageCount > 1 ? (
                        <Pagination
                            aria-label={t('layouts.marketing.heroAuthoring.recordPagination', 'Hero content pages')}
                            count={recordPageCount}
                            page={recordPage + 1}
                            size='small'
                            siblingCount={0}
                            boundaryCount={1}
                            disabled={isRecordsFetching}
                            getItemAriaLabel={(type, page) =>
                                type === 'page'
                                    ? t('layouts.marketing.heroAuthoring.recordPageNumber', { page, defaultValue: `Go to page ${page}` })
                                    : type === 'next'
                                    ? t('layouts.marketing.heroAuthoring.nextRecordPage', 'Go to next page')
                                    : type === 'previous'
                                    ? t('layouts.marketing.heroAuthoring.previousRecordPage', 'Go to previous page')
                                    : t('layouts.marketing.heroAuthoring.recordPageNavigation', 'Change content page')
                            }
                            onChange={(_event, page) => setRecordPage(page - 1)}
                        />
                    ) : null}
                    {hasNoRecords ? (
                        <Alert severity='info'>
                            {t('layouts.marketing.heroAuthoring.empty', 'Create an Entity record to use as Hero content.')}
                        </Alert>
                    ) : null}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button
                            variant='outlined'
                            onClick={() => openRecordForm('create')}
                            disabled={!canEditContent || isLoading || Boolean(queryError) || !treeEntityId || !selectedSourceId}
                        >
                            {t('layouts.marketing.heroAuthoring.createContent', 'Create record')}
                        </Button>
                        <Button
                            variant='outlined'
                            onClick={() => openRecordForm('edit')}
                            disabled={!canEditContent || !hasSelectedRecord || isSelectedRecordFetching}
                        >
                            {t('layouts.marketing.heroAuthoring.editContent', 'Edit record')}
                        </Button>
                    </Stack>
                    {widgetId && currentBindingId && selectedRecordId && currentBindingId !== selectedRecordId ? (
                        <Alert severity='info'>
                            {t(
                                'layouts.marketing.heroAuthoring.unsavedBinding',
                                'Save the content selection before changing presentation settings.'
                            )}
                        </Alert>
                    ) : null}
                </Stack>
            </StandardDialog>

            <MarketingHeroRecordFormDialog
                open={open && Boolean(recordFormMode)}
                mode={recordFormMode}
                onClose={closeRecordForm}
                onSubmit={handleRecordSubmit}
                initialData={recordFormInitialData}
                fields={formFields}
                actionFieldIds={actionFieldIds}
                locale={locale}
                sectionTargets={actionSectionTargets}
                sectionTargetsState={actionSectionTargetsState}
                isSubmitting={isSavingRecord}
                error={recordFormError}
                fieldError={recordFieldError}
                sharedUsageCount={sharedUsageCount}
                onFieldErrorClear={clearRecordFieldError}
                onChooseRecord={isDirectBoundEdit && canManageLayouts ? chooseAnotherRecord : undefined}
            />
        </>
    )
}
