import { useEffect } from 'react'
import { Divider, Stack } from '@mui/material'
import { LocalizedInlineField, useCodenameAutoFillVlc } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'

import { CodenameField } from '../../../components'
import { sanitizeCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import type { CodenameConfig } from '../../settings/hooks/useCodenameConfig'

export type GeneralTabFieldValues = Record<string, unknown>

export type GeneralTabFieldsProps = {
    values: GeneralTabFieldValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors?: Record<string, string>
    uiLocale?: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
    editingEntityId?: string | null
    onCodenameConfigResolved?: (config: CodenameConfig) => void
}

const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper,
    editingEntityId,
    onCodenameConfigResolved
}: GeneralTabFieldsProps) => {
    const fieldErrors = errors ?? {}
    const resolvedUiLocale = uiLocale ?? 'en'
    const codenameConfig = useCodenameConfig()
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)

    useEffect(() => {
        onCodenameConfigResolved?.(codenameConfig)
    }, [codenameConfig, onCodenameConfigResolved])

    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename: (nameContent) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                autoInitialize={!isLoading}
                value={nameVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={resolvedUiLocale}
            />

            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                autoInitialize={!isLoading}
                value={descriptionVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={resolvedUiLocale}
                multiline
                rows={2}
            />

            <Divider />

            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={resolvedUiLocale}
                label={codenameLabel}
                helperText={codenameHelper}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
                editingEntityId={editingEntityId}
            />
        </Stack>
    )
}

export default GeneralTabFields
