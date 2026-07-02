import { useTranslation } from 'react-i18next'
import { MenuWidgetSideMenuSettings as SharedMenuWidgetSideMenuSettings } from '@universo-react/template-mui'
import { type DashboardSideMenuMode, type MenuWidgetConfig } from '@universo-react/types'

interface MenuWidgetSideMenuSettingsProps {
    sideMenu: MenuWidgetConfig['sideMenu']
    onChange: (sideMenu: NonNullable<MenuWidgetConfig['sideMenu']>) => void
}

export default function MenuWidgetSideMenuSettings({ sideMenu, onChange }: MenuWidgetSideMenuSettingsProps) {
    const { t } = useTranslation('metahubs')

    const modes: Record<DashboardSideMenuMode, string> = {
        wide: t('layouts.menuEditor.sideMenu.modes.wide', 'Wide'),
        compact: t('layouts.menuEditor.sideMenu.modes.compact', 'Compact icons'),
        overlay: t('layouts.menuEditor.sideMenu.modes.overlay', 'Overlay drawer')
    }

    return (
        <SharedMenuWidgetSideMenuSettings
            sideMenu={sideMenu}
            labels={{
                title: t('layouts.menuEditor.sideMenu.title', 'Side menu display'),
                primaryMode: t('layouts.menuEditor.sideMenu.primaryMode', 'Primary display mode'),
                rememberUserChoice: t('layouts.menuEditor.sideMenu.rememberUserChoice', 'Remember user choice'),
                modes
            }}
            onChange={onChange}
        />
    )
}
