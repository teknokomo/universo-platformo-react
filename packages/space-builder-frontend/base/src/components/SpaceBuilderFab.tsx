import React, { useState } from 'react'
import { Fab, Tooltip } from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { SpaceBuilderDialog, type SpaceBuilderCreationMode } from './SpaceBuilderDialog'
import { useTranslation } from '@universo/i18n'

export type ModelOpt = { key: string; label: string; provider: string; modelName: string; credentialId: string }

export type SpaceBuilderFabProps = {
  models?: ModelOpt[]
  onApply: (graph: { nodes: any[]; edges: any[] }, mode: SpaceBuilderCreationMode) => void
  onError?: (message: string) => void
  sx?: any
  allowNewCanvas?: boolean
}

export const SpaceBuilderFab: React.FC<SpaceBuilderFabProps> = ({ models, onApply, onError, sx, allowNewCanvas }) => {
  // Bind to dedicated namespace for short keys
  const { t } = useTranslation('spaceBuilder')
  const [open, setOpen] = useState(false)

  return (
    <>
  <Tooltip title={t('fabTooltip')}>
        <Fab size='small' color='secondary' onClick={() => setOpen(true)} sx={sx}>
          <AutoFixHighIcon fontSize='small' />
        </Fab>
      </Tooltip>

      <SpaceBuilderDialog
        open={open}
        onClose={() => setOpen(false)}
        onApply={onApply}
        onError={onError}
        models={models || []}
        allowNewCanvas={allowNewCanvas}
      />
    </>
  )
}
