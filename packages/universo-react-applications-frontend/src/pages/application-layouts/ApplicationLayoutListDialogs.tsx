import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Button, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material'
import type { TFunction } from 'i18next'
import { StandardDialog } from '@universo-react/template-mui'
import type { ApplicationLayout, ApplicationLayoutScope, ApplicationTemplateKey } from '@universo-react/types'

type Translate = TFunction

export interface ApplicationLayoutListDialogsProps {
    t: Translate
    tc: Translate
    scopes: ApplicationLayoutScope[]
    templateKey: ApplicationTemplateKey
    defaultTemplateKey: ApplicationTemplateKey
    setTemplateKey: Dispatch<SetStateAction<ApplicationTemplateKey>>
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
    const [createValidation, setCreateValidation] = useState<'name' | 'target' | null>(null)
    const [editValidation, setEditValidation] = useState(false)
    const globalScope = useMemo(
        () => props.scopes.find((scope) => scope.scopeKind === 'global' || scope.scopeEntityId === null),
        [props.scopes]
    )
    const entityScopes = useMemo(
        () => props.scopes.filter((scope) => scope.scopeKind === 'entity' && scope.scopeEntityId !== null),
        [props.scopes]
    )
    const selectedScope = props.scopes.find((scope) => scope.id === props.scopeId)
    const isGlobalScope = props.scopeId === 'global' || selectedScope?.scopeKind === 'global' || selectedScope?.scopeEntityId === null
    const scopeMode = isGlobalScope ? 'global' : 'entity'

    useEffect(() => {
        if (props.createOpen) setCreateValidation(null)
    }, [props.createOpen])

    useEffect(() => {
        if (props.editingLayout) setEditValidation(false)
    }, [props.editingLayout])

    const formatScopeLabel = (scope: ApplicationLayoutScope): string => {
        if (scope.scopeKind === 'global' || scope.scopeEntityId === null) return t('layouts.scopeKinds.global', 'Global')
        const kind = (scope.scopeEntityKind ?? scope.kind ?? '').toLowerCase()
        const kindLabel =
            kind === 'page'
                ? t('layouts.scopeKinds.page', 'Page')
                : kind === 'object'
                ? t('layouts.scopeKinds.object', 'Object')
                : t('layouts.scopeKinds.entity', 'Entity')
        return `${kindLabel}: ${scope.name}`
    }

    const selectScope = (nextScopeId: string) => {
        props.setScopeId(nextScopeId)
        const nextScope = props.scopes.find((scope) => scope.id === nextScopeId)
        if (nextScope?.scopeKind === 'global' || nextScope?.scopeEntityId === null || nextScopeId === 'global') {
            props.setTemplateKey(props.defaultTemplateKey)
        }
        setCreateValidation(null)
    }

    const selectScopeMode = (mode: 'global' | 'entity') => {
        if (mode === 'global') {
            selectScope(globalScope?.id ?? 'global')
            return
        }
        const currentEntityScope = entityScopes.find((scope) => scope.id === props.scopeId)
        selectScope(currentEntityScope?.id ?? entityScopes[0]?.id ?? '')
    }

    const handleCreate = () => {
        if (!props.name.trim()) {
            setCreateValidation('name')
            return
        }
        if (!isGlobalScope && !selectedScope?.scopeEntityId) {
            setCreateValidation('target')
            return
        }
        setCreateValidation(null)
        props.onCreate()
    }

    const handleSave = () => {
        if (!props.nameEn.trim() && !props.nameRu.trim()) {
            setEditValidation(true)
            return
        }
        setEditValidation(false)
        props.onSave()
    }

    return (
        <>
            <StandardDialog
                open={props.createOpen}
                onClose={() => {
                    if (!props.isCreating) props.setCreateOpen(false)
                }}
                fullWidth
                maxWidth='sm'
                dialogTitleProps={{ id: 'application-layout-create-dialog-title' }}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={() => props.setCreateOpen(false)} disabled={props.isCreating}>
                            {tc('actions.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={handleCreate} variant='contained' disabled={props.isCreating}>
                            {t('layouts.create', 'Create layout')}
                        </Button>
                    </>
                }
                title={t('layouts.create', 'Create layout')}
            >
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label={t('layouts.name', 'Name')}
                        value={props.name}
                        onChange={(event) => {
                            props.setName(event.target.value)
                            if (event.target.value.trim()) setCreateValidation(null)
                        }}
                        fullWidth
                        required
                        error={createValidation === 'name'}
                        helperText={createValidation === 'name' ? t('layouts.validation.nameRequired', 'Enter a layout name.') : undefined}
                    />
                    <FormControl fullWidth>
                        <InputLabel id='application-layout-scope-mode-label'>{t('layouts.scopeMode', 'Layout target')}</InputLabel>
                        <Select
                            labelId='application-layout-scope-mode-label'
                            value={scopeMode}
                            label={t('layouts.scopeMode', 'Layout target')}
                            onChange={(event) => selectScopeMode(event.target.value as 'global' | 'entity')}
                        >
                            <MenuItem value='global'>{t('layouts.scopeModes.global', 'Global default')}</MenuItem>
                            <MenuItem value='entity'>{t('layouts.scopeModes.entity', 'Specific entity')}</MenuItem>
                        </Select>
                        <FormHelperText>{t('layouts.scopeModeHint', 'Choose the runtime target for this layout.')}</FormHelperText>
                    </FormControl>
                    {!isGlobalScope ? (
                        <FormControl fullWidth error={createValidation === 'target'}>
                            <InputLabel id='application-layout-target-label'>{t('layouts.target', 'Target')}</InputLabel>
                            <Select
                                labelId='application-layout-target-label'
                                value={props.scopeId}
                                label={t('layouts.target', 'Target')}
                                onChange={(event) => selectScope(event.target.value)}
                                displayEmpty
                            >
                                {entityScopes.length > 0 ? (
                                    entityScopes.map((scope) => (
                                        <MenuItem key={scope.id} value={scope.id}>
                                            {formatScopeLabel(scope)}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem value='' disabled>
                                        {t('layouts.noTargets', 'No authorized entity targets are available.')}
                                    </MenuItem>
                                )}
                            </Select>
                            <FormHelperText>
                                {createValidation === 'target'
                                    ? t('layouts.validation.targetRequired', 'Select an authorized target.')
                                    : t('layouts.targetHint', 'Only targets available to this application are listed.')}
                            </FormHelperText>
                        </FormControl>
                    ) : null}
                    <TextField
                        select
                        fullWidth
                        disabled={isGlobalScope}
                        label={t('layouts.template', 'Template')}
                        value={props.templateKey}
                        slotProps={{ inputLabel: { shrink: true } }}
                        onChange={(event) => props.setTemplateKey(event.target.value as ApplicationTemplateKey)}
                        helperText={
                            isGlobalScope
                                ? t('layouts.templateGlobalHint', 'Global layouts use the application default template.')
                                : t('layouts.templateScopedHint', 'This template is fixed after the layout is created.')
                        }
                    >
                        <MenuItem value='dashboard'>{t('layouts.templates.dashboard', 'Dashboard')}</MenuItem>
                        <MenuItem value='marketing-page'>{t('layouts.templates.marketingPage', 'Marketing page')}</MenuItem>
                    </TextField>
                </Stack>
            </StandardDialog>

            <StandardDialog
                open={Boolean(props.editingLayout)}
                onClose={() => {
                    if (!props.isSaving) props.setEditingLayout(null)
                }}
                fullWidth
                maxWidth='sm'
                dialogTitleProps={{ id: 'application-layout-edit-dialog-title' }}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={() => props.setEditingLayout(null)} disabled={props.isSaving}>
                            {tc('actions.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={handleSave} variant='contained' disabled={props.isSaving}>
                            {tc('actions.save', 'Save')}
                        </Button>
                    </>
                }
                title={tc('actions.edit', 'Edit')}
            >
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label={t('layouts.nameEn', 'Name (English)')}
                        value={props.nameEn}
                        onChange={(event) => {
                            props.setNameEn(event.target.value)
                            if (event.target.value.trim() || props.nameRu.trim()) setEditValidation(false)
                        }}
                        fullWidth
                        error={editValidation}
                        helperText={
                            editValidation
                                ? t('layouts.validation.localizedNameRequired', 'Enter a name in English or Russian.')
                                : undefined
                        }
                    />
                    <TextField
                        label={t('layouts.nameRu', 'Name (Russian)')}
                        value={props.nameRu}
                        onChange={(event) => {
                            props.setNameRu(event.target.value)
                            if (event.target.value.trim() || props.nameEn.trim()) setEditValidation(false)
                        }}
                        fullWidth
                        error={editValidation}
                    />
                    <TextField
                        label={t('layouts.descriptionEn', 'Description (English)')}
                        value={props.descriptionEn}
                        onChange={(event) => props.setDescriptionEn(event.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TextField
                        label={t('layouts.descriptionRu', 'Description (Russian)')}
                        value={props.descriptionRu}
                        onChange={(event) => props.setDescriptionRu(event.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                </Stack>
            </StandardDialog>
        </>
    )
}
