import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CodeMirror from '@uiw/react-codemirror'
import type { TabConfig } from '@universo-react/template-mui/components/dialogs'
import { extractAxiosError } from '@universo-react/utils'
import {
    MODULE_CAPABILITIES,
    resolveAllowedModuleCapabilities,
    resolveDefaultModuleCapabilities,
    type MetahubModuleRecord,
    type ModuleAttachmentKind,
    type ModuleCapability,
    type ModuleRole,
    type ModuleSourceKind,
    type ModuleStorageMode
} from '@universo-react/types'
import type { Metahub } from '../../../types'
import { getVLCString } from '../../../types'
import { useMetahubDetails } from '../../metahubs/hooks'
import { metahubsQueryKeys } from '../../shared'
import { modulesApi, type ModuleUpsertPayload } from '../api/modulesApi'
import { buildModuleEditorExtensions, getModuleEditorTheme, getModuleRoleGuidance } from '../utils/moduleEditor'

type TranslationFn = (key: string, fallback?: string) => string

type DraftState = {
    id: string | null
    codename: string
    name: string
    description: string
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    storageMode: ModuleStorageMode
    sourcePath: string
    sdkApiVersion: string
    sourceCode: string
    isActive: boolean
    capabilities: ModuleCapability[]
    writeFileOnCreate: boolean
}

const MODULE_CAPABILITY_LABEL_KEYS: Record<ModuleCapability, string> = {
    'records.read': 'modules.capabilities.recordsRead',
    'records.write': 'modules.capabilities.recordsWrite',
    'metadata.read': 'modules.capabilities.metadataRead',
    'rpc.client': 'modules.capabilities.rpcClient',
    lifecycle: 'modules.capabilities.lifecycle',
    posting: 'modules.capabilities.posting',
    'ledger.read': 'modules.capabilities.ledgerRead',
    'ledger.write': 'modules.capabilities.ledgerWrite'
}

const MODULE_CAPABILITY_FALLBACK_LABELS: Record<ModuleCapability, string> = {
    'records.read': 'Read records',
    'records.write': 'Write records',
    'metadata.read': 'Read metadata',
    'rpc.client': 'Call server methods from client code',
    lifecycle: 'Receive lifecycle events',
    posting: 'Run posting handlers',
    'ledger.read': 'Read ledgers',
    'ledger.write': 'Write ledgers'
}

for (const capability of MODULE_CAPABILITIES) {
    if (!MODULE_CAPABILITY_LABEL_KEYS[capability] || !MODULE_CAPABILITY_FALLBACK_LABELS[capability]) {
        throw new Error(`Missing module capability label key for ${capability}`)
    }
}

const MODULE_ERROR_TRANSLATION_KEYS: Array<{ pattern: RegExp; key: string; fallback: string }> = [
    {
        pattern: /shared library.*imported|dependent modules/i,
        key: 'modules.errors.dependency',
        fallback: 'This shared library is used by other modules.'
    },
    {
        pattern: /codename/i,
        key: 'modules.errors.invalidCodename',
        fallback: 'Use a kebab-case English codename for the module.'
    },
    {
        pattern: /attachment kind|attachment scope|general modules|library modules/i,
        key: 'modules.errors.invalidAttachment',
        fallback: 'Select a valid module attachment and role.'
    },
    {
        pattern: /capabilities.*not allowed|selected module role/i,
        key: 'modules.errors.invalidCapabilities',
        fallback: 'Selected capabilities are not available for this module role.'
    },
    {
        pattern: /embedded module sources/i,
        key: 'modules.errors.invalidSourceKind',
        fallback: 'Only embedded module sources are supported.'
    },
    {
        pattern: /compilation failed|circular @shared imports/i,
        key: 'modules.errors.compilation',
        fallback: 'Module compilation failed. Check the source code and shared imports.'
    },
    {
        pattern: /hidden or parent|parent segments/i,
        key: 'modules.errors.sourcePathHiddenOrParent',
        fallback: 'Source paths cannot contain hidden or parent directory segments.'
    },
    {
        pattern: /must start with modules\//i,
        key: 'modules.errors.sourcePathModulesPrefix',
        fallback: 'Source paths must start with modules/.'
    },
    {
        pattern: /must end with \.ts or \.tsx|unsupported extension/i,
        key: 'modules.errors.sourcePathUnsupportedExtension',
        fallback: 'Use a .ts or .tsx source file.'
    },
    {
        pattern: /relative TypeScript file path|empty segments/i,
        key: 'modules.errors.sourcePathInvalidRelative',
        fallback: 'Use a relative source path under modules/.'
    },
    {
        pattern: /source path|file-backed module source|source file|source root/i,
        key: 'modules.errors.sourcePath',
        fallback: 'Check the source file path and current file state.'
    },
    {
        pattern: /invalid input/i,
        key: 'modules.errors.invalidInput',
        fallback: 'Check the module fields and try again.'
    }
]

const MODULE_ERROR_MESSAGE_CODE_KEYS: Record<string, { key: string; fallback: string }> = {
    'modules.sourcePath.invalidRelative': {
        key: 'modules.errors.sourcePathInvalidRelative',
        fallback: 'Use a relative source path under modules/.'
    },
    'modules.sourcePath.emptySegment': {
        key: 'modules.errors.sourcePathInvalidRelative',
        fallback: 'Use a relative source path under modules/.'
    },
    'modules.sourcePath.modulesPrefixRequired': {
        key: 'modules.errors.sourcePathModulesPrefix',
        fallback: 'Source paths must start with modules/.'
    },
    'modules.sourcePath.hiddenOrParentSegment': {
        key: 'modules.errors.sourcePathHiddenOrParent',
        fallback: 'Source paths cannot contain hidden or parent directory segments.'
    },
    'modules.sourcePath.unsupportedExtension': {
        key: 'modules.errors.sourcePathUnsupportedExtension',
        fallback: 'Use a .ts or .tsx source file.'
    },
    'modules.sourcePath.expectedChecksumRequired': {
        key: 'modules.errors.sourcePathExpectedChecksum',
        fallback: 'Reload the module before overwriting an existing source file.'
    },
    'modules.sourcePath.checksumConflict': {
        key: 'modules.errors.sourcePathChecksumConflict',
        fallback: 'The source file changed outside this editor. Reload and try again.'
    },
    'modules.sourcePath.schemaUnsupported': {
        key: 'modules.errors.sourcePathSchemaUnsupported',
        fallback: 'File-backed module sources require the current metahub schema.'
    },
    'modules.sourcePath.missing': {
        key: 'modules.errors.sourcePathMissing',
        fallback: 'The selected source file does not exist.'
    },
    'modules.sourcePath.unreadable': {
        key: 'modules.errors.sourcePathUnreadable',
        fallback: 'The selected source file cannot be read.'
    },
    'modules.sourcePath.invalidScope': {
        key: 'modules.errors.sourcePath',
        fallback: 'Check the source file path and current file state.'
    },
    'modules.sourcePath.rootEscape': {
        key: 'modules.errors.sourcePath',
        fallback: 'Check the source file path and current file state.'
    }
}

const resolveKnownModuleError = (message: string, t: TranslationFn): string | null => {
    for (const entry of MODULE_ERROR_TRANSLATION_KEYS) {
        if (entry.pattern.test(message)) {
            return t(entry.key, entry.fallback)
        }
    }

    return null
}

const resolveMessageCodeError = (value: unknown, t: TranslationFn): string | null => {
    if (typeof value !== 'string') return null
    const entry = MODULE_ERROR_MESSAGE_CODE_KEYS[value]
    return entry ? t(entry.key, entry.fallback) : null
}

const resolveErrorMessage = (error: unknown, fallback: string, t: TranslationFn): string => {
    const responseData =
        error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: unknown } }).response?.data ?? null
            : null

    if (responseData && typeof responseData === 'object') {
        const details = (responseData as { details?: unknown }).details
        if (details && typeof details === 'object' && !Array.isArray(details)) {
            const messageCodeError = resolveMessageCodeError((details as { messageCode?: unknown }).messageCode, t)
            if (messageCodeError) {
                return messageCodeError
            }
        }

        const directError =
            typeof (responseData as { error?: unknown }).error === 'string' ? (responseData as { error: string }).error.trim() : ''
        if (directError.length > 0) {
            return resolveKnownModuleError(directError, t) ?? fallback
        }

        const directMessage =
            typeof (responseData as { message?: unknown }).message === 'string' ? (responseData as { message: string }).message.trim() : ''
        if (directMessage.length > 0) {
            return resolveKnownModuleError(directMessage, t) ?? fallback
        }

        const detailsMessage =
            typeof (responseData as { details?: { message?: unknown } }).details?.message === 'string'
                ? String((responseData as { details: { message: string } }).details.message).trim()
                : ''
        if (detailsMessage.length > 0) {
            return resolveKnownModuleError(detailsMessage, t) ?? fallback
        }
    }

    const message = extractAxiosError(error).message.trim()
    return message.length > 0 ? resolveKnownModuleError(message, t) ?? fallback : fallback
}

const DEFAULT_LIBRARY_SOURCE = `import { SharedLibraryModule } from '@universo-react/extension-sdk'

export default class ExampleSharedLibrary extends SharedLibraryModule {
    static formatValue(value: string) {
        return value.trim()
    }
}
`

const DEFAULT_SOURCE = `import { ExtensionModule, AtClient, AtServer, OnEvent } from '@universo-react/extension-sdk'

export default class ExampleModule extends ExtensionModule {
  @AtClient()
  async mount() {
    return null
  }

  @AtServer()
  async ping() {
    return { ok: true }
  }

  @OnEvent('afterCreate')
  async afterCreate(payload) {
    return payload
  }
}
`

const DEFAULT_WIDGET_SOURCE = `import { ExtensionModule, AtClient, AtServer } from '@universo-react/extension-sdk'

const normalizeLocale = (locale) => (typeof locale === 'string' && locale.toLowerCase().startsWith('ru') ? 'ru' : 'en')

const sortSelection = (value) => (Array.isArray(value) ? value.map((item) => String(item)).sort() : [])

const isSameSelection = (selected, correct) => {
    if (selected.length !== correct.length) {
        return false
    }

    return selected.every((item, index) => item === correct[index])
}

const buildQuizDefinition = (localeInput) => {
    const locale = normalizeLocale(localeInput)

    const content = {
        en: {
            title: 'Space Quiz',
            description: 'Answer ten astronomy questions one by one. Correct answers move you forward automatically.',
            submitLabel: 'Check answer',
            nextLabel: 'Next question',
            questions: [
                {
                    id: 'q1',
                    prompt: 'Which planet is known as the Red Planet?',
                    description: 'Think about the rusty world explored by many rovers.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Venus' },
                        { id: 'b', label: 'Mars' },
                        { id: 'c', label: 'Mercury' },
                        { id: 'd', label: 'Jupiter' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Mars looks red because iron-rich dust on its surface oxidizes like rust.'
                },
                {
                    id: 'q2',
                    prompt: 'Where is Olympus Mons located?',
                    description: 'It is the tallest volcano known in the Solar System.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Earth' },
                        { id: 'b', label: 'The Moon' },
                        { id: 'c', label: 'Mars' },
                        { id: 'd', label: 'Io' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: 'Olympus Mons is a giant shield volcano on Mars, towering far above Everest.'
                },
                {
                    id: 'q3',
                    prompt: 'The Great Red Spot is a storm on which planet?',
                    description: 'This world is the largest planet in the Solar System.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Saturn' },
                        { id: 'b', label: 'Jupiter' },
                        { id: 'c', label: 'Neptune' },
                        { id: 'd', label: 'Uranus' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: "The Great Red Spot is a long-lived storm system in Jupiter's atmosphere."
                },
                {
                    id: 'q4',
                    prompt: 'Which mission first landed humans on the Moon?',
                    description: 'It carried Neil Armstrong and Buzz Aldrin to the lunar surface.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Apollo 8' },
                        { id: 'b', label: 'Apollo 11' },
                        { id: 'c', label: 'Apollo 13' },
                        { id: 'd', label: 'Gemini 4' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Apollo 11 completed the first crewed lunar landing in July 1969.'
                },
                {
                    id: 'q5',
                    prompt: 'What is at the center of our Solar System?',
                    description: 'Every planet in our system orbits this star.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'The Moon' },
                        { id: 'b', label: 'Polaris' },
                        { id: 'c', label: 'The Sun' },
                        { id: 'd', label: 'Sagittarius A*' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: "The Sun contains almost all of the Solar System's mass and anchors its orbits."
                },
                {
                    id: 'q6',
                    prompt: 'Which planet is most famous for its bright ring system?',
                    description: 'Several gas giants have rings, but one is the classic example.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Jupiter' },
                        { id: 'b', label: 'Saturn' },
                        { id: 'c', label: 'Mars' },
                        { id: 'd', label: 'Mercury' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: "Saturn's icy rings are the most extensive and visually striking in the Solar System."
                },
                {
                    id: 'q7',
                    prompt: 'What protects Earth from much of the solar wind?',
                    description: 'Without it, charged particles would strip away much more of our atmosphere.',
                    difficulty: 2,
                    options: [
                        { id: 'a', label: 'Its magnetic field' },
                        { id: 'b', label: 'The asteroid belt' },
                        { id: 'c', label: 'Ocean tides' },
                        { id: 'd', label: "The Moon's gravity" }
                    ],
                    correctOptionIds: ['a'],
                    explanation: "Earth's magnetosphere deflects many charged particles streaming from the Sun."
                },
                {
                    id: 'q8',
                    prompt: 'Which space observatory primarily studies the universe in infrared light?',
                    description: 'Its segmented mirror was designed to see through cosmic dust.',
                    difficulty: 2,
                    options: [
                        { id: 'a', label: 'Hubble Space Telescope' },
                        { id: 'b', label: 'James Webb Space Telescope' },
                        { id: 'c', label: 'Chandra X-ray Observatory' },
                        { id: 'd', label: 'Kepler Space Telescope' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'The James Webb Space Telescope is optimized for infrared observations.'
                },
                {
                    id: 'q9',
                    prompt: 'Which spacecraft is widely recognized as the first human-made object to enter interstellar space?',
                    description: 'It launched in 1977 and still sends data today.',
                    difficulty: 3,
                    options: [
                        { id: 'a', label: 'Pioneer 10' },
                        { id: 'b', label: 'Voyager 2' },
                        { id: 'c', label: 'Voyager 1' },
                        { id: 'd', label: 'New Horizons' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: 'Voyager 1 crossed into interstellar space in 2012, ahead of Voyager 2.'
                },
                {
                    id: 'q10',
                    prompt: 'Which two planets are classified as ice giants?',
                    description: 'Select two answers.',
                    difficulty: 3,
                    multiple: true,
                    options: [
                        { id: 'a', label: 'Jupiter' },
                        { id: 'b', label: 'Saturn' },
                        { id: 'c', label: 'Uranus' },
                        { id: 'd', label: 'Neptune' }
                    ],
                    correctOptionIds: ['c', 'd'],
                    explanation: 'Uranus and Neptune are called ice giants because their interiors contain more water, ammonia, and methane ices than Jupiter or Saturn.'
                }
            ]
        },
        ru: {
            title: 'Космическая викторина',
            description: 'Ответьте по очереди на десять вопросов по астрономии. После правильного ответа виджет автоматически перейдёт дальше.',
            submitLabel: 'Проверить ответ',
            nextLabel: 'Следующий вопрос',
            questions: [
                {
                    id: 'q1',
                    prompt: 'Какую планету называют Красной планетой?',
                    description: 'Подумайте о ржаво-красном мире, который исследуют марсоходы.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Венера' },
                        { id: 'b', label: 'Марс' },
                        { id: 'c', label: 'Меркурий' },
                        { id: 'd', label: 'Юпитер' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Марс кажется красным из-за богатой железом пыли на поверхности, которая окисляется как ржавчина.'
                },
                {
                    id: 'q2',
                    prompt: 'Где находится Олимп Монс?',
                    description: 'Это самый высокий известный вулкан в Солнечной системе.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'На Земле' },
                        { id: 'b', label: 'На Луне' },
                        { id: 'c', label: 'На Марсе' },
                        { id: 'd', label: 'На Ио' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: 'Олимп Монс — гигантский щитовой вулкан на Марсе, намного выше Эвереста.'
                },
                {
                    id: 'q3',
                    prompt: 'На какой планете находится Большое красное пятно?',
                    description: 'Это крупнейшая планета Солнечной системы.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Сатурн' },
                        { id: 'b', label: 'Юпитер' },
                        { id: 'c', label: 'Нептун' },
                        { id: 'd', label: 'Уран' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Большое красное пятно — это долгоживущий шторм в атмосфере Юпитера.'
                },
                {
                    id: 'q4',
                    prompt: 'Какая миссия первой высадила людей на Луну?',
                    description: 'Именно она доставила Нила Армстронга и Базза Олдрина на лунную поверхность.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Apollo 8' },
                        { id: 'b', label: 'Apollo 11' },
                        { id: 'c', label: 'Apollo 13' },
                        { id: 'd', label: 'Gemini 4' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Apollo 11 совершила первую пилотируемую посадку на Луну в июле 1969 года.'
                },
                {
                    id: 'q5',
                    prompt: 'Что находится в центре нашей Солнечной системы?',
                    description: 'Все планеты обращаются вокруг этой звезды.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Луна' },
                        { id: 'b', label: 'Полярная звезда' },
                        { id: 'c', label: 'Солнце' },
                        { id: 'd', label: 'Стрелец A*' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: 'Солнце содержит почти всю массу Солнечной системы и удерживает планеты на орбитах.'
                },
                {
                    id: 'q6',
                    prompt: 'Какая планета больше всего известна своей яркой системой колец?',
                    description: 'Кольца есть у нескольких газовых гигантов, но именно эта планета стала классическим примером.',
                    difficulty: 1,
                    options: [
                        { id: 'a', label: 'Юпитер' },
                        { id: 'b', label: 'Сатурн' },
                        { id: 'c', label: 'Марс' },
                        { id: 'd', label: 'Меркурий' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Ледяные кольца Сатурна — самые обширные и заметные в Солнечной системе.'
                },
                {
                    id: 'q7',
                    prompt: 'Что защищает Землю от значительной части солнечного ветра?',
                    description: 'Без этого слоя заряжённые частицы гораздо сильнее разрушали бы атмосферу.',
                    difficulty: 2,
                    options: [
                        { id: 'a', label: 'Магнитное поле' },
                        { id: 'b', label: 'Пояс астероидов' },
                        { id: 'c', label: 'Океанские приливы' },
                        { id: 'd', label: 'Гравитация Луны' }
                    ],
                    correctOptionIds: ['a'],
                    explanation: 'Магнитосфера Земли отклоняет значительную часть заряжённых частиц, летящих от Солнца.'
                },
                {
                    id: 'q8',
                    prompt: 'Какая космическая обсерватория в основном изучает Вселенную в инфракрасном диапазоне?',
                    description: 'Её сегментированное зеркало создано для наблюдений сквозь космическую пыль.',
                    difficulty: 2,
                    options: [
                        { id: 'a', label: 'Космический телескоп Хаббл' },
                        { id: 'b', label: 'Космический телескоп Джеймса Уэбба' },
                        { id: 'c', label: 'Рентгеновская обсерватория Чандра' },
                        { id: 'd', label: 'Космический телескоп Кеплер' }
                    ],
                    correctOptionIds: ['b'],
                    explanation: 'Телескоп Джеймса Уэбба оптимизирован именно для инфракрасных наблюдений.'
                },
                {
                    id: 'q9',
                    prompt: 'Какой аппарат обычно считают первым рукотворным объектом, вошедшим в межзвёздное пространство?',
                    description: 'Он был запущен в 1977 году и до сих пор передаёт данные.',
                    difficulty: 3,
                    options: [
                        { id: 'a', label: 'Pioneer 10' },
                        { id: 'b', label: 'Voyager 2' },
                        { id: 'c', label: 'Voyager 1' },
                        { id: 'd', label: 'New Horizons' }
                    ],
                    correctOptionIds: ['c'],
                    explanation: 'Voyager 1 пересёк границу межзвёздного пространства в 2012 году, раньше Voyager 2.'
                },
                {
                    id: 'q10',
                    prompt: 'Какие две планеты относятся к ледяным гигантам?',
                    description: 'Выберите два ответа.',
                    difficulty: 3,
                    multiple: true,
                    options: [
                        { id: 'a', label: 'Юпитер' },
                        { id: 'b', label: 'Сатурн' },
                        { id: 'c', label: 'Уран' },
                        { id: 'd', label: 'Нептун' }
                    ],
                    correctOptionIds: ['c', 'd'],
                    explanation: 'Уран и Нептун называют ледяными гигантами, потому что в их недрах больше воды, аммиака и метановых льдов, чем у Юпитера или Сатурна.'
                }
            ]
        }
    }

    return content[locale] || content.en
}

export default class SpaceQuizWidget extends ExtensionModule {
    @AtClient()
    async mount(locale = 'en') {
        return this.ctx.callServerMethod('getQuiz', [{ locale }])
    }

    @AtServer()
    async getQuiz(payload) {
        const quiz = buildQuizDefinition(payload?.locale)

        return {
            title: quiz.title,
            description: quiz.description,
            submitLabel: quiz.submitLabel,
            nextLabel: quiz.nextLabel,
            questions: quiz.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                description: question.description,
                multiple: Boolean(question.multiple),
                difficulty: question.difficulty,
                options: question.options
            }))
        }
    }

    @AtServer()
    async submit(payload) {
        const quiz = buildQuizDefinition(payload?.locale)
        const questionId = typeof payload?.questionId === 'string' ? payload.questionId : ''
        const question = quiz.questions.find((item) => item.id === questionId)

        if (!question) {
            return {
                questionId,
                correct: false,
                score: 0,
                total: quiz.questions.length,
                completed: false,
                message:
                    normalizeLocale(payload?.locale) === 'ru'
                        ? 'Вопрос не найден. Обновите квиз и попробуйте снова.'
                        : 'Question not found. Refresh the quiz and try again.',
                correctOptionIds: {}
            }
        }

        const responses = payload?.responses && typeof payload.responses === 'object' ? payload.responses : {}
        const selectedAnswerIds = sortSelection(payload?.answerIds)
        const normalizedCorrect = sortSelection(question.correctOptionIds)
        const correct = isSameSelection(selectedAnswerIds, normalizedCorrect)

        let score = 0
        let answeredCount = 0

        for (const candidate of quiz.questions) {
            const submitted = sortSelection(responses[candidate.id])
            if (submitted.length > 0) {
                answeredCount += 1
            }

            if (isSameSelection(submitted, sortSelection(candidate.correctOptionIds))) {
                score += 1
            }
        }

        return {
            questionId,
            correct,
            score,
            total: quiz.questions.length,
            completed: answeredCount >= quiz.questions.length,
            message: correct
                ? normalizeLocale(payload?.locale) === 'ru'
                    ? 'Верно!'
                    : 'Correct!'
                : normalizeLocale(payload?.locale) === 'ru'
                  ? 'Пока неверно.'
                  : 'Not quite yet.',
            explanation: question.explanation,
            correctOptionIds: {
                [question.id]: normalizedCorrect
            }
        }
    }
}
`

const createDraft = (attachedToKind: ModuleAttachmentKind, module?: MetahubModuleRecord | null): DraftState => ({
    id: module?.id ?? null,
    codename: module ? getVLCString(module.codename, module.codename?._primary ?? 'en') : '',
    name: module ? getVLCString(module.presentation.name, module.presentation.name?._primary ?? 'en') : '',
    description: module
        ? getVLCString(
              module.presentation.description,
              module.presentation.description?._primary ?? module.presentation.name?._primary ?? 'en'
          )
        : '',
    moduleRole: module?.moduleRole ?? (attachedToKind === 'general' ? 'library' : 'module'),
    sourceKind: module?.sourceKind ?? 'embedded',
    storageMode: module?.storageMode ?? module?.sourceStorage?.mode ?? 'inline',
    sourcePath: module?.sourcePath ?? module?.sourceStorage?.path ?? '',
    sdkApiVersion: module?.sdkApiVersion ?? '1.0.0',
    sourceCode: resolveDraftSourceCode(attachedToKind, module),
    isActive: module?.isActive ?? true,
    capabilities:
        module?.manifest.capabilities && module.manifest.capabilities.length > 0
            ? module.manifest.capabilities
            : resolveDefaultModuleCapabilities(module?.moduleRole ?? (attachedToKind === 'general' ? 'library' : 'module')),
    writeFileOnCreate: true
})

const resolveModuleDisplayName = (module: MetahubModuleRecord, t: TranslationFn): string => {
    const presentationName = getVLCString(module.presentation.name, module.presentation.name?._primary ?? 'en').trim()
    if (presentationName.length > 0) {
        return presentationName
    }

    const codename = getVLCString(module.codename, module.codename?._primary ?? 'en').trim()
    if (codename.length > 0) {
        return codename
    }

    return t('modules.unnamed', 'Unnamed module')
}

const getAvailableModuleRoles = (attachedToKind: ModuleAttachmentKind): ModuleRole[] =>
    attachedToKind === 'general' ? ['library'] : ['module', 'lifecycle', 'widget']

const resolveDraftSourceCode = (attachedToKind: ModuleAttachmentKind, module?: MetahubModuleRecord | null): string => {
    const isFileBacked = module?.storageMode === 'file' || module?.sourceStorage?.mode === 'file'
    if (isFileBacked) {
        const snapshotContent = module?.sourceStorage && 'content' in module.sourceStorage ? module.sourceStorage.content : null
        if (typeof snapshotContent === 'string') {
            return snapshotContent
        }
        return typeof module?.sourceCode === 'string' ? module.sourceCode : ''
    }

    if (module?.sourceCode) {
        return module.sourceCode
    }

    if (module?.moduleRole === 'widget') {
        return DEFAULT_WIDGET_SOURCE
    }

    if (module?.moduleRole === 'library' || attachedToKind === 'general') {
        return DEFAULT_LIBRARY_SOURCE
    }

    return DEFAULT_SOURCE
}

const formatModuleSourceTimestamp = (value: string | null | undefined): string | null => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
}

const formatModuleSourceChecksum = (value: string | null | undefined, t: TranslationFn): string =>
    value ? `${value.slice(0, 12)}...` : t('modules.sourceMetadata.notAvailable', 'Not available')

const resolveModuleSourceChecksum = (module?: MetahubModuleRecord | null): string | undefined =>
    module?.sourceChecksum ?? module?.sourceStorage?.checksum ?? undefined

const isFileBackedModule = (module?: MetahubModuleRecord | null): boolean =>
    module?.storageMode === 'file' || module?.sourceStorage?.mode === 'file'

const resolveModuleSourceStatusLabel = (value: string | null | undefined, t: TranslationFn): string => {
    const status = value || 'inline'
    const fallbackLabels: Record<string, string> = {
        inline: 'Inline source',
        ready: 'Ready',
        modified: 'Modified on disk',
        missing: 'Missing file',
        unreadable: 'Unreadable file',
        conflict: 'Conflict'
    }
    return t(`modules.sourceMetadata.statuses.${status}`, fallbackLabels[status] ?? status)
}

const resolveModuleCompileStatusLabel = (value: string | null | undefined, t: TranslationFn): string => {
    const status = value || 'never'
    const fallbackLabels: Record<string, string> = {
        never: 'Not compiled yet',
        success: 'Compiled',
        failed: 'Compilation failed'
    }
    return t(`modules.sourceMetadata.compileStatuses.${status}`, fallbackLabels[status] ?? status)
}

export const EntityModulesTab = ({
    metahubId,
    attachedToKind,
    attachedToId,
    t
}: {
    metahubId: string | null | undefined
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
    t: TranslationFn
}) => {
    const muiTheme = useTheme()
    const queryClient = useQueryClient()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
    const [draft, setDraft] = useState<DraftState>(() => createDraft(attachedToKind))
    const [error, setError] = useState<string | null>(null)
    const [layoutWidth, setLayoutWidth] = useState(0)
    const [isModuleListOpen, setIsModuleListOpen] = useState(true)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isCreatingNewModule, setIsCreatingNewModule] = useState(false)

    const hasEditableAttachment =
        Boolean(metahubId) && (attachedToKind === 'metahub' || attachedToKind === 'general' || Boolean(attachedToId))
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const permissionsLoading = Boolean(metahubId) && !resolvedPermissions && metahubDetailsQuery.isLoading
    const canManageModules = resolvedPermissions?.manageMetahub === true
    const availableModuleRoles = useMemo(() => {
        const roles = getAvailableModuleRoles(attachedToKind)
        return roles.includes(draft.moduleRole) ? roles : [...roles, draft.moduleRole]
    }, [attachedToKind, draft.moduleRole])

    const modulesQuery = useQuery({
        queryKey: ['metahub-modules', metahubId, attachedToKind, attachedToId],
        queryFn: () => modulesApi.list(metahubId!, { attachedToKind, attachedToId }),
        enabled: Boolean(metahubId) && hasEditableAttachment && canManageModules
    })

    const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
    const selectedModule = useMemo(() => modules.find((module) => module.id === selectedModuleId) ?? null, [modules, selectedModuleId])
    const allowedCapabilities = useMemo(() => resolveAllowedModuleCapabilities(draft.moduleRole), [draft.moduleRole])
    const roleGuidance = useMemo(() => getModuleRoleGuidance(draft.moduleRole), [draft.moduleRole])
    const sourceCodeLabel = t('modules.fields.sourceCode', 'Source code')
    const editorExtensions = useMemo(() => buildModuleEditorExtensions(sourceCodeLabel), [sourceCodeLabel])
    const editorTheme = useMemo(() => getModuleEditorTheme(muiTheme.palette.mode), [muiTheme.palette.mode])
    const modulesLoadError = modulesQuery.isError
        ? resolveErrorMessage(modulesQuery.error, t('modules.errors.load', 'Failed to load modules'), t)
        : null
    const displayedError = error ?? modulesLoadError
    const isCompactLayout = layoutWidth > 0 ? layoutWidth < 880 : true
    const selectedModuleLabel = selectedModule
        ? resolveModuleDisplayName(selectedModule, t)
        : t('modules.noneSelected', 'No module selected')
    const selectedSourceStorage = selectedModule?.sourceStorage
    const sourceMetadata = selectedModule
        ? {
              status: resolveModuleSourceStatusLabel(selectedModule.sourceStatus ?? selectedSourceStorage?.status, t),
              absolutePath: selectedSourceStorage?.absolutePath ?? null,
              checksum: formatModuleSourceChecksum(selectedModule.sourceChecksum ?? selectedSourceStorage?.checksum, t),
              lastReadAt: formatModuleSourceTimestamp(selectedModule.sourceLastReadAt ?? selectedSourceStorage?.lastReadAt),
              lastCompileAt: formatModuleSourceTimestamp(selectedModule.sourceLastCompileAt ?? selectedSourceStorage?.lastCompileAt),
              lastCompileStatus: resolveModuleCompileStatusLabel(
                  selectedModule.sourceLastCompileStatus ?? selectedSourceStorage?.lastCompileStatus,
                  t
              )
          }
        : null
    const isConvertingInlineDraftToFile = Boolean(
        draft.id && draft.storageMode === 'file' && selectedModule && selectedModule.storageMode === 'inline'
    )
    const canEditSourceInCurrentDraft =
        draft.storageMode === 'inline' ||
        (!draft.id && draft.storageMode === 'file' && draft.writeFileOnCreate) ||
        isConvertingInlineDraftToFile

    useEffect(() => {
        const node = containerRef.current
        if (!node) return undefined

        const updateWidth = (nextWidth?: number) => {
            const measuredWidth = nextWidth ?? node.getBoundingClientRect().width ?? node.clientWidth
            setLayoutWidth(Math.round(measuredWidth))
        }

        updateWidth()

        if (typeof ResizeObserver === 'undefined') {
            const handleResize = () => updateWidth()
            window.addEventListener('resize', handleResize)
            return () => window.removeEventListener('resize', handleResize)
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            updateWidth(entry?.contentRect.width)
        })

        observer.observe(node)

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!selectedModuleId && !isCreatingNewModule && modules.length > 0) {
            setSelectedModuleId(modules[0].id)
            return
        }

        if (selectedModuleId && !selectedModule) {
            setSelectedModuleId(modules[0]?.id ?? null)
        }
    }, [isCreatingNewModule, modules, selectedModuleId, selectedModule])

    useEffect(() => {
        if (selectedModule) {
            setDraft(createDraft(attachedToKind, selectedModule))
            setError(null)
        }
    }, [attachedToKind, selectedModule])

    useEffect(() => {
        if (!isCompactLayout) {
            setIsModuleListOpen(true)
            return
        }

        if (!selectedModuleId || modules.length === 0) {
            setIsModuleListOpen(true)
        }
    }, [isCompactLayout, modules.length, selectedModuleId])

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: ['metahub-modules', metahubId, attachedToKind, attachedToId] })
    }

    const createMutation = useMutation({
        mutationFn: (payload: ModuleUpsertPayload) => modulesApi.create(metahubId!, payload),
        onSuccess: async (module) => {
            await invalidate()
            setIsCreatingNewModule(false)
            setSelectedModuleId(module.id)
            setDraft(createDraft(attachedToKind, module))
            setError(null)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('modules.errors.save', 'Failed to save module'), t))
        }
    })

    const updateMutation = useMutation({
        mutationFn: (payload: Partial<ModuleUpsertPayload>) => modulesApi.update(metahubId!, draft.id!, payload),
        onSuccess: async (module) => {
            await invalidate()
            setIsCreatingNewModule(false)
            setSelectedModuleId(module.id)
            setDraft(createDraft(attachedToKind, module))
            setError(null)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('modules.errors.save', 'Failed to save module'), t))
        }
    })

    const deleteMutation = useMutation({
        mutationFn: () => modulesApi.remove(metahubId!, draft.id!, selectedModule?.version, resolveModuleSourceChecksum(selectedModule)),
        onSuccess: async () => {
            await invalidate()
            setIsCreatingNewModule(true)
            setSelectedModuleId(null)
            setDraft(createDraft(attachedToKind))
            setError(null)
            setIsDeleteConfirmOpen(false)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('modules.errors.delete', 'Failed to delete module'), t))
        }
    })

    const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

    const handleNew = () => {
        setIsCreatingNewModule(true)
        setSelectedModuleId(null)
        setDraft(createDraft(attachedToKind))
        setError(null)
        setIsDeleteConfirmOpen(false)
        if (isCompactLayout) {
            setIsModuleListOpen(false)
        }
    }

    const handleSelectModule = (moduleId: string) => {
        setIsCreatingNewModule(false)
        setSelectedModuleId(moduleId)
        setIsDeleteConfirmOpen(false)
        if (isCompactLayout) {
            setIsModuleListOpen(false)
        }
    }

    const handleModuleRoleChange = (moduleRole: ModuleRole) => {
        setDraft((prev) => {
            const shouldSwapToWidgetTemplate =
                !prev.id && moduleRole === 'widget' && (prev.sourceCode.trim().length === 0 || prev.sourceCode === DEFAULT_SOURCE)
            const shouldSwapToLibraryTemplate =
                !prev.id && moduleRole === 'library' && (prev.sourceCode.trim().length === 0 || prev.sourceCode === DEFAULT_SOURCE)
            const shouldSwapToDefaultTemplate =
                !prev.id &&
                moduleRole === 'module' &&
                (prev.sourceCode === DEFAULT_WIDGET_SOURCE || prev.sourceCode === DEFAULT_LIBRARY_SOURCE)
            const shouldSwapFromLibraryTemplate = !prev.id && moduleRole !== 'library' && prev.sourceCode === DEFAULT_LIBRARY_SOURCE
            const previousDefaultCapabilities = resolveDefaultModuleCapabilities(prev.moduleRole)
            const nextAllowedCapabilities = resolveAllowedModuleCapabilities(moduleRole)
            const preservedCapabilities = prev.capabilities.filter((capability) => nextAllowedCapabilities.includes(capability))
            const isUsingPreviousRoleDefaults =
                prev.capabilities.length === previousDefaultCapabilities.length &&
                previousDefaultCapabilities.every((capability) => prev.capabilities.includes(capability))

            const nextCapabilities = isUsingPreviousRoleDefaults
                ? resolveDefaultModuleCapabilities(moduleRole)
                : preservedCapabilities.length > 0
                ? preservedCapabilities
                : resolveDefaultModuleCapabilities(moduleRole)

            return {
                ...prev,
                moduleRole,
                capabilities: nextCapabilities,
                sourceCode: shouldSwapToWidgetTemplate
                    ? DEFAULT_WIDGET_SOURCE
                    : shouldSwapToLibraryTemplate
                    ? DEFAULT_LIBRARY_SOURCE
                    : shouldSwapToDefaultTemplate
                    ? DEFAULT_SOURCE
                    : shouldSwapFromLibraryTemplate
                    ? DEFAULT_SOURCE
                    : prev.sourceCode
            }
        })
    }

    const handleCapabilityToggle = (capability: ModuleCapability, checked: boolean) => {
        setDraft((prev) => ({
            ...prev,
            capabilities: checked
                ? Array.from(new Set([...prev.capabilities, capability]))
                : prev.capabilities.filter((item) => item !== capability)
        }))
    }

    const getCapabilityLabel = (capability: ModuleCapability): string => {
        return t(MODULE_CAPABILITY_LABEL_KEYS[capability], MODULE_CAPABILITY_FALLBACK_LABELS[capability])
    }

    const handleSave = async () => {
        if (!metahubId || !canManageModules) return
        if (!draft.codename.trim() || !draft.name.trim() || (draft.storageMode === 'inline' && !draft.sourceCode.trim())) {
            setError(t('modules.errors.required', 'Codename, name, and source code are required'))
            return
        }

        const payload: ModuleUpsertPayload = {
            codename: draft.codename.trim(),
            name: draft.name.trim(),
            description: draft.description.trim() || undefined,
            attachedToKind,
            attachedToId,
            moduleRole: draft.moduleRole,
            sourceKind: draft.sourceKind,
            storageMode: draft.storageMode,
            sourcePath: draft.storageMode === 'file' ? draft.sourcePath.trim() || undefined : null,
            sdkApiVersion: draft.sdkApiVersion.trim() || '1.0.0',
            isActive: draft.isActive,
            capabilities: draft.capabilities
        }

        if (
            draft.storageMode === 'inline' ||
            (((!draft.id && draft.writeFileOnCreate) || isConvertingInlineDraftToFile) &&
                draft.storageMode === 'file' &&
                draft.sourceCode.trim().length > 0)
        ) {
            payload.sourceCode = draft.sourceCode
        }

        if (draft.id) {
            let guardModule = selectedModule
            if (isFileBackedModule(selectedModule)) {
                try {
                    const latestModules = await modulesApi.list(metahubId, { attachedToKind, attachedToId })
                    const latestModule = latestModules.find((module) => module.id === draft.id)
                    if (latestModule && selectedModule?.version !== undefined && latestModule.version !== selectedModule.version) {
                        setError(
                            t('modules.errors.versionConflict', 'This module was changed by another user. Reload the module before saving.')
                        )
                        return
                    }
                    guardModule = latestModule ?? selectedModule
                } catch (preflightError) {
                    setError(resolveErrorMessage(preflightError, t('modules.errors.save', 'Failed to save module'), t))
                    return
                }
            }

            if (selectedModule?.version) {
                payload.expectedVersion = selectedModule.version
            }
            const expectedSourceChecksum = resolveModuleSourceChecksum(guardModule)
            if (expectedSourceChecksum) {
                payload.expectedSourceChecksum = expectedSourceChecksum
            }
            await updateMutation.mutateAsync(payload)
            return
        }

        await createMutation.mutateAsync(payload)
    }

    const handleRequestDelete = () => {
        if (!draft.id || isSaving) return
        setError(null)
        setIsDeleteConfirmOpen(true)
    }

    const handleConfirmDelete = () => {
        if (!draft.id || isSaving) return
        deleteMutation.mutate()
    }

    if (!hasEditableAttachment) {
        return (
            <Alert severity='info'>
                {t('modules.saveEntityFirst', 'Save this entity first, then modules can be attached from this tab.')}
            </Alert>
        )
    }

    if (permissionsLoading) {
        return <Alert severity='info'>{t('modules.loadingPermissions', 'Loading module permissions...')}</Alert>
    }

    if (!canManageModules) {
        return (
            <Alert severity='info'>
                {t('modules.noManagePermission', 'You do not have permission to manage modules for this metahub.')}
            </Alert>
        )
    }

    const modulesListContent = (
        <List dense disablePadding sx={{ maxHeight: isCompactLayout ? 260 : 480, overflowY: 'auto' }}>
            {modulesQuery.isLoading ? (
                <Box sx={{ px: 2, py: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('modules.loading', 'Loading attached modules...')}
                    </Typography>
                </Box>
            ) : null}
            {modules.map((module) => {
                const moduleName = resolveModuleDisplayName(module, t)
                const moduleRoleLabel = t(`modules.moduleRoles.${module.moduleRole}`, module.moduleRole)
                return (
                    <ListItemButton key={module.id} selected={module.id === selectedModuleId} onClick={() => handleSelectModule(module.id)}>
                        <ListItemText
                            primary={moduleName}
                            secondary={`${moduleRoleLabel} · ${
                                module.isActive ? t('modules.active', 'Active') : t('modules.inactive', 'Inactive')
                            }`}
                        />
                    </ListItemButton>
                )
            })}
            {!modulesQuery.isLoading && modules.length === 0 ? (
                <Box sx={{ px: 2, py: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('modules.empty', 'No modules are attached to this entity yet.')}
                    </Typography>
                </Box>
            ) : null}
        </List>
    )

    const formContent = (
        <Stack spacing={2} sx={{ minWidth: 0, width: '100%' }}>
            <TextField
                label={t('modules.fields.name', 'Name')}
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
            />
            <TextField
                label={t('modules.fields.codename', 'Codename')}
                value={draft.codename}
                onChange={(event) => setDraft((prev) => ({ ...prev, codename: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
            />
            <TextField
                label={t('modules.fields.description', 'Description')}
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
                multiline
                minRows={2}
            />
            <Stack direction={isCompactLayout ? 'column' : 'row'} spacing={2} sx={{ minWidth: 0 }}>
                <FormControl size='small' fullWidth>
                    <InputLabel id='metahub-module-role-label'>{t('modules.fields.moduleRole', 'Module role')}</InputLabel>
                    <Select
                        labelId='metahub-module-role-label'
                        id='metahub-module-role'
                        label={t('modules.fields.moduleRole', 'Module role')}
                        value={draft.moduleRole}
                        onChange={(event) => handleModuleRoleChange(event.target.value as ModuleRole)}
                        disabled={isSaving || availableModuleRoles.length === 1}
                    >
                        {availableModuleRoles.includes('module') ? (
                            <MenuItem value='module'>{t('modules.moduleRoles.module', 'Module')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('lifecycle') ? (
                            <MenuItem value='lifecycle'>{t('modules.moduleRoles.lifecycle', 'Lifecycle')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('widget') ? (
                            <MenuItem value='widget'>{t('modules.moduleRoles.widget', 'Widget')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('library') ? (
                            <MenuItem value='library'>{t('modules.moduleRoles.library', 'Library')}</MenuItem>
                        ) : null}
                    </Select>
                </FormControl>
                <FormControl size='small' fullWidth>
                    <InputLabel id='metahub-module-source-kind-label'>{t('modules.fields.sourceKind', 'Source kind')}</InputLabel>
                    <Select
                        labelId='metahub-module-source-kind-label'
                        id='metahub-module-source-kind'
                        label={t('modules.fields.sourceKind', 'Source kind')}
                        value={draft.sourceKind}
                        onChange={(event) => setDraft((prev) => ({ ...prev, sourceKind: event.target.value as ModuleSourceKind }))}
                        disabled
                    >
                        <MenuItem value='embedded'>{t('modules.sourceKinds.embedded', 'Embedded')}</MenuItem>
                    </Select>
                </FormControl>
            </Stack>
            <Stack direction={isCompactLayout ? 'column' : 'row'} spacing={2} sx={{ minWidth: 0 }}>
                <FormControl size='small' fullWidth>
                    <InputLabel id='metahub-module-storage-mode-label'>{t('modules.fields.storageMode', 'Storage mode')}</InputLabel>
                    <Select
                        labelId='metahub-module-storage-mode-label'
                        id='metahub-module-storage-mode'
                        label={t('modules.fields.storageMode', 'Storage mode')}
                        value={draft.storageMode}
                        onChange={(event) =>
                            setDraft((prev) => ({
                                ...prev,
                                storageMode: event.target.value as ModuleStorageMode
                            }))
                        }
                        disabled={isSaving}
                    >
                        <MenuItem value='inline'>{t('modules.storageModes.inline', 'Inline')}</MenuItem>
                        <MenuItem value='file'>{t('modules.storageModes.file', 'File-backed')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    label={t('modules.fields.sourcePath', 'Source path')}
                    value={draft.sourcePath}
                    onChange={(event) => setDraft((prev) => ({ ...prev, sourcePath: event.target.value }))}
                    disabled={isSaving || draft.storageMode !== 'file'}
                    fullWidth
                    size='small'
                    placeholder='modules/general/example.ts'
                    helperText={
                        draft.storageMode === 'file'
                            ? t('modules.storageModes.fileHelp', 'Relative path under modules/; .ts and .tsx files are supported.')
                            : t('modules.storageModes.inlineHelp', 'Inline source is stored in the metahub database.')
                    }
                />
            </Stack>
            {!draft.id && draft.storageMode === 'file' ? (
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={draft.writeFileOnCreate}
                            onChange={(event) => setDraft((prev) => ({ ...prev, writeFileOnCreate: event.target.checked }))}
                            disabled={isSaving}
                        />
                    }
                    label={t('modules.storageModes.writeFileOnCreate', 'Create or update the source file from the editor')}
                />
            ) : null}
            {draft.storageMode === 'file' && sourceMetadata ? (
                <Alert severity='info' variant='outlined' data-testid='entity-module-source-metadata'>
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography variant='body2'>
                            {t('modules.sourceMetadata.status', 'Source status')}: {sourceMetadata.status}
                        </Typography>
                        {sourceMetadata.absolutePath ? (
                            <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                                {t('modules.sourceMetadata.absolutePath', 'Source file')}: {sourceMetadata.absolutePath}
                            </Typography>
                        ) : null}
                        <Typography variant='body2'>
                            {t('modules.sourceMetadata.checksum', 'Source checksum')}: {sourceMetadata.checksum}
                        </Typography>
                        <Typography variant='body2'>
                            {t('modules.sourceMetadata.lastReadAt', 'Last read')}:&nbsp;
                            {sourceMetadata.lastReadAt ?? t('modules.sourceMetadata.notAvailable', 'Not available')}
                        </Typography>
                        <Typography variant='body2'>
                            {t('modules.sourceMetadata.lastCompile', 'Last compile')}: {sourceMetadata.lastCompileStatus}
                            {sourceMetadata.lastCompileAt ? `, ${sourceMetadata.lastCompileAt}` : ''}
                        </Typography>
                    </Stack>
                </Alert>
            ) : null}
            <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography variant='subtitle2'>{t('modules.fields.capabilities', 'Capabilities')}</Typography>
                <Typography variant='body2' color='text.secondary'>
                    {t(
                        'modules.capabilities.help',
                        'Only declared capabilities are injected into the runtime. External and visual sources remain reserved for later phases.'
                    )}
                </Typography>
                <FormGroup>
                    {allowedCapabilities.map((capability) => (
                        <FormControlLabel
                            key={capability}
                            control={
                                <Checkbox
                                    checked={draft.capabilities.includes(capability)}
                                    onChange={(event) => handleCapabilityToggle(capability, event.target.checked)}
                                    disabled={isSaving}
                                />
                            }
                            label={getCapabilityLabel(capability)}
                        />
                    ))}
                </FormGroup>
            </Stack>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography variant='subtitle2'>{t('modules.guidance.title', 'Authoring guidance')}</Typography>
                <Alert severity='info' variant='outlined'>
                    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                        <Typography variant='body2'>
                            {t(`modules.guidance.roleSummaries.${draft.moduleRole}`, roleGuidance.summary)}
                        </Typography>
                        <Typography variant='body2'>
                            {t('modules.guidance.effectiveCapabilities', 'Effective capabilities for this role')}:&nbsp;
                            {roleGuidance.allowedCapabilities.map((capability) => getCapabilityLabel(capability)).join(', ')}
                        </Typography>
                        <Typography variant='body2'>
                            {t('modules.guidance.recommendedEntryPoints', 'Recommended entry points')}:&nbsp;
                            {roleGuidance.entryPoints.join(', ')}
                        </Typography>
                        <Typography variant='body2'>
                            {draft.moduleRole === 'library'
                                ? t(
                                      'modules.guidance.editorHelpLibrary',
                                      'Start typing SharedLibraryModule or @shared/example-helpers to use shared-library completions.'
                                  )
                                : t(
                                      'modules.guidance.editorHelp',
                                      'Start typing ExtensionModule, @AtClient, @AtServer, @AtServerAndClient, or @OnEvent to use SDK completions.'
                                  )}
                        </Typography>
                    </Stack>
                </Alert>
            </Stack>
            <TextField
                label={t('modules.fields.sdkApiVersion', 'SDK API version')}
                value={draft.sdkApiVersion}
                onChange={(event) => setDraft((prev) => ({ ...prev, sdkApiVersion: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={draft.isActive}
                        onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                        disabled={isSaving}
                    />
                }
                label={t('modules.fields.isActive', 'Module is active')}
            />
            <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography id='entity-module-source-code-label' variant='subtitle2'>
                    {sourceCodeLabel}
                </Typography>
                {draft.storageMode === 'file' ? (
                    <Alert severity='info' variant='outlined'>
                        {canEditSourceInCurrentDraft
                            ? t(
                                  'modules.storageModes.fileEditorWritable',
                                  'This source will be written to the selected file path when the module is saved.'
                              )
                            : t(
                                  'modules.storageModes.fileEditorReadOnly',
                                  'File-backed source is shown as a live preview. Edit the external file at the selected source path, then save module metadata to recompile it.'
                              )}
                    </Alert>
                ) : null}
                <Box
                    data-testid='entity-modules-editor-shell'
                    sx={{
                        minWidth: 0,
                        maxWidth: '100%',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                        '& .cm-editor': {
                            maxWidth: '100%'
                        },
                        '& .cm-scroller': {
                            overflowX: 'auto',
                            overflowY: 'auto'
                        },
                        '& .cm-content': {
                            minWidth: 'fit-content'
                        }
                    }}
                >
                    <CodeMirror
                        value={draft.sourceCode}
                        height='320px'
                        theme={editorTheme}
                        extensions={editorExtensions}
                        onChange={(value) => {
                            if (canEditSourceInCurrentDraft) {
                                setDraft((prev) => ({ ...prev, sourceCode: value }))
                            }
                        }}
                        editable={!isSaving && canEditSourceInCurrentDraft}
                        basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
                    />
                </Box>
            </Stack>
            <Stack
                direction={isCompactLayout ? 'column-reverse' : 'row'}
                spacing={1}
                justifyContent='space-between'
                alignItems={isCompactLayout ? 'stretch' : 'center'}
            >
                <Button color='error' onClick={handleRequestDelete} disabled={!draft.id || isSaving}>
                    {t('modules.delete', 'Delete')}
                </Button>
                <Button variant='contained' onClick={() => void handleSave()} disabled={isSaving}>
                    {draft.id ? t('modules.save', 'Save module') : t('modules.create', 'Create module')}
                </Button>
            </Stack>
        </Stack>
    )

    return (
        <>
            <Stack spacing={2} sx={{ mt: 1, minWidth: 0 }} data-testid='entity-modules-root'>
                {displayedError ? <Alert severity='error'>{displayedError}</Alert> : null}
                <Box
                    ref={containerRef}
                    sx={{ minWidth: 0 }}
                    data-testid='entity-modules-layout'
                    data-layout-mode={isCompactLayout ? 'compact' : 'split'}
                >
                    {isCompactLayout ? (
                        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                            <Stack
                                direction='row'
                                justifyContent='space-between'
                                alignItems='flex-start'
                                spacing={1.5}
                                sx={{ minWidth: 0 }}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant='subtitle2'>{t('modules.listTitle', 'Attached modules')}</Typography>
                                    <Typography variant='body2' color='text.secondary' noWrap>
                                        {`${t('modules.currentSelection', 'Selected')}: ${selectedModuleLabel}`}
                                    </Typography>
                                </Box>
                                <Stack direction='row' spacing={1} sx={{ flexShrink: 0 }}>
                                    <Button
                                        size='small'
                                        variant='outlined'
                                        onClick={() => setIsModuleListOpen((prev) => !prev)}
                                        data-testid='entity-modules-list-toggle'
                                    >
                                        {isModuleListOpen
                                            ? t('modules.listToggle.hide', 'Hide modules')
                                            : t('modules.listToggle.show', 'Show modules')}
                                    </Button>
                                    <Button size='small' onClick={handleNew} disabled={isSaving}>
                                        {t('modules.new', 'New')}
                                    </Button>
                                </Stack>
                            </Stack>

                            <Collapse in={isModuleListOpen}>
                                <Box
                                    data-testid='entity-modules-sidebar'
                                    sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                                >
                                    <Divider />
                                    {modulesListContent}
                                </Box>
                            </Collapse>

                            {formContent}
                        </Stack>
                    ) : (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)',
                                gap: 2,
                                alignItems: 'start',
                                minWidth: 0
                            }}
                        >
                            <Box
                                data-testid='entity-modules-sidebar'
                                sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                            >
                                <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ px: 1.5, py: 1 }}>
                                    <Typography variant='subtitle2'>{t('modules.listTitle', 'Attached modules')}</Typography>
                                    <Button size='small' onClick={handleNew} disabled={isSaving}>
                                        {t('modules.new', 'New')}
                                    </Button>
                                </Stack>
                                <Divider />
                                {modulesListContent}
                            </Box>

                            {formContent}
                        </Box>
                    )}
                </Box>
            </Stack>
            <Dialog
                open={isDeleteConfirmOpen}
                onClose={() => {
                    if (!isSaving) {
                        setIsDeleteConfirmOpen(false)
                    }
                }}
                aria-labelledby='entity-module-delete-dialog-title'
                aria-describedby='entity-module-delete-dialog-description'
                maxWidth='sm'
                fullWidth
            >
                <DialogTitle id='entity-module-delete-dialog-title'>{t('modules.deleteDialog.title', 'Delete module?')}</DialogTitle>
                <DialogContent>
                    <DialogContentText id='entity-module-delete-dialog-description'>
                        {draft.storageMode === 'file'
                            ? t(
                                  'modules.deleteDialog.fileBackedDescription',
                                  'This will delete the module and remove its file-backed source if no other active module owns that file.'
                              )
                            : t('modules.deleteDialog.inlineDescription', 'This will delete the module from the metahub.')}
                    </DialogContentText>
                    {draft.storageMode === 'file' && draft.sourcePath ? (
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                            {t('modules.fields.sourcePath', 'Source path')}: {draft.sourcePath}
                        </Typography>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDeleteConfirmOpen(false)} disabled={isSaving}>
                        {t('modules.deleteDialog.cancel', 'Cancel')}
                    </Button>
                    <Button color='error' variant='contained' onClick={handleConfirmDelete} disabled={isSaving}>
                        {t('modules.deleteDialog.confirm', 'Delete module')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export const createModulesTab = (params: {
    t: TranslationFn
    metahubId: string | null | undefined
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
}): TabConfig => ({
    id: 'modules',
    label: params.t('tabs.modules', 'Modules'),
    content: (
        <EntityModulesTab
            metahubId={params.metahubId}
            attachedToKind={params.attachedToKind}
            attachedToId={params.attachedToId}
            t={params.t}
        />
    )
})
