import type { ComponentType, ReactNode } from 'react'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DialogPresentationProvider } from '@universo/template-mui/components/dialogs'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS } from './dialogSettings'

export function ApplicationDialogSettingsProvider({ children }: { children: ReactNode }) {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t } = useTranslation('applications')

    const applicationQuery = useApplicationDetails(applicationId || '', {
        enabled: Boolean(applicationId),
        retry: 1
    })

    const settings = useMemo(
        () => ({
            ...DEFAULT_APPLICATION_DIALOG_SETTINGS,
            ...(applicationQuery.data?.settings ?? {})
        }),
        [applicationQuery.data?.settings]
    )

    return (
        <DialogPresentationProvider
            value={{
                enabled: true,
                sizePreset: settings.dialogSizePreset,
                allowFullscreen: settings.dialogAllowFullscreen,
                allowResize: settings.dialogAllowResize,
                closeBehavior: settings.dialogCloseBehavior,
                storageScopeKey: applicationId ? `application:${applicationId}` : 'application',
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

export function withApplicationDialogSettings<TProps extends object>(Component: ComponentType<TProps>) {
    const Wrapped = (props: TProps) => (
        <ApplicationDialogSettingsProvider>
            <Component {...props} />
        </ApplicationDialogSettingsProvider>
    )

    Wrapped.displayName = `withApplicationDialogSettings(${Component.displayName ?? Component.name ?? 'Component'})`

    return Wrapped
}
