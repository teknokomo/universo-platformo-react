import { z } from 'zod'

import { interpretationNetworkWorkspaceWidgetConfigSchema } from './interpretationNetworkLayout'
import { moduleBackedWidgetConfigSchema } from './moduleBackedWidgetConfig'
import { RESOURCE_TYPES } from './resourceSources'
import { sequencePolicySchema } from './sequenceCompletion'
import { workflowActionSchema } from './workflowActions'

const infoCardConfig = z
    .object({
        severity: z.enum(['info', 'success', 'warning', 'error']).optional()
    })
    .strict()

const headingConfig = z
    .object({
        align: z.enum(['left', 'center', 'right']).optional(),
        level: z.enum(['h1', 'h2', 'h3']).optional()
    })
    .strict()

const localizedTextSchema = z.union([
    z.string().trim().min(1).max(160),
    z.record(z.string().trim().min(2).max(16), z.string().trim().min(1).max(160))
])

const chartConfig = z
    .object({
        title: localizedTextSchema.optional(),
        interval: z.enum(['hour', 'day', 'week', 'month', 'quarter']).optional(),
        chartStyle: z.enum(['line', 'area', 'bar']).optional(),
        maxPoints: z.number().int().min(1).max(366).optional()
    })
    .strict()

const recordSetPresentationConfig = z
    .object({
        showSearch: z.boolean().optional(),
        showViewToggle: z.boolean().optional(),
        defaultViewMode: z.enum(['table', 'card']).optional(),
        showFilterBar: z.boolean().optional(),
        enableRowReordering: z.boolean().optional(),
        cardColumns: z.number().int().min(1).max(6).optional(),
        rowHeight: z.union([z.number().int().min(36).max(200), z.literal('auto')]).optional(),
        maxRows: z.number().int().min(1).max(500).optional()
    })
    .strict()

const columnDescriptorSchema = z
    .object({
        slotKey: z
            .string()
            .trim()
            .max(71)
            .regex(/^column:[A-Za-z][A-Za-z0-9._-]{0,63}$/u),
        width: z.number().int().min(1).max(12)
    })
    .strict()

const columnsContainerPresentationConfig = z
    .object({
        columns: z.array(columnDescriptorSchema).min(1).max(12)
    })
    .strict()
    .superRefine((value, context) => {
        const keys = value.columns.map(({ slotKey }) => slotKey)
        if (new Set(keys).size !== keys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: 'Column slot keys must be unique.' })
        }
    })

const detailsTabsPresentationConfig = z
    .object({
        tabs: z
            .array(
                z
                    .object({
                        slotKey: z
                            .string()
                            .trim()
                            .max(68)
                            .regex(/^tab:[A-Za-z][A-Za-z0-9._-]{0,63}$/u),
                        label: z.union([
                            z.string().trim().min(1).max(160),
                            z.record(z.string().trim().min(2).max(16), z.string().trim().min(1).max(160))
                        ]),
                        isDefault: z.boolean().optional()
                    })
                    .strict()
            )
            .min(1)
            .max(8)
    })
    .strict()
    .superRefine((value, context) => {
        const keys = value.tabs.map(({ slotKey }) => slotKey)
        if (new Set(keys).size !== keys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['tabs'], message: 'Tab slot keys must be unique.' })
        }
        if (value.tabs.filter(({ isDefault }) => isDefault).length > 1) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['tabs'], message: 'Only one tab can be the default.' })
        }
    })

const widgetCodenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)

const forbiddenCreateDefaultFieldKeys = new Set([
    'id',
    'workspaceid',
    'workspace',
    'ownerid',
    'owneruserid',
    'owner',
    'userid',
    'user',
    'assigneduserid',
    'createdby',
    'updatedby',
    'deletedby',
    'progress',
    'progresspercent',
    'progressstatus',
    'lifecyclestate',
    'lifecycle',
    'targetrecordid',
    'targetobjectcodename',
    'targetobjectid',
    'sourceobjectcodename',
    'sourcerowid',
    'sourcelineid',
    'principalid',
    'apprecordstate',
    'appdeleted'
])

const isUnsafeCreateDefaultFieldCodename = (fieldCodename: string): boolean => {
    const normalized = fieldCodename
        .trim()
        .replace(/[^a-z0-9]/giu, '')
        .toLowerCase()
    return normalized.startsWith('upl') || forbiddenCreateDefaultFieldKeys.has(normalized)
}

const createDefaultContextPathSchema = z
    .string()
    .trim()
    .min(1)
    .max(256)
    .refine(
        (value) =>
            value.split('.').every((segment) => {
                const normalized = segment.toLowerCase()
                return /^[A-Za-z0-9_-]+$/u.test(segment) && !['__proto__', 'prototype', 'constructor'].includes(normalized)
            }),
        'Create target default context paths must use safe dot-separated identifiers.'
    )

export const createTargetDefaultSchema = z
    .object({
        fieldCodename: widgetCodenameSchema,
        value: z.union([z.string().max(2048), z.number().finite(), z.boolean(), z.null()]).optional(),
        enumCodename: widgetCodenameSchema.optional(),
        resourceSourceType: z.enum(RESOURCE_TYPES).optional(),
        contextPath: createDefaultContextPathSchema.optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (isUnsafeCreateDefaultFieldCodename(value.fieldCodename)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Create target defaults cannot target system-owned fields.',
                path: ['fieldCodename']
            })
        }

        const sourceCount = [
            Object.prototype.hasOwnProperty.call(value, 'value'),
            typeof value.enumCodename === 'string',
            typeof value.resourceSourceType === 'string',
            typeof value.contextPath === 'string'
        ].filter(Boolean).length
        if (sourceCount !== 1) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Create target default must define exactly one default value source.'
            })
        }
    })

export type CreateTargetDefault = z.infer<typeof createTargetDefaultSchema>

const rowCountWarningSchema = z
    .object({
        threshold: z.number().int().min(1).max(100_000),
        message: localizedTextSchema
    })
    .strict()

const recordsUnionTargetFilterSchema = z
    .object({
        id: z.string().trim().min(1).max(64),
        label: localizedTextSchema,
        targetDisplayTypes: z.array(z.string().trim().min(1).max(64)).min(1).max(16).optional(),
        targetSectionCodenames: z.array(widgetCodenameSchema).min(1).max(16).optional(),
        targetObjectCollectionCodenames: z.array(widgetCodenameSchema).min(1).max(16).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (!value.targetDisplayTypes?.length && !value.targetSectionCodenames?.length && !value.targetObjectCollectionCodenames?.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Target filters must define at least one semantic criterion.' })
        }
    })

const createTargetSchema = z
    .object({
        id: z.string().trim().min(1).max(64),
        label: localizedTextSchema,
        sectionCodename: widgetCodenameSchema.optional(),
        objectCollectionCodename: widgetCodenameSchema.optional(),
        icon: z.string().trim().min(1).max(64).nullable().optional(),
        surface: z.enum(['dialog', 'page']).optional(),
        disabled: z.boolean().optional(),
        disabledReason: localizedTextSchema.optional(),
        createDefaults: z.array(createTargetDefaultSchema).max(12).optional()
    })
    .strict()
    .superRefine((value, context) => {
        if (Boolean(value.sectionCodename) === Boolean(value.objectCollectionCodename)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Create target must reference exactly one semantic source kind.'
            })
        }
    })

const semanticTargetPickerObjectSchema = z
    .object({
        targetSectionCodename: widgetCodenameSchema.optional(),
        targetObjectCollectionCodename: widgetCodenameSchema.optional(),
        parentFieldCodename: widgetCodenameSchema.optional(),
        labelFields: z.array(widgetCodenameSchema).min(1).max(8).optional(),
        dialogTitle: localizedTextSchema.optional(),
        targetLabel: localizedTextSchema.optional()
    })
    .strict()

const requireSemanticTarget = (value: z.infer<typeof semanticTargetPickerObjectSchema>, context: z.RefinementCtx): void => {
    if (!value.targetSectionCodename && !value.targetObjectCollectionCodename) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Target action must reference a semantic source.' })
    }
}

const semanticTargetPickerSchema = semanticTargetPickerObjectSchema.superRefine(requireSemanticTarget)

const detailsTableRowActionSchema = z.union([
    z
        .object({
            id: z.string().trim().min(1).max(64),
            kind: z.literal('library.toggle'),
            libraryView: z.enum(['starred', 'shared']),
            label: localizedTextSchema.optional(),
            activeLabel: localizedTextSchema.optional(),
            icon: z.enum(['star', 'share']).optional(),
            principalTarget: z.enum(['currentUser', 'workspaceMember']).optional(),
            dialogTitle: localizedTextSchema.optional(),
            targetLabel: localizedTextSchema.optional()
        })
        .strict(),
    semanticTargetPickerObjectSchema
        .extend({
            id: z.string().trim().min(1).max(64),
            kind: z.literal('field.updateWithTarget'),
            fieldCodename: widgetCodenameSchema,
            label: localizedTextSchema.optional(),
            icon: z.enum(['move']).optional()
        })
        .strict()
        .superRefine(requireSemanticTarget)
])

const recordsDetailsTableConfigSchema = recordSetPresentationConfig
    .extend({
        variant: z.literal('records').optional(),
        targetFilters: z.array(recordsUnionTargetFilterSchema).max(16).optional(),
        createTargets: z.array(createTargetSchema).max(16).optional(),
        rowActions: z.array(detailsTableRowActionSchema).max(8).optional(),
        restoreTarget: semanticTargetPickerSchema.optional(),
        rowCountWarning: rowCountWarningSchema.optional(),
        sequencePolicy: sequencePolicySchema.optional(),
        reportCodename: z.never().optional(),
        workflowActions: z.array(workflowActionSchema).max(16).optional()
    })
    .strict()

const libraryDetailsTableConfigSchema = recordSetPresentationConfig
    .extend({
        variant: z.literal('library'),
        libraryView: z.enum(['all', 'recent', 'starred', 'shared']).default('all'),
        lifecycleState: z.enum(['active', 'deleted']).default('active'),
        targetFilters: z.array(recordsUnionTargetFilterSchema).max(16).optional(),
        createTargets: z.array(createTargetSchema).max(16).optional(),
        rowActions: z.array(detailsTableRowActionSchema).max(8).optional(),
        restoreTarget: semanticTargetPickerSchema.optional(),
        rowCountWarning: rowCountWarningSchema.optional()
    })
    .strict()

const learnerEnrollmentDetailsTableConfigSchema = recordSetPresentationConfig
    .pick({ rowHeight: true, maxRows: true })
    .extend({ variant: z.literal('learner-enrollments') })
    .strict()

const savedReportDetailsTableConfigSchema = recordSetPresentationConfig
    .pick({ rowHeight: true })
    .extend({ variant: z.literal('report'), reportCodename: widgetCodenameSchema })
    .strict()

const detailsTableConfigSchema = z.discriminatedUnion('variant', [
    recordsDetailsTableConfigSchema,
    libraryDetailsTableConfigSchema,
    learnerEnrollmentDetailsTableConfigSchema,
    savedReportDetailsTableConfigSchema
])

export type DashboardRecordsTableWidgetConfig = z.infer<typeof recordsDetailsTableConfigSchema>
export type DashboardLibraryTableWidgetConfig = z.infer<typeof libraryDetailsTableConfigSchema>
export type DashboardLearnerEnrollmentTableWidgetConfig = z.infer<typeof learnerEnrollmentDetailsTableConfigSchema>
export type DashboardSavedReportWidgetConfig = z.infer<typeof savedReportDetailsTableConfigSchema>

const menuWidgetConfigSchema = z.object({ variant: z.enum(['generated', 'manual']) }).strict()

const moduleMethodNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)

const relationBuilderDisplayFieldSchema = z
    .object({
        fieldCodename: widgetCodenameSchema,
        valueType: z.enum(['string', 'number', 'boolean']),
        localized: z.boolean(),
        required: z.boolean()
    })
    .strict()
    .superRefine((field, context) => {
        const hasIdentifierSuffix = /(?:Id|ID|Uuid|UUID)$/u.test(field.fieldCodename) || /(?:_id|_uuid)$/iu.test(field.fieldCodename)
        if (isUnsafeCreateDefaultFieldCodename(field.fieldCodename) || hasIdentifierSuffix) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['fieldCodename'],
                message: 'Relation display fields cannot expose system or identifier Components.'
            })
        }
        if (field.localized && field.valueType !== 'string') {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['localized'],
                message: 'Only string Components can use localized display values.'
            })
        }
    })

const quizWidgetConfigSchema = moduleBackedWidgetConfigSchema
    .pick({ moduleCodename: true, attachedToKind: true, serverModuleCodename: true })
    .extend({
        mountMethodName: moduleMethodNameSchema.optional(),
        submitMethodName: moduleMethodNameSchema.optional()
    })
    .strict()

export const relationBuilderPanelSchema = z
    .object({
        slotKey: z
            .string()
            .trim()
            .max(70)
            .regex(/^panel:[A-Za-z][A-Za-z0-9._-]{0,63}$/u),
        title: localizedTextSchema,
        width: z.number().int().min(1).max(12).optional(),
        order: z.number().int().min(0).max(31).optional(),
        parentFieldCodename: widgetCodenameSchema,
        sortOrderFieldCodename: widgetCodenameSchema.optional(),
        displayFields: z.array(relationBuilderDisplayFieldSchema).max(8).optional(),
        enableRowReordering: z.boolean().optional(),
        createDefaults: z.array(createTargetDefaultSchema).max(12).optional(),
        createWizard: z
            .object({
                steps: z
                    .array(
                        z
                            .object({
                                id: z.string().trim().min(1).max(64),
                                label: localizedTextSchema,
                                helperText: localizedTextSchema.optional(),
                                fieldCodenames: z.array(widgetCodenameSchema).min(1).max(12)
                            })
                            .strict()
                    )
                    .min(1)
                    .max(6)
            })
            .strict()
            .optional(),
        rowCountWarning: rowCountWarningSchema.optional()
    })
    .strict()
    .superRefine((panel, context) => {
        const displayFields = panel.displayFields ?? []
        const fieldCodenames = displayFields.map(({ fieldCodename }) => fieldCodename)
        if (new Set(fieldCodenames).size !== fieldCodenames.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['displayFields'], message: 'Display field Codenames must be unique.' })
        }

        const reservedCodenames = new Set(['Title', panel.parentFieldCodename, panel.sortOrderFieldCodename ?? 'SortOrder'])
        displayFields.forEach(({ fieldCodename }, index) => {
            if (reservedCodenames.has(fieldCodename)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['displayFields', index, 'fieldCodename'],
                    message: 'Relation display fields must not duplicate a panel binding Component.'
                })
            }
        })
    })
export type RelationBuilderPanelConfig = z.infer<typeof relationBuilderPanelSchema>

const relationBuilderConfigSchema = z
    .object({
        wizardMode: z.boolean().optional(),
        enableRowReordering: z.boolean().optional(),
        parentLabel: localizedTextSchema.optional(),
        parentTitleFieldCodename: widgetCodenameSchema.optional(),
        emptyParentMessage: localizedTextSchema.optional(),
        panels: z.array(relationBuilderPanelSchema).min(1).max(16)
    })
    .strict()
    .superRefine((value, context) => {
        const keys = (value.panels ?? []).map(({ slotKey }) => slotKey)
        if (new Set(keys).size !== keys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['panels'], message: 'Relation panel slot keys must be unique.' })
        }
    })

const emptyConfigSchema = z.object({}).strict()

export const DASHBOARD_WIDGET_CONFIG_SCHEMAS = {
    workspaceSwitcher: z.object({ variant: z.enum(['compact', 'wide']).optional() }).strict(),
    divider: z
        .object({ orientation: z.enum(['horizontal', 'vertical']).optional(), spacing: z.number().int().min(0).max(32).optional() })
        .strict(),
    menuWidget: menuWidgetConfigSchema,
    spacer: z.object({ flex: z.number().min(0).max(8).optional(), minSize: z.number().int().min(0).max(256).optional() }).strict(),
    infoCard: infoCardConfig,
    userProfile: z.object({ variant: z.enum(['compact', 'wide']).optional() }).strict(),
    appNavbar: emptyConfigSchema,
    header: emptyConfigSchema,
    breadcrumbs: z
        .object({ maxItems: z.number().int().min(1).max(32).optional(), overflow: z.enum(['collapse', 'scroll']).optional() })
        .strict(),
    search: z.object({ width: z.enum(['compact', 'standard', 'wide']).optional(), placeholder: localizedTextSchema.optional() }).strict(),
    datePicker: z.object({ selection: z.enum(['single', 'range']).optional(), showPresets: z.boolean().optional() }).strict(),
    optionsMenu: z
        .object({
            density: z.enum(['compact', 'standard']).optional(),
            visibleActions: z
                .array(z.enum(['notifications', 'preferences']))
                .max(2)
                .optional()
        })
        .strict(),
    languageSwitcher: emptyConfigSchema,
    colorModeSwitcher: emptyConfigSchema,
    overviewTitle: headingConfig,
    overviewCards: z
        .object({
            maxCards: z.number().int().min(1).max(8).optional(),
            density: z.enum(['compact', 'standard', 'comfortable']).optional(),
            trendDisplay: z.enum(['hidden', 'compact', 'expanded']).optional()
        })
        .strict(),
    sessionsChart: chartConfig,
    pageViewsChart: chartConfig,
    detailsTitle: headingConfig,
    detailsTable: detailsTableConfigSchema,
    relationBuilder: relationBuilderConfigSchema,
    columnsContainer: columnsContainerPresentationConfig,
    detailsTabs: detailsTabsPresentationConfig,
    interpretationNetworkWorkspace: interpretationNetworkWorkspaceWidgetConfigSchema,
    quizWidget: quizWidgetConfigSchema,
    playcanvasCanvas: moduleBackedWidgetConfigSchema
        .pick({
            moduleCodename: true,
            attachedToKind: true,
            mountMethodName: true,
            emptyStateTitle: true,
            emptyStateDescription: true,
            serverModuleCodename: true
        })
        .extend({
            title: localizedTextSchema.optional(),
            runtimeManifest: z
                .object({
                    source: z.literal('publishedManifest'),
                    projectId: z.string().uuid(),
                    sceneId: z.string().uuid().nullable().optional(),
                    checksum: z.string().regex(/^[a-f0-9]{64}$/iu),
                    failClosed: z.boolean().default(true)
                })
                .strict()
                .optional(),
            minHeight: z.number().int().min(320).max(1200).optional(),
            heightMode: z.enum(['fixed', 'fitViewport']).optional(),
            camera: z
                .object({
                    distance: z.number().min(1).max(1000).optional(),
                    minDistance: z.number().min(1).max(1000).optional(),
                    maxDistance: z.number().min(1).max(2000).optional()
                })
                .strict()
                .optional(),
            scene: z
                .object({
                    background: z.string().trim().min(1).max(32).optional(),
                    objects: z
                        .array(
                            z
                                .object({
                                    id: z.string().trim().min(1).max(128),
                                    label: localizedTextSchema.optional(),
                                    position: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict(),
                                    scale: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).strict(),
                                    selectable: z.boolean().optional(),
                                    guard: z.boolean().optional()
                                })
                                .strict()
                        )
                        .min(1)
                        .max(64)
                        .optional(),
                    controlledObjectId: z.string().trim().min(1).max(128).optional(),
                    targetObjectId: z.string().trim().min(1).max(128).optional(),
                    cruiseSpeed: z.number().min(1).max(1000).optional(),
                    intentDistance: z.number().min(10).max(10_000).optional()
                })
                .strict()
                .superRefine((scene, context) => {
                    if (!scene.objects?.length) return

                    const objectIds = new Set<string>()
                    for (const [index, object] of scene.objects.entries()) {
                        if (objectIds.has(object.id)) {
                            context.addIssue({
                                code: z.ZodIssueCode.custom,
                                path: ['objects', index, 'id'],
                                message: 'Scene object ids must be unique.'
                            })
                        }
                        objectIds.add(object.id)
                    }
                    if (scene.controlledObjectId && !objectIds.has(scene.controlledObjectId)) {
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['controlledObjectId'],
                            message: 'Controlled object must reference an object in the scene.'
                        })
                    }
                    if (scene.targetObjectId && !objectIds.has(scene.targetObjectId)) {
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['targetObjectId'],
                            message: 'Target object must reference an object in the scene.'
                        })
                    }
                })
                .optional()
        })
        .strict(),
    resourcePreview: z
        .object({
            displayMode: z.enum(['card', 'compact', 'embedded']).optional(),
            titleOverride: localizedTextSchema.optional()
        })
        .strict(),
    learnerPlayer: z
        .object({
            variant: z.enum(['course', 'track']),
            displayMode: z.enum(['list', 'player']).optional(),
            sequenceMode: z.enum(['strict', 'flexible']).optional()
        })
        .strict(),
    footer: z
        .object({
            alignment: z.enum(['left', 'center', 'right']).optional(),
            spacing: z.enum(['compact', 'standard', 'spacious']).optional(),
            showLegalLinks: z.boolean().optional(),
            showContact: z.boolean().optional()
        })
        .strict()
} satisfies Record<string, z.ZodTypeAny>

export type DashboardLayoutWidgetKey = keyof typeof DASHBOARD_WIDGET_CONFIG_SCHEMAS
export type DashboardWidgetConfig<K extends DashboardLayoutWidgetKey> = z.infer<(typeof DASHBOARD_WIDGET_CONFIG_SCHEMAS)[K]>
