import { getLayoutAuthoringDropTargetLabel, type LayoutAuthoringZone } from '../LayoutAuthoringDetails'

const zones: LayoutAuthoringZone[] = [
    {
        zone: 'marketing-header',
        title: 'Marketing header',
        items: [],
        groups: [
            { key: 'start', title: 'Start', items: [] },
            { key: 'end', title: 'End', items: [] }
        ],
        availableWidgets: []
    }
]

describe('LayoutAuthoringDetails accessibility labels', () => {
    it('announces grouped drop targets with user-facing zone and group labels', () => {
        expect(getLayoutAuthoringDropTargetLabel(zones, 'zone:marketing-header:group:end', 'Move widget')).toBe('Marketing header: End')
    })

    it('never exposes malformed or unknown technical droppable IDs', () => {
        expect(getLayoutAuthoringDropTargetLabel(zones, 'zone:marketing-header:group:missing', 'Move widget')).toBe('Marketing header')
        expect(getLayoutAuthoringDropTargetLabel(zones, 'zone:unknown:group:end', 'Move widget')).toBe('Move widget')
        expect(getLayoutAuthoringDropTargetLabel(zones, 'widget:technical-id', 'Move widget')).toBe('Move widget')
    })
})
