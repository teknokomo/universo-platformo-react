import { useEffect, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { EntityFormDialog } from '@universo/template-mui'
import { useTranslation } from 'react-i18next'

import LayoutWidgetSharedBehaviorFields from './LayoutWidgetSharedBehaviorFields'

const normalizeConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}

export interface WidgetBehaviorEditorDialogProps {
    open: boolean
    config?: Record<string, unknown> | null
    onSave: (config: Record<string, unknown>) => void
    onCancel: () => void
}

export default function WidgetBehaviorEditorDialog({ open, config, onSave, onCancel }: WidgetBehaviorEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const [draft, setDraft] = useState<Record<string, unknown>>(() => normalizeConfig(config))

    useEffect(() => {
        if (!open) {
            return
        }

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
                        {t('layouts.widgetBehaviorEditor.description', 'Configure how catalog layouts can override this inherited widget.')}
                    </Typography>
                    <LayoutWidgetSharedBehaviorFields value={draft} onChange={setDraft} />
                </Stack>
            )}
        />
    )
}
