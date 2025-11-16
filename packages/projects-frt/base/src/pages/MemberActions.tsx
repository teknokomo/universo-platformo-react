import { createMemberActions } from '@universo/template-mui'
import type { ProjectMember } from '../types'

/**
 * Member management actions for Projects (edit, remove)
 * Uses createMemberActions factory for code reusability across modules
 */
export default createMemberActions<ProjectMember>({
    i18nPrefix: 'projects',
    TaskType: 'Project'
})
