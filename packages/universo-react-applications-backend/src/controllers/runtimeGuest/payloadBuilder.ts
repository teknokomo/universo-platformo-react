import type { DbExecutor } from '@universo-react/utils'
import {
    loadPublicRuntimeRecord,
    loadPublicTableRows,
    resolveChildComponents,
    resolveTopLevelComponents
} from '../../shared/publicRuntimeAccess'
import { resolveLocalizedContent, resolveRuntimeCodenameText, UUID_REGEX } from '../../shared/runtimeHelpers'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import type { AccessLinkRecord } from './shared'
import {
    indexByCodename,
    loadEnumerationValueCodeMaps,
    normalizeAccessLinkNumber,
    normalizeQuestionRows,
    readAttrValue,
    resolveEnumerationRefValue
} from './shared'
import type { GuestAccessLinkService } from './accessLinkService'

export const createGuestRuntimePayloadBuilder = (accessLinkService: GuestAccessLinkService) => {
    const { resolveContentNodeBinding, resolveQuizBinding } = accessLinkService
    const buildContentPayload = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        contentNodeId: string,
        locale: string,
        workspaceId: string | null = null,
        options: { lockParentRecord?: boolean } = {}
    ) => {
        const binding = await resolveContentNodeBinding(executor, schemaName, config)
        if (!binding) return null

        const row = await loadPublicRuntimeRecord(executor, schemaName, binding, contentNodeId, workspaceId, {
            lockForUpdate: options.lockParentRecord
        })
        if (!row) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const contentFields = config.fields.contentNode
        const contentItemFields = config.fields.contentPart
        const contentTable = attrByCodename[contentFields.contentItems]
        const contentAttrs = resolveChildComponents(binding, contentTable?.id ?? '')
        const contentAttrByCodename = indexByCodename(contentAttrs)
        const childRows = contentTable
            ? await loadPublicTableRows(executor, schemaName, contentTable, contentAttrs, contentNodeId, workspaceId)
            : []
        const enumValueCodeMaps = await loadEnumerationValueCodeMaps(executor, schemaName, contentAttrs)

        const columns = Object.fromEntries(contentAttrs.map((cmp) => [resolveRuntimeCodenameText(cmp.codename), cmp.column_name]))

        return {
            type: 'content' as const,
            id: contentNodeId,
            title: resolveLocalizedContent(readAttrValue(row, attrByCodename[contentFields.title]?.column_name ?? 'title'), locale, ''),
            description: resolveLocalizedContent(
                readAttrValue(row, attrByCodename[contentFields.description]?.column_name ?? 'description'),
                locale,
                ''
            ),
            contentItems: childRows.map((childRow, index) => ({
                id: String(childRow.id),
                itemType: resolveEnumerationRefValue(
                    contentAttrByCodename[contentItemFields.itemType],
                    childRow[columns[contentItemFields.itemType]],
                    enumValueCodeMaps
                ),
                itemTitle: resolveLocalizedContent(childRow[columns[contentItemFields.itemTitle]], locale, ''),
                itemContent: resolveLocalizedContent(childRow[columns[contentItemFields.itemContent]], locale, ''),
                quizId:
                    typeof childRow[columns[contentItemFields.quizId]] === 'string'
                        ? String(childRow[columns[contentItemFields.quizId]])
                        : '',
                sortOrder:
                    typeof childRow[columns[contentItemFields.sortOrder]] === 'number'
                        ? Number(childRow[columns[contentItemFields.sortOrder]])
                        : index
            }))
        }
    }

    const buildQuizPayload = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        quizId: string,
        includeAnswers: boolean,
        locale: string,
        workspaceId: string | null = null,
        includeQuestions = true,
        options: { lockParentRecord?: boolean } = {}
    ) => {
        const assessmentConfig = config.assessment
        if (!assessmentConfig) return null

        const binding = await resolveQuizBinding(executor, schemaName, config)
        if (!binding) return null

        const row = await loadPublicRuntimeRecord(executor, schemaName, binding, quizId, workspaceId, {
            lockForUpdate: options.lockParentRecord
        })
        if (!row) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const quizFields = assessmentConfig.fields.assessment
        const questionFields = assessmentConfig.fields.assessmentQuestion
        const confirmAnswerBeforeNextValue = readAttrValue(
            row,
            attrByCodename[quizFields.confirmAnswerBeforeNext]?.column_name ?? 'confirm_answer_before_next'
        )
        const confirmAnswerBeforeNext =
            confirmAnswerBeforeNextValue === true ||
            confirmAnswerBeforeNextValue === 1 ||
            (typeof confirmAnswerBeforeNextValue === 'string' && confirmAnswerBeforeNextValue.trim().toLowerCase() === 'true')
        const questionsTable = attrByCodename[quizFields.questions]
        const questionAttrs = questionsTable ? resolveChildComponents(binding, questionsTable.id) : []
        const questionAttrByCodename = indexByCodename(questionAttrs)
        const questionRows = questionsTable
            ? await loadPublicTableRows(executor, schemaName, questionsTable, questionAttrs, quizId, workspaceId)
            : []
        const enumValueCodeMaps = await loadEnumerationValueCodeMaps(executor, schemaName, questionAttrs)
        const columns = Object.fromEntries(questionAttrs.map((cmp) => [resolveRuntimeCodenameText(cmp.codename), cmp.column_name]))
        const questions = normalizeQuestionRows(
            questionRows,
            {
                prompt: columns[questionFields.prompt],
                description: columns[questionFields.description],
                questionType: columns[questionFields.questionType],
                explanation: columns[questionFields.explanation],
                sortOrder: columns[questionFields.sortOrder],
                options: columns[questionFields.options]
            },
            {
                locale,
                questionTypeComponent: questionAttrByCodename[questionFields.questionType],
                enumValueCodeMaps
            }
        ).map((question) => ({
            id: question.id,
            prompt: question.prompt,
            description: question.description,
            sortOrder: question.sortOrder,
            ...(includeAnswers ? { explanation: question.explanation } : {}),
            options: includeAnswers
                ? question.options.map((option) => ({ id: option.id, label: option.label, isCorrect: option.isCorrect }))
                : question.options.map((option) => ({ id: option.id, label: option.label }))
        }))

        return {
            type: 'quiz' as const,
            id: quizId,
            title: resolveLocalizedContent(readAttrValue(row, attrByCodename[quizFields.title]?.column_name ?? 'title'), locale, ''),
            description: resolveLocalizedContent(
                readAttrValue(row, attrByCodename[quizFields.description]?.column_name ?? 'description'),
                locale,
                ''
            ),
            passingScorePercent: normalizeAccessLinkNumber(
                readAttrValue(row, attrByCodename[quizFields.passingScorePercent]?.column_name ?? 'passing_score_percent')
            ),
            maxAttempts: normalizeAccessLinkNumber(
                readAttrValue(row, attrByCodename[quizFields.maxAttempts]?.column_name ?? 'max_attempts')
            ),
            timeLimitSeconds: normalizeAccessLinkNumber(
                readAttrValue(row, attrByCodename[quizFields.timeLimitSeconds]?.column_name ?? 'time_limit_seconds')
            ),
            confirmAnswerBeforeNext,
            completionText: resolveLocalizedContent(
                readAttrValue(row, attrByCodename[quizFields.completionText]?.column_name ?? 'completion_text'),
                locale,
                ''
            ),
            questionCount: questions.length,
            questions: includeQuestions ? questions : []
        }
    }

    const resolveAllowedRuntimeTarget = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        link: AccessLinkRecord,
        requestedTargetType?: 'content' | 'assessment' | 'quiz',
        requestedTargetId?: string,
        options: { lockContentNode?: boolean } = {}
    ): Promise<{ type: 'content' | 'quiz'; id: string } | null> => {
        const baseTargetType = link.targetType === 'quiz' || link.targetType === 'assessment' ? 'quiz' : 'content'
        const normalizedRequestedTargetType = requestedTargetType === 'assessment' ? 'quiz' : requestedTargetType
        const baseTargetId = baseTargetType === 'content' && link.contentNodeIdRef ? link.contentNodeIdRef : link.targetId
        if (!UUID_REGEX.test(baseTargetId)) {
            return null
        }

        if (!normalizedRequestedTargetType || !requestedTargetId) {
            return { type: baseTargetType, id: baseTargetId }
        }
        if (!UUID_REGEX.test(requestedTargetId)) {
            return null
        }
        if (normalizedRequestedTargetType === baseTargetType && requestedTargetId === baseTargetId) {
            return { type: baseTargetType, id: baseTargetId }
        }
        if (baseTargetType !== 'content' || normalizedRequestedTargetType !== 'quiz') {
            return null
        }

        const contentPayload = await buildContentPayload(executor, schemaName, config, baseTargetId, 'en', link.workspaceId, {
            lockParentRecord: options.lockContentNode
        })
        if (!contentPayload) {
            return null
        }

        const linkedQuizIds = new Set(
            contentPayload.contentItems
                .map((item) => (typeof item.quizId === 'string' ? item.quizId : ''))
                .filter((quizId) => UUID_REGEX.test(quizId))
        )

        if (!linkedQuizIds.has(requestedTargetId)) {
            return null
        }

        return { type: 'quiz', id: requestedTargetId }
    }

    return { buildContentPayload, buildQuizPayload, resolveAllowedRuntimeTarget }
}
