import { useEffect, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { EntityFormDialog } from '@universo/template-mui'
import { useTranslation } from 'react-i18next'

import ApplicationLayoutSharedBehaviorFields from './ApplicationLayoutSharedBehaviorFields'

const normalizeConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}

type Props = {
    open: boolean
    config?: Record<string, unknown> | null
    onSave: (config: Record<string, unknown>) => void
    onCancel: () => void
}

export default function ApplicationWidgetBehaviorEditorDialog({ open, config, onSave, onCancel }: Props) {
    const { t } = useTranslation(['applications', 'common'])
    const [draft, setDraft] = useState<Record<string, unknown>>(() => normalizeConfig(config))

    useEffect(() => {
        if (!open) return
        setDraft(normalizeConfig(config))
    }, [config, open])

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.widgetBehaviorEditor.title', 'Widget behavior')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(draft)}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('layouts.widgetBehaviorEditor.description', 'Configure how inherited layouts can override this widget.')}
                    </Typography>
                    <ApplicationLayoutSharedBehaviorFields value={draft} onChange={setDraft} />
                </Stack>
            )}
        />
    )
}
