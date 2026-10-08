import { createDashboardFixtureValidationContext, type DashboardFixtureContractArguments } from './lmsDashboardFixtureContractSupport.ts'
import { assertDashboardLayoutWidgetOwnership, assertDashboardNavigationAndKnowledgeLayout } from './lmsDashboardFixtureLayoutValidator.ts'
import { assertLmsLearningContentLibrary, assertLmsLearnerHomePlacements } from './lmsDashboardFixtureLearnerValidator.ts'
import { assertLmsBuilderPlacements } from './lmsDashboardFixtureBuilderValidator.ts'
import { assertLmsReportsLayout } from './lmsDashboardFixtureReportsValidator.ts'
import { assertLmsLearningResourcesSortOrder } from './lmsDashboardFixtureLearningResourcesValidator.ts'

/** Validates the LMS fixture's Dashboard widgets, bindings, and scoped placements. */
export const assertLmsDashboardFixtureContract = (arguments_: DashboardFixtureContractArguments): void => {
    const context = createDashboardFixtureValidationContext(arguments_)
    assertDashboardLayoutWidgetOwnership(context)
    assertLmsLearningContentLibrary(context)
    assertDashboardNavigationAndKnowledgeLayout(context)
    assertLmsLearnerHomePlacements(context)
    assertLmsBuilderPlacements(context)
    assertLmsReportsLayout(context)
    assertLmsLearningResourcesSortOrder(context)
}
