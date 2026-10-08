import type { DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'

export const assertLmsLearningResourcesSortOrder = (context: DashboardFixtureValidationContext): void => {
    const entity = context.entityByCodename.get('LearningResources')
    const sortOrderField = entity?.fields?.find((field) => context.readLocalizedText(field.codename, 'en') === 'SortOrder')
    const validationRules = context.readRecord(sortOrderField?.validationRules)
    const uiConfig = context.readRecord(sortOrderField?.uiConfig)

    if (
        sortOrderField?.dataType !== 'NUMBER' ||
        sortOrderField.isRequired !== true ||
        validationRules?.min !== 0 ||
        uiConfig?.defaultValue !== 0
    ) {
        context.errors.push('LMS LearningResources.SortOrder must be a required NUMBER field with min 0 and uiConfig.defaultValue 0')
    }
}
