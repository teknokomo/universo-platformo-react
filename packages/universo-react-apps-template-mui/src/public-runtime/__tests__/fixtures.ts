import type { PublicInterpretationNetworkReadResponse } from '@universo-react/types'

export const handles = {
    structure: 'pn1.public_structure_handle_example',
    interpretation: 'pn1.public_interpretation_handle_example',
    cell: 'pn1.public_cell_handle_example',
    row: 'pn1.public_row_handle_example',
    column: 'pn1.public_column_handle_example'
}
export const scope = { applicationRef: 'public-network', locale: 'en', instanceKey: 'network-main' }
const page = { offset: 0, limit: 25, hasMore: false }
export const responses: Record<PublicInterpretationNetworkReadResponse['view'], PublicInterpretationNetworkReadResponse> = {
    structures: {
        view: 'structures',
        locale: 'en',
        page,
        items: [{ handle: handles.structure, name: 'Cities', description: 'Public structures' }]
    },
    interpretations: {
        view: 'interpretations',
        locale: 'en',
        page,
        structure: { handle: handles.structure, name: 'Cities', description: null },
        items: [{ handle: handles.interpretation, title: 'Cultural history' }]
    },
    matrix: {
        view: 'matrix',
        locale: 'en',
        page,
        interpretation: { handle: handles.interpretation, title: 'Cultural history' },
        items: [
            {
                handle: handles.cell,
                parentHandle: null,
                rowHandle: handles.row,
                rowLabel: 'History',
                columnHandle: handles.column,
                columnLabel: 'Places',
                value: 'Suzdal',
                description: 'City timeline first line\nCity timeline second line',
                sortOrder: 0,
                style: {}
            }
        ]
    },
    materials: {
        view: 'materials',
        locale: 'en',
        page,
        cellHandle: handles.cell,
        items: [
            { title: 'City guide', description: 'Public introduction', bodyText: '<script>plain text only</script>', isPrimary: true },
            { title: 'Visitor notes', description: null, bodyText: 'Additional information', isPrimary: false }
        ]
    }
}
