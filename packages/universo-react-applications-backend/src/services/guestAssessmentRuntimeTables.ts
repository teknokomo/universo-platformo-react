import type { DbExecutor } from '@universo-react/utils'
import { IDENTIFIER_REGEX, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'
import { resolvePublicRuntimeObject, resolveTopLevelComponents, type PublicRuntimeObjectBinding } from '../shared/publicRuntimeAccess'
import type { GuestAssessmentAttemptTable, GuestAssessmentResponseTable } from '../persistence/guestAssessmentAttemptStore'
import type { PublicGuestAssessmentRuntimeConfig, PublicGuestRuntimeConfig } from './publicGuestRuntimeConfig'

export interface GuestAssessmentRuntimeTables {
    attemptBinding: PublicRuntimeObjectBinding
    responseBinding: PublicRuntimeObjectBinding
    attemptTable: GuestAssessmentAttemptTable
    responseTable: GuestAssessmentResponseTable
}

const indexByCodename = <T extends { codename: unknown }>(items: T[]) =>
    Object.fromEntries(items.map((item) => [resolveRuntimeCodenameText(item.codename), item]))

export const resolveGuestAssessmentRuntimeTables = async (
    executor: DbExecutor,
    schemaName: string,
    config: PublicGuestRuntimeConfig,
    workspaceId: string | null
): Promise<GuestAssessmentRuntimeTables | null> => {
    const assessmentConfig = config.assessment
    if (!assessmentConfig) return null

    const [attemptBinding, responseBinding] = await Promise.all([
        resolvePublicRuntimeObject(executor, schemaName, assessmentConfig.objects.assessmentAttempts),
        resolvePublicRuntimeObject(executor, schemaName, assessmentConfig.objects.assessmentResponses)
    ])
    if (!attemptBinding || !responseBinding) return null

    const attemptAttrs = indexByCodename(resolveTopLevelComponents(attemptBinding))
    const responseAttrs = indexByCodename(resolveTopLevelComponents(responseBinding))
    const attemptColumns = Object.fromEntries(
        Object.entries(assessmentConfig.fields.assessmentAttempt).map(([key, codename]) => [key, attemptAttrs[codename]?.column_name])
    ) as Record<keyof PublicGuestAssessmentRuntimeConfig['fields']['assessmentAttempt'], string | undefined>
    const responseColumns = Object.fromEntries(
        Object.entries(assessmentConfig.fields.assessmentResponse).map(([key, codename]) => [key, responseAttrs[codename]?.column_name])
    ) as Record<keyof PublicGuestAssessmentRuntimeConfig['fields']['assessmentResponse'], string | undefined>

    const allColumns = [...Object.values(attemptColumns), ...Object.values(responseColumns)]
    if (allColumns.some((column) => !column || !IDENTIFIER_REGEX.test(column))) return null

    return {
        attemptBinding,
        responseBinding,
        attemptTable: {
            schemaName,
            tableName: attemptBinding.tableName,
            workspaceId,
            columns: attemptColumns as GuestAssessmentAttemptTable['columns']
        },
        responseTable: {
            schemaName,
            tableName: responseBinding.tableName,
            workspaceId,
            columns: responseColumns as GuestAssessmentResponseTable['columns']
        }
    }
}
