import React, { useState } from 'react'
import { SpaceBuilderDialog, type SpaceBuilderCreationMode } from './SpaceBuilderDialog'
import type { ModelOpt } from './SpaceBuilderFab'

export type SpaceBuilderButtonProps = {
  models: ModelOpt[]
  onApply: (graph: { nodes: unknown[]; edges: unknown[] }, mode: SpaceBuilderCreationMode) => void
  allowNewCanvas?: boolean
}

export const SpaceBuilderButton: React.FC<SpaceBuilderButtonProps> = ({ models, onApply, allowNewCanvas }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button title='Build flow from prompt' onClick={() => setOpen(true)}>
        ✨ Build from prompt
      </button>
      <SpaceBuilderDialog
        open={open}
        onClose={() => setOpen(false)}
        onApply={onApply}
        models={models}
        allowNewCanvas={allowNewCanvas}
      />
    </>
  )
}
