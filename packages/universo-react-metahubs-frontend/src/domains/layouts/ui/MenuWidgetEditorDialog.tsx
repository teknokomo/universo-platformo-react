import { useEffect, useState } from 'react'
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntityFormDialog } from '@universo-react/template-mui'
import { dashboardWidgetConfigSchemaByKey, type DashboardWidgetConfig } from '@universo-react/types'

type MenuWidgetConfig = DashboardWidgetConfig<'menuWidget'>

export interface MenuWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    config: MenuWidgetConfig | null
    onSave: (config: MenuWidgetConfig) => void
    onCancel: () => void
}

const normalizeConfig = (config: MenuWidgetConfig | null): MenuWidgetConfig => {
    const parsed = dashboardWidgetConfigSchemaByKey.menuWidget.safeParse(config ?? { variant: 'generated' })
    return parsed.success ? parsed.data : { variant: 'generated' }
}

export default function MenuWidgetEditorDialog({ open, config, onSave, onCancel }: MenuWidgetEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const [draft, setDraft] = useState<MenuWidgetConfig>(() => normalizeConfig(config))

    useEffect(() => {
        if (open) setDraft(normalizeConfig(config))
    }, [config, open])

    const isManual = draft.variant === 'manual'

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.menuEditor.title', 'Navigation menu')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(draft)}
            saveButtonText={isManual ? t('layouts.menuEditor.continueToSource', 'Continue to content source') : t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'layouts.menuEditor.description',
                            'Choose whether navigation is generated from the published application or authored from an Entity-backed source.'
                        )}
                    </Typography>
                    <TextField
                        select
                        fullWidth
                        size='small'
                        label={t('layouts.menuEditor.variant', 'Navigation source')}
                        value={draft.variant}
                        onChange={(event) => {
                            const next = dashboardWidgetConfigSchemaByKey.menuWidget.safeParse({ variant: event.target.value })
                            if (next.success) setDraft(next.data)
                        }}
                    >
                        <MenuItem value='generated'>{t('layouts.menuEditor.variants.generated', 'Generated navigation')}</MenuItem>
                        <MenuItem value='manual'>{t('layouts.menuEditor.variants.manual', 'Manual navigation')}</MenuItem>
                    </TextField>
                    <Alert severity={isManual ? 'info' : 'success'}>
                        {isManual
                            ? t(
                                  'layouts.menuEditor.manualHint',
                                  'Menu items are stored in an Entity source. Continue to select or edit that source; no menu content is stored in widget configuration.'
                              )
                            : t(
                                  'layouts.menuEditor.generatedHint',
                                  'Navigation is generated from published application metadata and does not use an authored content source.'
                              )}
                    </Alert>
                </Stack>
            )}
        />
    )
}
