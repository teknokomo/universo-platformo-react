import { REQUIRED_ENTITY_CODENAMES } from './lmsSnapshotEnvelopeDefinitions.ts'
import { readLocalizedText, readRecord } from './lmsFixtureValidationHelpers.ts'
import type { SnapshotEntity, SnapshotEnvelope } from './lmsFixtureContractTypes.ts'

export interface LmsSnapshotEnvelopeEntityContext {
    entities: SnapshotEntity[]
    entityByCodename: Map<string, SnapshotEntity>
    findEntityByKindAndName: (kind: string, name: string) => SnapshotEntity | undefined
}

export function assertLmsSnapshotEnvelopeEntityContract(envelope: SnapshotEnvelope, errors: string[]): LmsSnapshotEnvelopeEntityContext {
    const entities = Object.values(envelope.snapshot?.entities ?? {})
    const entityTypeDefinitions =
        envelope.snapshot?.entityTypeDefinitions && typeof envelope.snapshot.entityTypeDefinitions === 'object'
            ? envelope.snapshot.entityTypeDefinitions
            : {}
    const objectEntityType = entityTypeDefinitions.object
    const objectEntityTypeUi =
        objectEntityType?.ui && typeof objectEntityType.ui === 'object' && !Array.isArray(objectEntityType.ui)
            ? (objectEntityType.ui as Record<string, unknown>)
            : null
    const objectEntityTypeTabs = Array.isArray(objectEntityTypeUi?.tabs) ? objectEntityTypeUi.tabs : []
    const objectEntityTypeComponents =
        objectEntityType?.capabilities && typeof objectEntityType.capabilities === 'object' && !Array.isArray(objectEntityType.capabilities)
            ? (objectEntityType.capabilities as Record<string, unknown>)
            : objectEntityType?.components && typeof objectEntityType.components === 'object' && !Array.isArray(objectEntityType.components)
            ? (objectEntityType.components as Record<string, unknown>)
            : null

    if (!objectEntityTypeTabs.includes('behavior')) {
        errors.push('LMS fixture Object entity type must expose the generic behavior tab')
    }
    if (!objectEntityTypeTabs.includes('ledgerSchema')) {
        errors.push('LMS fixture Object entity type must expose the generic ledger schema tab')
    }
    for (const componentKey of ['identityFields', 'recordLifecycle', 'posting', 'ledgerSchema']) {
        const component = objectEntityTypeComponents?.[componentKey]
        if (
            !component ||
            typeof component !== 'object' ||
            Array.isArray(component) ||
            (component as Record<string, unknown>).enabled !== true
        ) {
            errors.push(`LMS fixture Object entity type must enable ${componentKey} for runtime behavior authoring`)
        }
    }

    const entityByCodename = new Map<string, SnapshotEntity>()
    for (const entity of entities) {
        const codename = readLocalizedText(entity?.codename, 'en')
        if (codename) {
            if (
                entities.some(
                    (candidate) =>
                        candidate !== entity && candidate.kind === entity.kind && readLocalizedText(candidate?.codename, 'en') === codename
                )
            ) {
                errors.push(`LMS fixture contains duplicate ${entity.kind} entity codename ${codename}`)
            }
            entityByCodename.set(codename, entity)
        }

        const fieldCodenames = new Set<string>()
        for (const field of entity?.fields ?? []) {
            const fieldCodename = readLocalizedText(field?.codename, 'en')
            if (!fieldCodename) continue
            if (fieldCodenames.has(fieldCodename)) {
                errors.push(`LMS ${codename ?? 'unknown entity'} contains duplicate field codename ${fieldCodename}`)
            }
            fieldCodenames.add(fieldCodename)
        }
    }

    for (const [entityCodename, fieldCodename] of [
        ['LearningResources', 'Body'],
        ['KnowledgeArticles', 'Body']
    ] as const) {
        const field = entityByCodename
            .get(entityCodename)
            ?.fields?.find((candidate) => readLocalizedText(candidate.codename, 'en') === fieldCodename)
        const uiConfig =
            field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
                ? (field.uiConfig as Record<string, unknown>)
                : null
        if (!field || field.dataType !== 'JSON' || uiConfig?.widget !== 'editorjsBlockContent') {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must expose the shared Editor.js block-content runtime field`)
        }
    }

    for (const entityCodename of ['LearningResources', 'Courses', 'LearningTracks'] as const) {
        const entity = entityByCodename.get(entityCodename)
        const config = readRecord(entity?.config)
        const runtimeLibrary = readRecord(config?.runtimeLibrary)
        const projection = readRecord(runtimeLibrary?.projection)
        const expectedDisplayType = entityCodename === 'LearningResources' ? 'resource' : entityCodename === 'Courses' ? 'course' : 'track'
        const expectedStatusField = entityCodename === 'LearningResources' ? 'PublicationStatus' : 'Status'
        const projectedFieldCodenames = Array.isArray(projection?.projectedFieldCodenames) ? projection.projectedFieldCodenames : []
        if (
            projection?.displayType !== expectedDisplayType ||
            projection.titleFieldCodename !== 'Title' ||
            projection.statusFieldCodename !== expectedStatusField ||
            projection.projectFieldCodename !== 'ProjectId' ||
            !projectedFieldCodenames.includes('Instructor')
        ) {
            errors.push(`LMS ${entityCodename} must own the trusted Learning Content runtime projection metadata`)
        }
        const recent = readRecord(runtimeLibrary?.recent)
        if (
            recent?.objectCodename !== 'RecentContentViews' ||
            recent.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            recent.targetRecordFieldCodename !== 'TargetRecordId' ||
            recent.actorFieldCodename !== 'UserId' ||
            recent.timestampFieldCodename !== 'ViewedAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure recent content through generic runtimeLibrary metadata`)
        }
        const starred = readRecord(runtimeLibrary?.starred)
        if (
            starred?.objectCodename !== 'ContentStars' ||
            starred.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            starred.targetRecordFieldCodename !== 'TargetRecordId' ||
            starred.actorFieldCodename !== 'UserId' ||
            starred.timestampFieldCodename !== 'StarredAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure starred content through generic runtimeLibrary metadata`)
        }
        const shared = readRecord(runtimeLibrary?.shared)
        if (
            shared?.objectCodename !== 'ContentAccessEntries' ||
            shared.targetObjectFieldCodename !== 'TargetObjectCodename' ||
            shared.targetRecordFieldCodename !== 'TargetRecordId' ||
            shared.principalTypeFieldCodename !== 'PrincipalType' ||
            shared.principalIdFieldCodename !== 'PrincipalId' ||
            shared.accessLevelFieldCodename !== 'AccessLevel' ||
            shared.defaultAccessLevel !== 'canView' ||
            shared.timestampFieldCodename !== 'InvitedAt'
        ) {
            errors.push(`LMS ${entityCodename} must configure shared content through generic runtimeLibrary metadata`)
        }
    }

    const findEntityByKindAndName = (kind: string, name: string) =>
        entities.find((entity) => entity?.kind === kind && readLocalizedText(entity?.presentation?.name, 'en') === name)

    for (const codename of REQUIRED_ENTITY_CODENAMES) {
        if (!entityByCodename.has(codename)) {
            errors.push(`LMS fixture is missing entity ${codename}`)
        }
    }

    const findFieldByCodename = (entityCodename: string, fieldCodename: string) =>
        entityByCodename.get(entityCodename)?.fields?.find((field) => readLocalizedText(field?.codename, 'en') === fieldCodename)

    const readFieldUiConfig = (entityCodename: string, fieldCodename: string) => {
        const field = findFieldByCodename(entityCodename, fieldCodename)
        return field?.uiConfig && typeof field.uiConfig === 'object' && !Array.isArray(field.uiConfig)
            ? (field.uiConfig as Record<string, unknown>)
            : null
    }

    const assertTextareaField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.widget !== 'textarea' || Number(uiConfig.rows ?? 0) < 2) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must be a textarea with at least 2 rows`)
        }
    }

    const assertResourceSourceField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.widget !== 'resourceSource' || uiConfig.gridHidden !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must use resourceSource and stay hidden from default grids`)
        }
    }

    const assertGridHiddenField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.gridHidden !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must stay hidden from normal runtime grids`)
        }
    }

    const assertHiddenRuntimeField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.hidden !== true && (uiConfig?.formHidden !== true || uiConfig?.gridHidden !== true)) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must stay hidden from normal runtime forms and grids`)
        }
    }

    const assertServerOwnedRuntimeField = (entityCodename: string, fieldCodename: string) => {
        const uiConfig = readFieldUiConfig(entityCodename, fieldCodename)
        if (uiConfig?.serverOwned !== true) {
            errors.push(`LMS ${entityCodename}.${fieldCodename} must be marked server-owned in Entity metadata`)
        }
    }

    const assertNoEditableRuntimeIdentityIdFields = (entityCodename: string) => {
        const entity = entityByCodename.get(entityCodename)
        for (const field of entity?.fields ?? []) {
            const fieldCodename = readLocalizedText(field?.codename, 'en') ?? ''
            if (!/(?:Owner|User|AssignedUser|CreatedByUser|Reviewer|Principal)Id$/i.test(fieldCodename)) {
                continue
            }

            const uiConfig = readFieldUiConfig(entityCodename, fieldCodename) ?? {}
            const isHidden = uiConfig.hidden === true || (uiConfig.formHidden === true && uiConfig.gridHidden === true)
            const isReferenceField = field.dataType === 'REF'
            const widget = typeof uiConfig.widget === 'string' ? uiConfig.widget : ''
            const hasSemanticPicker =
                ['runtimeRecordPicker', 'recordPicker', 'userPicker', 'workspaceMemberPicker'].includes(widget) ||
                readRecord(uiConfig.runtimeRecordPicker) !== null

            if (!isHidden && !isReferenceField && !hasSemanticPicker) {
                errors.push(
                    `LMS ${entityCodename}.${fieldCodename} must not expose an editable raw identity ID field; hide it or use a semantic picker/reference control`
                )
            }
        }
    }

    assertTextareaField('ContentProjects', 'Description')
    assertResourceSourceField('ContentProjects', 'Cover')
    assertTextareaField('Courses', 'Description')
    assertResourceSourceField('Courses', 'Cover')
    assertResourceSourceField('LearningResources', 'Source')
    assertHiddenRuntimeField('LearningResources', 'CreatedBy')
    assertHiddenRuntimeField('CourseItems', 'SortOrder')
    assertHiddenRuntimeField('KnowledgeArticles', 'SortOrder')
    {
        const knowledgeArticleSortOrderField = entityByCodename
            .get('KnowledgeArticles')
            ?.fields?.find((field) => readLocalizedText(field?.codename, 'en') === 'SortOrder')
        const knowledgeArticleSortOrderUiConfig = readFieldUiConfig('KnowledgeArticles', 'SortOrder') ?? {}
        if (
            knowledgeArticleSortOrderField?.dataType !== 'NUMBER' ||
            knowledgeArticleSortOrderField.isRequired !== true ||
            knowledgeArticleSortOrderUiConfig.defaultValue !== 0 ||
            knowledgeArticleSortOrderUiConfig.formHidden !== true ||
            knowledgeArticleSortOrderUiConfig.gridHidden !== true
        ) {
            errors.push(
                'LMS KnowledgeArticles.SortOrder must be a required numeric Entity field defaulted to 0 and hidden from runtime forms and grids'
            )
        }
    }
    assertServerOwnedRuntimeField('CourseItems', 'SortOrder')
    assertHiddenRuntimeField('CourseItems', 'AvailabilityOverride')
    assertGridHiddenField('Reports', 'Filters')
    assertGridHiddenField('Reports', 'Definition')
    assertGridHiddenField('Reports', 'SavedFilters')
    {
        const sourceUiConfig = readFieldUiConfig('LearningResources', 'Source') ?? {}
        const autoPageCodename = readRecord(sourceUiConfig.autoPageCodename)
        const sourceFields = Array.isArray(autoPageCodename?.sourceFields) ? autoPageCodename.sourceFields : []
        if (!sourceFields.includes('Name') || !sourceFields.includes('Title')) {
            errors.push('LMS LearningResources.Source must auto-resolve page resource codenames from Name/Title metadata fields')
        }
    }
    assertResourceSourceField('LearningResources', 'Thumbnail')
    for (const entityCodename of REQUIRED_ENTITY_CODENAMES) {
        assertNoEditableRuntimeIdentityIdFields(entityCodename)
    }

    return { entities, entityByCodename, findEntityByKindAndName }
}
