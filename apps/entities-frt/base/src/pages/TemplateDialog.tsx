import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import ResourceConfigTree from '@apps/resources-frt/base/src/components/ResourceConfigTree'

interface TemplateDialogProps {
  open: boolean
  onClose: () => void
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>Template</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label='Name' fullWidth />
        <TextField label='Description' fullWidth multiline />
        <ResourceConfigTree />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant='contained'>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export default TemplateDialog
