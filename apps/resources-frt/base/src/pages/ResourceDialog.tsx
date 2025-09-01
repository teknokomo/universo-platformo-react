import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import ResourceConfigTree from '../components/ResourceConfigTree'

interface ResourceDialogProps {
    open: boolean
    onClose: () => void
}

const ResourceDialog: React.FC<ResourceDialogProps> = ({ open, onClose }) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>Resource</DialogTitle>
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

export default ResourceDialog
