import { describe, expect, it } from 'vitest'

import {
    WorkspacePolicyError,
    assertPublicationWorkspacePolicyTransition,
    parseWorkspaceModePolicy,
    resolveWorkspaceModeDecision
} from '../workspacePolicy'

describe('workspace policy helpers', () => {
    it('parses missing policy as optional', () => {
        expect(parseWorkspaceModePolicy(undefined)).toBe('optional')
        expect(parseWorkspaceModePolicy(null)).toBe('optional')
    })

    it('rejects unsupported policy values', () => {
        expect(() => parseWorkspaceModePolicy('workspace-enabled')).toThrow(WorkspacePolicyError)
    })

    it('resolves optional workspace mode from connector request', () => {
        expect(
            resolveWorkspaceModeDecision({
                policy: 'optional',
                requested: true,
                applicationAlreadyEnabled: false,
                schemaAlreadyInstalled: false,
                acknowledgementReceived: true
            })
        ).toBe(true)
        expect(
            resolveWorkspaceModeDecision({
                policy: 'optional',
                requested: null,
                applicationAlreadyEnabled: false,
                schemaAlreadyInstalled: false,
                acknowledgementReceived: false
            })
        ).toBe(false)
    })

    it('blocks turning workspace mode off after enablement', () => {
        expect(() =>
            resolveWorkspaceModeDecision({
                policy: 'optional',
                requested: false,
                applicationAlreadyEnabled: true,
                schemaAlreadyInstalled: true,
                acknowledgementReceived: true
            })
        ).toThrow(WorkspacePolicyError)
    })

    it('enables workspace mode without application-admin acknowledgement when publication requires it', () => {
        expect(
            resolveWorkspaceModeDecision({
                policy: 'required',
                requested: null,
                applicationAlreadyEnabled: false,
                schemaAlreadyInstalled: false,
                acknowledgementReceived: false
            })
        ).toBe(true)
    })

    it('requires acknowledgement before optional policy enables workspaces', () => {
        expect(() =>
            resolveWorkspaceModeDecision({
                policy: 'optional',
                requested: true,
                applicationAlreadyEnabled: false,
                schemaAlreadyInstalled: false,
                acknowledgementReceived: false
            })
        ).toThrow(/acknowledgement/)
    })

    it('enforces irreversible publication required policy', () => {
        expect(() =>
            assertPublicationWorkspacePolicyTransition({
                previousRequired: true,
                requested: 'optional',
                acknowledgementReceived: true
            })
        ).toThrow(/cannot be downgraded/)

        expect(
            assertPublicationWorkspacePolicyTransition({
                previousRequired: false,
                requested: 'required',
                acknowledgementReceived: true
            })
        ).toBe('required')
    })

    it('requires acknowledgement the first time publication policy becomes required', () => {
        expect(() =>
            assertPublicationWorkspacePolicyTransition({
                previousRequired: false,
                requested: 'required',
                acknowledgementReceived: false
            })
        ).toThrow(/requires irreversible-action acknowledgement/)
    })
})
