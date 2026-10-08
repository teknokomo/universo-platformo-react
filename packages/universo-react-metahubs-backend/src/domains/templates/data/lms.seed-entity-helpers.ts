import type { MetahubTemplateManifest, WorkflowAction } from '@universo-react/types'
import { enrichConfigWithVlcTimestamps, vlc } from './basic.template'

export type LmsTemplateEntity = NonNullable<MetahubTemplateManifest['seed']['entities']>[number]

const buildEditorText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

export const buildEditorHeaderBlock = (id: string, level: number, en: string, ru: string) => ({
    id,
    type: 'header',
    data: {
        level,
        text: buildEditorText(en, ru)
    }
})

export const buildEditorParagraphBlock = (id: string, en: string, ru: string) => ({
    id,
    type: 'paragraph',
    data: {
        text: buildEditorText(en, ru)
    }
})

const buildEditorBlockContent = (blocks: Array<Record<string, unknown>>) => ({
    format: 'editorjs',
    version: '2.29.0',
    blocks
})

export const buildLmsPageEntity = ({
    codename,
    nameEn,
    nameRu,
    descriptionEn,
    descriptionRu,
    routeSegment,
    icon,
    blocks
}: {
    codename: string
    nameEn: string
    nameRu: string
    descriptionEn: string
    descriptionRu: string
    routeSegment: string
    icon: string
    blocks: Array<Record<string, unknown>>
}): LmsTemplateEntity => ({
    codename,
    kind: 'page',
    name: vlc(nameEn, nameRu),
    description: vlc(descriptionEn, descriptionRu),
    hubs: ['Learning'],
    config: enrichConfigWithVlcTimestamps({
        blockContent: buildEditorBlockContent(blocks),
        runtime: {
            menuVisibility: 'secondary',
            routeSegment,
            icon
        }
    })
})

const buildLmsBalanceLedger = ({
    codename,
    nameEn,
    nameRu,
    descriptionEn,
    descriptionRu,
    subjectEn,
    subjectRu,
    resourceCodename,
    resourceEn,
    resourceRu,
    aggregate
}: {
    codename: string
    nameEn: string
    nameRu: string
    descriptionEn: string
    descriptionRu: string
    subjectEn: string
    subjectRu: string
    resourceCodename: string
    resourceEn: string
    resourceRu: string
    aggregate: 'sum' | 'latest'
}): LmsTemplateEntity => ({
    codename,
    kind: 'object',
    name: vlc(nameEn, nameRu),
    description: vlc(descriptionEn, descriptionRu),
    hubs: ['Learning'],
    config: {
        ledger: {
            mode: 'balance',
            mutationPolicy: 'appendOnly',
            periodicity: 'instant',
            sourcePolicy: 'registrar',
            registrarKinds: ['object'],
            fieldRoles: [
                { fieldCodename: 'Learner', role: 'dimension', required: true },
                { fieldCodename: 'Subject', role: 'dimension', required: true },
                { fieldCodename: resourceCodename, role: 'resource', aggregate, required: true },
                { fieldCodename: 'Status', role: 'component' },
                { fieldCodename: 'OccurredAt', role: 'component' },
                { fieldCodename: 'SourceObjectId', role: 'component' },
                { fieldCodename: 'SourceRowId', role: 'component' },
                { fieldCodename: 'SourceLineId', role: 'component' }
            ],
            projections: [
                {
                    codename: `${codename}ByLearner`,
                    kind: aggregate === 'latest' ? 'latest' : 'balance',
                    dimensions: ['Learner', 'Subject'],
                    resources: [resourceCodename],
                    period: 'none'
                }
            ],
            idempotency: {
                keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
            }
        }
    },
    components: [
        { codename: 'Learner', dataType: 'STRING', name: vlc('Learner', 'Учащийся'), sortOrder: 1, isRequired: true },
        { codename: 'Subject', dataType: 'STRING', name: vlc(subjectEn, subjectRu), sortOrder: 2, isRequired: true },
        { codename: resourceCodename, dataType: 'NUMBER', name: vlc(resourceEn, resourceRu), sortOrder: 3, isRequired: true },
        { codename: 'Status', dataType: 'STRING', name: vlc('Status', 'Статус'), sortOrder: 4 },
        {
            codename: 'OccurredAt',
            dataType: 'DATE',
            name: vlc('Occurred At', 'Дата события'),
            sortOrder: 5,
            validationRules: { dateComposition: 'datetime' }
        },
        { codename: 'SourceObjectId', dataType: 'STRING', name: vlc('Source Object ID', 'ID объекта-источника'), sortOrder: 6 },
        { codename: 'SourceRowId', dataType: 'STRING', name: vlc('Source Row ID', 'ID строки-источника'), sortOrder: 7 },
        { codename: 'SourceLineId', dataType: 'STRING', name: vlc('Source Line ID', 'ID строки движения'), sortOrder: 8 }
    ]
})

export const LMS_ADDITIONAL_LEDGER_ENTITIES: LmsTemplateEntity[] = [
    buildLmsBalanceLedger({
        codename: 'LearningActivityLedger',
        nameEn: 'Learning Activity Ledger',
        nameRu: 'Регистр учебной активности',
        descriptionEn: 'Append-only activity facts for runtime learning events.',
        descriptionRu: 'Неизменяемые факты активности для событий обучения в runtime.',
        subjectEn: 'Activity Subject',
        subjectRu: 'Предмет активности',
        resourceCodename: 'ActivityCount',
        resourceEn: 'Activity Count',
        resourceRu: 'Количество активностей',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'EnrollmentLedger',
        nameEn: 'Enrollment Ledger',
        nameRu: 'Регистр записей на обучение',
        descriptionEn: 'Append-only enrollment facts by learner and learning item.',
        descriptionRu: 'Неизменяемые факты записей на обучение по учащемуся и учебному элементу.',
        subjectEn: 'Enrollment Subject',
        subjectRu: 'Предмет записи',
        resourceCodename: 'EnrollmentDelta',
        resourceEn: 'Enrollment Delta',
        resourceRu: 'Изменение записи',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'AttendanceLedger',
        nameEn: 'Attendance Ledger',
        nameRu: 'Регистр посещаемости',
        descriptionEn: 'Append-only attendance facts for instructor-led and blended training.',
        descriptionRu: 'Неизменяемые факты посещаемости для очного и смешанного обучения.',
        subjectEn: 'Training Event',
        subjectRu: 'Учебное мероприятие',
        resourceCodename: 'AttendanceDelta',
        resourceEn: 'Attendance Delta',
        resourceRu: 'Изменение посещаемости',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'CertificateLedger',
        nameEn: 'Certificate Ledger',
        nameRu: 'Регистр сертификатов',
        descriptionEn: 'Append-only certificate issue and revocation facts.',
        descriptionRu: 'Неизменяемые факты выдачи и отзыва сертификатов.',
        subjectEn: 'Certificate',
        subjectRu: 'Сертификат',
        resourceCodename: 'CertificateDelta',
        resourceEn: 'Certificate Delta',
        resourceRu: 'Изменение сертификата',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'PointsLedger',
        nameEn: 'Points Ledger',
        nameRu: 'Регистр баллов',
        descriptionEn: 'Append-only gamification and learning points facts.',
        descriptionRu: 'Неизменяемые факты баллов обучения и геймификации.',
        subjectEn: 'Points Source',
        subjectRu: 'Источник баллов',
        resourceCodename: 'PointsDelta',
        resourceEn: 'Points Delta',
        resourceRu: 'Изменение баллов',
        aggregate: 'sum'
    }),
    buildLmsBalanceLedger({
        codename: 'NotificationLedger',
        nameEn: 'Notification Ledger',
        nameRu: 'Регистр уведомлений',
        descriptionEn: 'Append-only notification delivery facts for learning workflows.',
        descriptionRu: 'Неизменяемые факты доставки уведомлений для учебных процессов.',
        subjectEn: 'Notification',
        subjectRu: 'Уведомление',
        resourceCodename: 'NotificationCount',
        resourceEn: 'Notification Count',
        resourceRu: 'Количество уведомлений',
        aggregate: 'sum'
    })
]

export const buildTransactionalObjectConfig = ({
    prefix,
    effectiveDateField,
    stateField,
    states = [],
    targetLedgers = [],
    workflowActions = []
}: {
    prefix: string
    effectiveDateField: string
    stateField?: string
    states?: Array<{ codename: string; title: string; isInitial?: boolean; isFinal?: boolean }>
    targetLedgers?: string[]
    workflowActions?: WorkflowAction[]
}) => ({
    recordBehavior: {
        mode: 'transactional',
        numbering: {
            enabled: true,
            scope: 'workspace',
            periodicity: 'year',
            prefix,
            minLength: 6
        },
        effectiveDate: {
            enabled: true,
            fieldCodename: effectiveDateField,
            defaultToNow: true
        },
        lifecycle: {
            enabled: Boolean(stateField && states.length > 0),
            ...(stateField ? { stateFieldCodename: stateField } : {}),
            states
        },
        posting: {
            mode: 'manual',
            targetLedgers
        },
        immutability: 'posted'
    },
    ...(workflowActions.length > 0 ? { workflowActions } : {})
})
