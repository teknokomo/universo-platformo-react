import { Alert, Button } from '@mui/material'
import { useCommonTranslations } from '@universo-react/i18n'
import { DynamicEntityFormDialog } from '@universo-react/template-mui/components/dialogs'
import type { DynamicEntityFormFieldError, DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'
import type { MarketingActionSectionTarget } from '@universo-react/types'

import MarketingActionField from '../../entities/metadata/record/ui/fields/MarketingActionField'
import type { HeroRecordFormMode } from './useMarketingHeroBindingDialog'

type RenderActionFieldParams = {
    field: DynamicFieldConfig
    value: unknown
    onChange: (value: unknown) => void
    disabled: boolean
    error: string | null
    helperText?: string
}

type MarketingHeroRecordFormDialogProps = {
    open: boolean
    mode: HeroRecordFormMode
    onClose: () => void
    onChooseRecord?: () => void
    onSubmit: (submittedData: Record<string, unknown>) => Promise<void>
    initialData: Record<string, unknown> | undefined
    fields: DynamicFieldConfig[]
    actionFieldIds: Set<string>
    locale: string
    sectionTargets: readonly MarketingActionSectionTarget[]
    sectionTargetsState: 'ready' | 'loading' | 'unavailable'
    isSubmitting: boolean
    error: string | null
    fieldError: DynamicEntityFormFieldError | null
    onFieldErrorClear: (fieldId: string) => void
    sharedUsageCount?: number
}

/** Renders the create or edit form for an Entity-backed Hero content record. */
export default function MarketingHeroRecordFormDialog({
    open,
    mode,
    onClose,
    onChooseRecord,
    onSubmit,
    initialData,
    fields,
    actionFieldIds,
    locale,
    sectionTargets,
    sectionTargetsState,
    isSubmitting,
    error,
    fieldError,
    onFieldErrorClear,
    sharedUsageCount = 0
}: MarketingHeroRecordFormDialogProps) {
    const { t } = useCommonTranslations()

    const renderActionField = (params: RenderActionFieldParams) => {
        if (!actionFieldIds.has(params.field.id)) return undefined
        return <MarketingActionField {...params} sectionTargets={sectionTargets} sectionTargetsState={sectionTargetsState} />
    }

    const sharedRecordAlert =
        sharedUsageCount > 0 ? (
            <Alert severity='warning'>
                {t('layouts.marketing.heroAuthoring.sharedRecordWarning', {
                    count: sharedUsageCount,
                    defaultValue: 'Changes to this shared record will affect {{count}} other Hero placements.'
                })}
            </Alert>
        ) : undefined

    return (
        <DynamicEntityFormDialog
            open={open && Boolean(mode)}
            onClose={onClose}
            onSubmit={onSubmit}
            initialData={initialData}
            fields={fields}
            i18nNamespace='metahubs'
            locale={locale}
            isSubmitting={isSubmitting}
            error={error}
            fieldValidationError={fieldError}
            onFieldErrorClear={onFieldErrorClear}
            title={t(
                mode === 'edit' ? 'layouts.marketing.heroAuthoring.editTitle' : 'layouts.marketing.heroAuthoring.createTitle',
                mode === 'edit' ? 'Edit Hero content' : 'Create Hero content'
            )}
            requireAnyValue
            emptyStateText={t('layouts.marketing.heroAuthoring.fieldsUnavailable', 'No editable Hero content fields are available.')}
            saveButtonText={t('actions.save', 'Save')}
            savingButtonText={t('layouts.marketing.heroAuthoring.savingRecord', 'Saving content…')}
            cancelButtonText={t('actions.cancel', 'Cancel')}
            footerStartActions={
                <>
                    {sharedRecordAlert}
                    {onChooseRecord ? (
                        <Button
                            type='button'
                            aria-label={t(
                                'layouts.marketing.heroAuthoring.chooseAnotherRecordAriaLabel',
                                'Choose another record and discard unsaved changes'
                            )}
                            title={t(
                                'layouts.marketing.heroAuthoring.chooseAnotherRecordAriaLabel',
                                'Choose another record and discard unsaved changes'
                            )}
                            onClick={onChooseRecord}
                            disabled={isSubmitting}
                            variant='outlined'
                        >
                            {t('layouts.marketing.heroAuthoring.chooseAnotherRecord', 'Choose another record')}
                        </Button>
                    ) : undefined}
                </>
            }
            renderField={renderActionField}
        />
    )
}
