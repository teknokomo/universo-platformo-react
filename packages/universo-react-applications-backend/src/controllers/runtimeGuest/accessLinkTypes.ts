import type { PublicRuntimeObjectBinding } from '../../shared/publicRuntimeAccess'
import type { GuestIntakePolicy } from '@universo-react/types'

export type GuestAssessmentAccessLink = {
    id: string
    slug: string
    title: unknown
    targetType: string
    targetId: string
    contentNodeIdRef: string | null
    isActive: boolean
    expiresAt: string | null
    maxUses: number | null
    useCount: number | null
    classId: string | null
    intake: GuestIntakePolicy
    workspaceId: string | null
    binding: PublicRuntimeObjectBinding
    columns: {
        slug: string
        targetType: string
        targetId: string
        contentNodeIdRef: string | null
        isActive: string
        expiresAt: string | null
        maxUses: string | null
        useCount: string | null
        title: string | null
        classId: string | null
        showFirstName: string | null
        requireFirstName: string | null
        showLastName: string | null
        requireLastName: string | null
        showEmail: string | null
        requireEmail: string | null
        showPhone: string | null
        requirePhone: string | null
        captchaEnabled: string | null
    }
}
