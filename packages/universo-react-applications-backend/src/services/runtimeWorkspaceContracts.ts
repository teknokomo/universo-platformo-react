export const RUNTIME_WORKSPACE_ERROR_CODES = {
    workspaceNotFound: 'WORKSPACE_NOT_FOUND',
    userNotMember: 'USER_NOT_MEMBER',
    roleNotFound: 'WORKSPACE_ROLE_NOT_FOUND',
    memberNotFound: 'WORKSPACE_MEMBER_NOT_FOUND',
    personalWorkspaceMutationBlocked: 'PERSONAL_WORKSPACE_MUTATION_BLOCKED',
    workspaceConversionBlocked: 'WORKSPACE_CONVERSION_BLOCKED',
    memberWorkspaceOwnershipBlocked: 'APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED',
    lastOwnerRemovalBlocked: 'LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED',
    workspaceCopyReferenceUnresolved: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
    workspaceCopyAccessLinkIntakeInvalid: 'WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID',
    workspaceCopyTemplateMaterialsExcluded: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED'
} as const

export type RuntimeWorkspaceErrorCode = (typeof RUNTIME_WORKSPACE_ERROR_CODES)[keyof typeof RUNTIME_WORKSPACE_ERROR_CODES]

export class RuntimeWorkspaceError extends Error {
    code: RuntimeWorkspaceErrorCode

    constructor(code: RuntimeWorkspaceErrorCode, message: string) {
        super(message)
        this.name = 'RuntimeWorkspaceError'
        this.code = code
    }
}

export type RuntimeWorkspace = {
    id: string
    name: unknown
    description: unknown
    workspaceType: string
    personalUserId: string | null
    status: string
    isDefault: boolean
    roleCodename: string
}

export type RuntimeWorkspaceMember = {
    userId: string
    roleCodename: string
    email: string | null
    nickname: string | null
    canRemove: boolean
}

export type RuntimeWorkspaceMembership = {
    id: string
    userId: string
    workspaceId: string
    roleCodename: string
    isDefault: boolean
    workspaceType: string | null
    personalUserId: string | null
}
