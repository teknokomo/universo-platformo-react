import type { ComponentType, ReactNode } from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DialogPresentationProvider } from '@universo/template-mui/components/dialogs'
import type { DialogCloseBehavior, DialogSizePreset } from '@universo/types'
import * as settingsApi from '../api/settingsApi'
import type { AdminSettingItem } from '../api/settingsApi'
import { settingsQueryKeys } from '../api/queryKeys'
import { DEFAULT_ADMIN_DIALOG_SETTINGS } from './dialogSettings'

function extractValue(setting?: AdminSettingItem): unknown {
    if (!setting) return undefined
    const raw = setting.value
    return '_value' in raw ? raw._value : raw
}

export function AdminDialogSettingsProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation('admin')
    const settingsQuery = useQuery({
        queryKey: settingsQueryKeys.byCategory('general'),
        queryFn: () => settingsApi.listSettingsByCategory('general'),
        retry: false
    })

    const settingsMap = useMemo(
        () => new Map((settingsQuery.data?.items ?? []).map((item) => [item.key, item])),
        [settingsQuery.data?.items]
    )

    const sizePreset =
        (extractValue(settingsMap.get('dialogSizePreset')) as DialogSizePreset | undefined) ??
        DEFAULT_ADMIN_DIALOG_SETTINGS.dialogSizePreset
    const allowFullscreen =
        (extractValue(settingsMap.get('dialogAllowFullscreen')) as boolean | undefined) ??
        DEFAULT_ADMIN_DIALOG_SETTINGS.dialogAllowFullscreen
    const allowResize =
        (extractValue(settingsMap.get('dialogAllowResize')) as boolean | undefined) ?? DEFAULT_ADMIN_DIALOG_SETTINGS.dialogAllowResize
    const closeBehavior =
        (extractValue(settingsMap.get('dialogCloseBehavior')) as DialogCloseBehavior | undefined) ??
        DEFAULT_ADMIN_DIALOG_SETTINGS.dialogCloseBehavior

    return (
        <DialogPresentationProvider
            value={{
                enabled: true,
                sizePreset,
                allowFullscreen,
                allowResize,
                closeBehavior,
                storageScopeKey: 'admin',
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

export function withAdminDialogSettings<TProps extends object>(Component: ComponentType<TProps>) {
    const Wrapped = (props: TProps) => (
        <AdminDialogSettingsProvider>
            <Component {...props} />
        </AdminDialogSettingsProvider>
    )

    Wrapped.displayName = `withAdminDialogSettings(${Component.displayName ?? Component.name ?? 'Component'})`

    return Wrapped
}
