import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ApplicationMenuWidgetEditorDialog from '../ApplicationMenuWidgetEditorDialog'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string, values?: Record<string, string>) => {
            const translations: Record<string, string> = {
                'layouts.menuEditor.sideMenu.title': 'Side menu display',
                'layouts.menuEditor.sideMenu.primaryMode': 'Primary display mode',
                'layouts.menuEditor.sideMenu.rememberUserChoice': 'Remember user choice',
                'layouts.menuEditor.sideMenu.modes.wide': 'Wide',
                'layouts.menuEditor.sideMenu.modes.compact': 'Compact icons',
                'layouts.menuEditor.sideMenu.modes.overlay': 'Overlay drawer'
            }
            let translated = translations[_key] ?? fallback ?? _key
            for (const [key, value] of Object.entries(values ?? {})) {
                translated = translated.replace(`{{${key}}}`, value)
            }
            return translated
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo-react/template-mui', () => ({
    normalizeSideMenuConfig: (value?: { availableModes?: string[]; primaryMode?: string; rememberUserChoice?: boolean }) => {
        const modes = ['wide', 'compact', 'overlay']
        const availableModes = Array.isArray(value?.availableModes)
            ? value.availableModes.filter((mode, index, source) => modes.includes(mode) && source.indexOf(mode) === index)
            : modes
        const primaryMode = value?.primaryMode && availableModes.includes(value.primaryMode) ? value.primaryMode : availableModes[0]
        return {
            availableModes,
            primaryMode,
            rememberUserChoice: value?.rememberUserChoice ?? true
        }
    },
    MenuWidgetSideMenuSettings: ({
        sideMenu,
        labels,
        onChange
    }: {
        sideMenu?: {
            availableModes?: string[]
            primaryMode?: string
            rememberUserChoice?: boolean
        }
        labels: {
            title: string
            primaryMode: string
            rememberUserChoice: string
            modes: Record<string, string>
        }
        onChange: (next: { availableModes: string[]; primaryMode: string; rememberUserChoice: boolean }) => void
    }) => {
        const modes = ['wide', 'compact', 'overlay']
        const normalized = {
            availableModes: sideMenu?.availableModes ?? modes,
            primaryMode: sideMenu?.primaryMode ?? 'wide',
            rememberUserChoice: sideMenu?.rememberUserChoice ?? true
        }
        return (
            <section aria-label={labels.title}>
                <h2>{labels.title}</h2>
                {modes.map((mode) => (
                    <label key={mode}>
                        <input
                            type='checkbox'
                            checked={normalized.availableModes.includes(mode)}
                            onChange={(event) => {
                                const availableModes = event.target.checked
                                    ? [...normalized.availableModes, mode]
                                    : normalized.availableModes.filter((candidate) => candidate !== mode)
                                onChange({
                                    ...normalized,
                                    availableModes,
                                    primaryMode: availableModes.includes(normalized.primaryMode)
                                        ? normalized.primaryMode
                                        : availableModes[0]
                                })
                            }}
                        />
                        {labels.modes[mode]}
                    </label>
                ))}
                <label>
                    {labels.primaryMode}
                    <select
                        aria-label={labels.primaryMode}
                        value={normalized.primaryMode}
                        onChange={(event) => onChange({ ...normalized, primaryMode: event.target.value })}
                    >
                        {normalized.availableModes.map((mode) => (
                            <option key={mode} value={mode}>
                                {labels.modes[mode]}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <input
                        type='checkbox'
                        role='switch'
                        checked={normalized.rememberUserChoice}
                        onChange={(event) => onChange({ ...normalized, rememberUserChoice: event.target.checked })}
                    />
                    {labels.rememberUserChoice}
                </label>
            </section>
        )
    },
    EntityFormDialog: ({
        open,
        title,
        extraFields,
        onSave,
        onClose,
        saveButtonText = 'Save',
        cancelButtonText = 'Cancel'
    }: {
        open: boolean
        title: string
        extraFields?: () => ReactNode
        onSave: () => void
        onClose: () => void
        saveButtonText?: string
        cancelButtonText?: string
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                <h1>{title}</h1>
                {extraFields?.()}
                <button type='button' onClick={onSave}>
                    {saveButtonText}
                </button>
                <button type='button' onClick={onClose}>
                    {cancelButtonText}
                </button>
            </div>
        ) : null,
    LocalizedInlineField: ({
        label,
        value,
        onChange
    }: {
        label: string
        value: { locales?: Record<string, { content?: string }> } | null
        onChange: (next: { _primary: string; locales: Record<string, { content: string }> }) => void
    }) => (
        <input
            aria-label={label}
            value={value?.locales?.en?.content ?? ''}
            onChange={(event) =>
                onChange({
                    _primary: 'en',
                    locales: { en: { content: event.target.value } }
                })
            }
        />
    )
}))

const sectionOptions = [
    {
        id: '019f1423-9a35-7d96-9c61-7816ee969ad1',
        label: 'Structures'
    },
    {
        id: '019f1423-aad2-7f47-8d10-aef8540b91f5',
        label: 'Materials'
    }
]

describe('ApplicationMenuWidgetEditorDialog', () => {
    it('stores menu targets from application section options without raw target input', () => {
        const onSave = vi.fn()
        render(<ApplicationMenuWidgetEditorDialog open config={null} sectionOptions={sectionOptions} onSave={onSave} onCancel={vi.fn()} />)

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Start page' }))
        fireEvent.click(screen.getByRole('option', { name: 'Structures' }))

        fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
        const itemDialog = screen.getByRole('dialog', { name: 'Add item' })
        fireEvent.mouseDown(within(itemDialog).getByRole('combobox', { name: 'Type' }))
        fireEvent.click(screen.getByRole('option', { name: 'section' }))
        fireEvent.change(within(itemDialog).getByRole('textbox', { name: 'Item title' }), {
            target: { value: 'Structures' }
        })
        fireEvent.mouseDown(within(itemDialog).getByRole('combobox', { name: 'Entity section' }))
        fireEvent.click(screen.getAllByRole('option', { name: 'Structures' }).at(-1)!)
        fireEvent.click(within(itemDialog).getByRole('button', { name: 'Save' }))

        fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu widget' })).getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                startPage: sectionOptions[0].id,
                items: [
                    expect.objectContaining({
                        kind: 'section',
                        title: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'Structures' })
                            })
                        }),
                        sectionId: sectionOptions[0].id,
                        objectCollectionId: sectionOptions[0].id,
                        hubId: null
                    })
                ]
            })
        )
    })

    it('preserves unavailable start page tokens when saving unrelated settings', () => {
        const onSave = vi.fn()
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    startPage: 'legacy-codename',
                    startTarget: { kind: 'objectCollection', objectCollectionId: sectionOptions[0].id },
                    items: []
                }}
                sectionOptions={sectionOptions}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu widget' })).getByRole('button', { name: 'Save' }))
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                startPage: 'legacy-codename',
                startTarget: { kind: 'objectCollection', objectCollectionId: sectionOptions[0].id }
            })
        )
    })

    it('does not offer menu item ids as start pages when the runtime cannot open them directly', () => {
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    items: [
                        {
                            id: 'menu-item-structures',
                            kind: 'section',
                            title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                            sectionId: sectionOptions[0].id,
                            objectCollectionId: sectionOptions[0].id,
                            sortOrder: 0,
                            isActive: true
                        }
                    ]
                }}
                sectionOptions={sectionOptions}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Start page' }))

        expect(screen.queryByRole('option', { name: 'Menu item: Structures' })).not.toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'menu-item-structures' })).not.toBeInTheDocument()
    })

    it('does not expose duplicate menu item start page options that shadow section ids', () => {
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    startPage: sectionOptions[0].id,
                    items: [
                        {
                            id: sectionOptions[0].id,
                            kind: 'section',
                            title: { _primary: 'en', locales: { en: { content: 'Shadow item' } } },
                            sectionId: sectionOptions[0].id,
                            objectCollectionId: sectionOptions[0].id,
                            sortOrder: 0,
                            isActive: true
                        }
                    ]
                }}
                sectionOptions={sectionOptions}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Start page' }))

        expect(screen.getAllByRole('option', { name: 'Structures' })).toHaveLength(1)
        expect(screen.queryByRole('option', { name: 'Menu item: Shadow item' })).not.toBeInTheDocument()
    })

    it('clears a materialized start target when the user selects another start page', () => {
        const onSave = vi.fn()
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    startPage: sectionOptions[0].id,
                    startTarget: { kind: 'objectCollection', objectCollectionId: sectionOptions[0].id },
                    items: []
                }}
                sectionOptions={sectionOptions}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Start page' }))
        fireEvent.click(screen.getByRole('option', { name: 'Materials' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu widget' })).getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ startPage: sectionOptions[1].id, startTarget: null }))
    })

    it('preserves hub menu item targets when saving unrelated application menu settings', () => {
        const onSave = vi.fn()
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    items: [
                        {
                            id: 'hub-item',
                            kind: 'hub',
                            title: { _primary: 'en', locales: { en: { content: 'Main hub' } } },
                            hubId: '019f1518-5d18-7000-8000-000000000001',
                            sortOrder: 0,
                            isActive: true
                        }
                    ]
                }}
                sectionOptions={sectionOptions}
                onSave={onSave}
                onCancel={vi.fn()}
            />
        )

        fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu widget' })).getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                items: [
                    expect.objectContaining({
                        id: 'hub-item',
                        kind: 'hub',
                        hubId: '019f1518-5d18-7000-8000-000000000001'
                    })
                ]
            })
        )
    })

    it('names menu item icon actions for assistive technology', () => {
        render(
            <ApplicationMenuWidgetEditorDialog
                open
                config={{
                    items: [
                        {
                            id: 'menu-item-structures',
                            kind: 'section',
                            title: { _primary: 'en', locales: { en: { content: 'Structures' } } },
                            sectionId: sectionOptions[0].id,
                            objectCollectionId: sectionOptions[0].id,
                            sortOrder: 0,
                            isActive: true
                        }
                    ]
                }}
                sectionOptions={sectionOptions}
                onSave={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Edit menu item: Structures' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove menu item: Structures' })).toBeInTheDocument()
    })

    it('saves side-menu display settings from the widget editor', () => {
        const onSave = vi.fn()
        render(<ApplicationMenuWidgetEditorDialog open config={null} sectionOptions={sectionOptions} onSave={onSave} onCancel={vi.fn()} />)

        fireEvent.click(screen.getByRole('checkbox', { name: 'Wide' }))
        fireEvent.change(screen.getByRole('combobox', { name: 'Primary display mode' }), { target: { value: 'overlay' } })
        fireEvent.click(screen.getByRole('switch', { name: 'Remember user choice' }))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'Menu widget' })).getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                sideMenu: {
                    availableModes: ['compact', 'overlay'],
                    primaryMode: 'overlay',
                    rememberUserChoice: false
                }
            })
        )
    })
})
