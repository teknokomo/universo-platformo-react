import React, { useState } from 'react'
import { Fab, Tooltip } from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { SpaceBuilderDialog } from './SpaceBuilderDialog'
import { useTranslation } from 'react-i18next'

export type ModelOpt = { key: string; label: string; provider: string; modelName: string; credentialId: string }

export type SpaceBuilderFabProps = {
    models?: ModelOpt[]
    onApply: (graph: { nodes: any[]; edges: any[] }, mode: 'append' | 'replace' | 'newSpace') => void
    onError?: (message: string) => void
    sx?: any
}

export const SpaceBuilderFab: React.FC<SpaceBuilderFabProps> = ({ models, onApply, onError, sx }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    return (
        <>
            <Tooltip title={t('spaceBuilder.fabTooltip')}>
                <Fab size='small' color='secondary' onClick={() => setOpen(true)} sx={sx}>
                    <AutoFixHighIcon fontSize='small' />
                </Fab>
            </Tooltip>

            <SpaceBuilderDialog open={open} onClose={() => setOpen(false)} onApply={onApply} onError={onError} models={models || []} />
        </>
    )
}
