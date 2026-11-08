import type { DbExecutor } from '@universo-react/utils'
import { normalizeApplicationLayoutReadRoles, resolveApplicationLayoutReadRoles } from '../../controllers/applicationReadPolicy'

describe('application read policy', () => {
    it('defaults to owner/admin when settings are absent or empty', () => {
        expect(normalizeApplicationLayoutReadRoles(null)).toEqual(['owner', 'admin'])
        expect(normalizeApplicationLayoutReadRoles({})).toEqual(['owner', 'admin'])
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: {} })).toEqual(['owner', 'admin'])
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: { readRoles: [] } })).toEqual(['owner', 'admin'])
    })

    it('widens access with configured roles in the canonical order', () => {
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: { readRoles: ['member', 'editor'] } })).toEqual([
            'owner',
            'admin',
            'editor',
            'member'
        ])
    })

    it('falls back to owner/admin when the configured list contains an unknown role (strict policy)', () => {
        // The strict policy schema rejects the whole settings object on an
        // unknown role — an invalid policy must not silently widen access.
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: { readRoles: ['member', 'ghost'] as never } })).toEqual([
            'owner',
            'admin'
        ])
    })

    it('never narrows below owner/admin even with a restricted configured list', () => {
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: { readRoles: ['member'] } })).toContain('owner')
        expect(normalizeApplicationLayoutReadRoles({ applicationLayouts: { readRoles: ['member'] } })).toContain('admin')
    })

    it('resolves roles from the application settings row', async () => {
        const rows = [{ settings: { applicationLayouts: { readRoles: ['editor'] } } }]
        const executor = {
            query: async () => rows
        } as unknown as DbExecutor

        await expect(resolveApplicationLayoutReadRoles(executor, '0190a9b5-0000-7000-8000-000000000001')).resolves.toEqual([
            'owner',
            'admin',
            'editor'
        ])
    })
})
