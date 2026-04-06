import type { ComponentType, ReactNode } from 'react'
import { DialogPresentationProvider, type DialogPresentationContextValue } from '@universo/template-mui/components/dialogs'
import type { DialogCloseBehavior, DialogSizePreset } from '@universo/types'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useSettingValue } from '../hooks/useSettings'

const DEFAULT_DIALOG_PRESENTATION: Required<Omit<DialogPresentationContextValue, 'storageScopeKey'>> = {
    enabled: true,
    sizePreset: 'medium',
    allowFullscreen: true,
    allowResize: true,
    closeBehavior: 'strict-modal'
}

export function MetahubDialogSettingsProvider({ children }: { children: ReactNode }) {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')

    const sizePreset = useSettingValue<DialogSizePreset>('common.dialogSizePreset') ?? DEFAULT_DIALOG_PRESENTATION.sizePreset
    const allowFullscreen =
        useSettingValue<boolean>('common.dialogAllowFullscreen') ?? DEFAULT_DIALOG_PRESENTATION.allowFullscreen
    const allowResize = useSettingValue<boolean>('common.dialogAllowResize') ?? DEFAULT_DIALOG_PRESENTATION.allowResize
    const closeBehavior =
        useSettingValue<DialogCloseBehavior>('common.dialogCloseBehavior') ?? DEFAULT_DIALOG_PRESENTATION.closeBehavior

    return (
        <DialogPresentationProvider
            value={{
                enabled: Boolean(metahubId),
                sizePreset,
                allowFullscreen,
                allowResize,
                closeBehavior,
                storageScopeKey: metahubId ?? null,
                titleActionLabels: {
                    resetSize: t('settings.dialogActionTooltips.resetSize', 'Reset dialog size'),
                    expand: t('settings.dialogActionTooltips.expand', 'Expand dialog'),
                    restoreSize: t('settings.dialogActionTooltips.restoreSize', 'Restore dialog size'),
                    resizeHandle: t('settings.dialogActionTooltips.resizeHandle', 'Resize dialog')
                }
            }}
        >
            {children}
        </DialogPresentationProvider>
    )
}

export function withMetahubDialogSettings<TProps extends object>(Component: ComponentType<TProps>) {
    const Wrapped = (props: TProps) => (
        <MetahubDialogSettingsProvider>
            <Component {...props} />
        </MetahubDialogSettingsProvider>
    )

    Wrapped.displayName = `withMetahubDialogSettings(${Component.displayName ?? Component.name ?? 'Component'})`

    return Wrapped
}