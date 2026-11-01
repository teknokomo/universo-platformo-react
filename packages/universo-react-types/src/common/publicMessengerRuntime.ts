import { z } from 'zod'
import { publicApplicationRouteResolutionSchema } from './applicationAliases'
import { layoutInstanceKeySchema } from './applicationLayouts'

export const MAX_PUBLIC_MESSENGER_TABLE_ROWS = 20
export const MAX_PUBLIC_MESSENGER_CHART_POINTS = 30
export const MAX_PUBLIC_MESSENGER_RUNTIME_DATA_BYTES = 3 * 1024 * 1024
export const MAX_PUBLIC_MESSENGER_PLACEMENTS = 64
export const MAX_PUBLIC_MESSENGER_RELATION_PANELS = 16
export const MAX_PUBLIC_MESSENGER_RENDERER_PLACEMENTS = MAX_PUBLIC_MESSENGER_PLACEMENTS * MAX_PUBLIC_MESSENGER_RELATION_PANELS * 2

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const uuidLikeText = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
const emailLikeText = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu
const phoneLikeText = /(?:^|\D)\+?\d[\d ().-]{8,}\d(?:$|\D)/u
const privateKeyPemText = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/iu
const credentialLikeText =
    /(?:\bbearer\s+[A-Z0-9._~+/-]{12,}\b|\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}(?:\.[A-Z0-9_-]+)?|\b(?:access|refresh|auth|api|secret)[_-]?(?:token|key)\s*[:=])/iu

export const isPublicMessengerTextSafe = (value: string): boolean =>
    !uuidLikeText.test(value) &&
    !emailLikeText.test(value) &&
    !phoneLikeText.test(value) &&
    !privateKeyPemText.test(value) &&
    !credentialLikeText.test(value)

const PUBLIC_PERSONAL_IDENTITY_FIELD_MARKERS = [
    'firstname',
    'lastname',
    'givenname',
    'familyname',
    'fullname',
    'surname',
    'middlename',
    'patronymic',
    'displayname',
    'personname',
    'customername',
    'contactname',
    'contactpersonname',
    'membername',
    'profilename',
    'employeename',
    'studentname',
    'patientname',
    'subscribername',
    'agentname',
    'clientname',
    'staffname',
    'participantname',
    'sendername',
    'receivername',
    'assigneename',
    'accountownername',
    'preferredname',
    'legalname',
    'nickname',
    'parentname',
    'childname',
    'guestname',
    'adminname',
    'recipientname',
    'ownername',
    'authorname',
    'username',
    'имя',
    'фамилия',
    'отчеств',
    'фио'
] as const

/** Detect field labels that identify a natural person's name in anonymous public data. */
export const isPublicPersonalIdentityFieldName = (value: string): boolean => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9а-яё]/gu, '')
    return normalized === 'name' || PUBLIC_PERSONAL_IDENTITY_FIELD_MARKERS.some((marker) => normalized.includes(marker))
}

const PUBLIC_MESSENGER_CREDENTIAL_URL_PARAMETER_NAMES = new Set([
    'accesskey',
    'accesskeyid',
    'apikey',
    'auth',
    'authorization',
    'bearer',
    'clientsecret',
    'credential',
    'credentials',
    'googaccessid',
    'jwt',
    'key',
    'oauth',
    'password',
    'passwd',
    'privatekey',
    'secret',
    'sessionid',
    'sig',
    'signature',
    'token',
    'xamzcredential',
    'xamzsecuritytoken',
    'xamzsignature',
    'xgoogcredential',
    'xgoogsignature'
])

/** Reject credential-bearing URL parameter names without blocking ordinary keys such as `author`. */
export const isPublicMessengerCredentialUrlParameter = (key: string): boolean => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '')
    return (
        PUBLIC_MESSENGER_CREDENTIAL_URL_PARAMETER_NAMES.has(normalizedKey) ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('credential') ||
        normalizedKey.includes('signature') ||
        normalizedKey.includes('privatekey') ||
        normalizedKey.includes('apikey') ||
        normalizedKey.includes('accesskey') ||
        normalizedKey.includes('sessionid')
    )
}

const publicMessengerTextSchema = (maxLength: number) =>
    z
        .string()
        .max(maxLength)
        .refine(isPublicMessengerTextSafe, 'Public Messenger text must not contain identifiers or private contact data.')

const publicMessengerDataLabelSchema = (maxLength: number) =>
    publicMessengerTextSchema(maxLength).refine(
        (value) => !isPublicPersonalIdentityFieldName(value),
        "Public Messenger data labels must not identify a person's name."
    )

const publicMessengerSemanticKeySchema = layoutInstanceKeySchema
    .refine((value) => !uuidLike.test(value), { message: 'Public placement identity must be semantic.' })
    .refine(
        (value) => !uuidLikeText.test(value) && /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(value),
        'Public Messenger placement keys must be semantic.'
    )

const publicMessengerIsoTimestampSchema = z.string().datetime()
const publicMessengerSeriesLabelSchema = z
    .string()
    .max(120)
    .refine(
        (value) => isPublicMessengerTextSafe(value) || publicMessengerIsoTimestampSchema.safeParse(value).success,
        'Public Messenger chart labels must be safe text or an ISO timestamp.'
    )

const publicMessengerSlotKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
    .refine((value) => !uuidLikeText.test(value), 'Public Messenger slot keys must be semantic.')

const publicMessengerTabSlotSchema = z
    .string()
    .regex(/^tab:[A-Za-z][A-Za-z0-9._-]{0,63}$/u)
    .refine((value) => !uuidLikeText.test(value))
const publicMessengerColumnSlotSchema = z
    .string()
    .regex(/^column:[A-Za-z][A-Za-z0-9._-]{0,63}$/u)
    .refine((value) => !uuidLikeText.test(value))
const publicMessengerPanelSlotSchema = z
    .string()
    .regex(/^panel:[A-Za-z][A-Za-z0-9._-]{0,63}$/u)
    .refine((value) => !uuidLikeText.test(value))

const publicMessengerBasePlacementShape = {
    instanceKey: publicMessengerSemanticKeySchema,
    zone: z.enum(['top', 'center', 'bottom']),
    sortOrder: z.number().int().min(0).max(100_000),
    parentInstanceKey: publicMessengerSemanticKeySchema.nullable(),
    slotKey: publicMessengerSlotKeySchema.nullable()
}

const publicMessengerHeaderConfigSchema = z.object({}).strict()
const publicMessengerOverviewCardsConfigSchema = z
    .object({
        maxCards: z.number().int().min(1).max(8).optional(),
        density: z.enum(['compact', 'standard', 'comfortable']).optional(),
        trendDisplay: z.enum(['hidden', 'compact', 'expanded']).optional()
    })
    .strict()
const publicMessengerDetailsTableConfigSchema = z
    .object({
        variant: z.literal('records'),
        showSearch: z.boolean().optional(),
        showViewToggle: z.boolean().optional(),
        defaultViewMode: z.enum(['table', 'card']).optional(),
        showFilterBar: z.boolean().optional(),
        cardColumns: z.number().int().min(1).max(6).optional(),
        rowHeight: z.union([z.number().int().min(36).max(200), z.literal('auto')]).optional(),
        maxRows: z.number().int().min(1).max(MAX_PUBLIC_MESSENGER_TABLE_ROWS).optional()
    })
    .strict()
const publicMessengerDetailsTitleConfigSchema = z
    .object({ align: z.enum(['left', 'center', 'right']).optional(), level: z.enum(['h1', 'h2', 'h3']).optional() })
    .strict()
const publicMessengerDetailsTabsConfigSchema = z
    .object({
        tabs: z
            .array(
                z
                    .object({
                        slotKey: publicMessengerTabSlotSchema,
                        label: publicMessengerTextSchema(160).refine((value) => value.trim().length > 0),
                        isDefault: z.boolean().optional()
                    })
                    .strict()
            )
            .min(1)
            .max(8)
    })
    .strict()
    .superRefine((config, context) => {
        const slotKeys = config.tabs.map(({ slotKey }) => slotKey)
        if (new Set(slotKeys).size !== slotKeys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['tabs'], message: 'Public Messenger tab slots must be unique.' })
        }
        if (config.tabs.filter(({ isDefault }) => isDefault).length > 1) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['tabs'], message: 'Only one public Messenger tab can be default.' })
        }
    })
const publicMessengerMenuConfigSchema = z.object({ variant: z.literal('generated') }).strict()
const publicMessengerMenuTargetSchema = z
    .object({
        kind: z.enum(['hub', 'page', 'object']),
        codename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u)
            .refine(isPublicMessengerTextSafe)
    })
    .strict()
const publicMessengerMenuItemSchema = z
    .object({
        key: publicMessengerSemanticKeySchema,
        label: publicMessengerTextSchema(160).refine((value) => value.trim().length > 0),
        icon: z.null(),
        kind: z.enum(['group', 'section']),
        target: publicMessengerMenuTargetSchema
    })
    .strict()
    .superRefine((item, context) => {
        const validTarget = (item.kind === 'group' && item.target.kind === 'hub') || (item.kind === 'section' && item.target.kind !== 'hub')
        if (!validTarget)
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'Public Messenger menu target is invalid.' })
    })
const publicMessengerMenuDataSchema = z
    .object({
        kind: z.literal('menu'),
        title: publicMessengerTextSchema(160),
        showTitle: z.boolean(),
        overflowLabel: publicMessengerTextSchema(80).refine((value) => value.trim().length > 0),
        items: z.array(publicMessengerMenuItemSchema).max(100),
        overflowItems: z.array(publicMessengerMenuItemSchema).max(0)
    })
    .strict()
    .superRefine((menu, context) => {
        const keys = menu.items.map(({ key }) => key)
        if (new Set(keys).size !== keys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Public Messenger menu keys must be unique.' })
        }
    })
const publicMessengerResourceConfigSchema = z
    .object({
        displayMode: z.enum(['card', 'compact', 'embedded']).optional(),
        titleOverride: publicMessengerTextSchema(160).optional()
    })
    .strict()
const publicMessengerRelationConfigSchema = z
    .object({
        parentLabel: publicMessengerTextSchema(160).optional(),
        emptyParentMessage: publicMessengerTextSchema(160).optional(),
        panels: z
            .array(
                z
                    .object({
                        slotKey: publicMessengerPanelSlotSchema,
                        title: publicMessengerTextSchema(160),
                        width: z.number().int().min(1).max(12).optional(),
                        order: z.number().int().min(0).max(31).optional()
                    })
                    .strict()
            )
            .min(1)
            .max(MAX_PUBLIC_MESSENGER_RELATION_PANELS)
    })
    .strict()
    .superRefine((config, context) => {
        const slotKeys = config.panels.map(({ slotKey }) => slotKey)
        if (new Set(slotKeys).size !== slotKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['panels'],
                message: 'Public Messenger relation panel slots must be unique.'
            })
        }
    })
const publicMessengerColumnsConfigSchema = z
    .object({
        columns: z
            .array(z.object({ slotKey: publicMessengerColumnSlotSchema, width: z.number().int().min(1).max(12) }).strict())
            .min(1)
            .max(12)
    })
    .strict()
    .superRefine((config, context) => {
        const slotKeys = config.columns.map(({ slotKey }) => slotKey)
        if (new Set(slotKeys).size !== slotKeys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: 'Public Messenger column slots must be unique.' })
        }
    })
const publicMessengerChartConfigSchema = z
    .object({
        title: publicMessengerTextSchema(160).optional(),
        interval: z.enum(['hour', 'day', 'week', 'month', 'quarter']).optional(),
        chartStyle: z.enum(['line', 'area', 'bar']).optional(),
        maxPoints: z.number().int().min(1).max(MAX_PUBLIC_MESSENGER_CHART_POINTS).optional()
    })
    .strict()

const publicMessengerMetricCardSchema = z
    .object({
        label: publicMessengerDataLabelSchema(120).refine((value) => value.trim().length > 0),
        value: publicMessengerTextSchema(80),
        trend: z.enum(['up', 'down', 'neutral']).optional(),
        trendLabel: publicMessengerTextSchema(80).optional(),
        sparkline: z.array(z.number().finite()).max(120).optional()
    })
    .strict()
const publicMessengerMetricsDataSchema = z
    .object({ kind: z.literal('metrics'), cards: z.array(publicMessengerMetricCardSchema).max(8) })
    .strict()
const publicMessengerTitleDataSchema = z.object({ kind: z.literal('title'), text: publicMessengerTextSchema(160) }).strict()
const publicMessengerTableDataSchema = z
    .object({
        kind: z.literal('table'),
        columns: z
            .array(
                z
                    .object({
                        key: z.string().regex(/^column[1-9][0-9]*$/u),
                        label: publicMessengerDataLabelSchema(120).refine((value) => value.trim().length > 0),
                        valueType: z.enum(['string', 'number', 'boolean']).optional()
                    })
                    .strict()
            )
            .min(1)
            .max(64),
        rows: z
            .array(
                z
                    .object({
                        key: z.string().regex(/^row[1-9][0-9]*$/u),
                        cells: z
                            .array(
                                z.object({ key: z.string().regex(/^column[1-9][0-9]*$/u), value: publicMessengerTextSchema(2000) }).strict()
                            )
                            .max(64)
                    })
                    .strict()
            )
            .max(MAX_PUBLIC_MESSENGER_TABLE_ROWS),
        pagination: z
            .object({
                total: z.number().int().nonnegative(),
                limit: z.number().int().positive().max(MAX_PUBLIC_MESSENGER_TABLE_ROWS),
                offset: z.number().int().nonnegative()
            })
            .strict()
            .optional()
    })
    .strict()
    .superRefine((table, context) => {
        const columnKeys = table.columns.map(({ key }) => key)
        if (new Set(columnKeys).size !== columnKeys.length) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['columns'], message: 'Public Messenger table columns must be unique.' })
        }
        table.rows.forEach((row, rowIndex) => {
            const cellKeys = row.cells.map(({ key }) => key)
            if (new Set(cellKeys).size !== cellKeys.length || cellKeys.some((key) => !columnKeys.includes(key))) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['rows', rowIndex, 'cells'],
                    message: 'Public Messenger cells must match columns.'
                })
            }
        })
    })
const publicMessengerRecordDataSchema = z
    .object({
        kind: z.literal('record'),
        title: publicMessengerTextSchema(160),
        fields: z
            .array(
                z
                    .object({
                        label: publicMessengerDataLabelSchema(120).refine((value) => value.trim().length > 0),
                        value: publicMessengerTextSchema(2000)
                    })
                    .strict()
            )
            .min(1)
            .max(64)
    })
    .strict()
const publicMessengerDetailsTableDataSchema = z.union([publicMessengerTableDataSchema, publicMessengerRecordDataSchema])
const publicMessengerResourceUrlSchema = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .url()
    .refine((value) => {
        try {
            const parsed = new URL(value)
            const hashParameters = new URLSearchParams(parsed.hash.replace(/^#/u, ''))
            const hasSensitiveParameters = [parsed.searchParams, hashParameters].some((parameters) =>
                [...parameters.keys()].some(isPublicMessengerCredentialUrlParameter)
            )
            return (
                parsed.protocol === 'https:' &&
                !parsed.username &&
                !parsed.password &&
                !hasSensitiveParameters &&
                isPublicMessengerTextSafe(value)
            )
        } catch {
            return false
        }
    }, 'Public Messenger resources must use a safe HTTPS URL.')
const publicMessengerResourceSourceSchema = z.discriminatedUnion('type', [
    z
        .object({
            type: z.enum(['url', 'video', 'audio', 'document', 'embed', 'file']),
            url: publicMessengerResourceUrlSchema,
            launchMode: z.enum(['inline', 'newTab', 'download'])
        })
        .strict(),
    z
        .object({
            type: z.literal('page'),
            pageCodename: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u),
            launchMode: z.enum(['inline', 'newTab', 'download'])
        })
        .strict()
])
const publicMessengerResourceDataSchema = z
    .object({ kind: z.literal('resource'), title: publicMessengerTextSchema(160), source: publicMessengerResourceSourceSchema })
    .strict()
const publicMessengerRelationDataSchema = z
    .object({
        kind: z.literal('relation'),
        parents: z
            .array(z.object({ key: z.string().regex(/^parent[1-9][0-9]*$/u), label: publicMessengerDataLabelSchema(160) }).strict())
            .max(100),
        panels: z
            .array(
                z
                    .object({
                        slotKey: publicMessengerPanelSlotSchema,
                        title: publicMessengerTextSchema(160),
                        displayColumns: z
                            .array(
                                z.object({ key: z.string().regex(/^display[1-8]$/u), label: publicMessengerDataLabelSchema(120) }).strict()
                            )
                            .max(8),
                        rows: z
                            .array(
                                z
                                    .object({
                                        key: z.string().regex(/^row[1-9][0-9]*-[1-9][0-9]*$/u),
                                        parentKey: z.string().regex(/^parent[1-9][0-9]*$/u),
                                        label: publicMessengerTextSchema(160),
                                        cells: z
                                            .array(
                                                z
                                                    .object({
                                                        key: z.string().regex(/^display[1-8]$/u),
                                                        value: publicMessengerTextSchema(240)
                                                    })
                                                    .strict()
                                            )
                                            .max(8)
                                    })
                                    .strict()
                            )
                            .max(1000)
                    })
                    .strict()
            )
            .max(32)
    })
    .strict()
    .superRefine((relation, context) => {
        const parentKeys = relation.parents.map(({ key }) => key)
        if (new Set(parentKeys).size !== parentKeys.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['parents'],
                message: 'Public Messenger relation parents must be unique.'
            })
        }
        relation.panels.forEach((panel, panelIndex) => {
            const columnKeys = panel.displayColumns.map(({ key }) => key)
            if (new Set(columnKeys).size !== columnKeys.length) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['panels', panelIndex, 'displayColumns'],
                    message: 'Relation columns must be unique.'
                })
            }
            panel.rows.forEach((row, rowIndex) => {
                if (!parentKeys.includes(row.parentKey)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['panels', panelIndex, 'rows', rowIndex, 'parentKey'],
                        message: 'Relation parent is missing.'
                    })
                }
                const cellKeys = row.cells.map(({ key }) => key)
                if (cellKeys.length !== columnKeys.length || cellKeys.some((key, index) => key !== columnKeys[index])) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['panels', panelIndex, 'rows', rowIndex, 'cells'],
                        message: 'Relation cells must match columns.'
                    })
                }
            })
        })
    })
const publicMessengerSeriesDataSchema = z
    .object({
        kind: z.literal('series'),
        title: publicMessengerTextSchema(160),
        labels: z.array(publicMessengerSeriesLabelSchema).max(MAX_PUBLIC_MESSENGER_CHART_POINTS),
        series: z
            .array(
                z
                    .object({
                        label: publicMessengerDataLabelSchema(120).refine((value) => value.trim().length > 0),
                        values: z.array(z.number().finite()).max(MAX_PUBLIC_MESSENGER_CHART_POINTS)
                    })
                    .strict()
            )
            .max(8)
    })
    .strict()
    .superRefine((series, context) => {
        series.series.forEach((item, index) => {
            if (series.labels.length !== item.values.length) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['series', index, 'values'],
                    message: 'Chart labels and values must match.'
                })
            }
        })
    })

const publicMessengerRuntimeData = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.discriminatedUnion('status', [
        z.object({ status: z.literal('empty') }).strict(),
        z.object({ status: z.literal('ready'), data: dataSchema }).strict()
    ])

const publicMessengerPlacementSchemas = [
    z.object({ ...publicMessengerBasePlacementShape, widgetKey: z.literal('header'), config: publicMessengerHeaderConfigSchema }).strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('overviewCards'),
            config: publicMessengerOverviewCardsConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerMetricsDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('detailsTable'),
            config: publicMessengerDetailsTableConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerDetailsTableDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('detailsTitle'),
            config: publicMessengerDetailsTitleConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerTitleDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('menuWidget'),
            config: publicMessengerMenuConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerMenuDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('detailsTabs'),
            config: publicMessengerDetailsTabsConfigSchema
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('resourcePreview'),
            config: publicMessengerResourceConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerResourceDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('relationBuilder'),
            config: publicMessengerRelationConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerRelationDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('columnsContainer'),
            config: publicMessengerColumnsConfigSchema
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('sessionsChart'),
            config: publicMessengerChartConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerSeriesDataSchema)
        })
        .strict(),
    z
        .object({
            ...publicMessengerBasePlacementShape,
            widgetKey: z.literal('pageViewsChart'),
            config: publicMessengerChartConfigSchema,
            runtimeData: publicMessengerRuntimeData(publicMessengerSeriesDataSchema)
        })
        .strict()
] as const

export const publicMessengerPlacementSchema = z.discriminatedUnion('widgetKey', publicMessengerPlacementSchemas)
export type PublicMessengerPlacement = z.infer<typeof publicMessengerPlacementSchema>

export const publicMessengerAppRuntimeSchema = z
    .object({
        locale: z.enum(['en', 'ru']),
        title: publicMessengerTextSchema(160).refine((value) => value.trim().length > 0),
        placements: z.array(publicMessengerPlacementSchema).max(MAX_PUBLIC_MESSENGER_PLACEMENTS)
    })
    .strict()
    .superRefine((runtime, context) => {
        const placementsByKey = new Map<string, PublicMessengerPlacement>()
        runtime.placements.forEach((placement, index) => {
            if (placementsByKey.has(placement.instanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index, 'instanceKey'],
                    message: 'Messenger placement keys must be unique.'
                })
            }
            placementsByKey.set(placement.instanceKey, placement)
            if ((placement.parentInstanceKey === null) !== (placement.slotKey === null)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index],
                    message: 'Messenger parent and slot must be set together.'
                })
            }
        })

        const parentByChild = new Map<string, string>()
        runtime.placements.forEach((placement, index) => {
            if (placement.parentInstanceKey === null) return
            const parent = placementsByKey.get(placement.parentInstanceKey)
            if (!parent) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index, 'parentInstanceKey'],
                    message: 'Messenger placement parent is missing.'
                })
                return
            }
            const slot = placement.slotKey
            const validSlot =
                (parent.widgetKey === 'detailsTabs' && parent.config.tabs.some((tab) => tab.slotKey === slot)) ||
                (parent.widgetKey === 'columnsContainer' && parent.config.columns.some((column) => column.slotKey === slot))
            if (!validSlot) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['placements', index, 'slotKey'],
                    message: 'Messenger parent slot is invalid.'
                })
            }
            parentByChild.set(placement.instanceKey, parent.instanceKey)
        })

        runtime.placements.forEach((placement, index) => {
            const visited = new Set<string>([placement.instanceKey])
            let parentKey = parentByChild.get(placement.instanceKey)
            while (parentKey) {
                if (visited.has(parentKey)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ['placements', index, 'parentInstanceKey'],
                        message: 'Messenger placement graph contains a cycle.'
                    })
                    break
                }
                visited.add(parentKey)
                parentKey = parentByChild.get(parentKey)
            }
        })
    })
export type PublicMessengerAppRuntime = z.infer<typeof publicMessengerAppRuntimeSchema>

export const publicMessengerApplicationRuntimeSchema = z
    .object({
        route: publicApplicationRouteResolutionSchema,
        templateKey: z.literal('messenger-app'),
        messengerApp: publicMessengerAppRuntimeSchema
    })
    .strict()
