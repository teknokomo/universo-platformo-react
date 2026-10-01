import { Alert, Button, Stack, TextField, Typography } from '@mui/material'
import { useConfirm } from '@universo-react/template-mui'
import { DynamicEntityFormDialog, StandardDialog } from '@universo-react/template-mui/components/dialogs'
import MarketingActionField from '../../entities/metadata/record/ui/fields/MarketingActionField'
import type { MarketingWidgetBindingDialogViewModel } from './useMarketingWidgetBindingDialog'
import MarketingWidgetBindingSlots from './MarketingWidgetBindingSlots'

export default function MarketingWidgetBindingDialogView({ model }: { model: MarketingWidgetBindingDialogViewModel }) {
    const {
        dialog: { open, widgetId, canManageLayouts, onClose, onConfigurePresentation, rawLocale, sectionTargets },
        state: {
            recordFormMode,
            recordFormInitialData,
            recordFormError,
            recordFieldError,
            isRecordSaving,
            isCreatingSelection,
            sourceProvisionOpen,
            sourceProvisionName,
            sourceProvisionError,
            draftBindings
        },
        queries: { bindingQuery, updateMutation, sourceProvisionMutation },
        data: { title, isBusy, canSubmit, isDirty, canCreatePlacement, isBindingReady, recordFields, placementId },
        actions: {
            handleConfigurePresentation,
            handleSave,
            handleCreateSelection,
            closeSourceProvision,
            closeRecordForm,
            saveRecordForm,
            setRecordFieldError,
            openEditRecord,
            setSourceProvisionName,
            setSourceProvisionError
        },
        refs: { sourceProvisionNameInputRef },
        t
    } = model
    const { confirm } = useConfirm()
    const hasUncommittedCreateBinding = !widgetId && !placementId && Object.keys(draftBindings).length > 0
    const hasUnsavedBindingChanges = isDirty || hasUncommittedCreateBinding
    const handleBindingDialogClose = () => {
        if (isBusy) return
        if (!hasUnsavedBindingChanges) {
            onClose()
            return
        }

        void confirm({
            title: t('unsavedChanges.title', { defaultValue: 'Discard unsaved changes?' }),
            description: t('unsavedChanges.description', { defaultValue: 'Your unsaved changes will be lost.' }),
            confirmButtonName: t('unsavedChanges.confirm', { defaultValue: 'Discard' }),
            cancelButtonName: t('unsavedChanges.cancel', { defaultValue: 'Keep editing' })
        }).then((discard) => {
            if (discard) onClose()
        })
    }
    const handleSourceProvisionClose = () => {
        if (sourceProvisionMutation.isPending) return
        if (!sourceProvisionName) {
            closeSourceProvision()
            return
        }

        void confirm({
            title: t('unsavedChanges.title', { defaultValue: 'Discard unsaved changes?' }),
            description: t('unsavedChanges.description', { defaultValue: 'Your unsaved changes will be lost.' }),
            confirmButtonName: t('unsavedChanges.confirm', { defaultValue: 'Discard' }),
            cancelButtonName: t('unsavedChanges.cancel', { defaultValue: 'Keep editing' })
        }).then((discard) => {
            if (discard) closeSourceProvision()
        })
    }

    return (
        <>
            <StandardDialog
                open={open && !recordFormMode}
                onClose={handleBindingDialogClose}
                title={title}
                maxWidth='md'
                isBusy={isBusy}
                actions={
                    <>
                        <Button onClick={handleBindingDialogClose} disabled={isBusy}>
                            {t('actions.cancel', { defaultValue: 'Cancel' })}
                        </Button>
                        {widgetId ? (
                            <>
                                {onConfigurePresentation ? (
                                    <Button
                                        variant='outlined'
                                        onClick={handleConfigurePresentation}
                                        disabled={
                                            !canManageLayouts ||
                                            !isBindingReady ||
                                            bindingQuery.isError ||
                                            isDirty ||
                                            updateMutation.isPending
                                        }
                                    >
                                        {t('layouts.marketing.widget.configurePresentation', { defaultValue: 'Appearance' })}
                                    </Button>
                                ) : null}
                                <Button variant='contained' onClick={handleSave} disabled={!canSubmit || !isDirty}>
                                    {updateMutation.isPending
                                        ? t('actions.saving', { defaultValue: 'Saving…' })
                                        : t('actions.save', { defaultValue: 'Save' })}
                                </Button>
                            </>
                        ) : (
                            <Button variant='contained' onClick={() => void handleCreateSelection()} disabled={!canCreatePlacement}>
                                {isCreatingSelection
                                    ? t('actions.saving', { defaultValue: 'Saving…' })
                                    : t('actions.add', { defaultValue: 'Add' })}
                            </Button>
                        )}
                    </>
                }
            >
                {!recordFormMode && recordFormError ? (
                    <Alert
                        severity='error'
                        action={
                            <Button color='inherit' size='small' onClick={() => void openEditRecord()} disabled={isBusy}>
                                {t('layouts.widgetBindings.retryOpenRecord', { defaultValue: 'Retry' })}
                            </Button>
                        }
                    >
                        {recordFormError}
                    </Alert>
                ) : null}
                <MarketingWidgetBindingSlots model={model} />
            </StandardDialog>
            <DynamicEntityFormDialog
                open={open && Boolean(recordFormMode)}
                onClose={closeRecordForm}
                onSubmit={saveRecordForm}
                initialData={recordFormInitialData}
                fields={recordFields}
                i18nNamespace='metahubs'
                locale={rawLocale}
                isSubmitting={isRecordSaving}
                error={recordFormError}
                fieldValidationError={recordFieldError}
                onFieldErrorClear={() => setRecordFieldError(null)}
                title={t(
                    recordFormMode === 'edit' ? 'layouts.widgetBindings.editRecordTitle' : 'layouts.widgetBindings.createRecordTitle',
                    { defaultValue: recordFormMode === 'edit' ? 'Edit content record' : 'Create content record' }
                )}
                requireAnyValue
                emptyStateText={t('layouts.widgetBindings.recordFieldsEmpty', {
                    defaultValue: 'No editable content fields are available.'
                })}
                saveButtonText={t('actions.save', { defaultValue: 'Save' })}
                savingButtonText={t('actions.saving', { defaultValue: 'Saving…' })}
                cancelButtonText={t('actions.cancel', { defaultValue: 'Cancel' })}
                renderField={({ field, value, onChange, disabled, error, helperText }) =>
                    field.validationRules?.format === 'marketingAction' ? (
                        <MarketingActionField
                            field={field}
                            value={value}
                            onChange={onChange}
                            disabled={disabled}
                            error={error}
                            helperText={helperText}
                            sectionTargets={sectionTargets}
                            sectionTargetsState='ready'
                        />
                    ) : undefined
                }
            />
            <StandardDialog
                open={sourceProvisionOpen}
                onClose={handleSourceProvisionClose}
                title={t('layouts.widgetBindings.createSourceTitle', { defaultValue: 'Create a separate content source' })}
                maxWidth='sm'
                isBusy={sourceProvisionMutation.isPending}
                actions={
                    <>
                        <Button onClick={handleSourceProvisionClose} disabled={sourceProvisionMutation.isPending}>
                            {t('actions.cancel', { defaultValue: 'Cancel' })}
                        </Button>
                        <Button
                            variant='contained'
                            onClick={() => void sourceProvisionMutation.mutateAsync(sourceProvisionName)}
                            disabled={!canManageLayouts || !sourceProvisionName.trim() || sourceProvisionMutation.isPending}
                        >
                            {sourceProvisionMutation.isPending
                                ? t('actions.saving', { defaultValue: 'Saving…' })
                                : t('actions.create', { defaultValue: 'Create' })}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2} sx={{ pt: 0.5 }}>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t('layouts.widgetBindings.createSourceDescription', {
                            defaultValue:
                                'A new Entity model with the same content fields will be created. Existing records will not be copied.'
                        })}
                    </Typography>
                    {sourceProvisionError ? (
                        <Alert severity='error'>
                            {t('layouts.widgetBindings.createSourceError', {
                                defaultValue: 'The content source could not be created. Review the name and try again.'
                            })}
                        </Alert>
                    ) : null}
                    <TextField
                        inputRef={sourceProvisionNameInputRef}
                        required
                        fullWidth
                        label={t('layouts.widgetBindings.createSourceName', { defaultValue: 'Content source name' })}
                        value={sourceProvisionName}
                        slotProps={{ htmlInput: { maxLength: 128 } }}
                        onChange={(event) => {
                            setSourceProvisionName(event.target.value)
                            setSourceProvisionError(false)
                        }}
                        error={sourceProvisionError && !sourceProvisionName.trim()}
                        helperText={t('layouts.widgetBindings.createSourceNameHelp', {
                            defaultValue: 'Use a clear name that helps your team choose this model later.'
                        })}
                    />
                </Stack>
            </StandardDialog>
        </>
    )
}
