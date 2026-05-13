import { describe, expect, it } from 'vitest'

import type { MenuWidgetConfigItem } from '@universo/types'

import { isLayoutMenuSectionEntityType, normalizeEditableMenuItemKind, resolveMenuItemSectionTarget } from '../MenuWidgetEditorDialog'

describe('MenuWidgetEditorDialog helpers', () => {
    it('accepts only current menu editor kinds and falls back unknown values to links', () => {
        expect(normalizeEditableMenuItemKind('section')).toBe('section')
        expect(normalizeEditableMenuItemKind('hub')).toBe('hub')
        expect(normalizeEditableMenuItemKind('link')).toBe('link')
        expect(normalizeEditableMenuItemKind('unknown')).toBe('link')
    })

    it('resolves section targets from current section aliases', () => {
        expect(resolveMenuItemSectionTarget({ sectionId: 'section-1' } as MenuWidgetConfigItem)).toBe('section-1')
        expect(resolveMenuItemSectionTarget({ linkedCollectionId: 'section-2' } as MenuWidgetConfigItem)).toBe('section-2')
    })

    it('uses the Entity constructor layout capability to discover menu section targets', () => {
        expect(isLayoutMenuSectionEntityType({ components: { layoutConfig: { enabled: true } } })).toBe(true)
        expect(isLayoutMenuSectionEntityType({ components: { layoutConfig: false } })).toBe(false)
    })
})
