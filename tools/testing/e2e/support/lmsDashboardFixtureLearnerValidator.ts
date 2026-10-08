import type { DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'

export const assertLmsLearningContentLibrary = (context: DashboardFixtureValidationContext): void => {
    const { errors, readRecord, readWidgetConfig, readLocalizedText, assertLocalizedFixtureValue, widgets } = context
    const libraryWidgets = widgets.filter((widget) => {
        const config = readWidgetConfig(widget?.config)
        return widget?.widgetKey === 'detailsTable' && config.variant === 'library'
    })
    const requiredLibraryViews = new Set(['active:all', 'active:recent', 'active:starred', 'active:shared', 'deleted:all'])
    const actualLibraryViews = new Set<string>()
    for (const widget of libraryWidgets) {
        const config = readWidgetConfig(widget?.config)
        const libraryView = typeof config.libraryView === 'string' ? config.libraryView : ''
        const lifecycleState = typeof config.lifecycleState === 'string' ? config.lifecycleState : ''
        const createTargets = Array.isArray(config.createTargets) ? config.createTargets : []
        const rowActions = Array.isArray(config.rowActions) ? config.rowActions.map(readRecord) : []
        const targetFilters = Array.isArray(config.targetFilters) ? config.targetFilters.map(readRecord) : []
        const neutral = readRecord(config.__layout)
        const bindings = readRecord(neutral?.bindings)
        const slots = Array.isArray(bindings?.slots) ? bindings.slots.map(readRecord) : []
        const rowsSlot = slots.find((slot) => slot?.slot === 'rows')
        const bindingTargets = Array.isArray(rowsSlot?.targets) ? rowsSlot.targets.map(readRecord) : []
        const boundEntityCodenames = new Set(
            bindingTargets
                .map((target) => (typeof target?.entityCodename === 'string' ? target.entityCodename : null))
                .filter((value): value is string => Boolean(value))
        )
        actualLibraryViews.add(`${lifecycleState}:${libraryView}`)
        if (Object.prototype.hasOwnProperty.call(config, 'datasource')) {
            errors.push('LMS Learning Content library widgets must not persist the retired config.datasource contract')
        }
        if (config.showSearch !== true) {
            errors.push('LMS Learning Content library views must expose the generic runtime search toolbar')
        }
        if (config.showViewToggle !== true) {
            errors.push('LMS Learning Content library views must expose the shared table/card view toggle')
        }
        for (const entityCodename of ['LearningResources', 'Courses', 'LearningTracks']) {
            if (!boundEntityCodenames.has(entityCodename)) {
                errors.push(`LMS Learning Content library rows binding must target ${entityCodename}`)
            }
        }
        if (bindingTargets.length !== 3 || bindingTargets.some((target) => readRecord(target?.selector)?.kind !== 'record-set')) {
            errors.push('LMS Learning Content library rows binding must contain exactly three semantic record-set targets')
        }
        const targetFilterDisplayTypes = new Set(
            targetFilters
                .flatMap((filter) => (Array.isArray(filter?.targetDisplayTypes) ? filter.targetDisplayTypes : []))
                .filter((value): value is string => typeof value === 'string')
        )
        for (const displayType of ['resource', 'course', 'track']) {
            if (!targetFilterDisplayTypes.has(displayType)) {
                errors.push(`LMS Learning Content records.union views must expose a generic ${displayType} target filter`)
            }
        }
        if (lifecycleState === 'active') {
            const starredAction = rowActions.find(
                (action) => action?.kind === 'library.toggle' && action.libraryView === 'starred' && action.icon === 'star'
            )
            if (!starredAction) {
                errors.push('LMS active Learning Content library views must expose the generic starred row action')
            }
            const sharedAction = rowActions.find(
                (action) => action?.kind === 'library.toggle' && action.libraryView === 'shared' && action.icon === 'share'
            )
            if (!sharedAction) {
                errors.push('LMS active Learning Content library views must expose the generic shared row action')
            } else if (sharedAction.principalTarget !== 'workspaceMember') {
                errors.push('LMS shared Learning Content row action must use the generic workspace-member picker target')
            }
            if (libraryView === 'all') {
                const moveProjectAction = rowActions.find(
                    (action) =>
                        action?.kind === 'field.updateWithTarget' &&
                        action.fieldCodename === 'ProjectId' &&
                        action.targetObjectCollectionCodename === 'ContentProjects' &&
                        action.icon === 'move'
                )
                if (!moveProjectAction) {
                    errors.push('LMS main Learning Content library view must expose the generic Move to project target-field row action')
                }
            }
        }
        if (libraryView === 'all' && lifecycleState === 'active') {
            const createTargetCodenames = new Set(
                createTargets
                    .map((target) => {
                        const record = readRecord(target)
                        return record?.sectionCodename ?? record?.objectCollectionCodename
                    })
                    .filter((value): value is string => typeof value === 'string')
            )
            for (const requiredCreateTarget of ['ContentProjects', 'LearningResources', 'Courses', 'LearningTracks']) {
                if (!createTargetCodenames.has(requiredCreateTarget)) {
                    errors.push(`LMS Learning Content create menu must expose ${requiredCreateTarget} through generic createTargets`)
                }
            }
            const createTargetLabels = createTargets
                .map((target) => readLocalizedText(readRecord(target)?.label, 'en'))
                .filter((value): value is string => typeof value === 'string')
            for (const requiredLabel of ['Project', 'Page', 'Link', 'Course', 'Learning track', 'Quiz', 'Assignment', 'Package']) {
                if (!createTargetLabels.includes(requiredLabel)) {
                    errors.push(`LMS Learning Content create menu must include a ${requiredLabel} entry`)
                }
            }
            const createTargetById = new Map(
                createTargets
                    .map((target) => readRecord(target))
                    .filter((target): target is Record<string, unknown> => Boolean(target))
                    .map((target) => [String(target.id ?? ''), target])
            )
            const projectTarget = createTargetById.get('learning-content-create-project')
            const pageDefaults = createTargetById.get('learning-content-create-page')?.createDefaults
            const linkDefaults = createTargetById.get('learning-content-create-link')?.createDefaults
            const courseDefaults = createTargetById.get('learning-content-create-course')?.createDefaults
            const trackDefaults = createTargetById.get('learning-content-create-track')?.createDefaults
            const quizLiteTarget = createTargetById.get('learning-content-create-quiz-lite')
            const assignmentLiteTarget = createTargetById.get('learning-content-create-assignment-lite')
            const packageTarget = createTargetById.get('learning-content-create-package')
            const hasCreateDefault = (defaults: unknown, expected: Record<string, unknown>): boolean =>
                Array.isArray(defaults) &&
                defaults.some((item) => {
                    const record = readRecord(item)
                    return Object.entries(expected).every(([key, value]) => record?.[key] === value)
                })
            if (projectTarget?.objectCollectionCodename !== 'ContentProjects') {
                errors.push('LMS Project create target must open ContentProjects through the generic createTargets contract')
            }
            if (Array.isArray(projectTarget?.createDefaults) && projectTarget.createDefaults.length > 0) {
                errors.push('LMS Project create target must not prefill system-owned or policy fields through createDefaults')
            }
            if (
                !hasCreateDefault(pageDefaults, { fieldCodename: 'ResourceType', enumCodename: 'Page' }) ||
                !hasCreateDefault(pageDefaults, { fieldCodename: 'Source', resourceSourceType: 'page' })
            ) {
                errors.push('LMS Page create target must preselect the Page resource type and page source draft through createDefaults')
            }
            if (
                !hasCreateDefault(linkDefaults, { fieldCodename: 'ResourceType', enumCodename: 'Url' }) ||
                !hasCreateDefault(linkDefaults, { fieldCodename: 'Source', resourceSourceType: 'url' })
            ) {
                errors.push('LMS Link create target must preselect the URL resource type and URL source draft through createDefaults')
            }
            if (
                !hasCreateDefault(courseDefaults, {
                    fieldCodename: 'NavigationMode',
                    contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                }) ||
                !hasCreateDefault(courseDefaults, {
                    fieldCodename: 'CompletionCondition',
                    contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                }) ||
                !hasCreateDefault(courseDefaults, {
                    fieldCodename: 'StatusFormat',
                    contextPath: 'learningContent.courseCompletionPolicy.statusFormat'
                })
            ) {
                errors.push('LMS Course create target must derive completion defaults from the generic runtime create context')
            }
            if (
                !hasCreateDefault(trackDefaults, {
                    fieldCodename: 'OrderMode',
                    contextPath: 'learningContent.trackOrderPolicy.orderMode'
                })
            ) {
                errors.push('LMS Learning Track create target must derive order defaults from the generic runtime create context')
            }
            if (quizLiteTarget?.objectCollectionCodename !== 'Quizzes' || quizLiteTarget.disabled !== true) {
                errors.push('LMS Quiz create target must stay an explicitly disabled generic createTargets entry for Quizzes')
            } else {
                assertLocalizedFixtureValue(
                    errors,
                    quizLiteTarget.disabledReason,
                    {
                        en: 'Quiz authoring is planned for a later Learning Content phase.',
                        ru: 'Создание тестов запланировано на следующий этап учебного контента.'
                    },
                    'LMS Quiz (planned) create target disabled reason'
                )
            }
            if (assignmentLiteTarget?.objectCollectionCodename !== 'Assignments' || assignmentLiteTarget.disabled !== true) {
                errors.push('LMS Assignment create target must stay an explicitly disabled generic createTargets entry for Assignments')
            } else {
                assertLocalizedFixtureValue(
                    errors,
                    assignmentLiteTarget.disabledReason,
                    {
                        en: 'Assignment authoring is planned for a later Learning Content phase.',
                        ru: 'Создание заданий запланировано на следующий этап учебного контента.'
                    },
                    'LMS Assignment create target disabled reason'
                )
            }
            if (packageTarget?.sectionCodename !== 'LearningResources' || packageTarget.disabled !== true) {
                errors.push('LMS Package create target must stay an explicitly disabled generic createTargets entry for LearningResources')
            } else {
                assertLocalizedFixtureValue(
                    errors,
                    packageTarget.disabledReason,
                    {
                        en: 'File import support is planned for a later phase.',
                        ru: 'Импорт файлов запланирован на следующий этап.'
                    },
                    'LMS Package create target disabled reason'
                )
            }
        } else if (lifecycleState === 'deleted') {
            const restoreTarget = readRecord(config.restoreTarget)
            const labelFields = Array.isArray(restoreTarget?.labelFields) ? restoreTarget.labelFields : []
            if (
                restoreTarget?.targetObjectCollectionCodename !== 'ContentProjects' ||
                restoreTarget.parentFieldCodename !== 'ProjectId' ||
                !labelFields.includes('Name')
            ) {
                errors.push(
                    'LMS Learning Content Trash must expose the generic restoreTarget picker for restoring records into ContentProjects'
                )
            }
        } else if (createTargets.length > 0) {
            errors.push('LMS secondary library views must not expose create targets')
        }
    }
    for (const requiredView of requiredLibraryViews) {
        if (!actualLibraryViews.has(requiredView)) {
            errors.push(`LMS fixture must include the entity-backed Learning Content library view ${requiredView}`)
        }
    }
    if (libraryWidgets.length !== 8) {
        errors.push(
            'LMS fixture must contain eight entity-backed Learning Content library placements across LearnerHome and library scopes'
        )
    }
}

export const assertLmsLearnerHomePlacements = (context: DashboardFixtureValidationContext): void => {
    const { errors, readRecord, readWidgetConfig, assertLocalizedFixtureValue, widgets, learnerHomeLayout } = context
    if (!learnerHomeLayout) return
    const expectedGroups = [
        {
            slots: ['tab:my-courses', 'tab:my-tracks'],
            tabs: [
                { slotKey: 'tab:my-courses', label: { en: 'My Courses', ru: 'Мои курсы' }, targetKind: 'course' },
                { slotKey: 'tab:my-tracks', label: { en: 'My Tracks', ru: 'Мои треки' }, targetKind: 'track' }
            ]
        },
        {
            slots: ['tab:recent', 'tab:starred', 'tab:shared'],
            tabs: [
                { slotKey: 'tab:recent', label: { en: 'Recent', ru: 'Недавние' } },
                { slotKey: 'tab:starred', label: { en: 'Starred', ru: 'Избранное' } },
                { slotKey: 'tab:shared', label: { en: 'Shared with me', ru: 'Доступные мне' } }
            ]
        }
    ] as const
    const detailsTabWidgets = widgets.filter((widget) => widget?.layoutId === learnerHomeLayout.id && widget?.widgetKey === 'detailsTabs')
    if (detailsTabWidgets.length !== expectedGroups.length) {
        errors.push('LMS LearnerHome must contain exactly the assignment and Learning Content detailsTabs placements')
    }

    for (const group of expectedGroups) {
        const tabsWidget = detailsTabWidgets.find((widget) => {
            const tabsConfig = readWidgetConfig(widget.config)
            const tabs = Array.isArray(tabsConfig.tabs) ? tabsConfig.tabs.map(readRecord) : []
            const actualSlots = tabs.map((tab) => tab?.slotKey).filter((slot): slot is string => typeof slot === 'string')
            return actualSlots.length === group.slots.length && group.slots.every((slot) => actualSlots.includes(slot))
        })
        if (!tabsWidget) {
            errors.push(`LMS LearnerHome must include first-class tabs for ${group.slots.join(', ')}`)
            continue
        }

        const tabsConfig = readWidgetConfig(tabsWidget.config)
        const tabs = Array.isArray(tabsConfig.tabs) ? tabsConfig.tabs.map(readRecord) : []
        for (const expectedTab of group.tabs) {
            const targetKind = 'targetKind' in expectedTab ? expectedTab.targetKind : undefined
            const tab = tabs.find((candidate) => candidate?.slotKey === expectedTab.slotKey)
            assertLocalizedFixtureValue(errors, tab?.label, expectedTab.label, `LMS LearnerHome ${expectedTab.slotKey} tab label`)
            const child = widgets.find(
                (widget) =>
                    widget?.layoutId === learnerHomeLayout.id &&
                    widget?.parentWidgetId === tabsWidget.id &&
                    widget?.slotKey === expectedTab.slotKey &&
                    widget?.widgetKey === 'detailsTable'
            )
            if (!child) {
                errors.push(`LMS LearnerHome ${expectedTab.slotKey} must be a first-class detailsTable child placement`)
                continue
            }
            const config = readWidgetConfig(child.config)
            if (targetKind) {
                if (config.variant !== 'learner-enrollments') {
                    errors.push(`LMS LearnerHome ${expectedTab.slotKey} must use the actor-scoped Enrollment table variant`)
                }
                const targets = context.readBindingTargets(child, 'rows')
                const selector = readRecord(targets[0]?.selector)
                if (
                    targets.length !== 1 ||
                    targets[0]?.entityCodename !== 'Enrollments' ||
                    selector?.kind !== 'learner-enrollment-set' ||
                    selector.targetKind !== targetKind
                ) {
                    errors.push(`LMS LearnerHome ${expectedTab.slotKey} must bind Enrollments with its fixed target kind`)
                }
            } else {
                if (config.variant !== 'library') {
                    errors.push(`LMS LearnerHome ${expectedTab.slotKey} must use the entity-backed library detailsTable variant`)
                }
                const targets = context.readBindingTargets(child, 'rows')
                const codenames = new Set(
                    targets.map((target) => target.entityCodename).filter((value): value is string => typeof value === 'string')
                )
                for (const entityCodename of ['LearningResources', 'Courses', 'LearningTracks']) {
                    if (!codenames.has(entityCodename)) {
                        errors.push(`LMS LearnerHome ${expectedTab.slotKey} rows binding must target ${entityCodename}`)
                    }
                }
            }
        }
    }
}
