import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { GridColDef } from '@mui/x-data-grid'
import { toFieldConfigs, toGridColumns } from '../columns'

const renderGridCell = (column: GridColDef, value: unknown) =>
    column.renderCell?.({
        id: 'row-1',
        field: column.field,
        row: { id: 'row-1' },
        value
    } as never)

const localizedText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

describe('toFieldConfigs', () => {
    it('preserves component uiConfig for metadata-driven runtime form widgets', () => {
        const [field] = toFieldConfigs({
            columns: [
                {
                    id: 'component-content',
                    codename: 'Content',
                    field: 'content',
                    dataType: 'JSON',
                    headerName: 'Content',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph', 'header'],
                            maxBlocks: 5
                        }
                    }
                }
            ]
        } as never)

        expect(field).toMatchObject({
            id: 'content',
            type: 'JSON',
            uiConfig: {
                widget: 'editorjsBlockContent',
                blockEditor: {
                    allowedBlockTypes: ['paragraph', 'header'],
                    maxBlocks: 5
                }
            }
        })
    })

    it('maps semantic long-text string columns to textarea fields without explicit widget metadata', () => {
        const fields = toFieldConfigs({
            columns: [
                {
                    id: 'component-description',
                    codename: 'Description',
                    field: 'Description',
                    dataType: 'STRING',
                    headerName: 'Description',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-instructions',
                    codename: 'AssignmentInstructions',
                    field: 'AssignmentInstructions',
                    dataType: 'STRING',
                    headerName: 'Instructions',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        expect(fields.map((field) => [field.id, field.widget])).toEqual([
            ['Description', 'textarea'],
            ['AssignmentInstructions', 'textarea'],
            ['Title', undefined]
        ])
    })
})

describe('toGridColumns', () => {
    it('omits metadata-hidden columns from the runtime grid', () => {
        const columns = toGridColumns({
            columns: [
                {
                    id: 'component-title',
                    codename: 'Title',
                    field: 'Title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: true,
                    validationRules: {},
                    uiConfig: {}
                },
                {
                    id: 'component-manual-flag',
                    codename: 'NameManuallyEdited',
                    field: 'NameManuallyEdited',
                    dataType: 'BOOLEAN',
                    headerName: 'Name manually edited',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        hidden: true
                    }
                }
            ]
        } as never)

        expect(columns.map((column) => column.field)).toEqual(['Title'])
    })

    it('respects metadata sort and filter guards for runtime projection columns', () => {
        const [typeColumn] = toGridColumns({
            columns: [
                {
                    id: 'union-type',
                    codename: 'Type',
                    field: 'type',
                    dataType: 'STRING',
                    headerName: 'Type',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        gridSortable: false,
                        gridFilterable: false
                    }
                }
            ]
        } as never)

        expect(typeColumn.sortable).toBe(false)
        expect(typeColumn.filterable).toBe(false)
    })

    it('applies metadata width and flex hints to runtime grid columns', () => {
        const [fixedColumn, flexibleColumn] = toGridColumns({
            columns: [
                {
                    id: 'fixed',
                    codename: 'Title',
                    field: 'title',
                    dataType: 'STRING',
                    headerName: 'Title',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { gridWidth: 220 }
                },
                {
                    id: 'flexible',
                    codename: 'Status',
                    field: 'status',
                    dataType: 'STRING',
                    headerName: 'Status',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: { gridFlex: 0.5 }
                }
            ]
        } as never)

        expect(fixedColumn.width).toBe(220)
        expect(fixedColumn.flex).toBeUndefined()
        expect(flexibleColumn.flex).toBe(0.5)
    })

    it('formats default runtime grid cells without leaking raw IDs or runtime JSON', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-title',
                        codename: 'Title',
                        field: 'Title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    }
                ]
            } as never,
            { locale: 'ru' }
        )

        expect(renderGridCell(column, localizedText('Readable title', 'Читаемый заголовок'))).toBe('Читаемый заголовок')
        expect(renderGridCell(column, rawRecordId)).toBe('')
        expect(renderGridCell(column, '{"blocks":[{"type":"paragraph"}]}')).toBe('')
        expect(renderGridCell(column, { blocks: [{ type: 'paragraph' }] })).toBe('')
        expect(renderGridCell(column, { codename: 'LearningResources' })).toBe('')
        expect(renderGridCell(column, { id: 'project-1' })).toBe('')
        expect(renderGridCell(column, { displayName: 'Readable display name', codename: 'LearningResources' })).toBe(
            'Readable display name'
        )
    })

    it('formats semantic long-text cells through safe runtime display text', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns({
            columns: [
                {
                    id: 'component-description',
                    codename: 'Description',
                    field: 'Description',
                    dataType: 'STRING',
                    headerName: 'Description',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {}
                }
            ]
        } as never)

        const { container, rerender } = render(<>{renderGridCell(column, 'Linked record ' + rawRecordId)}</>)
        expect(container).not.toHaveTextContent('Linked record')
        expect(container).not.toHaveTextContent(rawRecordId)

        rerender(<>{renderGridCell(column, localizedText('Readable notes', 'Readable notes'))}</>)
        expect(container).toHaveTextContent('Readable notes')
    })

    it('uses safe REF object labels and falls back to human option labels', () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-project',
                        codename: 'Project',
                        field: 'ProjectId',
                        dataType: 'REF',
                        headerName: 'Project',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {},
                        refOptions: [{ id: rawRecordId, label: 'Readable project' }]
                    }
                ]
            } as never,
            { locale: 'en' }
        )

        expect(renderGridCell(column, { label: 'Readable object label', id: rawRecordId })).toBe('Readable object label')
        expect(renderGridCell(column, { label: rawRecordId, id: rawRecordId })).toBe('Readable project')
        expect(renderGridCell(column, { name: '{"recordId":"017f22e2-79b0-7cc3-98c4-dc0c0c073988"}', id: 'missing' })).toBe('')
    })

    it('supports row-aware accessible labels for runtime row action menus', () => {
        const [actionsColumn] = toGridColumns(
            {
                columns: []
            } as never,
            {
                actionsAriaLabel: 'Actions',
                getRowActionsAriaLabel: (row) => `Actions for ${String(row.Title)}`,
                onMenuOpen: () => undefined
            }
        )

        const rendered = render(
            <>
                {actionsColumn.renderCell?.({
                    id: 'row-1',
                    field: 'actions',
                    row: { id: 'row-1', Title: 'Onboarding course' },
                    value: undefined
                } as never)}
            </>
        )

        expect(rendered.getByRole('button', { name: 'Actions for Onboarding course' })).toBeVisible()
    })

    it('renders STRING option labels in runtime grid cells', () => {
        const [column] = toGridColumns(
            {
                columns: [
                    {
                        id: 'component-completion-condition',
                        codename: 'CompletionCondition',
                        field: 'CompletionCondition',
                        dataType: 'STRING',
                        headerName: 'Completion condition',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {
                            widget: 'select',
                            stringOptions: [
                                { value: 'allItems', label: localizedText('All items', 'Все элементы') },
                                { value: 'selectedItems', label: localizedText('Selected items', 'Выбранные элементы') }
                            ]
                        }
                    }
                ]
            } as never,
            { locale: 'ru' }
        )

        expect(renderGridCell(column, 'selectedItems')).toBe('Выбранные элементы')
    })
})
