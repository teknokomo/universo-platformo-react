import type { DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'

/** Keep the server-owned relationship fields required by the generic relationBuilder contract. */
export const assertLmsGuestAccessRelationFields = (context: DashboardFixtureValidationContext): void => {
    const accessLinks = context.entityByCodename.get('AccessLinks')
    const quizzes = context.entityByCodename.get('Quizzes')
    const findField = (codename: string) =>
        accessLinks?.fields?.find((field) => context.readLocalizedText(field.codename, 'en') === codename)
    const targetId = findField('TargetId')
    const targetIdUiConfig = context.readRecord(targetId?.uiConfig)
    const targetType = findField('TargetType')
    const targetTypeUiConfig = context.readRecord(targetType?.uiConfig)
    const useCount = findField('UseCount')
    const useCountUiConfig = context.readRecord(useCount?.uiConfig)
    const sortOrder = findField('SortOrder')
    const sortOrderUiConfig = context.readRecord(sortOrder?.uiConfig)

    if (
        targetId?.dataType !== 'REF' ||
        targetId.targetEntityKind !== 'object' ||
        targetId.targetEntityId !== quizzes?.id ||
        targetIdUiConfig?.serverOwned !== true
    ) {
        context.errors.push('LMS AccessLinks.TargetId must be a server-owned REF to the Quizzes Object')
    }
    if (targetType?.dataType !== 'STRING' || targetTypeUiConfig?.serverOwned !== true || targetTypeUiConfig?.defaultValue !== 'quiz') {
        context.errors.push('LMS AccessLinks.TargetType must be a server-owned STRING defaulting to quiz')
    }
    if (
        useCount?.dataType !== 'NUMBER' ||
        useCountUiConfig?.serverOwned !== true ||
        useCountUiConfig?.defaultValue !== 0 ||
        useCountUiConfig?.resetOnCopy !== true
    ) {
        context.errors.push('LMS AccessLinks.UseCount must be a server-owned NUMBER defaulting to zero and reset on copy')
    }
    if (sortOrder?.dataType !== 'NUMBER' || sortOrderUiConfig?.serverOwned !== true) {
        context.errors.push('LMS AccessLinks.SortOrder must be a server-owned NUMBER for relationBuilder writes')
    }
}
