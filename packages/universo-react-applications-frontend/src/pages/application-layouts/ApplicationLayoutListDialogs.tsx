import type { Dispatch, SetStateAction } from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField
} from '@mui/material'
import type { TFunction } from 'i18next'
import type { ApplicationLayout, ApplicationLayoutScope } from '@universo-react/types'

type Translate = TFunction

export interface ApplicationLayoutListDialogsProps {
    t: Translate
    tc: Translate
    scopes: ApplicationLayoutScope[]
    createOpen: boolean
    setCreateOpen: Dispatch<SetStateAction<boolean>>
    name: string
    setName: Dispatch<SetStateAction<string>>
    scopeId: string
    setScopeId: Dispatch<SetStateAction<string>>
    onCreate: () => void
    isCreating: boolean
    editingLayout: ApplicationLayout | null
    setEditingLayout: Dispatch<SetStateAction<ApplicationLayout | null>>
    nameEn: string
    setNameEn: Dispatch<SetStateAction<string>>
    nameRu: string
    setNameRu: Dispatch<SetStateAction<string>>
    descriptionEn: string
    setDescriptionEn: Dispatch<SetStateAction<string>>
    descriptionRu: string
    setDescriptionRu: Dispatch<SetStateAction<string>>
    onSave: () => void
    isSaving: boolean
}

export function ApplicationLayoutListDialogs(props: ApplicationLayoutListDialogsProps) {
    const { t, tc } = props
    return (
        <>
            <Dialog open={props.createOpen} onClose={() => props.setCreateOpen(false)} fullWidth maxWidth='sm'>
                <DialogTitle>{t('layouts.create', 'Create layout')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label={t('layouts.name', 'Name')}
                            value={props.name}
                            onChange={(event) => props.setName(event.target.value)}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.scope', 'Scope')}</InputLabel>
                            <Select
                                value={props.scopeId}
                                label={t('layouts.scope', 'Scope')}
                                onChange={(event) => props.setScopeId(event.target.value)}
                            >
                                {props.scopes.map((scope) => (
                                    <MenuItem key={scope.id} value={scope.id}>
                                        {scope.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => props.setCreateOpen(false)}>{tc('actions.cancel', 'Cancel')}</Button>
                    <Button onClick={props.onCreate} variant='contained' disabled={props.isCreating}>
                        {t('layouts.create', 'Create layout')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(props.editingLayout)} onClose={() => props.setEditingLayout(null)} fullWidth maxWidth='sm'>
                <DialogTitle>{tc('actions.edit', 'Edit')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label='Name (EN)'
                            value={props.nameEn}
                            onChange={(event) => props.setNameEn(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label='Name (RU)'
                            value={props.nameRu}
                            onChange={(event) => props.setNameRu(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label='Description (EN)'
                            value={props.descriptionEn}
                            onChange={(event) => props.setDescriptionEn(event.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                        <TextField
                            label='Description (RU)'
                            value={props.descriptionRu}
                            onChange={(event) => props.setDescriptionRu(event.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => props.setEditingLayout(null)}>{tc('actions.cancel', 'Cancel')}</Button>
                    <Button onClick={props.onSave} variant='contained' disabled={props.isSaving}>
                        {tc('actions.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
