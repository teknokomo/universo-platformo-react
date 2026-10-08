import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toFieldConfigs } from '../columns'
import { buildTabularColumns } from '../tabularColumns'

describe('buildTabularColumns', () => {
    it('hides technical and structured child fields while preserving safe REF selection', async () => {
        const rawUuid = '017f22e2-79b0-7cc3-98c4-dc0c0c073992'
        const [tableField] = toFieldConfigs({
            columns: [
                {
                    id: 'component-lines',
                    codename: 'Lines',
                    field: 'Lines',
                    dataType: 'TABLE',
                    headerName: 'Lines',
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {},
                    childColumns: [
                        {
                            id: 'child-title',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'child-owner',
                            codename: 'OwnerId',
                            field: 'OwnerId',
                            dataType: 'STRING',
                            headerName: 'Owner ID',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'child-resource',
                            codename: 'Resource',
                            field: 'Resource',
                            dataType: 'JSON',
                            headerName: 'Resource source',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { widget: 'resourceSource' }
                        },
                        {
                            id: 'child-blocks',
                            codename: 'Instructions',
                            field: 'Instructions',
                            dataType: 'JSON',
                            headerName: 'Instructions',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { widget: 'editorjsBlockContent' }
                        },
                        {
                            id: 'child-private',
                            codename: 'PrivateNote',
                            field: 'PrivateNote',
                            dataType: 'STRING',
                            headerName: 'Private note',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { formHidden: true }
                        },
                        {
                            id: 'child-project',
                            codename: 'Project',
                            field: 'ProjectId',
                            dataType: 'REF',
                            headerName: 'Project',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {},
                            refOptions: [
                                { id: rawUuid, label: rawUuid },
                                { id: 'project-one', label: 'Project one' }
                            ]
                        }
                    ]
                }
            ]
        } as never)
        const childFields = tableField?.childFields ?? []
        const onSelectChange = vi.fn()
        const columns = buildTabularColumns({
            childFields,
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            onSelectChange
        })

        expect(childFields.map(({ id }) => id)).toEqual(['Title', 'OwnerId', 'Resource', 'Instructions', 'PrivateNote', 'ProjectId'])
        expect(columns.map(({ field }) => field)).toEqual(['__rowNumber', 'Title', 'ProjectId', '__actions'])

        const projectColumn = columns.find(({ field }) => field === 'ProjectId')
        expect(projectColumn?.editable).toBe(false)
        render(
            <>
                {projectColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'ProjectId',
                    row: { ProjectId: '' },
                    value: ''
                } as never)}
            </>
        )

        const user = userEvent.setup()
        await user.click(screen.getByRole('combobox'))
        expect(screen.getByRole('option', { name: 'Project one' })).toBeVisible()
        expect(screen.queryByRole('option', { name: rawUuid })).not.toBeInTheDocument()
        await user.click(screen.getByRole('option', { name: 'Project one' }))

        expect(onSelectChange).toHaveBeenCalledExactlyOnceWith('row-1', 'ProjectId', 'project-one')
    })
})
