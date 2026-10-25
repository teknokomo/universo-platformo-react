import { useEffect, useId, useState } from 'react'
import { Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntityFormDialog } from '@universo-react/template-mui'
import { INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS, type InterpretationNetworkWorkspaceWidgetConfig } from '@universo-react/types'

import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'
import InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSection from './InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSection'
import InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSection from './InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSection'
import InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySection from './InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySection'
import InterpretationNetworkWorkspaceWidgetEditorDialogTableSection from './InterpretationNetworkWorkspaceWidgetEditorDialogTableSection'
import { normalizeConfig } from './interpretationNetworkWorkspaceWidgetEditorDialogConfig'

export interface InterpretationNetworkWorkspaceWidgetEditorDialogProps {
    open: boolean
    config?: InterpretationNetworkWorkspaceWidgetConfig | null
    metahubId?: string | null
    layoutId?: string | null
    widgetId?: string | null
    showScopeVisibility?: boolean
    onSave: (config: InterpretationNetworkWorkspaceWidgetConfig) => Promise<void> | void
    onCancel: () => void
}

export default function InterpretationNetworkWorkspaceWidgetEditorDialog({
    open,
    config,
    metahubId,
    layoutId,
    widgetId,
    showScopeVisibility = false,
    onSave,
    onCancel
}: InterpretationNetworkWorkspaceWidgetEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const defaultMatrixViewLabelId = useId()
    const [draft, setDraft] = useState<InterpretationNetworkWorkspaceWidgetConfig>(() => normalizeConfig(config))
    const [newCellStyleColor, setNewCellStyleColor] = useState(() => INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS[0] ?? '')

    useEffect(() => {
        if (open) {
            setDraft(normalizeConfig(config))
        }
    }, [config, open])

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.interpretationNetworkEditor.title', 'Interpretation network workspace')}
            mode='edit'
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(normalizeConfig(draft))}
            autoCloseOnSuccess={false}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <InterpretationNetworkWorkspaceWidgetEditorDialogDisplaySection
                        draft={draft}
                        setDraft={setDraft}
                        fieldIdPrefix={defaultMatrixViewLabelId}
                    />
                    <InterpretationNetworkWorkspaceWidgetEditorDialogTableSection
                        draft={draft}
                        setDraft={setDraft}
                        fieldIdPrefix={defaultMatrixViewLabelId}
                    />
                    <InterpretationNetworkWorkspaceWidgetEditorDialogBehaviorSection
                        draft={draft}
                        setDraft={setDraft}
                        fieldIdPrefix={defaultMatrixViewLabelId}
                    />
                    <InterpretationNetworkWorkspaceWidgetEditorDialogCellStyleSection
                        draft={draft}
                        setDraft={setDraft}
                        newCellStyleColor={newCellStyleColor}
                        setNewCellStyleColor={setNewCellStyleColor}
                    />
                    {showScopeVisibility && metahubId && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
