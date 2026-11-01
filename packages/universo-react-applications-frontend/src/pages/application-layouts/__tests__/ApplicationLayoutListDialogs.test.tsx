import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import type { ApplicationLayout, ApplicationLayoutScope, ApplicationTemplateKey } from '@universo-react/types'
import { ApplicationLayoutListDialogs } from '../ApplicationLayoutListDialogs'

const commonTranslations = { en: commonEn.common, ru: commonRu.common }
let activeLocale: keyof typeof commonTranslations = 'en'

const translate = ((key: string, fallback?: string | { defaultValue?: string }) => {
    const translated = key.split('.').reduce<unknown>((value, segment) => {
        if (!value || typeof value !== 'object') return undefined
        return (value as Record<string, unknown>)[segment]
    }, commonTranslations[activeLocale])
    if (typeof translated === 'string') return translated
    return typeof fallback === 'string' ? fallback : fallback?.defaultValue ?? key
}) as unknown as TFunction

afterEach(() => {
    activeLocale = 'en'
})

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

function CreateHarness({ onCreate, canSelectGlobalTemplate = true }: { onCreate: () => void; canSelectGlobalTemplate?: boolean }) {
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
            canSelectGlobalTemplate={canSelectGlobalTemplate}
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
            canSelectGlobalTemplate={false}
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
    it.each([
        { locale: 'en' as const, labels: ['Dashboard', 'Marketing page', 'Messenger app'] },
        { locale: 'ru' as const, labels: ['Дашборд', 'Маркетинговая страница', 'Приложение для мессенджера'] }
    ])('renders registry template choices with shared $locale labels', async ({ locale, labels }) => {
        activeLocale = locale
        const user = userEvent.setup()
        render(<CreateHarness onCreate={() => undefined} />)

        await user.click(screen.getByRole('combobox', { name: 'Template' }))

        for (const label of labels) {
            expect(screen.getByRole('option', { name: label })).toBeVisible()
        }
    })

    it('lets the owner choose Messenger for the first global layout', async () => {
        const user = userEvent.setup()
        const onCreate = vi.fn()
        render(<CreateHarness onCreate={onCreate} />)

        await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Messenger home')
        await user.click(screen.getByRole('combobox', { name: 'Template' }))
        await user.click(screen.getByRole('option', { name: 'Messenger app' }))

        expect(screen.getByRole('combobox', { name: 'Template' })).toHaveTextContent('Messenger app')
        await user.click(screen.getByRole('button', { name: 'Create layout' }))
        expect(onCreate).toHaveBeenCalledOnce()
    })

    it('locks the template selector after the application has a global layout', () => {
        render(<CreateHarness onCreate={() => undefined} canSelectGlobalTemplate={false} />)

        expect(screen.getByRole('combobox', { name: 'Template' })).toHaveAttribute('aria-disabled', 'true')
    })

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
