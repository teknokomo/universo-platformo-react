import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import type { TFunction } from 'i18next'
import { StandardDialog } from '@universo-react/template-mui'
import type { ApplicationLayoutWidget } from '@universo-react/types'
import { MatrixSettingsPanel, type InterpretationNetworkMatrixSettings } from '../application-settings/MatrixSettingsPanel'

type Translate = TFunction<'applications'>
type CommonTranslate = TFunction

export interface ApplicationLayoutWidgetEditorsProps {
    t: Translate
    tc: CommonTranslate
    interpretationNetworkEditingWidget: ApplicationLayoutWidget | null
    interpretationNetworkInitialSettings: InterpretationNetworkMatrixSettings | null
    interpretationNetworkDraftHasChanges: boolean
    workspaceSwitcherEditingWidget: ApplicationLayoutWidget | null
    isSavingWidget: boolean
    isResettingWidget: boolean
    isInterpretationNetworkCustomized: boolean
    canResetInterpretationNetwork: boolean
    onCloseInterpretationNetwork: () => void
    onSaveInterpretationNetwork: () => void
    onSaveInterpretationNetworkSettings: (settings: InterpretationNetworkMatrixSettings) => void
    onResetInterpretationNetwork: () => void
    onInterpretationNetworkDraftChange: (settings: InterpretationNetworkMatrixSettings, hasChanges: boolean) => void
    onCloseWorkspaceSwitcher: () => void
}

export function ApplicationLayoutWidgetEditors({
    t,
    tc,
    interpretationNetworkEditingWidget,
    interpretationNetworkInitialSettings,
    interpretationNetworkDraftHasChanges,
    workspaceSwitcherEditingWidget,
    isSavingWidget,
    isResettingWidget,
    isInterpretationNetworkCustomized,
    canResetInterpretationNetwork,
    onCloseInterpretationNetwork,
    onSaveInterpretationNetwork,
    onSaveInterpretationNetworkSettings,
    onResetInterpretationNetwork,
    onInterpretationNetworkDraftChange,
    onCloseWorkspaceSwitcher
}: ApplicationLayoutWidgetEditorsProps) {
    return (
        <>
            <StandardDialog
                open={Boolean(interpretationNetworkEditingWidget)}
                onClose={onCloseInterpretationNetwork}
                title={t('layouts.interpretationNetworkEditor.title', 'Interpretation network workspace')}
                maxWidth='md'
                dialogContentProps={{ dividers: true }}
                actions={
                    <>
                        <Button onClick={onCloseInterpretationNetwork}>{tc('actions.cancel', 'Cancel')}</Button>
                        <Button
                            data-testid='application-settings-matrix-save'
                            onClick={onSaveInterpretationNetwork}
                            variant='contained'
                            disabled={isSavingWidget || !interpretationNetworkDraftHasChanges}
                        >
                            {tc('actions.save', 'Save')}
                        </Button>
                    </>
                }
            >
                <Box sx={{ pt: 1 }}>
                    {interpretationNetworkEditingWidget && interpretationNetworkInitialSettings ? (
                        <Stack spacing={2}>
                            <Alert severity='info' data-testid='application-layout-widget-customization-state'>
                                {isInterpretationNetworkCustomized
                                    ? t('layouts.widgetCustomization.application', 'Customized in application')
                                    : t('layouts.widgetCustomization.metahub', 'Inherited from metahub')}
                            </Alert>
                            <MatrixSettingsPanel
                                t={t}
                                settings={interpretationNetworkInitialSettings}
                                hasDivergentSettings={false}
                                isSaving={isSavingWidget}
                                onSave={onSaveInterpretationNetworkSettings}
                                renderSaveButton={false}
                                showResetButton={canResetInterpretationNetwork}
                                isResetting={isResettingWidget}
                                onReset={onResetInterpretationNetwork}
                                onDraftChange={onInterpretationNetworkDraftChange}
                            />
                        </Stack>
                    ) : null}
                </Box>
            </StandardDialog>

            <StandardDialog
                open={Boolean(workspaceSwitcherEditingWidget)}
                onClose={onCloseWorkspaceSwitcher}
                title={t('layouts.workspaceSwitcherEditor.title', 'Workspace switcher')}
                maxWidth='sm'
                actions={<Button onClick={onCloseWorkspaceSwitcher}>{tc('actions.close', 'Close')}</Button>}
            >
                <Stack spacing={1.5}>
                    <Alert severity='info' data-testid='application-layout-workspace-switcher-readonly'>
                        {t(
                            'layouts.workspaceSwitcherEditor.readOnly',
                            'The workspace switcher uses the published application workspace state and has no widget-specific settings yet.'
                        )}
                    </Alert>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
                        {t(
                            'layouts.workspaceSwitcherEditor.hint',
                            'Use application settings to control which workspace settings can be changed inside workspaces.'
                        )}
                    </Typography>
                </Stack>
            </StandardDialog>
        </>
    )
}
