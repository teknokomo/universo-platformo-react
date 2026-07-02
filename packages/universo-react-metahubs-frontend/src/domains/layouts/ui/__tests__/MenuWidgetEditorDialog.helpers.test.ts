import { describe, expect, it } from 'vitest'

import type { MenuWidgetConfigItem } from '@universo-react/types'

import {
    applySideMenuPatch,
    isAllowedMenuStartPage,
    isLayoutMenuSectionEntityType,
    normalizeSideMenuConfig,
    normalizeEditableMenuItemKind,
    resolveMenuItemSectionTarget
} from '../MenuWidgetEditorDialog'

describe('MenuWidgetEditorDialog helpers', () => {
    it('accepts only current menu editor kinds and falls back unknown values to links', () => {
        expect(normalizeEditableMenuItemKind('section')).toBe('section')
        expect(normalizeEditableMenuItemKind('hub')).toBe('hub')
        expect(normalizeEditableMenuItemKind('link')).toBe('link')
        expect(normalizeEditableMenuItemKind('unknown')).toBe('link')
    })

    it('resolves section targets from current section aliases', () => {
        expect(resolveMenuItemSectionTarget({ sectionId: 'section-1' } as MenuWidgetConfigItem)).toBe('section-1')
        expect(resolveMenuItemSectionTarget({ objectCollectionId: 'section-2' } as MenuWidgetConfigItem)).toBe('section-2')
    })

    it('uses the Entity constructor layout capability to discover menu section targets', () => {
        expect(isLayoutMenuSectionEntityType({ capabilities: { layoutConfig: { enabled: true } } })).toBe(true)
        expect(isLayoutMenuSectionEntityType({ capabilities: { layoutConfig: false } })).toBe(false)
    })

    it('allows start pages only from UUID-backed selectable options', () => {
        const options = [
            { id: '019f1423-9a35-7d96-9c61-7816ee969ad1', label: 'Structures' },
            { id: 'legacy-codename', label: 'Unavailable configured section', disabled: true }
        ]

        expect(isAllowedMenuStartPage('019f1423-9a35-7d96-9c61-7816ee969ad1', options)).toBe(true)
        expect(isAllowedMenuStartPage('Structure', options)).toBe(false)
        expect(isAllowedMenuStartPage('legacy-codename', options)).toBe(false)
        expect(isAllowedMenuStartPage(null, options)).toBe(false)
    })

    it('normalizes side-menu widget display settings and keeps primary mode selectable', () => {
        expect(
            normalizeSideMenuConfig({
                availableModes: ['compact', 'overlay'],
                primaryMode: 'wide',
                rememberUserChoice: false
            })
        ).toEqual({
            availableModes: ['compact', 'overlay'],
            primaryMode: 'compact',
            rememberUserChoice: false
        })

        expect(applySideMenuPatch({ availableModes: ['wide'], primaryMode: 'wide' }, { availableModes: ['overlay'] })).toEqual({
            availableModes: ['overlay'],
            primaryMode: 'overlay',
            rememberUserChoice: true
        })
    })
})
