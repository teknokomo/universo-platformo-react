import type { AssignableRole } from '@universo/template-mui'
import type { MetahubLocalizedPayload, SimpleLocalizedInput } from '../../../types'
import type { MetahubCopyInput } from '../api'

export type MetahubDraftInput = { name: string; description?: string }

export interface UpdateMetahubParams {
    id: string
    data: MetahubDraftInput | MetahubLocalizedPayload
    expectedVersion?: number
}

export interface CopyMetahubParams {
    id: string
    data?: MetahubCopyInput
}

export interface UpdateMemberRoleParams {
    metahubId: string
    memberId: string
    data: { role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}

export interface RemoveMemberParams {
    metahubId: string
    memberId: string
}

export interface InviteMemberParams {
    metahubId: string
    data: { email: string; role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}
