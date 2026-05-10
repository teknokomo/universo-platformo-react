import type { WorkspaceModePolicy } from '@universo/types'

const DEFAULT_WORKSPACE_MODE_POLICY: WorkspaceModePolicy = 'optional'
const WORKSPACE_MODE_POLICY_VALUES = new Set<string>(['optional', 'required'])
const isWorkspaceModePolicy = (value: unknown): value is WorkspaceModePolicy =>
    typeof value === 'string' && WORKSPACE_MODE_POLICY_VALUES.has(value)

export class WorkspacePolicyError extends Error {
    constructor(
        public readonly code:
            | 'WORKSPACE_POLICY_REQUIRED_DOWNGRADE'
            | 'WORKSPACE_ENABLEMENT_ACK_REQUIRED'
            | 'WORKSPACE_POLICY_INVALID'
            | 'WORKSPACE_MODE_ALREADY_ENABLED',
        message: string
    ) {
        super(message)
        this.name = 'WorkspacePolicyError'
    }
}

export interface ResolveWorkspaceModeInput {
    policy?: WorkspaceModePolicy | null
    requested: boolean | null
    applicationAlreadyEnabled: boolean
    schemaAlreadyInstalled: boolean
    acknowledgementReceived: boolean
}

export interface PublicationWorkspacePolicyTransitionInput {
    previousRequired: boolean
    requested?: WorkspaceModePolicy | null
    acknowledgementReceived: boolean
}

export const parseWorkspaceModePolicy = (value: unknown): WorkspaceModePolicy => {
    if (value === null || value === undefined || value === '') {
        return DEFAULT_WORKSPACE_MODE_POLICY
    }

    if (!isWorkspaceModePolicy(value)) {
        throw new WorkspacePolicyError('WORKSPACE_POLICY_INVALID', `Unsupported workspace mode policy: ${String(value)}`)
    }

    return value
}

export function resolveWorkspaceModeDecision(input: ResolveWorkspaceModeInput): boolean {
    const policy = input.policy ?? DEFAULT_WORKSPACE_MODE_POLICY

    if (input.applicationAlreadyEnabled) {
        if (input.requested === false) {
            throw new WorkspacePolicyError(
                'WORKSPACE_MODE_ALREADY_ENABLED',
                'Workspace mode cannot be turned off after it has been enabled.'
            )
        }
        return true
    }

    if (policy === 'required') {
        if (!input.acknowledgementReceived) {
            throw new WorkspacePolicyError(
                'WORKSPACE_ENABLEMENT_ACK_REQUIRED',
                'Enabling workspace mode requires irreversible-action acknowledgement.'
            )
        }
        return true
    }

    if (input.requested === true && !input.acknowledgementReceived) {
        throw new WorkspacePolicyError(
            'WORKSPACE_ENABLEMENT_ACK_REQUIRED',
            'Enabling workspace mode requires irreversible-action acknowledgement.'
        )
    }

    return input.requested === true
}

export function assertPublicationWorkspacePolicyTransition(input: PublicationWorkspacePolicyTransitionInput): WorkspaceModePolicy {
    const requested = parseWorkspaceModePolicy(input.requested)

    if (input.previousRequired && requested !== 'required') {
        throw new WorkspacePolicyError(
            'WORKSPACE_POLICY_REQUIRED_DOWNGRADE',
            'Workspace mode required by an earlier publication version cannot be downgraded.'
        )
    }

    if (requested === 'required' && !input.previousRequired && !input.acknowledgementReceived) {
        throw new WorkspacePolicyError(
            'WORKSPACE_ENABLEMENT_ACK_REQUIRED',
            'Selecting required workspace mode requires irreversible-action acknowledgement.'
        )
    }

    return requested
}
