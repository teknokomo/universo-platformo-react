import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, MenuItem } from '@mui/material'
import ResourceConfigTree from '@apps/resources-frt/base/src/components/ResourceConfigTree'

interface EntityDialogProps {
  open: boolean
  onClose: () => void
}

const templates = ['Template A', 'Template B']

const EntityDialog: React.FC<EntityDialogProps> = ({ open, onClose }) => {
  const [template, setTemplate] = useState('')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>Entity</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label='Name' fullWidth />
        <TextField select label='Template' value={template} onChange={(e) => setTemplate(e.target.value)}>
          {templates.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        <ResourceConfigTree />
        <TextField label='Owner' fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant='contained'>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export default EntityDialog
