import type { DashboardFixtureValidationContext } from './lmsDashboardFixtureContractSupport.ts'
import { assertBuilderSavedReportsSlot } from './lmsDashboardFixtureReportsValidator.ts'

export const assertLmsBuilderPlacements = (context: DashboardFixtureValidationContext): void => {
    const { errors, readRecord, readWidgetConfig, readLocalizedText, widgets, courseBuilderLayout, trackBuilderLayout } = context
    const assertBuilderPlacements = (
        layout: Record<string, unknown> | undefined,
        label: string,
        expectedTabs: Array<{
            slotKey: string
            relation?: {
                parentEntityCodename: string
                childEntityCodename: string
                parentFieldCodename: string
                panelSlot: string
                createWizard?: {
                    steps: Array<{
                        id: string
                        label: { en: string; ru: string }
                        helperText: { en: string; ru: string }
                        fieldCodenames: string[]
                    }>
                }
            }
            learnerPlayer?: {
                variant: 'course' | 'track'
                parentEntityCodename: string
                itemsEntityCodename: string
            }
        }>
    ) => {
        if (!layout) return
        const tabsWidget = widgets.find((widget) => widget?.layoutId === layout.id && widget?.widgetKey === 'detailsTabs')
        if (!tabsWidget) {
            errors.push(`${label} must include a first-class detailsTabs placement`)
            return
        }
        const tabsConfig = readWidgetConfig(tabsWidget.config)
        const tabs = Array.isArray(tabsConfig.tabs) ? tabsConfig.tabs.map(readRecord) : []
        const actualSlots = tabs.map((tab) => tab?.slotKey).filter((slot): slot is string => typeof slot === 'string')
        const expectedSlotKeys = expectedTabs.map(({ slotKey }) => slotKey)
        if (actualSlots.length !== expectedSlotKeys.length || expectedSlotKeys.some((slot) => !actualSlots.includes(slot))) {
            errors.push(`${label} must expose exactly the registered first-class tab slots ${expectedSlotKeys.join(', ')}`)
        }

        for (const expectedTab of expectedTabs) {
            const children = widgets.filter(
                (widget) =>
                    widget?.layoutId === layout.id && widget?.parentWidgetId === tabsWidget.id && widget?.slotKey === expectedTab.slotKey
            )
            if (expectedTab.relation) {
                const relationBuilders = children.filter((widget) => widget?.widgetKey === 'relationBuilder')
                if (children.length !== 1 || relationBuilders.length !== 1) {
                    errors.push(`${label} ${expectedTab.slotKey} must contain one first-class relationBuilder child placement`)
                }
                const relationBuilder = relationBuilders[0]
                if (!relationBuilder) continue

                const { parentEntityCodename, childEntityCodename, parentFieldCodename, panelSlot } = expectedTab.relation
                const assertEntityBinding = (slotKey: string, entityCodename: string, selectorKind: string, parentSlot?: string) => {
                    const targets = context.readBindingTargets(relationBuilder, slotKey)
                    const selector = readRecord(targets[0]?.selector)
                    if (
                        targets.length !== 1 ||
                        targets[0]?.entityKind !== 'object' ||
                        targets[0]?.entityCodename !== entityCodename ||
                        selector?.kind !== selectorKind ||
                        (parentSlot !== undefined && selector.parentSlot !== parentSlot)
                    ) {
                        errors.push(
                            `${label} ${expectedTab.slotKey} relationBuilder ${slotKey} binding must target the ${entityCodename} Entity with ${selectorKind}`
                        )
                    }
                }
                assertEntityBinding('parent', parentEntityCodename, 'record-set')
                assertEntityBinding(panelSlot, childEntityCodename, 'relation-set', 'parent')

                const config = readWidgetConfig(relationBuilder.config)
                const panels = Array.isArray(config.panels) ? config.panels.map(readRecord) : []
                const panel = panels.find((candidate) => candidate?.slotKey === panelSlot)
                if (
                    panels.length !== 1 ||
                    !panel ||
                    panel.parentFieldCodename !== parentFieldCodename ||
                    panel.sortOrderFieldCodename !== 'SortOrder' ||
                    panel.enableRowReordering !== true
                ) {
                    errors.push(
                        `${label} ${expectedTab.slotKey} relationBuilder panel must use ${parentFieldCodename} parent scoping and generic SortOrder reordering`
                    )
                }

                const expectedWizard = expectedTab.relation.createWizard
                if (expectedWizard) {
                    const actualWizard = readRecord(panel?.createWizard)
                    const actualSteps = Array.isArray(actualWizard?.steps) ? actualWizard.steps.map(readRecord) : []
                    if (actualSteps.length !== expectedWizard.steps.length) {
                        errors.push(
                            `${label} ${expectedTab.slotKey} relationBuilder panel must expose the configured ${expectedWizard.steps.length}-step create wizard`
                        )
                    }

                    expectedWizard.steps.forEach((expectedStep, index) => {
                        const actualStep = actualSteps[index]
                        const actualFieldCodenames = Array.isArray(actualStep?.fieldCodenames)
                            ? actualStep.fieldCodenames.filter((value): value is string => typeof value === 'string')
                            : []
                        const localizedStepMatches =
                            readLocalizedText(actualStep?.label, 'en') === expectedStep.label.en &&
                            readLocalizedText(actualStep?.label, 'ru') === expectedStep.label.ru &&
                            readLocalizedText(actualStep?.helperText, 'en') === expectedStep.helperText.en &&
                            readLocalizedText(actualStep?.helperText, 'ru') === expectedStep.helperText.ru
                        if (
                            actualStep?.id !== expectedStep.id ||
                            !localizedStepMatches ||
                            actualFieldCodenames.length !== expectedStep.fieldCodenames.length ||
                            expectedStep.fieldCodenames.some((codename, fieldIndex) => actualFieldCodenames[fieldIndex] !== codename)
                        ) {
                            errors.push(
                                `${label} ${expectedTab.slotKey} create wizard step ${expectedStep.id} must keep its localized guidance and CourseItems field grouping`
                            )
                        }
                    })

                    if (panel?.rowCountWarning !== undefined) {
                        errors.push(
                            `${label} ${expectedTab.slotKey} CourseItems must not advertise a row-count warning without a canonical threshold case`
                        )
                    }
                }
            } else if (expectedTab.learnerPlayer) {
                const players = children.filter((widget) => widget?.widgetKey === 'learnerPlayer')
                if (children.length !== 1 || players.length !== 1) {
                    errors.push(`${label} ${expectedTab.slotKey} must contain one first-class learnerPlayer placement`)
                }
                const player = players[0]
                if (!player) continue

                const config = readWidgetConfig(player.config)
                const { variant, parentEntityCodename, itemsEntityCodename } = expectedTab.learnerPlayer
                if (config.variant !== variant || config.displayMode !== 'player' || config.sequenceMode !== 'strict') {
                    errors.push(`${label} ${expectedTab.slotKey} learnerPlayer must use the registered ${variant} strict player behavior`)
                }

                const assertPlayerBinding = (slotKey: string, entityCodename: string, selectorKind: string, parentSlot?: string) => {
                    const targets = context.readBindingTargets(player, slotKey)
                    const selector = readRecord(targets[0]?.selector)
                    if (
                        targets.length !== 1 ||
                        targets[0]?.entityKind !== 'object' ||
                        targets[0]?.entityCodename !== entityCodename ||
                        selector?.kind !== selectorKind ||
                        (parentSlot !== undefined && selector.parentSlot !== parentSlot)
                    ) {
                        errors.push(
                            `${label} ${expectedTab.slotKey} learnerPlayer ${slotKey} binding must target ${entityCodename} with ${selectorKind}`
                        )
                    }
                }
                assertPlayerBinding('parent', parentEntityCodename, 'record-set')
                assertPlayerBinding('items', itemsEntityCodename, 'relation-set', 'parent')
            } else {
                assertBuilderSavedReportsSlot(context, label, children)
            }
        }
    }
    assertBuilderPlacements(courseBuilderLayout, 'Course Builder', [
        {
            slotKey: 'tab:sections',
            relation: {
                parentEntityCodename: 'Courses',
                childEntityCodename: 'CourseSections',
                parentFieldCodename: 'CourseId',
                panelSlot: 'panel:sections'
            }
        },
        {
            slotKey: 'tab:items',
            relation: {
                parentEntityCodename: 'Courses',
                childEntityCodename: 'CourseItems',
                parentFieldCodename: 'CourseId',
                panelSlot: 'panel:items',
                createWizard: {
                    steps: [
                        {
                            id: 'content',
                            label: { en: 'Learning content', ru: 'Учебный контент' },
                            helperText: {
                                en: 'Name this course item, then choose the resource or quiz learners will open.',
                                ru: 'Назовите элемент курса и выберите ресурс или тест, который откроют учащиеся.'
                            },
                            fieldCodenames: ['Title', 'TargetObjectCodename', 'TargetRecordId']
                        },
                        {
                            id: 'course-placement',
                            label: { en: 'Course section and completion', ru: 'Раздел курса и завершение' },
                            helperText: {
                                en: 'Choose the course section, set completion rules, and optionally estimate the time required.',
                                ru: 'Выберите раздел курса, задайте правила завершения и при необходимости укажите время на прохождение.'
                            },
                            fieldCodenames: ['SectionId', 'ItemType', 'IsRequired', 'CompletionWeight', 'EstimatedTimeMinutes']
                        }
                    ]
                }
            }
        },
        {
            slotKey: 'tab:player',
            learnerPlayer: {
                variant: 'course',
                parentEntityCodename: 'Courses',
                itemsEntityCodename: 'CourseItems'
            }
        },
        { slotKey: 'tab:reports' }
    ])
    assertBuilderPlacements(trackBuilderLayout, 'Track Builder', [
        {
            slotKey: 'tab:stages',
            relation: {
                parentEntityCodename: 'LearningTracks',
                childEntityCodename: 'TrackStages',
                parentFieldCodename: 'TrackId',
                panelSlot: 'panel:stages'
            }
        },
        {
            slotKey: 'tab:steps',
            relation: {
                parentEntityCodename: 'LearningTracks',
                childEntityCodename: 'TrackSteps',
                parentFieldCodename: 'TrackId',
                panelSlot: 'panel:steps'
            }
        },
        {
            slotKey: 'tab:player',
            learnerPlayer: {
                variant: 'track',
                parentEntityCodename: 'LearningTracks',
                itemsEntityCodename: 'TrackSteps'
            }
        },
        { slotKey: 'tab:reports' }
    ])
}
