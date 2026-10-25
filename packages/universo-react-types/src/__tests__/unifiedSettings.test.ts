import { describe, expect, it } from 'vitest'

import {
    applyWorkspaceSettingOverrides,
    applicationWorkspaceOverridePolicySchema,
    isWorkspaceSettingAllowed,
    isWorkspaceSettingAddressAllowed,
    workspaceSettingAddressSchema,
    workspaceSettingBatchUpdateSchema,
    getDefaultWorkspaceOverrideAllowedAddresses,
    normalizeApplicationWorkspaceOverridePolicy,
    resolveEffectiveSetting,
    getUnifiedSettingDefinition
} from '../common/unifiedSettings'

const globalAddress = (key: string) => ({ key, target: { kind: 'global' as const } })
const widgetAddress = (key: string, instanceKey = 'matrix-main') => ({ key, target: { kind: 'widget' as const, instanceKey } })

describe('unified workspace settings', () => {
    it('distinguishes missing workspace override policy from an explicit empty allowlist', () => {
        expect(normalizeApplicationWorkspaceOverridePolicy({}).allowedAddresses).toContainEqual(globalAddress('sectionLinksEnabled'))
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: { allowedAddresses: [], lockedAddresses: [] }
            }).allowedAddresses
        ).toEqual([])
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: {
                    allowedAddresses: [
                        globalAddress('sectionLinksEnabled'),
                        globalAddress('unknown-setting'),
                        widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor'),
                        widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor')
                    ],
                    lockedAddresses: [globalAddress('sectionLinksEnabled')]
                }
            })
        ).toEqual({
            allowedAddresses: [widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor')],
            lockedAddresses: [globalAddress('sectionLinksEnabled')]
        })
    })

    it('validates semantic setting addresses, rejects physical identifiers, and defaults v1 key-only requests to global', () => {
        expect(applicationWorkspaceOverridePolicySchema.safeParse({ allowedKeys: ['sectionLinksEnabled'] }).success).toBe(false)
        expect(workspaceSettingAddressSchema.safeParse(globalAddress('sectionLinksEnabled')).success).toBe(true)
        expect(workspaceSettingAddressSchema.safeParse({ ...widgetAddress('theme'), layoutId: 'layout-1' }).success).toBe(false)
        expect(workspaceSettingAddressSchema.safeParse({ key: 'theme', target: { kind: 'layout', layoutId: 'layout-1' } }).success).toBe(
            false
        )
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({ settings: [{ key: 'sectionLinksEnabled', value: false }] }).data
        ).toMatchObject({
            settings: [{ key: 'sectionLinksEnabled', target: { kind: 'global' }, value: false }]
        })
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({
                settings: [{ ...globalAddress('sectionLinksEnabled'), value: false }],
                resetKeys: ['sectionLinksEnabled']
            }).success
        ).toBe(false)
    })

    it('rejects retired key aliases and accepts only canonical semantic addresses', () => {
        const address = widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor')
        expect(
            applicationWorkspaceOverridePolicySchema.safeParse({
                allowedAddresses: [globalAddress('sectionLinksEnabled')],
                lockedAddresses: [],
                allowedKeys: ['sectionLinksEnabled']
            }).success
        ).toBe(false)
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: {
                    allowedAddresses: [globalAddress('sectionLinksEnabled'), address],
                    lockedAddresses: [],
                    allowedKeys: ['sectionLinksEnabled'],
                    lockedKeys: []
                }
            })
        ).toEqual({
            allowedAddresses: [],
            lockedAddresses: []
        })
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: { allowedKeys: ['sectionLinksEnabled'], lockedKeys: [] }
            }).allowedAddresses
        ).toEqual([])
    })

    it('rejects a duplicate semantic address across a set and reset operation', () => {
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({
                settings: [{ ...widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor'), value: true }],
                resets: [widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor')]
            }).success
        ).toBe(false)
        expect(
            workspaceSettingBatchUpdateSchema.safeParse({
                settings: [{ ...widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor'), value: true }],
                resets: [widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor', 'another-matrix')]
            }).success
        ).toBe(true)
    })

    it('applies only application-allowed workspace overrides through nested setting keys', () => {
        const settings = {
            sectionLinksEnabled: true,
            learningContent: { defaultView: 'table' },
            workspaceOverrides: {
                allowedAddresses: [globalAddress('sectionLinksEnabled'), globalAddress('learningContent.defaultView')],
                lockedAddresses: []
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
                allowedAddresses: [globalAddress('sectionLinksEnabled')],
                lockedAddresses: []
            }
        })

        const overridden = resolveEffectiveSetting(
            definition!,
            {
                sectionLinksEnabled: true,
                workspaceOverrides: {
                    allowedAddresses: [globalAddress('sectionLinksEnabled')],
                    lockedAddresses: []
                }
            },
            { sectionLinksEnabled: false }
        )

        expect(inherited).toMatchObject({ value: true, source: 'application', isInherited: true })
        expect(overridden).toMatchObject({ value: false, source: 'workspace', isInherited: false })
    })

    it('does not delegate widget settings by default and respects explicit allow and lock addresses', () => {
        const address = widgetAddress('interpretationNetwork.cellStylePolicy.editable.fillColor')
        const unknownAddress = widgetAddress('interpretationNetwork.cellStylePolicy.editable.script')
        const defaults = normalizeApplicationWorkspaceOverridePolicy({})
        expect(defaults.allowedAddresses).toEqual(getDefaultWorkspaceOverrideAllowedAddresses())
        expect(defaults.allowedAddresses.some((item) => item.target.kind === 'widget')).toBe(false)
        expect(isWorkspaceSettingAddressAllowed({}, address)).toBe(false)
        expect(
            isWorkspaceSettingAddressAllowed({ workspaceOverrides: { allowedAddresses: [address], lockedAddresses: [] } }, address)
        ).toBe(true)
        expect(
            isWorkspaceSettingAddressAllowed({ workspaceOverrides: { allowedAddresses: [address], lockedAddresses: [address] } }, address)
        ).toBe(false)
        expect(
            normalizeApplicationWorkspaceOverridePolicy({
                workspaceOverrides: { allowedAddresses: [address, unknownAddress], lockedAddresses: [] }
            }).allowedAddresses
        ).toEqual([address])
        expect(
            isWorkspaceSettingAddressAllowed(
                { workspaceOverrides: { allowedAddresses: [unknownAddress], lockedAddresses: [] } },
                unknownAddress
            )
        ).toBe(false)
    })
})
