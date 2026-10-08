import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    CircularProgress,
    ListItemText,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { DropdownAutocomplete as Autocomplete } from '@universo-react/template-mui/dropdowns'
import type { MarketingWidgetBindingDialogViewModel } from './useMarketingWidgetBindingDialog'

export default function MarketingWidgetBindingSlots({ model }: { model: MarketingWidgetBindingDialogViewModel }) {
    const {
        dialog: { open, canManageLayouts, canEditContent },
        state: { saveError, attemptedSubmit, draftBindings, recordFormMode, recordFormError, isRecordSaving, isRecordResolving },
        queries: { bindingQuery, sourcesQuery, recordsQuery, hubsQuery, objectsQuery, pagesQuery, componentsQuery },
        data: {
            isInitialBindingLoading,
            isBindingReady,
            placementId,
            slots,
            missingRequiredSlots,
            activeSlot,
            activeDraft,
            sourceOptions,
            recordOptions,
            activeSourceOption,
            activeRecordOption,
            incompatibleRelationSlot,
            sourceEntity,
            shouldLoadRecordMetadata,
            recordFields,
            hasUnsupportedRequiredFields
        },
        actions: {
            setActiveSlotKey,
            slotLabel,
            updateDraft,
            handleSourceChange,
            openSourceProvision,
            handleRecordChange,
            openCreateRecord,
            openEditRecord,
            setSourceSearchValue,
            setRecordSearchValue
        },
        refs: { autocompleteRefs },
        t
    } = model

    return (
        <Stack spacing={2} sx={{ minWidth: 0, pt: 0.5 }}>
            {!canManageLayouts ? (
                <Alert severity='info'>
                    {t('layouts.widgetBindings.managePermissionRequired', {
                        defaultValue: 'Changing content sources or bindings requires permission to manage this Metahub.'
                    })}
                </Alert>
            ) : null}
            {bindingQuery.isError ? (
                <Alert
                    severity='error'
                    action={
                        <Button color='inherit' size='small' onClick={() => void bindingQuery.refetch()}>
                            {t('actions.retry', { defaultValue: 'Retry' })}
                        </Button>
                    }
                >
                    {t('layouts.widgetBindings.loadError', { defaultValue: 'Content bindings could not be loaded. Try again.' })}
                </Alert>
            ) : null}
            {saveError ? (
                <Alert severity='error'>
                    {t('layouts.widgetBindings.saveError', { defaultValue: 'Content bindings could not be saved. Try again.' })}
                </Alert>
            ) : null}
            {recordFormError && !recordFormMode ? <Alert severity='error'>{recordFormError}</Alert> : null}
            {isInitialBindingLoading || (open && Boolean(placementId) && bindingQuery.isFetching && !bindingQuery.data) ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} aria-label={t('common.loading', { defaultValue: 'Loading' })} />
                </Box>
            ) : null}
            {slots.length === 0 ? (
                <Alert severity='info'>
                    {t('layouts.widgetBindings.noSlots', {
                        defaultValue: 'This widget has no Entity content bindings to configure.'
                    })}
                </Alert>
            ) : null}
            {missingRequiredSlots.length > 0 && isBindingReady ? (
                <Alert severity='info'>
                    {t('layouts.widgetBindings.requiredSelection', {
                        defaultValue: 'Choose a content source for each required section before saving.'
                    })}
                </Alert>
            ) : null}
            {slots.map((slot) => {
                const draft = draftBindings[slot.key]
                const isActive = slot.key === activeSlot?.key
                const canClear = Boolean(draft) && slot.cardinality.min === 0
                const slotIsRelationBlocked = Boolean(slot.relation && !draftBindings[slot.relation.parentSlot])
                const summary =
                    draft?.selectionLabel ?? draft?.sourceName ?? t('layouts.widgetBindings.notSelected', { defaultValue: 'Not selected' })

                return (
                    <Accordion
                        key={slot.key}
                        expanded={isActive}
                        onChange={(_event, expanded) => {
                            if (expanded) setActiveSlotKey(slot.key)
                            else setActiveSlotKey('')
                        }}
                        disableGutters
                        elevation={0}
                        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`binding-${slot.key}-content`}>
                            <ListItemText
                                primary={slotLabel(slot.key)}
                                secondary={summary}
                                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                                sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                            />
                        </AccordionSummary>
                        <AccordionDetails id={`binding-${slot.key}-content`}>
                            <Stack spacing={2}>
                                {slot.relation ? (
                                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                        {t('layouts.widgetBindings.relationHelper', {
                                            parent: slotLabel(slot.relation.parentSlot),
                                            child: slotLabel(slot.key),
                                            defaultValue: '{{child}} content is related to each selected {{parent}} item.'
                                        })}
                                    </Typography>
                                ) : null}
                                {incompatibleRelationSlot?.key === slot.key ? (
                                    <Alert severity='error'>
                                        {t('layouts.widgetBindings.relationSourceIncompatible', {
                                            defaultValue:
                                                'This source contains records linked to a different parent. Choose a compatible source to continue.'
                                        })}
                                    </Alert>
                                ) : null}
                                {slotIsRelationBlocked ? (
                                    <Alert severity='info'>
                                        {t('layouts.widgetBindings.chooseRelationParent', {
                                            parent: slot.relation ? slotLabel(slot.relation.parentSlot) : '',
                                            child: slotLabel(slot.key),
                                            defaultValue: 'Choose {{parent}} before configuring {{child}}.'
                                        })}
                                    </Alert>
                                ) : null}
                                {isActive && sourcesQuery.isError ? (
                                    <Alert
                                        severity='error'
                                        action={
                                            <Button color='inherit' size='small' onClick={() => void sourcesQuery.refetch()}>
                                                {t('actions.retry', { defaultValue: 'Retry' })}
                                            </Button>
                                        }
                                    >
                                        {t('layouts.widgetBindings.sourcesError', {
                                            defaultValue: 'Compatible content sources could not be loaded.'
                                        })}
                                    </Alert>
                                ) : null}
                                {isActive && sourcesQuery.isSuccess && sourceOptions.length === 0 ? (
                                    <Alert severity='info'>
                                        {t('layouts.widgetBindings.noSources', {
                                            defaultValue: 'No compatible content sources found.'
                                        })}
                                    </Alert>
                                ) : null}
                                {activeSlot?.key === slot.key ? (
                                    <>
                                        <Autocomplete
                                            ref={(node) => {
                                                autocompleteRefs.current[`${slot.key}:source`] = node
                                            }}
                                            options={sourceOptions}
                                            value={activeSourceOption}
                                            loading={sourcesQuery.isLoading || sourcesQuery.isFetchingNextPage}
                                            onChange={(_event, option) => handleSourceChange(option)}
                                            onInputChange={(_event, value, reason) => {
                                                if (reason !== 'reset') setSourceSearchValue(value)
                                            }}
                                            filterOptions={(options) => options}
                                            isOptionEqualToValue={(option, value) => option.sourceKey === value.sourceKey}
                                            getOptionLabel={(option) => option.label}
                                            noOptionsText={t('layouts.widgetBindings.noSources', {
                                                defaultValue: 'No compatible content sources found.'
                                            })}
                                            loadingText={t('layouts.widgetBindings.loadingSources', {
                                                defaultValue: 'Loading compatible content sources…'
                                            })}
                                            disabled={
                                                !canManageLayouts ||
                                                !isBindingReady ||
                                                bindingQuery.isError ||
                                                slotIsRelationBlocked ||
                                                sourcesQuery.isError
                                            }
                                            renderOption={(props, option) => (
                                                <li {...props} key={option.sourceKey}>
                                                    <ListItemText primary={option.label} />
                                                </li>
                                            )}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    required={slot.cardinality.min > 0}
                                                    label={t('layouts.widgetBindings.sourceLabel', {
                                                        defaultValue: 'Content source'
                                                    })}
                                                    placeholder={t('layouts.widgetBindings.sourcePlaceholder', {
                                                        defaultValue: 'Search compatible sources'
                                                    })}
                                                    helperText={
                                                        attemptedSubmit && !draft && slot.cardinality.min > 0
                                                            ? t('layouts.widgetBindings.requiredSourceError', {
                                                                  defaultValue: 'Choose a content source to continue.'
                                                              })
                                                            : incompatibleRelationSlot?.key === slot.key
                                                            ? t('layouts.widgetBindings.relationSourceIncompatible', {
                                                                  defaultValue:
                                                                      'This source contains records linked to a different parent. Choose a compatible source to continue.'
                                                              })
                                                            : t('layouts.widgetBindings.sourceHelperText', {
                                                                  defaultValue:
                                                                      'Choose the Entity that contains the content shown by this widget.'
                                                              })
                                                    }
                                                    error={
                                                        (attemptedSubmit && !draft && slot.cardinality.min > 0) ||
                                                        incompatibleRelationSlot?.key === slot.key
                                                    }
                                                />
                                            )}
                                        />
                                        {activeDraft?.sourceKey ? (
                                            <Button
                                                variant='outlined'
                                                onClick={openSourceProvision}
                                                disabled={
                                                    !canManageLayouts ||
                                                    !isBindingReady ||
                                                    sourcesQuery.isError ||
                                                    Boolean(incompatibleRelationSlot)
                                                }
                                                sx={{ alignSelf: 'flex-start' }}
                                            >
                                                {t('layouts.widgetBindings.createSeparateSource', {
                                                    defaultValue: 'Create a separate content source'
                                                })}
                                            </Button>
                                        ) : null}
                                        {sourcesQuery.hasNextPage ? (
                                            <Button
                                                variant='text'
                                                onClick={() => void sourcesQuery.fetchNextPage()}
                                                disabled={sourcesQuery.isFetchingNextPage}
                                            >
                                                {sourcesQuery.isFetchingNextPage
                                                    ? t('layouts.widgetBindings.loadingMore', {
                                                          defaultValue: 'Loading more sources…'
                                                      })
                                                    : t('layouts.widgetBindings.loadMore', { defaultValue: 'Load more sources' })}
                                            </Button>
                                        ) : sourcesQuery.data?.pages.some(({ truncated }) => truncated) ? (
                                            <Alert severity='warning'>
                                                {t('layouts.widgetBindings.resultsTruncated', {
                                                    defaultValue: 'Some results are not available.'
                                                })}
                                            </Alert>
                                        ) : null}
                                        {activeDraft?.selectorKind === 'semantic-key' ? (
                                            <>
                                                {!canEditContent ? (
                                                    <Alert severity='info'>
                                                        {t('layouts.widgetBindings.recordPermissionRequired', {
                                                            defaultValue: 'Editing Entity records requires content editing permission.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                {recordsQuery.isError ? (
                                                    <Alert
                                                        severity='error'
                                                        action={
                                                            <Button
                                                                color='inherit'
                                                                size='small'
                                                                onClick={() => void recordsQuery.refetch()}
                                                            >
                                                                {t('actions.retry', { defaultValue: 'Retry' })}
                                                            </Button>
                                                        }
                                                    >
                                                        {t('layouts.widgetBindings.recordsError', {
                                                            defaultValue: 'Content records could not be loaded.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                {recordsQuery.isSuccess && recordOptions.length === 0 ? (
                                                    <Alert severity='info'>
                                                        {t(slot.authoring.emptyOptionsKey, {
                                                            defaultValue: slot.authoring.defaultEmptyOptions
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                <Autocomplete
                                                    ref={(node) => {
                                                        autocompleteRefs.current[`${slot.key}:record`] = node
                                                    }}
                                                    options={recordOptions}
                                                    value={activeRecordOption}
                                                    loading={recordsQuery.isLoading || recordsQuery.isFetchingNextPage}
                                                    onChange={(_event, option) => handleRecordChange(option)}
                                                    onInputChange={(_event, value, reason) => {
                                                        if (reason !== 'reset') setRecordSearchValue(value)
                                                    }}
                                                    filterOptions={(options) => options}
                                                    isOptionEqualToValue={(option, value) => option.semanticKey === value.semanticKey}
                                                    getOptionLabel={(option) => option.label}
                                                    noOptionsText={t(slot.authoring.emptyOptionsKey, {
                                                        defaultValue: slot.authoring.defaultEmptyOptions
                                                    })}
                                                    loadingText={t(slot.authoring.loadingOptionsKey, {
                                                        defaultValue: slot.authoring.defaultLoadingOptions
                                                    })}
                                                    disabled={!canManageLayouts || !isBindingReady || recordsQuery.isError}
                                                    renderOption={(props, option) => (
                                                        <li {...props} key={option.semanticKey}>
                                                            <ListItemText primary={option.label} />
                                                        </li>
                                                    )}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            required={slot.cardinality.min > 0}
                                                            label={t('layouts.widgetBindings.recordLabel', {
                                                                defaultValue: 'Content record'
                                                            })}
                                                            placeholder={t(slot.authoring.placeholderKey, {
                                                                defaultValue: slot.authoring.defaultPlaceholder
                                                            })}
                                                            helperText={
                                                                attemptedSubmit && !activeDraft.semanticKey
                                                                    ? t('layouts.widgetBindings.requiredRecordError', {
                                                                          defaultValue: 'Choose a content record to continue.'
                                                                      })
                                                                    : t(slot.authoring.helperTextKey, {
                                                                          defaultValue: slot.authoring.defaultHelperText
                                                                      })
                                                            }
                                                            error={attemptedSubmit && !activeDraft.semanticKey}
                                                        />
                                                    )}
                                                />
                                                {recordsQuery.hasNextPage ? (
                                                    <Button
                                                        variant='text'
                                                        onClick={() => void recordsQuery.fetchNextPage()}
                                                        disabled={recordsQuery.isFetchingNextPage}
                                                    >
                                                        {recordsQuery.isFetchingNextPage
                                                            ? t('layouts.widgetBindings.loadingMoreRecords', {
                                                                  defaultValue: 'Loading more records…'
                                                              })
                                                            : t('layouts.widgetBindings.loadMoreRecords', {
                                                                  defaultValue: 'Load more records'
                                                              })}
                                                    </Button>
                                                ) : recordsQuery.data?.pages.some(({ truncated }) => truncated) ? (
                                                    <Alert severity='warning'>
                                                        {t('layouts.widgetBindings.resultsTruncated', {
                                                            defaultValue: 'Some results are not available.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                {hasUnsupportedRequiredFields ? (
                                                    <Alert severity='warning'>
                                                        {t('layouts.widgetBindings.unsupportedRequiredFields', {
                                                            defaultValue:
                                                                'This Entity has required field types this form cannot create. Use the Entity Records view to add records; existing values will be preserved when edited here.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                {shouldLoadRecordMetadata &&
                                                sourceEntity &&
                                                componentsQuery.isSuccess &&
                                                !componentsQuery.isFetching &&
                                                recordFields.length === 0 &&
                                                !hasUnsupportedRequiredFields ? (
                                                    <Alert severity='info'>
                                                        {t('layouts.widgetBindings.recordFieldsEmpty', {
                                                            defaultValue: 'This content source has no editable fields.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                                    <Button
                                                        variant='outlined'
                                                        onClick={openCreateRecord}
                                                        disabled={
                                                            !canEditContent ||
                                                            !sourceEntity ||
                                                            componentsQuery.isLoading ||
                                                            componentsQuery.isError ||
                                                            hasUnsupportedRequiredFields ||
                                                            recordFields.length === 0 ||
                                                            isRecordSaving
                                                        }
                                                    >
                                                        {t('layouts.widgetBindings.createRecord', {
                                                            defaultValue: 'Create content record'
                                                        })}
                                                    </Button>
                                                    <Button
                                                        variant='outlined'
                                                        onClick={() => void openEditRecord()}
                                                        disabled={
                                                            !canEditContent ||
                                                            !activeDraft.semanticKey ||
                                                            !sourceEntity ||
                                                            componentsQuery.isLoading ||
                                                            componentsQuery.isError ||
                                                            recordFields.length === 0 ||
                                                            isRecordResolving ||
                                                            isRecordSaving
                                                        }
                                                    >
                                                        {isRecordResolving
                                                            ? t('layouts.widgetBindings.loadingRecord', {
                                                                  defaultValue: 'Loading record…'
                                                              })
                                                            : t('layouts.widgetBindings.editRecord', {
                                                                  defaultValue: 'Edit selected record'
                                                              })}
                                                    </Button>
                                                </Stack>
                                                {shouldLoadRecordMetadata &&
                                                (hubsQuery.isLoading ||
                                                    objectsQuery.isLoading ||
                                                    pagesQuery.isLoading ||
                                                    componentsQuery.isLoading) ? (
                                                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                        {t('layouts.widgetBindings.loadingRecordFields', {
                                                            defaultValue: 'Loading content fields…'
                                                        })}
                                                    </Typography>
                                                ) : null}
                                                {shouldLoadRecordMetadata &&
                                                (hubsQuery.isError ||
                                                    objectsQuery.isError ||
                                                    pagesQuery.isError ||
                                                    componentsQuery.isError) ? (
                                                    <Alert
                                                        severity='error'
                                                        action={
                                                            <Button
                                                                color='inherit'
                                                                size='small'
                                                                onClick={() => {
                                                                    if (objectsQuery.isError) void objectsQuery.refetch()
                                                                    if (pagesQuery.isError) void pagesQuery.refetch()
                                                                    if (componentsQuery.isError) void componentsQuery.refetch()
                                                                }}
                                                            >
                                                                {t('actions.retry', { defaultValue: 'Retry' })}
                                                            </Button>
                                                        }
                                                    >
                                                        {t('layouts.widgetBindings.recordFieldsError', {
                                                            defaultValue: 'Content fields could not be loaded. Try again.'
                                                        })}
                                                    </Alert>
                                                ) : null}
                                            </>
                                        ) : null}
                                        {canClear ? (
                                            <Button
                                                variant='text'
                                                onClick={() => updateDraft(slot.key, undefined)}
                                                disabled={!canManageLayouts}
                                            >
                                                {t('actions.remove', { defaultValue: 'Remove' })}
                                            </Button>
                                        ) : null}
                                    </>
                                ) : null}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                )
            })}
        </Stack>
    )
}
