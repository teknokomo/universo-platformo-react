import { AppMainLayout, PublicMessengerRuntime } from '@universo-react/apps-template-mui'
import type { PublicMessengerAppRuntime } from '@universo-react/types'

export interface PublicMessengerApplicationRuntimeProps {
    applicationRef: string
    messengerApp: PublicMessengerAppRuntime
    onNavigate: (href: string) => void
}

/** Anonymous Messenger host. The renderer receives only its typed public DTO. */
export function PublicMessengerApplicationRuntime(props: PublicMessengerApplicationRuntimeProps) {
    return (
        <AppMainLayout>
            <PublicMessengerRuntime {...props} />
        </AppMainLayout>
    )
}
