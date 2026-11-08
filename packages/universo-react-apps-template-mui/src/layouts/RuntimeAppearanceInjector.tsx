import * as React from 'react'
import { themeTokensToMuiInput } from '@universo-react/theme'
import type { ThemeAppearance } from '@universo-react/types'

import { AppMainLayoutContext } from './AppMainLayout'

interface RuntimeAppearanceInjectorProps {
    appearance: ThemeAppearance | null
}

/**
 * Injects the resolved layout appearance (TZ §7) into the host AppMainLayout
 * through `AppMainLayoutContext` — the same channel the marketing runtime
 * uses — without creating a nested ThemeProvider.
 */
export default function RuntimeAppearanceInjector({ appearance }: RuntimeAppearanceInjectorProps) {
    const hostLayout = React.useContext(AppMainLayoutContext)
    const injected = React.useMemo(() => {
        if (!appearance) return null
        return {
            defaultMode: appearance.mode,
            mode: appearance.mode,
            resolvedTokens: {
                hash: appearance.resolved.hash,
                input: themeTokensToMuiInput(appearance.resolved.tokens)
            }
        }
    }, [appearance])
    React.useEffect(() => {
        if (!hostLayout) return
        hostLayout.setAppearance(injected)
        return () => hostLayout.setAppearance(null)
    }, [injected, hostLayout])
    return null
}
