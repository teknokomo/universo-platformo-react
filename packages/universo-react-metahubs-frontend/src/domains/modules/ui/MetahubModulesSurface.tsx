import { useState } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import type { ModuleAttachmentKind } from '@universo-react/types'

import { EntityModulesTab } from './EntityModulesTab'

type TranslationFn = (key: string, defaultValue?: string, options?: Record<string, unknown>) => string

export type MetahubModulesScope = Extract<ModuleAttachmentKind, 'metahub' | 'general'>

interface MetahubModulesSurfaceProps {
    metahubId: string | null | undefined
    t: TranslationFn
}

/**
 * Single Modules surface for the metahub Resources page: merges the former
 * "Runtime modules" (attachedToKind='metahub') and "Shared modules"
 * (attachedToKind='general') tabs behind one scope switcher. The scope switcher
 * follows the existing nested Tabs pattern used across the dashboard
 * (see ComponentList) instead of introducing a new control.
 */
export const MetahubModulesSurface = ({ metahubId, t }: MetahubModulesSurfaceProps) => {
    const [scope, setScope] = useState<MetahubModulesScope>('metahub')
    return (
        <Box>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={scope}
                    onChange={(_, next: MetahubModulesScope) => setScope(next)}
                    sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none' } }}
                >
                    <Tab value='metahub' label={t('modules.scopes.metahub', 'Metahub modules')} />
                    <Tab value='general' label={t('modules.scopes.general', 'Shared modules')} />
                </Tabs>
            </Box>
            <EntityModulesTab metahubId={metahubId} attachedToKind={scope} attachedToId={null} t={t} />
        </Box>
    )
}
