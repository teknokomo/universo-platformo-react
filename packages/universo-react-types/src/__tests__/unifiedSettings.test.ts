import { describe, expect, it } from 'vitest'

import {
    applyWorkspaceSettingOverrides,
    isWorkspaceSettingAllowed,
    normalizeApplicationWorkspaceOverridePolicy,
    resolveEffectiveSetting,
    getUnifiedSettingDefinition
} from '../common/unifiedSettings'

describe('unified workspace settings', () => {
    it('distinguishes missing workspace override policy from an explicit empty allowlist', () => {
        expect(normalizeApplicationWorkspaceOverridePolicy({}).allowedKeys).toContain('sectionLinksEnabled')
        expect(
            normalizeApplicationWorkspaceOverridePolicy({ workspaceOverrides: { allowedKeys: [], lockedKeys: [] } }).allowedKeys
        ).toEqual([])
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: {
                    allowedKeys: ['sectionLinksEnabled', 'unknown-setting'],
                    lockedKeys: ['sectionLinksEnabled']
                }
            })
        ).toEqual({
            allowedKeys: [],
            lockedKeys: ['sectionLinksEnabled']
        })
    })

    it('applies only application-allowed workspace overrides through nested setting keys', () => {
        const settings = {
            sectionLinksEnabled: true,
            learningContent: { defaultView: 'table' },
            workspaceOverrides: {
                allowedKeys: ['sectionLinksEnabled', 'learningContent.defaultView'],
                lockedKeys: []
            }
        }

        expect(isWorkspaceSettingAllowed(settings, 'sectionLinksEnabled')).toBe(true)
        expect(isWorkspaceSettingAllowed(settings, 'learningContent.playerPreset.showOutline')).toBe(false)
        expect(
            applyWorkspaceSettingOverrides(settings, {
                sectionLinksEnabled: false,
                'learningContent.defaultView': 'cards',
                'learningContent.playerPreset.showOutline': false
            })
        ).toMatchObject({
            sectionLinksEnabled: false,
            learningContent: { defaultView: 'cards' }
        })
    })

    it('resolves inherited application values separately from workspace values', () => {
        const definition = getUnifiedSettingDefinition('sectionLinksEnabled')
        expect(definition).toBeDefined()

        const inherited = resolveEffectiveSetting(definition!, {
            sectionLinksEnabled: true,
            workspaceOverrides: {
                allowedKeys: ['sectionLinksEnabled'],
                lockedKeys: []
            }
        })

        const overridden = resolveEffectiveSetting(
            definition!,
            {
                sectionLinksEnabled: true,
                workspaceOverrides: {
                    allowedKeys: ['sectionLinksEnabled'],
                    lockedKeys: []
                }
            },
            { sectionLinksEnabled: false }
        )

        expect(inherited).toMatchObject({ value: true, source: 'application', isInherited: true })
        expect(overridden).toMatchObject({ value: false, source: 'workspace', isInherited: false })
    })
})
