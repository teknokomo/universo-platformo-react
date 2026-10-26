import { AppMainLayout, PublicDashboardRuntime } from '@universo-react/apps-template-mui'
import type { PublicDashboardRuntime as PublicDashboardData } from '@universo-react/types'
import type { PublicApplicationRuntimeTarget } from '../../api/publicApplicationRuntime'

export interface PublicDashboardApplicationRuntimeProps {
    applicationRef: string
    locale: string
    dashboard: PublicDashboardData
    target?: PublicApplicationRuntimeTarget
    onNavigate: (href: string) => void
}

/** Dedicated anonymous host. The renderer receives semantic targets and public data only. */
export function PublicDashboardApplicationRuntime(props: PublicDashboardApplicationRuntimeProps) {
    return (
        <AppMainLayout>
            <PublicDashboardRuntime {...props} />
        </AppMainLayout>
    )
}
