import { DEFAULT_GUEST_INTAKE_POLICY, getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { lmsTemplate } from '../../domains/templates/data/lms.template'
import { createLmsAccessLinkIntakeDefaults, lmsSeedAssessmentEntities } from '../../domains/templates/data/lms.seed-entities.assessment'
import { lmsSeedInitialEntities } from '../../domains/templates/data/lms.seed-entities.initial'
import { orderDashboardSeedPlacements } from '../../domains/templates/services/dashboardSeedPlacement'

describe('LMS Quiz authoring dashboard seed', () => {
    it('caps quiz Blocks at the assessment flow snapshot limit', () => {
        const quizzes = lmsSeedAssessmentEntities.find((candidate) => candidate.codename === 'Quizzes')
        const blocks = quizzes?.components.find((component) => component.codename === 'Blocks')

        expect(blocks?.validationRules).toMatchObject({ maxRows: 100 })
    })

    it('uses generated UUID v7 block keys and sibling selectors for questions', () => {
        const quizzes = lmsSeedAssessmentEntities.find((candidate) => candidate.codename === 'Quizzes')
        const blocks = quizzes?.components.find((component) => component.codename === 'Blocks')
        const questions = quizzes?.components.find((component) => component.codename === 'Questions')
        const blockKey = blocks?.childComponents?.find((component) => component.codename === 'BlockKey')
        const introduction = blocks?.childComponents?.find((component) => component.codename === 'Introduction')
        const questionBlock = questions?.childComponents?.find((component) => component.codename === 'BlockKey')

        expect(blockKey).toMatchObject({
            dataType: 'STRING',
            isRequired: true,
            uiConfig: { hidden: true, generateUuidV7: true, siblingRowSelectKey: true, resetOnCopy: true }
        })
        expect(questionBlock).toMatchObject({
            dataType: 'STRING',
            uiConfig: {
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title',
                    requiredWithRows: true,
                    requireEachTargetReferenced: true
                }
            }
        })
        expect(introduction).toMatchObject({ dataType: 'STRING', uiConfig: { widget: 'textarea', rows: 4 } })
    })

    it('exposes quizzes in runtime navigation and keeps guest links in their dedicated authoring tab', () => {
        const quizzes = lmsSeedAssessmentEntities.find((candidate) => candidate.codename === 'Quizzes')
        const accessLinks = lmsSeedAssessmentEntities.find((candidate) => candidate.codename === 'AccessLinks')

        expect(quizzes?.config).toMatchObject({ runtime: { menuVisibility: 'primary', icon: 'school' } })
        expect(accessLinks?.config?.runtime?.menuVisibility).not.toBe('primary')
    })

    it('backs the direct Tests menu entry with a generic editable quiz list', () => {
        const layout = lmsTemplate.seed.scopedLayouts?.find(({ codename }) => codename === 'quizzes')
        const placements = lmsTemplate.seed.layoutZoneWidgets.quizzes ?? []
        const quizRecords = placements.find(({ instanceKey }) => instanceKey === 'quizzes-index')

        expect(layout).toMatchObject({
            templateKey: 'dashboard',
            baseLayoutCodename: 'main',
            scopeEntityCodename: 'Quizzes',
            scopeEntityKind: 'object',
            isDefault: true,
            isActive: true
        })
        expect(quizRecords).toMatchObject({
            zone: 'center',
            widgetKey: 'detailsTable',
            rendererConfig: {
                variant: 'records',
                showSearch: true,
                createTargets: [expect.objectContaining({ objectCollectionCodename: 'Quizzes' })]
            },
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            expect.objectContaining({ entityKind: 'object', entityCodename: 'Quizzes', selector: { kind: 'record-set' } })
                        ]
                    }
                ]
            }
        })
        if (!quizRecords) throw new Error('The direct Quizzes menu layout is missing its records table')
        const definition = getLayoutWidgetDefinition(quizRecords.widgetKey, quizRecords.rendererConfig)
        if (!definition) throw new Error('The direct Quizzes menu layout is missing its widget definition')
        expect(() => validateWidgetBindings(definition, quizRecords.bindings)).not.toThrow()
        expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
    })

    it('provides localized Quiz CRUD in the generic Learning Content dashboard tabs', () => {
        const placements = lmsTemplate.seed.layoutZoneWidgets.learningContent ?? []
        const tabs = placements.find(({ instanceKey }) => instanceKey === 'learning-content-tabs')
        const library = placements.find(({ instanceKey }) => instanceKey === 'learning-content-all')
        const quizzes = placements.find(({ instanceKey }) => instanceKey === 'learning-content-quizzes')
        const guestLinks = placements.find(({ instanceKey }) => instanceKey === 'learning-content-quiz-guest-links')

        expect(tabs).toMatchObject({
            widgetKey: 'detailsTabs',
            rendererConfig: {
                tabs: [
                    { slotKey: 'tab:library', label: { en: 'Library', ru: 'Библиотека' }, isDefault: true },
                    { slotKey: 'tab:quizzes', label: { en: 'Quizzes', ru: 'Тесты' } },
                    { slotKey: 'tab:guest-links', label: { en: 'Guest links', ru: 'Ссылки для гостей' } }
                ]
            }
        })
        expect(library).toMatchObject({
            widgetKey: 'detailsTable',
            parentInstanceKey: 'learning-content-tabs',
            slotKey: 'tab:library',
            rendererConfig: { variant: 'library' }
        })
        expect(quizzes).toMatchObject({
            zone: 'center',
            widgetKey: 'detailsTable',
            parentInstanceKey: 'learning-content-tabs',
            slotKey: 'tab:quizzes',
            rendererConfig: {
                variant: 'records',
                maxRows: 50,
                showSearch: true,
                createTargets: [
                    {
                        id: 'learning-content-quizzes-create',
                        label: { en: 'Quiz', ru: 'Тест' },
                        objectCollectionCodename: 'Quizzes',
                        icon: 'quiz'
                    }
                ]
            },
            bindings: {
                version: 1,
                slots: [
                    {
                        slot: 'rows',
                        targets: [
                            expect.objectContaining({ entityKind: 'object', entityCodename: 'Quizzes', selector: { kind: 'record-set' } })
                        ]
                    }
                ]
            }
        })

        const definition = getLayoutWidgetDefinition(quizzes!.widgetKey, quizzes!.rendererConfig)!
        expect(() => validateWidgetBindings(definition, quizzes!.bindings)).not.toThrow()

        expect(guestLinks).toMatchObject({
            widgetKey: 'relationBuilder',
            parentInstanceKey: 'learning-content-tabs',
            slotKey: 'tab:guest-links',
            rendererConfig: {
                parentTitleFieldCodename: 'Title',
                panels: [
                    {
                        slotKey: 'panel:guest-links',
                        title: { en: 'Guest access links', ru: 'Ссылки гостевого доступа' },
                        parentFieldCodename: 'TargetId',
                        parentFieldRequired: false,
                        titleFieldCodename: 'LinkTitle',
                        sortOrderFieldCodename: 'SortOrder',
                        displayFields: [{ fieldCodename: 'Slug', valueType: 'string', localized: false, required: true }],
                        rowLink: {
                            fieldCodename: 'Slug',
                            pathTemplate: '/public/a/{applicationId}/links/{value}',
                            label: { en: 'Full guest link', ru: 'Полная гостевая ссылка' }
                        },
                        createWizard: {
                            steps: [
                                {
                                    id: 'link',
                                    fieldCodenames: ['Slug', 'LinkTitle', 'IsActive', 'ExpiresAt', 'MaxUses']
                                },
                                {
                                    id: 'guest-form',
                                    fieldCodenames: [
                                        'ShowFirstName',
                                        'RequireFirstName',
                                        'ShowLastName',
                                        'RequireLastName',
                                        'ShowEmail',
                                        'RequireEmail',
                                        'ShowPhone',
                                        'RequirePhone',
                                        'CaptchaEnabled'
                                    ]
                                }
                            ]
                        }
                    }
                ]
            },
            bindings: {
                version: 1,
                slots: expect.arrayContaining([
                    expect.objectContaining({
                        slot: 'parent',
                        targets: [expect.objectContaining({ entityCodename: 'Quizzes', selector: { kind: 'record-set' } })]
                    }),
                    expect.objectContaining({
                        slot: 'panel:guest-links',
                        targets: [
                            expect.objectContaining({
                                entityCodename: 'AccessLinks',
                                selector: { kind: 'relation-set', parentSlot: 'parent' },
                                projection: expect.arrayContaining([
                                    expect.objectContaining({ field: 'display1', componentCodename: 'Slug' })
                                ])
                            })
                        ]
                    })
                ])
            }
        })
        const relationDefinition = getLayoutWidgetDefinition(guestLinks!.widgetKey, guestLinks!.rendererConfig)!
        expect(() => validateWidgetBindings(relationDefinition, guestLinks!.bindings)).not.toThrow()
        expect(() => orderDashboardSeedPlacements(placements)).not.toThrow()
    })

    it('keeps quiz access-link routing defaults and usage count out of the user form', () => {
        const accessLinks = lmsSeedAssessmentEntities.find(({ codename }) => codename === 'AccessLinks')
        const components = new Map(accessLinks?.components.map((component) => [component.codename, component]))

        expect(components.get('TargetType')).toMatchObject({
            uiConfig: { hidden: true, serverOwned: true, defaultValue: 'quiz' }
        })
        expect(components.get('TargetId')).toMatchObject({
            dataType: 'REF',
            isRequired: false,
            targetEntityCodename: 'Quizzes',
            uiConfig: { hidden: true, serverOwned: true }
        })
        expect(components.get('Slug')?.validationRules).toMatchObject({ unique: true })
        expect(components.get('UseCount')?.uiConfig).toMatchObject({ hidden: true, serverOwned: true })
        expect(components.get('SortOrder')?.uiConfig).toMatchObject({ hidden: true, serverOwned: true })
        expect(components.get('IsActive')?.uiConfig).toMatchObject({ defaultValue: true })
        const intakeDefaults = {
            ShowFirstName: DEFAULT_GUEST_INTAKE_POLICY.showFirstName,
            RequireFirstName: DEFAULT_GUEST_INTAKE_POLICY.requireFirstName,
            ShowLastName: DEFAULT_GUEST_INTAKE_POLICY.showLastName,
            RequireLastName: DEFAULT_GUEST_INTAKE_POLICY.requireLastName,
            ShowEmail: DEFAULT_GUEST_INTAKE_POLICY.showEmail,
            RequireEmail: DEFAULT_GUEST_INTAKE_POLICY.requireEmail,
            ShowPhone: DEFAULT_GUEST_INTAKE_POLICY.showPhone,
            RequirePhone: DEFAULT_GUEST_INTAKE_POLICY.requirePhone,
            CaptchaEnabled: DEFAULT_GUEST_INTAKE_POLICY.captchaEnabled
        }
        for (const [codename, defaultValue] of Object.entries(intakeDefaults)) {
            expect(components.get(codename)?.uiConfig).toMatchObject({ defaultValue })
        }

        expect(components.get('IsActive')?.uiConfig).toMatchObject({ defaultValue: true })
    })

    it('maps every access-link intake codename to its own shared policy default', () => {
        expect(
            createLmsAccessLinkIntakeDefaults({
                showFirstName: false,
                requireFirstName: true,
                showLastName: false,
                requireLastName: true,
                showEmail: true,
                requireEmail: false,
                showPhone: true,
                requirePhone: false,
                captchaEnabled: true
            })
        ).toEqual({
            IsActive: true,
            ShowFirstName: false,
            RequireFirstName: true,
            ShowLastName: false,
            RequireLastName: true,
            ShowEmail: true,
            RequireEmail: false,
            ShowPhone: true,
            RequirePhone: false,
            CaptchaEnabled: true
        })
    })

    it('marks guest credentials and consent evidence as hidden server-owned fields and uses multiline quiz copy', () => {
        const students = lmsSeedInitialEntities.find(({ codename }) => codename === 'Students')
        const serverOwnedFields = new Set([
            'IsGuest',
            'GuestSessionToken',
            'TermsVersion',
            'TermsAcceptedAt',
            'PrivacyVersion',
            'PrivacyAcceptedAt'
        ])
        const studentComponents = students?.components ?? []

        expect(students?.config).toMatchObject({ recordPolicy: { version: 1, workspaceCopy: 'exclude', runtimeMutation: 'allow' } })

        for (const codename of serverOwnedFields) {
            expect(studentComponents.find((component) => component.codename === codename)?.uiConfig).toMatchObject({
                hidden: true,
                serverOwned: true
            })
        }
        expect(studentComponents.find((component) => component.codename === 'IsGuest')?.uiConfig).toMatchObject({
            defaultValue: false,
            resetOnCopy: true
        })
        expect(studentComponents.find((component) => component.codename === 'GuestSessionToken')?.uiConfig).toMatchObject({
            defaultValue: null,
            resetOnCopy: true
        })
        for (const codename of ['TermsVersion', 'TermsAcceptedAt', 'PrivacyVersion', 'PrivacyAcceptedAt']) {
            expect(studentComponents.find((component) => component.codename === codename)?.uiConfig).toMatchObject({
                defaultValue: null,
                resetOnCopy: true
            })
        }

        const accessLinks = lmsSeedAssessmentEntities.find(({ codename }) => codename === 'AccessLinks')
        expect(accessLinks?.components.find((component) => component.codename === 'UseCount')?.uiConfig).toMatchObject({
            hidden: true,
            serverOwned: true,
            resetOnCopy: true
        })

        for (const codename of ['QuizAttempts', 'QuizResponses']) {
            const entity = lmsSeedAssessmentEntities.find((candidate) => candidate.codename === codename)
            expect(entity?.config).toMatchObject({
                recordPolicy: { version: 1, workspaceCopy: 'exclude', runtimeMutation: 'deny' }
            })
        }

        const quizzes = lmsSeedAssessmentEntities.find(({ codename }) => codename === 'Quizzes')
        const questions = quizzes?.components.find((component) => component.codename === 'Questions')?.childComponents ?? []
        expect(questions.find((component) => component.codename === 'Options')?.uiConfig).toMatchObject({
            widget: 'assessmentOptions',
            minOptions: 2,
            maxOptions: 20
        })
        expect(questions.find((component) => component.codename === 'QuestionDescription')?.uiConfig).toMatchObject({
            widget: 'textarea',
            rows: 4
        })
        expect(questions.find((component) => component.codename === 'Explanation')?.uiConfig).toMatchObject({
            widget: 'textarea',
            rows: 4
        })
    })

    it('places the sibling block selector on quiz question rows', () => {
        const quizzes = lmsSeedAssessmentEntities.find(({ codename }) => codename === 'Quizzes')
        const questions = quizzes?.components.find((component) => component.codename === 'Questions')?.childComponents ?? []
        const blocks = quizzes?.components.find((component) => component.codename === 'Blocks')?.childComponents ?? []
        const blockField = questions.find((component) => component.codename === 'BlockKey')
        const blockKey = blocks.find((component) => component.codename === 'BlockKey')

        expect(blockField).toMatchObject({
            dataType: 'STRING',
            uiConfig: {
                siblingRowSelect: {
                    tableCodename: 'Blocks',
                    valueFieldCodename: 'BlockKey',
                    labelFieldCodename: 'Title',
                    requireEachTargetReferenced: true
                }
            }
        })
        expect(lmsSeedAssessmentEntities.find(({ codename }) => codename === 'QuizAttempts')?.components).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ codename: 'BlockKey' })])
        )
        expect(blockKey?.uiConfig).toMatchObject({ hidden: true, resetOnCopy: true, generateUuidV7: true, siblingRowSelectKey: true })
    })

    it('hides server-generated response identifiers and selected-option JSON from ordinary record surfaces', () => {
        const responses = lmsSeedAssessmentEntities.find(({ codename }) => codename === 'QuizResponses')

        for (const codename of ['QuestionId', 'SelectedOptionIds']) {
            expect(responses?.components.find((component) => component.codename === codename)?.uiConfig).toMatchObject({
                hidden: true,
                serverOwned: true
            })
        }
    })
})
