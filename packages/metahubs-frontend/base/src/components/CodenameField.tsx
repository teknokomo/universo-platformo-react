import React, { useCallback, useEffect, useRef } from 'react'
import { CodenameField as BaseCodenameField, type CodenameFieldProps as BaseCodenameFieldProps } from '@universo/template-mui'
import { autoConvertMixedAlphabetsByFirstSymbol, normalizeCodenameForStyle } from '../utils/codename'
import { useCodenameConfig } from '../domains/settings/hooks/useCodenameConfig'
import { useTranslation } from 'react-i18next'
import { useExistingCodenames } from './ExistingCodenamesContext'
import { useCodenameDuplicateCheck } from './useCodenameDuplicateCheck'

export interface CodenameFieldProps extends BaseCodenameFieldProps {
    /** Entity ID being edited (excluded from duplicate check). Null/undefined for create mode. */
    editingEntityId?: string | null
    /** Called when the duplicate status changes. Useful for disabling submit buttons. */
    onDuplicateStatusChange?: (hasDuplicate: boolean) => void
}

export const CodenameField: React.FC<CodenameFieldProps> = ({ editingEntityId, onDuplicateStatusChange, ...props }) => {
    const { t } = useTranslation('metahubs')
    const { style, alphabet, allowMixed, autoConvertMixedAlphabets, localizedEnabled } = useCodenameConfig()

    // Duplicate checking via context
    const existingEntities = useExistingCodenames()
    const { error: duplicateError, duplicateValue } = useCodenameDuplicateCheck({
        codename: props.value,
        codenameVlc: props.localizedValue,
        localizedEnabled,
        existingEntities,
        editingEntityId
    })

    // Merge duplicate error with existing error (form validation takes precedence)
    const duplicateCheckEnabled = !props.disabled
    const duplicateErrorMessage =
        duplicateCheckEnabled && !props.error && duplicateError
            ? localizedEnabled && duplicateValue
                ? t('validation.codenameDuplicateVlc', {
                      value: duplicateValue,
                      defaultValue: `Codename "${duplicateValue}" already used by another entity`
                  })
                : t('validation.codenameDuplicate', { defaultValue: 'An entity with this codename already exists' })
            : undefined
    const mergedError = props.error || duplicateErrorMessage

    // Notify parent when duplicate status changes (for disabling submit buttons)
    const hasDuplicate = duplicateCheckEnabled && !!duplicateError
    const prevHasDuplicate = useRef(hasDuplicate)
    useEffect(() => {
        if (prevHasDuplicate.current !== hasDuplicate) {
            prevHasDuplicate.current = hasDuplicate
            onDuplicateStatusChange?.(hasDuplicate)
        }
    }, [hasDuplicate, onDuplicateStatusChange])
    // Also fire on mount if there's already a duplicate (e.g. copy dialog opens with duplicate codename)
    useEffect(() => {
        if (hasDuplicate) {
            onDuplicateStatusChange?.(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const styleLabel = t(`settings.codenameStyles.${style}`, { defaultValue: style })
    const alphabetLabel = t(`settings.codenameAlphabets.${alphabet}`, { defaultValue: alphabet })
    const mixedRule =
        alphabet !== 'en-ru'
            ? t('codenameHelperMixedNotApplicable')
            : allowMixed
            ? t('codenameHelperMixedAllowed')
            : autoConvertMixedAlphabets
            ? t('codenameHelperMixedForbiddenAutoConvert')
            : t('codenameHelperMixedForbidden')

    const dynamicHelperText = t('codenameHelperDynamic', {
        style: styleLabel,
        alphabet: alphabetLabel,
        mixedRule
    })

    const settingsBasedNormalize = useCallback(
        (value: string) => {
            const sourceValue =
                alphabet === 'en-ru' && !allowMixed && autoConvertMixedAlphabets ? autoConvertMixedAlphabetsByFirstSymbol(value) : value

            return normalizeCodenameForStyle(sourceValue, style, alphabet)
        },
        [style, alphabet, allowMixed, autoConvertMixedAlphabets]
    )

    return (
        <BaseCodenameField
            {...props}
            error={mergedError}
            helperText={dynamicHelperText}
            normalizeOnBlur={props.normalizeOnBlur ?? settingsBasedNormalize}
        />
    )
}

export default CodenameField
