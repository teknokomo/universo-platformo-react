import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Collapse,
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
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { extractAxiosError } from '@universo/utils'
import {
    resolveAllowedScriptCapabilities,
    resolveDefaultScriptCapabilities,
    type MetahubScriptRecord,
    type ScriptAttachmentKind,
    type ScriptCapability,
    type ScriptModuleRole,
    type ScriptSourceKind
} from '@universo/types'
import type { Metahub } from '../../../types'
import { getVLCString } from '../../../types'
import { useMetahubDetails } from '../../metahubs/hooks'
import { metahubsQueryKeys } from '../../shared'
import { scriptsApi, type ScriptUpsertPayload } from '../api/scriptsApi'
import { buildScriptEditorExtensions, getScriptEditorTheme, getScriptRoleGuidance } from '../utils/scriptEditor'

type TranslationFn = (key: string, fallback?: string) => string

type DraftState = {
    id: string | null
    codename: string
    name: string
    description: string
    moduleRole: ScriptModuleRole
    sourceKind: ScriptSourceKind
    sdkApiVersion: string
    sourceCode: string
    isActive: boolean
    capabilities: ScriptCapability[]
}

const resolveErrorMessage = (error: unknown, fallback: string): string => {
    const responseData =
        error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: unknown } }).response?.data ?? null
            : null

    if (responseData && typeof responseData === 'object') {
        const directError =
            typeof (responseData as { error?: unknown }).error === 'string' ? (responseData as { error: string }).error.trim() : ''
        if (directError.length > 0) {
            return directError
        }

        const directMessage =
            typeof (responseData as { message?: unknown }).message === 'string' ? (responseData as { message: string }).message.trim() : ''
        if (directMessage.length > 0) {
            return directMessage
        }

        const detailsMessage =
            typeof (responseData as { details?: { message?: unknown } }).details?.message === 'string'
                ? String((responseData as { details: { message: string } }).details.message).trim()
                : ''
        if (detailsMessage.length > 0) {
            return detailsMessage
        }
    }

    const message = extractAxiosError(error).message.trim()
    return message.length > 0 ? message : fallback
}

const DEFAULT_LIBRARY_SOURCE = `import { SharedLibraryScript } from '@universo/extension-sdk'

export default class ExampleSharedLibrary extends SharedLibraryScript {
    static formatValue(value: string) {
        return value.trim()
    }
}
`

const DEFAULT_SOURCE = `import { ExtensionScript, AtClient, AtServer, OnEvent } from '@universo/extension-sdk'

export default class ExampleScript extends ExtensionScript {
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

const DEFAULT_WIDGET_SOURCE = `import { ExtensionScript, AtClient, AtServer } from '@universo/extension-sdk'

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

export default class SpaceQuizWidget extends ExtensionScript {
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

const createDraft = (attachedToKind: ScriptAttachmentKind, script?: MetahubScriptRecord | null): DraftState => ({
    id: script?.id ?? null,
    codename: script ? getVLCString(script.codename, script.codename?._primary ?? 'en') : '',
    name: script ? getVLCString(script.presentation.name, script.presentation.name?._primary ?? 'en') : '',
    description: script
        ? getVLCString(
              script.presentation.description,
              script.presentation.description?._primary ?? script.presentation.name?._primary ?? 'en'
          )
        : '',
    moduleRole: script?.moduleRole ?? (attachedToKind === 'general' ? 'library' : 'module'),
    sourceKind: script?.sourceKind ?? 'embedded',
    sdkApiVersion: script?.sdkApiVersion ?? '1.0.0',
    sourceCode:
        script?.sourceCode ??
        (script?.moduleRole === 'widget'
            ? DEFAULT_WIDGET_SOURCE
            : script?.moduleRole === 'library' || attachedToKind === 'general'
            ? DEFAULT_LIBRARY_SOURCE
            : DEFAULT_SOURCE),
    isActive: script?.isActive ?? true,
    capabilities:
        script?.manifest.capabilities && script.manifest.capabilities.length > 0
            ? script.manifest.capabilities
            : resolveDefaultScriptCapabilities(script?.moduleRole ?? (attachedToKind === 'general' ? 'library' : 'module'))
})

const getAvailableModuleRoles = (attachedToKind: ScriptAttachmentKind): ScriptModuleRole[] =>
    attachedToKind === 'general' ? ['library'] : ['module', 'lifecycle', 'widget']

export const EntityScriptsTab = ({
    metahubId,
    attachedToKind,
    attachedToId,
    t
}: {
    metahubId: string | null | undefined
    attachedToKind: ScriptAttachmentKind
    attachedToId: string | null
    t: TranslationFn
}) => {
    const muiTheme = useTheme()
    const queryClient = useQueryClient()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
    const [draft, setDraft] = useState<DraftState>(() => createDraft(attachedToKind))
    const [error, setError] = useState<string | null>(null)
    const [layoutWidth, setLayoutWidth] = useState(0)
    const [isScriptListOpen, setIsScriptListOpen] = useState(true)

    const hasEditableAttachment =
        Boolean(metahubId) && (attachedToKind === 'metahub' || attachedToKind === 'general' || Boolean(attachedToId))
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const permissionsLoading = Boolean(metahubId) && !resolvedPermissions && metahubDetailsQuery.isLoading
    const canManageScripts = resolvedPermissions?.manageMetahub === true
    const availableModuleRoles = useMemo(() => {
        const roles = getAvailableModuleRoles(attachedToKind)
        return roles.includes(draft.moduleRole) ? roles : [...roles, draft.moduleRole]
    }, [attachedToKind, draft.moduleRole])

    const scriptsQuery = useQuery({
        queryKey: ['metahub-scripts', metahubId, attachedToKind, attachedToId],
        queryFn: () => scriptsApi.list(metahubId!, { attachedToKind, attachedToId }),
        enabled: Boolean(metahubId) && hasEditableAttachment && canManageScripts
    })

    const scripts = useMemo(() => scriptsQuery.data ?? [], [scriptsQuery.data])
    const selectedScript = useMemo(() => scripts.find((script) => script.id === selectedScriptId) ?? null, [scripts, selectedScriptId])
    const allowedCapabilities = useMemo(() => resolveAllowedScriptCapabilities(draft.moduleRole), [draft.moduleRole])
    const roleGuidance = useMemo(() => getScriptRoleGuidance(draft.moduleRole), [draft.moduleRole])
    const editorExtensions = useMemo(() => buildScriptEditorExtensions(), [])
    const editorTheme = useMemo(() => getScriptEditorTheme(muiTheme.palette.mode), [muiTheme.palette.mode])
    const scriptsLoadError = scriptsQuery.isError
        ? resolveErrorMessage(scriptsQuery.error, t('scripts.errors.load', 'Failed to load scripts'))
        : null
    const displayedError = error ?? scriptsLoadError
    const isCompactLayout = layoutWidth > 0 ? layoutWidth < 880 : true
    const selectedScriptLabel = selectedScript
        ? getVLCString(selectedScript.presentation.name, selectedScript.presentation.name?._primary ?? 'en') || selectedScript.id
        : t('scripts.noneSelected', 'No script selected')

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
        if (!selectedScriptId && scripts.length > 0) {
            setSelectedScriptId(scripts[0].id)
            return
        }

        if (selectedScriptId && !selectedScript) {
            setSelectedScriptId(scripts[0]?.id ?? null)
        }
    }, [scripts, selectedScriptId, selectedScript])

    useEffect(() => {
        if (selectedScript) {
            setDraft(createDraft(attachedToKind, selectedScript))
            setError(null)
        }
    }, [attachedToKind, selectedScript])

    useEffect(() => {
        if (!isCompactLayout) {
            setIsScriptListOpen(true)
            return
        }

        if (!selectedScriptId || scripts.length === 0) {
            setIsScriptListOpen(true)
        }
    }, [isCompactLayout, scripts.length, selectedScriptId])

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: ['metahub-scripts', metahubId, attachedToKind, attachedToId] })
    }

    const createMutation = useMutation({
        mutationFn: (payload: ScriptUpsertPayload) => scriptsApi.create(metahubId!, payload),
        onSuccess: async (script) => {
            await invalidate()
            setSelectedScriptId(script.id)
            setDraft(createDraft(attachedToKind, script))
            setError(null)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('scripts.errors.save', 'Failed to save script')))
        }
    })

    const updateMutation = useMutation({
        mutationFn: (payload: Partial<ScriptUpsertPayload>) => scriptsApi.update(metahubId!, draft.id!, payload),
        onSuccess: async (script) => {
            await invalidate()
            setSelectedScriptId(script.id)
            setDraft(createDraft(attachedToKind, script))
            setError(null)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('scripts.errors.save', 'Failed to save script')))
        }
    })

    const deleteMutation = useMutation({
        mutationFn: () => scriptsApi.remove(metahubId!, draft.id!),
        onSuccess: async () => {
            await invalidate()
            setSelectedScriptId(null)
            setDraft(createDraft(attachedToKind))
            setError(null)
        },
        onError: (mutationError: unknown) => {
            setError(resolveErrorMessage(mutationError, t('scripts.errors.delete', 'Failed to delete script')))
        }
    })

    const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

    const handleNew = () => {
        setSelectedScriptId(null)
        setDraft(createDraft(attachedToKind))
        setError(null)
        if (isCompactLayout) {
            setIsScriptListOpen(false)
        }
    }

    const handleSelectScript = (scriptId: string) => {
        setSelectedScriptId(scriptId)
        if (isCompactLayout) {
            setIsScriptListOpen(false)
        }
    }

    const handleModuleRoleChange = (moduleRole: ScriptModuleRole) => {
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
            const previousDefaultCapabilities = resolveDefaultScriptCapabilities(prev.moduleRole)
            const nextAllowedCapabilities = resolveAllowedScriptCapabilities(moduleRole)
            const preservedCapabilities = prev.capabilities.filter((capability) => nextAllowedCapabilities.includes(capability))
            const isUsingPreviousRoleDefaults =
                prev.capabilities.length === previousDefaultCapabilities.length &&
                previousDefaultCapabilities.every((capability) => prev.capabilities.includes(capability))

            const nextCapabilities = isUsingPreviousRoleDefaults
                ? resolveDefaultScriptCapabilities(moduleRole)
                : preservedCapabilities.length > 0
                ? preservedCapabilities
                : resolveDefaultScriptCapabilities(moduleRole)

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

    const handleCapabilityToggle = (capability: ScriptCapability, checked: boolean) => {
        setDraft((prev) => ({
            ...prev,
            capabilities: checked
                ? Array.from(new Set([...prev.capabilities, capability]))
                : prev.capabilities.filter((item) => item !== capability)
        }))
    }

    const getCapabilityLabel = (capability: ScriptCapability): string => {
        switch (capability) {
            case 'records.read':
                return t('scripts.capabilities.recordsRead', 'Read records')
            case 'records.write':
                return t('scripts.capabilities.recordsWrite', 'Write records')
            case 'metadata.read':
                return t('scripts.capabilities.metadataRead', 'Read metadata')
            case 'rpc.client':
                return t('scripts.capabilities.rpcClient', 'Call server methods from client code')
            case 'lifecycle':
                return t('scripts.capabilities.lifecycle', 'Receive lifecycle events')
            default:
                return capability
        }
    }

    const handleSave = async () => {
        if (!metahubId || !canManageScripts) return
        if (!draft.codename.trim() || !draft.name.trim() || !draft.sourceCode.trim()) {
            setError(t('scripts.errors.required', 'Codename, name, and source code are required'))
            return
        }

        const payload: ScriptUpsertPayload = {
            codename: draft.codename.trim(),
            name: draft.name.trim(),
            description: draft.description.trim() || undefined,
            attachedToKind,
            attachedToId,
            moduleRole: draft.moduleRole,
            sourceKind: draft.sourceKind,
            sdkApiVersion: draft.sdkApiVersion.trim() || '1.0.0',
            sourceCode: draft.sourceCode,
            isActive: draft.isActive,
            capabilities: draft.capabilities
        }

        if (draft.id) {
            await updateMutation.mutateAsync(payload)
            return
        }

        await createMutation.mutateAsync(payload)
    }

    if (!hasEditableAttachment) {
        return (
            <Alert severity='info'>
                {t('scripts.saveEntityFirst', 'Save this entity first, then scripts can be attached from this tab.')}
            </Alert>
        )
    }

    if (permissionsLoading) {
        return <Alert severity='info'>{t('scripts.loadingPermissions', 'Loading script permissions...')}</Alert>
    }

    if (!canManageScripts) {
        return (
            <Alert severity='info'>
                {t('scripts.noManagePermission', 'You do not have permission to manage scripts for this metahub.')}
            </Alert>
        )
    }

    const scriptsListContent = (
        <List dense disablePadding sx={{ maxHeight: isCompactLayout ? 260 : 480, overflowY: 'auto' }}>
            {scriptsQuery.isLoading ? (
                <Box sx={{ px: 2, py: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('scripts.loading', 'Loading attached scripts...')}
                    </Typography>
                </Box>
            ) : null}
            {scripts.map((script) => {
                const scriptName = getVLCString(script.presentation.name, script.presentation.name?._primary ?? 'en') || script.id
                return (
                    <ListItemButton key={script.id} selected={script.id === selectedScriptId} onClick={() => handleSelectScript(script.id)}>
                        <ListItemText
                            primary={scriptName}
                            secondary={`${script.moduleRole} · ${
                                script.isActive ? t('scripts.active', 'Active') : t('scripts.inactive', 'Inactive')
                            }`}
                        />
                    </ListItemButton>
                )
            })}
            {!scriptsQuery.isLoading && scripts.length === 0 ? (
                <Box sx={{ px: 2, py: 3 }}>
                    <Typography variant='body2' color='text.secondary'>
                        {t('scripts.empty', 'No scripts are attached to this entity yet.')}
                    </Typography>
                </Box>
            ) : null}
        </List>
    )

    const formContent = (
        <Stack spacing={2} sx={{ minWidth: 0, width: '100%' }}>
            <TextField
                label={t('scripts.fields.name', 'Name')}
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
            />
            <TextField
                label={t('scripts.fields.codename', 'Codename')}
                value={draft.codename}
                onChange={(event) => setDraft((prev) => ({ ...prev, codename: event.target.value }))}
                disabled={isSaving}
                fullWidth
                size='small'
            />
            <TextField
                label={t('scripts.fields.description', 'Description')}
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
                    <InputLabel>{t('scripts.fields.moduleRole', 'Module role')}</InputLabel>
                    <Select
                        label={t('scripts.fields.moduleRole', 'Module role')}
                        value={draft.moduleRole}
                        onChange={(event) => handleModuleRoleChange(event.target.value as ScriptModuleRole)}
                        disabled={isSaving || availableModuleRoles.length === 1}
                    >
                        {availableModuleRoles.includes('module') ? (
                            <MenuItem value='module'>{t('scripts.moduleRoles.module', 'Module')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('lifecycle') ? (
                            <MenuItem value='lifecycle'>{t('scripts.moduleRoles.lifecycle', 'Lifecycle')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('widget') ? (
                            <MenuItem value='widget'>{t('scripts.moduleRoles.widget', 'Widget')}</MenuItem>
                        ) : null}
                        {availableModuleRoles.includes('library') ? (
                            <MenuItem value='library'>{t('scripts.moduleRoles.library', 'Library')}</MenuItem>
                        ) : null}
                    </Select>
                </FormControl>
                <FormControl size='small' fullWidth>
                    <InputLabel>{t('scripts.fields.sourceKind', 'Source kind')}</InputLabel>
                    <Select
                        label={t('scripts.fields.sourceKind', 'Source kind')}
                        value={draft.sourceKind}
                        onChange={(event) => setDraft((prev) => ({ ...prev, sourceKind: event.target.value as ScriptSourceKind }))}
                        disabled
                    >
                        <MenuItem value='embedded'>{t('scripts.sourceKinds.embedded', 'Embedded')}</MenuItem>
                    </Select>
                </FormControl>
            </Stack>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography variant='subtitle2'>{t('scripts.fields.capabilities', 'Capabilities')}</Typography>
                <Typography variant='body2' color='text.secondary'>
                    {t(
                        'scripts.capabilities.help',
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
                <Typography variant='subtitle2'>{t('scripts.guidance.title', 'Authoring guidance')}</Typography>
                <Alert severity='info' variant='outlined'>
                    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                        <Typography variant='body2'>
                            {t(`scripts.guidance.roleSummaries.${draft.moduleRole}`, roleGuidance.summary)}
                        </Typography>
                        <Typography variant='body2'>
                            {t('scripts.guidance.effectiveCapabilities', 'Effective capabilities for this role')}:&nbsp;
                            {roleGuidance.allowedCapabilities.map((capability) => getCapabilityLabel(capability)).join(', ')}
                        </Typography>
                        <Typography variant='body2'>
                            {t('scripts.guidance.recommendedEntryPoints', 'Recommended entry points')}:&nbsp;
                            {roleGuidance.entryPoints.join(', ')}
                        </Typography>
                        <Typography variant='body2'>
                            {draft.moduleRole === 'library'
                                ? t(
                                      'scripts.guidance.editorHelpLibrary',
                                      'Start typing SharedLibraryScript or @shared/example-helpers to use shared-library completions.'
                                  )
                                : t(
                                      'scripts.guidance.editorHelp',
                                      'Start typing ExtensionScript, @AtClient, @AtServer, @AtServerAndClient, or @OnEvent to use SDK completions.'
                                  )}
                        </Typography>
                    </Stack>
                </Alert>
            </Stack>
            <TextField
                label={t('scripts.fields.sdkApiVersion', 'SDK API version')}
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
                label={t('scripts.fields.isActive', 'Script is active')}
            />
            <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Typography variant='subtitle2'>{t('scripts.fields.sourceCode', 'Source code')}</Typography>
                <Box
                    data-testid='entity-scripts-editor-shell'
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
                        onChange={(value) => setDraft((prev) => ({ ...prev, sourceCode: value }))}
                        editable={!isSaving}
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
                <Button color='error' onClick={() => deleteMutation.mutate()} disabled={!draft.id || isSaving}>
                    {t('scripts.delete', 'Delete')}
                </Button>
                <Button variant='contained' onClick={() => void handleSave()} disabled={isSaving}>
                    {draft.id ? t('scripts.save', 'Save script') : t('scripts.create', 'Create script')}
                </Button>
            </Stack>
        </Stack>
    )

    return (
        <Stack spacing={2} sx={{ mt: 1, minWidth: 0 }} data-testid='entity-scripts-root'>
            {displayedError ? <Alert severity='error'>{displayedError}</Alert> : null}
            <Box
                ref={containerRef}
                sx={{ minWidth: 0 }}
                data-testid='entity-scripts-layout'
                data-layout-mode={isCompactLayout ? 'compact' : 'split'}
            >
                {isCompactLayout ? (
                    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                        <Stack direction='row' justifyContent='space-between' alignItems='flex-start' spacing={1.5} sx={{ minWidth: 0 }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant='subtitle2'>{t('scripts.listTitle', 'Attached scripts')}</Typography>
                                <Typography variant='body2' color='text.secondary' noWrap>
                                    {`${t('scripts.currentSelection', 'Selected')}: ${selectedScriptLabel}`}
                                </Typography>
                            </Box>
                            <Stack direction='row' spacing={1} sx={{ flexShrink: 0 }}>
                                <Button
                                    size='small'
                                    variant='outlined'
                                    onClick={() => setIsScriptListOpen((prev) => !prev)}
                                    data-testid='entity-scripts-list-toggle'
                                >
                                    {isScriptListOpen
                                        ? t('scripts.listToggle.hide', 'Hide scripts')
                                        : t('scripts.listToggle.show', 'Show scripts')}
                                </Button>
                                <Button size='small' onClick={handleNew} disabled={isSaving}>
                                    {t('scripts.new', 'New')}
                                </Button>
                            </Stack>
                        </Stack>

                        <Collapse in={isScriptListOpen}>
                            <Box
                                data-testid='entity-scripts-sidebar'
                                sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                            >
                                <Divider />
                                {scriptsListContent}
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
                            data-testid='entity-scripts-sidebar'
                            sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
                        >
                            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ px: 1.5, py: 1 }}>
                                <Typography variant='subtitle2'>{t('scripts.listTitle', 'Attached scripts')}</Typography>
                                <Button size='small' onClick={handleNew} disabled={isSaving}>
                                    {t('scripts.new', 'New')}
                                </Button>
                            </Stack>
                            <Divider />
                            {scriptsListContent}
                        </Box>

                        {formContent}
                    </Box>
                )}
            </Box>
        </Stack>
    )
}

export const createScriptsTab = (params: {
    t: TranslationFn
    metahubId: string | null | undefined
    attachedToKind: ScriptAttachmentKind
    attachedToId: string | null
}): TabConfig => ({
    id: 'scripts',
    label: params.t('tabs.scripts', 'Scripts'),
    content: (
        <EntityScriptsTab
            metahubId={params.metahubId}
            attachedToKind={params.attachedToKind}
            attachedToId={params.attachedToId}
            t={params.t}
        />
    )
})
