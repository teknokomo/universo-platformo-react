import type { WorkspaceSettingAddress } from '@universo-react/types'
import { isWorkspaceSettingAddressAllowed } from '../../shared/workspaceSettingsContracts'

describe('Workspace settings shared contracts', () => {
    const globalAddress = { key: 'sectionLinksEnabled', target: { kind: 'global' as const } }
    const widgetAddress = {
        key: 'interpretationNetwork.cellStylePolicy.editable.fillColor',
        target: { kind: 'widget' as const, instanceKey: 'matrix-main' }
    }

    it('preserves explicit Application delegation for global and widget settings', () => {
        expect(
            isWorkspaceSettingAddressAllowed(
                { workspaceOverrides: { allowedAddresses: [globalAddress], lockedAddresses: [] } },
                globalAddress
            )
        ).toBe(true)
        expect(
            isWorkspaceSettingAddressAllowed(
                { workspaceOverrides: { allowedAddresses: [widgetAddress], lockedAddresses: [] } },
                widgetAddress
            )
        ).toBe(true)
    })

    it('denies locked, undelegated, and malformed addresses', () => {
        const lockedPolicy = { workspaceOverrides: { allowedAddresses: [globalAddress], lockedAddresses: [globalAddress] } }
        const undelegatedPolicy = { workspaceOverrides: { allowedAddresses: [], lockedAddresses: [] } }
        const malformedAddress = {
            key: widgetAddress.key,
            target: { kind: 'widget' as const, instanceKey: '' }
        } as WorkspaceSettingAddress

        expect(isWorkspaceSettingAddressAllowed(lockedPolicy, globalAddress)).toBe(false)
        expect(isWorkspaceSettingAddressAllowed(undelegatedPolicy, widgetAddress)).toBe(false)
        expect(isWorkspaceSettingAddressAllowed(undelegatedPolicy, malformedAddress)).toBe(false)
    })
})
