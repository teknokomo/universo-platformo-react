import { workflowActionSchema } from '@universo-react/types'
import { readLocalizedText } from './lmsFixtureValidationHelpers.ts'
import { REQUIRED_WORKFLOW_ACTIONS } from './lmsSnapshotEnvelopeDefinitions.ts'
import type { SnapshotModule } from './lmsFixtureContractTypes.ts'
import type { LmsSnapshotEnvelopeEntityContext } from './lmsSnapshotEnvelopeEntityContract.ts'

export function assertLmsSnapshotEnvelopeWorkflowModulesContract(
    entityContext: LmsSnapshotEnvelopeEntityContext,
    modules: SnapshotModule[],
    errors: string[]
): void {
    const { entityByCodename } = entityContext
    for (const expectedWorkflowAction of REQUIRED_WORKFLOW_ACTIONS) {
        const objectEntity = entityByCodename.get(expectedWorkflowAction.entityCodename)
        const actions = Array.isArray(objectEntity?.config?.workflowActions) ? objectEntity.config.workflowActions : []
        const action = actions.find(
            (candidate) =>
                candidate &&
                typeof candidate === 'object' &&
                (candidate as Record<string, unknown>).codename === expectedWorkflowAction.actionCodename
        )
        if (!action) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename} must configure workflow action ${expectedWorkflowAction.actionCodename}`
            )
            continue
        }
        const parsedAction = workflowActionSchema.safeParse(action)
        if (!parsedAction.success) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must match the generic workflow action contract`
            )
            continue
        }
        const expectedStatusFieldCodename = expectedWorkflowAction.statusFieldCodename ?? 'Status'
        if (parsedAction.data.statusFieldCodename !== expectedStatusFieldCodename) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must use the ${expectedStatusFieldCodename} field as workflow state`
            )
        }
        if (JSON.stringify(parsedAction.data.from) !== JSON.stringify(expectedWorkflowAction.from)) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${
                    expectedWorkflowAction.actionCodename
                } must keep from=${expectedWorkflowAction.from.join(',')}`
            )
        }
        if (parsedAction.data.to !== expectedWorkflowAction.to) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must transition to ${expectedWorkflowAction.to}`
            )
        }
        for (const requiredCapability of expectedWorkflowAction.requiredCapabilities) {
            if (!parsedAction.data.requiredCapabilities.includes(requiredCapability)) {
                errors.push(
                    `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must require ${requiredCapability}`
                )
            }
        }
        if (expectedWorkflowAction.postingCommand && parsedAction.data.postingCommand !== expectedWorkflowAction.postingCommand) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must declare postingCommand=${expectedWorkflowAction.postingCommand}`
            )
        }
        if (expectedWorkflowAction.moduleCodename && parsedAction.data.moduleCodename !== expectedWorkflowAction.moduleCodename) {
            errors.push(
                `LMS ${expectedWorkflowAction.entityCodename}.${expectedWorkflowAction.actionCodename} must bind module ${expectedWorkflowAction.moduleCodename}`
            )
        }
    }
    const enrollmentEntity = entityByCodename.get('Enrollments')
    const enrollmentRecordBehavior =
        enrollmentEntity?.config?.recordBehavior &&
        typeof enrollmentEntity.config.recordBehavior === 'object' &&
        !Array.isArray(enrollmentEntity.config.recordBehavior)
            ? (enrollmentEntity.config.recordBehavior as Record<string, unknown>)
            : null
    const enrollmentPosting =
        enrollmentRecordBehavior?.posting &&
        typeof enrollmentRecordBehavior.posting === 'object' &&
        !Array.isArray(enrollmentRecordBehavior.posting)
            ? (enrollmentRecordBehavior.posting as Record<string, unknown>)
            : null
    const targetLedgers = Array.isArray(enrollmentPosting?.targetLedgers) ? enrollmentPosting.targetLedgers : []
    if (enrollmentRecordBehavior?.mode !== 'transactional') {
        errors.push('LMS Enrollments object must use transactional record behavior')
    }
    if (enrollmentPosting?.mode !== 'manual' || !targetLedgers.includes('ProgressLedger')) {
        errors.push('LMS Enrollments posting behavior must manually target ProgressLedger')
    }
    const enrollmentRuntimeValidations =
        enrollmentEntity?.config?.runtimeValidations &&
        typeof enrollmentEntity.config.runtimeValidations === 'object' &&
        !Array.isArray(enrollmentEntity.config.runtimeValidations)
            ? (enrollmentEntity.config.runtimeValidations as Record<string, unknown>)
            : null
    const enrollmentRequiredWhen = Array.isArray(enrollmentRuntimeValidations?.requiredWhen)
        ? enrollmentRuntimeValidations.requiredWhen
        : []
    const hasDueDateRequiredWhen = enrollmentRequiredWhen.some(
        (rule) =>
            rule &&
            typeof rule === 'object' &&
            !Array.isArray(rule) &&
            (rule as Record<string, unknown>).field === 'DueDate' &&
            (rule as Record<string, unknown>).when &&
            typeof (rule as Record<string, unknown>).when === 'object' &&
            !Array.isArray((rule as Record<string, unknown>).when) &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).field === 'DueDateMode' &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).equals === 'ByDate'
    )
    const hasDuePeriodRequiredWhen = enrollmentRequiredWhen.some(
        (rule) =>
            rule &&
            typeof rule === 'object' &&
            !Array.isArray(rule) &&
            (rule as Record<string, unknown>).field === 'DuePeriodDays' &&
            (rule as Record<string, unknown>).when &&
            typeof (rule as Record<string, unknown>).when === 'object' &&
            !Array.isArray((rule as Record<string, unknown>).when) &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).field === 'DueDateMode' &&
            ((rule as Record<string, unknown>).when as Record<string, unknown>).equals === 'ForPeriod'
    )
    if (!hasDueDateRequiredWhen || !hasDuePeriodRequiredWhen) {
        errors.push('LMS Enrollments must enforce conditional due-date requiredWhen runtime validations')
    }
    const enrollmentFields = enrollmentEntity?.fields ?? []
    for (const [fieldCodename, expectedMode] of [
        ['DueDate', 'ByDate'],
        ['DuePeriodDays', 'ForPeriod']
    ] as const) {
        const field = enrollmentFields.find((candidate) => readLocalizedText(candidate.codename, 'en') === fieldCodename)
        const uiConfig =
            field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
                ? (field.uiConfig as Record<string, unknown>)
                : null
        const requiredWhen =
            uiConfig?.requiredWhen && typeof uiConfig.requiredWhen === 'object' && !Array.isArray(uiConfig.requiredWhen)
                ? (uiConfig.requiredWhen as Record<string, unknown>)
                : null
        if (requiredWhen?.field !== 'DueDateMode' || requiredWhen.equals !== expectedMode) {
            errors.push(`LMS Enrollments.${fieldCodename} must declare form requiredWhen metadata`)
        }
    }
    if (modules.some((candidate) => readLocalizedText(candidate?.codename, 'en') === 'AutoEnrollmentRuleModule')) {
        errors.push('LMS fixture must not include AutoEnrollmentRuleModule until canonical auto-enrollment target rules are modeled')
    }
    for (const requiredModule of [
        { codename: 'EnrollmentPostingModule', attachedTo: 'Enrollments', capabilities: ['lifecycle', 'posting', 'ledger.write'] },
        { codename: 'QuizAttemptPostingModule', attachedTo: 'QuizAttempts', capabilities: ['lifecycle', 'posting', 'ledger.write'] },
        {
            codename: 'ContentCompletionPostingModule',
            attachedTo: 'ContentProgress',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        },
        {
            codename: 'CertificateIssuePostingModule',
            attachedTo: 'CertificateIssues',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        },
        {
            codename: 'PointTransactionPostingModule',
            attachedTo: 'PointTransactions',
            capabilities: ['lifecycle', 'posting', 'ledger.write']
        }
    ]) {
        const module = modules.find((candidate) => readLocalizedText(candidate?.codename, 'en') === requiredModule.codename)
        if (!module) {
            errors.push(`LMS fixture must include the ${requiredModule.codename} lifecycle module`)
            continue
        }
        const manifest = module.manifest && typeof module.manifest === 'object' ? (module.manifest as Record<string, unknown>) : null
        const capabilities = Array.isArray(manifest?.capabilities) ? manifest.capabilities : []
        const attachedEntity = entityByCodename.get(requiredModule.attachedTo)
        if (module.attachedToKind !== 'object' || !attachedEntity?.id || module.attachedToId !== attachedEntity.id) {
            errors.push(`LMS ${requiredModule.codename} must be attached to ${requiredModule.attachedTo}`)
        }
        for (const capability of requiredModule.capabilities) {
            if (!capabilities.includes(capability)) {
                errors.push(`LMS ${requiredModule.codename} must declare ${capability} capability`)
            }
        }
    }

    const enrollmentPostingModule = modules.find((module) => readLocalizedText(module?.codename, 'en') === 'EnrollmentPostingModule')
    if (!enrollmentPostingModule) {
        errors.push('LMS fixture must include the EnrollmentPostingModule lifecycle module')
    } else {
        const manifest =
            enrollmentPostingModule.manifest && typeof enrollmentPostingModule.manifest === 'object'
                ? (enrollmentPostingModule.manifest as Record<string, unknown>)
                : {}
        const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : []
        const methods = Array.isArray(manifest.methods) ? manifest.methods : []
        const hasBeforePost = methods.some(
            (method) =>
                method &&
                typeof method === 'object' &&
                (method as Record<string, unknown>).target === 'server' &&
                (method as Record<string, unknown>).eventName === 'beforePost'
        )
        if (enrollmentPostingModule.attachedToKind !== 'object' || enrollmentPostingModule.attachedToId !== enrollmentEntity?.id) {
            errors.push('LMS EnrollmentPostingModule must be attached to the Enrollments object')
        }
        if (enrollmentPostingModule.moduleRole !== 'lifecycle') {
            errors.push('LMS EnrollmentPostingModule must use the lifecycle module role')
        }
        for (const capability of ['metadata.read', 'lifecycle', 'posting', 'ledger.write']) {
            if (!capabilities.includes(capability)) {
                errors.push(`LMS EnrollmentPostingModule must declare ${capability}`)
            }
        }
        if (!hasBeforePost) {
            errors.push('LMS EnrollmentPostingModule must declare a beforePost server handler')
        }
    }
}
