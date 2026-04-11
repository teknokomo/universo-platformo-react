import { useEffect, useRef } from 'react'
import { Alert, Stack } from '@mui/material'
import type { CodenameAlphabet, CodenameStyle } from '@universo/types'
import { useTranslation } from 'react-i18next'

import { useTemplateDetail } from '../../templates/hooks'
import { TemplateSelector } from '../../templates/ui/TemplateSelector'
import { buildEntityTypePresetFormPatch, isEntityTypePresetManifest } from './entityTypePreset'

interface EntityTypePresetSelectorProps {
    value: string | undefined
    setValue: (name: string, value: unknown) => void
    disabled?: boolean
    uiLocale: string
    codenameStyle: CodenameStyle
    codenameAlphabet: CodenameAlphabet
}

export function EntityTypePresetSelector({
    value,
    setValue,
    disabled,
    uiLocale,
    codenameStyle,
    codenameAlphabet
}: EntityTypePresetSelectorProps) {
    const { t } = useTranslation('metahubs')
    const appliedTemplateIdRef = useRef<string | null>(null)
    const selectedTemplateId = value?.trim() || undefined
    const templateDetailQuery = useTemplateDetail(selectedTemplateId)

    useEffect(() => {
        if (!selectedTemplateId) {
            appliedTemplateIdRef.current = null
        }
    }, [selectedTemplateId])

    useEffect(() => {
        if (!selectedTemplateId || !templateDetailQuery.data || appliedTemplateIdRef.current === selectedTemplateId) {
            return
        }

        if (templateDetailQuery.data.definitionType !== 'entity_type_preset') {
            return
        }

        const manifest = templateDetailQuery.data.activeVersionManifest
        if (!isEntityTypePresetManifest(manifest)) {
            return
        }

        const patch = buildEntityTypePresetFormPatch(manifest, uiLocale, codenameStyle, codenameAlphabet)
        Object.entries(patch).forEach(([fieldName, fieldValue]) => setValue(fieldName, fieldValue))
        appliedTemplateIdRef.current = selectedTemplateId
    }, [codenameAlphabet, codenameStyle, selectedTemplateId, setValue, templateDetailQuery.data, uiLocale])

    return (
        <Stack spacing={1.5}>
            <TemplateSelector
                value={value}
                onChange={(templateId) => {
                    appliedTemplateIdRef.current = null
                    setValue('presetTemplateId', templateId)
                }}
                disabled={disabled}
                definitionType='entity_type_preset'
                allowEmptyOption
                emptyOptionLabel={t('entities.fields.noPreset', 'No preset')}
            />
            <Alert severity='info'>
                {t(
                    'entities.fields.presetHelper',
                    'Reusable presets are sourced from the existing template registry. Selecting one prefills the create dialog but still lets you review and change every field before save.'
                )}
            </Alert>
            {selectedTemplateId && templateDetailQuery.isError ? (
                <Alert severity='warning'>
                    {t(
                        'entities.fields.presetLoadError',
                        'Failed to load the selected preset. You can choose a different preset or continue editing manually.'
                    )}
                </Alert>
            ) : null}
            {selectedTemplateId &&
            templateDetailQuery.data &&
            !isEntityTypePresetManifest(templateDetailQuery.data.activeVersionManifest) ? (
                <Alert severity='warning'>
                    {t('entities.fields.presetManifestError', 'The selected template does not expose a valid entity preset manifest.')}
                </Alert>
            ) : null}
        </Stack>
    )
}
