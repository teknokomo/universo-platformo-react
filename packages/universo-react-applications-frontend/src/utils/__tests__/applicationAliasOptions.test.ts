import { describe, expect, it } from 'vitest'

import { buildApplicationAliasPickerOptions } from '../applicationAliasOptions'

const name = (en: string) => ({ locales: { en: { content: en } }, _primary: 'en' })

describe('application alias picker options', () => {
    it('keeps the localized name as the only label when names are unique', () => {
        const options = buildApplicationAliasPickerOptions(
            [
                { id: 'app-1', name: name('Meridian'), context: 'Eurasian corridor' },
                { id: 'app-2', name: name('Northline') }
            ],
            'en'
        )

        expect(options).toEqual([
            { id: 'app-1', label: 'Meridian' },
            { id: 'app-2', label: 'Northline' }
        ])
    })

    it('adds the localized description as a human-readable disambiguator for duplicate names', () => {
        const options = buildApplicationAliasPickerOptions(
            [
                { id: 'app-1', name: name('Meridian'), context: 'Eurasian corridor' },
                { id: 'app-2', name: name('Meridian'), context: 'Baltic programme' },
                { id: 'app-3', name: name('Meridian'), context: null }
            ],
            'en'
        )

        expect(options[0]).toEqual({ id: 'app-1', label: 'Meridian', secondaryLabel: 'Eurasian corridor' })
        expect(options[1]).toEqual({ id: 'app-2', label: 'Meridian', secondaryLabel: 'Baltic programme' })
        // A duplicate without any human context keeps a bare name rather than
        // falling back to identifiers.
        expect(options[2]).toEqual({ id: 'app-3', label: 'Meridian' })
    })
})
