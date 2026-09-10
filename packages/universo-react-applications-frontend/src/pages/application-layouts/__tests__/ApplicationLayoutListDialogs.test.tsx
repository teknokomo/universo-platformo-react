import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { ApplicationLayout, ApplicationLayoutScope, ApplicationTemplateKey } from '@universo-react/types'
import { ApplicationLayoutListDialogs } from '../ApplicationLayoutListDialogs'

const translate = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction

const scopes: ApplicationLayoutScope[] = [
    {
        id: 'global',
        scopeKind: 'global',
        scopeEntityId: null,
        kind: null,
        tableName: null,
        codename: {},
        name: 'Global'
    },
    {
        id: 'page-scope-1',
        scopeKind: 'entity',
        scopeEntityId: 'page-1',
        scopeEntityKind: 'page',
        kind: 'page',
        tableName: 'page_landing',
        codename: {},
        name: 'Landing page'
    }
]

const layoutForEdit = {
    id: 'layout-1',
    scopeId: 'global',
    scopeKind: 'global',
    scopeEntityId: null,
    templateKey: 'dashboard',
    name: { en: 'Dashboard' },
    description: null,
    config: {},
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    sourceKind: 'application',
    sourceLayoutId: null,
    sourceSnapshotHash: null,
    sourceContentHash: null,
    localContentHash: null,
    syncState: 'clean',
    isSourceExcluded: false,
    version: 1
} as ApplicationLayout

function CreateHarness({ onCreate }: { onCreate: () => void }) {
    const [createOpen, setCreateOpen] = useState(true)
    const [name, setName] = useState('')
    const [scopeId, setScopeId] = useState('global')
    const [templateKey, setTemplateKey] = useState<ApplicationTemplateKey>('dashboard')

    return (
        <ApplicationLayoutListDialogs
            t={translate}
            tc={translate}
            scopes={scopes}
            templateKey={templateKey}
            defaultTemplateKey='dashboard'
            setTemplateKey={setTemplateKey}
            createOpen={createOpen}
            setCreateOpen={setCreateOpen}
            name={name}
            setName={setName}
            scopeId={scopeId}
            setScopeId={setScopeId}
            onCreate={onCreate}
            isCreating={false}
            editingLayout={null}
            setEditingLayout={() => undefined}
            nameEn=''
            setNameEn={() => undefined}
            nameRu=''
            setNameRu={() => undefined}
            descriptionEn=''
            setDescriptionEn={() => undefined}
            descriptionRu=''
            setDescriptionRu={() => undefined}
            onSave={() => undefined}
            isSaving={false}
        />
    )
}

function EditHarness({ onSave }: { onSave: () => void }) {
    const [editingLayout, setEditingLayout] = useState<ApplicationLayout | null>(layoutForEdit)
    const [nameEn, setNameEn] = useState('')
    const [nameRu, setNameRu] = useState('')
    const [descriptionEn, setDescriptionEn] = useState('')
    const [descriptionRu, setDescriptionRu] = useState('')

    return (
        <ApplicationLayoutListDialogs
            t={translate}
            tc={translate}
            scopes={scopes}
            templateKey='dashboard'
            defaultTemplateKey='dashboard'
            setTemplateKey={() => undefined}
            createOpen={false}
            setCreateOpen={() => undefined}
            name=''
            setName={() => undefined}
            scopeId='global'
            setScopeId={() => undefined}
            onCreate={() => undefined}
            isCreating={false}
            editingLayout={editingLayout}
            setEditingLayout={setEditingLayout}
            nameEn={nameEn}
            setNameEn={setNameEn}
            nameRu={nameRu}
            setNameRu={setNameRu}
            descriptionEn={descriptionEn}
            setDescriptionEn={setDescriptionEn}
            descriptionRu={descriptionRu}
            setDescriptionRu={setDescriptionRu}
            onSave={onSave}
            isSaving={false}
        />
    )
}

describe('ApplicationLayoutListDialogs', () => {
    it('validates the name and lets an authorized entity target choose an independent template', async () => {
        const user = userEvent.setup()
        const onCreate = vi.fn()
        render(<CreateHarness onCreate={onCreate} />)

        await user.click(screen.getByRole('button', { name: 'Create layout' }))
        expect(screen.getByText('Enter a layout name.')).toBeInTheDocument()
        expect(onCreate).not.toHaveBeenCalled()

        await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Landing layout')
        await user.click(screen.getByRole('combobox', { name: 'Layout target' }))
        await user.click(screen.getByRole('option', { name: 'Specific entity' }))
        await user.click(screen.getByRole('combobox', { name: 'Target' }))
        await user.click(screen.getByRole('option', { name: 'Page: Landing page' }))
        await user.click(screen.getByRole('combobox', { name: 'Template' }))
        await user.click(screen.getByRole('option', { name: 'Marketing page' }))

        expect(screen.getByRole('dialog')).not.toHaveTextContent('page-scope-1')
        await user.click(screen.getByRole('button', { name: 'Create layout' }))
        expect(onCreate).toHaveBeenCalledTimes(1)
    })

    it('requires at least one localized edit name and keeps the dialog open', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        render(<EditHarness onSave={onSave} />)

        await user.click(screen.getByRole('button', { name: 'Save' }))
        expect(screen.getByText('Enter a name in English or Russian.')).toBeInTheDocument()
        expect(onSave).not.toHaveBeenCalled()

        await user.type(screen.getByLabelText('Name (Russian)'), 'Маркетинг')
        await user.click(screen.getByRole('button', { name: 'Save' }))
        expect(onSave).toHaveBeenCalledTimes(1)
    })
})
