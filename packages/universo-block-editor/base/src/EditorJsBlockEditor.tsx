import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import type { PageBlockContent, PageBlockContentValidationOptions } from '@universo/types'
import { normalizePageBlockContentForStorage } from '@universo/types'

import {
    buildEditorJsTools,
    loadEditorJsToolBundle,
    mergeEditorJsOutputDataWithLocale,
    normalizeAllowedBlockTypes,
    toEditorJsOutputData
} from './editorJsTools'

type EditorJsInstance = {
    isReady: Promise<void>
    destroy: () => void
    render?: (data: Record<string, unknown>) => Promise<void> | void
}

type EditorJsConstructor = new (config: Record<string, unknown>) => EditorJsInstance

export type EditorJsBlockEditorLabels = {
    loading?: string
    loadError?: string
    validationError?: string
    fallbackLabel?: string
    fallbackHelper?: string
    retry?: string
}

export interface EditorJsBlockEditorProps {
    value: PageBlockContent
    allowedBlockTypes?: readonly string[]
    maxBlocks?: number | null
    readOnly?: boolean
    locale?: string
    contentLocale?: string
    labels?: EditorJsBlockEditorLabels
    onChange: (nextValue: PageBlockContent) => void
    onValidationError?: (message: string | null) => void
}

const DEFAULT_LABELS: Required<EditorJsBlockEditorLabels> = {
    loading: 'Loading editor...',
    loadError: 'The block editor could not be loaded.',
    validationError: 'The editor content is not valid.',
    fallbackLabel: 'Editor.js blocks JSON',
    fallbackHelper: 'Fallback JSON editor for recovery when the visual editor cannot be loaded.',
    retry: 'Retry'
}

const EDITOR_HOLDER_MIN_HEIGHT = 280

function buildEditableEditorJsData(
    value: PageBlockContent,
    locale: string,
    allowedBlockTypes: readonly string[],
    maxBlocks?: number | null
): Record<string, unknown> {
    const data = toEditorJsOutputData(value, locale)
    const blocks = Array.isArray(data.blocks) ? data.blocks : []

    if (blocks.length > 0 || maxBlocks === 0 || !allowedBlockTypes.includes('paragraph')) {
        return data
    }

    return {
        ...data,
        blocks: [
            {
                type: 'paragraph',
                data: { text: '' }
            }
        ]
    }
}

function stableSerializeEditorValue(input: unknown): string {
    const seen = new WeakSet<object>()

    return (
        JSON.stringify(input, (_key, value) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return value
            }

            if (seen.has(value)) {
                return '[Circular]'
            }
            seen.add(value)

            const record = value as Record<string, unknown>
            return Object.keys(record)
                .sort()
                .reduce<Record<string, unknown>>((result, key) => {
                    result[key] = record[key]
                    return result
                }, {})
        }) ?? ''
    )
}

function buildEditorValueSignature(value: PageBlockContent, contentLocale: string): string {
    return stableSerializeEditorValue({ contentLocale, value })
}

function buildEditorJsI18n(locale?: string): Record<string, unknown> | undefined {
    const normalizedLocale = (locale ?? 'en').split(/[-_]/)[0].toLowerCase()

    if (normalizedLocale !== 'ru') {
        return undefined
    }

    return {
        messages: {
            ui: {
                blockTunes: {
                    toggler: {
                        'Click to tune': 'Настроить',
                        'or drag to move': 'или перетащите'
                    }
                },
                inlineToolbar: {
                    converter: {
                        'Convert to': 'Преобразовать в'
                    }
                },
                toolbar: {
                    toolbox: {
                        Add: 'Добавить'
                    }
                },
                popover: {
                    Filter: 'Поиск',
                    'Nothing found': 'Ничего не найдено',
                    'Convert to': 'Преобразовать в'
                }
            },
            toolNames: {
                Text: 'Текст',
                Heading: 'Заголовок',
                'Ordered List': 'Нумерованный список',
                'Unordered List': 'Маркированный список',
                Checklist: 'Чеклист',
                List: 'Список',
                Quote: 'Цитата',
                Table: 'Таблица',
                Delimiter: 'Разделитель',
                Image: 'Изображение',
                Embed: 'Встраивание'
            },
            tools: {
                header: {
                    'Heading 1': 'Заголовок 1',
                    'Heading 2': 'Заголовок 2',
                    'Heading 3': 'Заголовок 3',
                    'Heading 4': 'Заголовок 4',
                    'Heading 5': 'Заголовок 5',
                    'Heading 6': 'Заголовок 6'
                },
                paragraph: {
                    'Enter something': 'Введите текст'
                },
                list: {
                    Ordered: 'Нумерованный',
                    Unordered: 'Маркированный',
                    Checklist: 'Чеклист'
                },
                quote: {
                    'Enter a quote': 'Введите цитату',
                    "Quote's author": 'Автор цитаты'
                },
                table: {
                    'Add column to left': 'Добавить столбец слева',
                    'Add column to right': 'Добавить столбец справа',
                    'Delete column': 'Удалить столбец',
                    'Add row above': 'Добавить строку выше',
                    'Add row below': 'Добавить строку ниже',
                    'Delete row': 'Удалить строку',
                    'With headings': 'С заголовками',
                    'Without headings': 'Без заголовков'
                },
                image: {
                    Caption: 'Подпись',
                    'Select an Image': 'Выберите изображение',
                    'With border': 'С рамкой',
                    'Stretch image': 'Растянуть',
                    'With background': 'С фоном'
                },
                embed: {
                    'Enter a caption': 'Введите подпись'
                },
                stub: {
                    'The block can not be displayed correctly.': 'Блок не может быть отображён корректно'
                },
                convertTo: {
                    'Convert to': 'Преобразовать в'
                }
            },
            blockTunes: {
                delete: {
                    Delete: 'Удалить',
                    'Click to delete': 'Подтвердить удаление'
                },
                moveUp: {
                    'Move up': 'Переместить выше'
                },
                moveDown: {
                    'Move down': 'Переместить ниже'
                }
            }
        }
    }
}

function buildAllowedBlockTypesKey(allowedBlockTypes?: readonly string[]): string {
    return allowedBlockTypes?.join('\u001f') ?? ''
}

export function EditorJsBlockEditor({
    value,
    allowedBlockTypes,
    maxBlocks,
    readOnly = false,
    locale,
    contentLocale,
    labels,
    onChange,
    onValidationError
}: EditorJsBlockEditorProps) {
    const holderRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<EditorJsInstance | null>(null)
    const initialValueRef = useRef(value)
    const lastAppliedValueJsonRef = useRef<string | null>(null)
    const onChangeRef = useRef(onChange)
    const onValidationErrorRef = useRef(onValidationError)
    const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [retryToken, setRetryToken] = useState(0)
    const [fallbackText, setFallbackText] = useState(() => JSON.stringify(value, null, 2))
    const mergedLabels = { ...DEFAULT_LABELS, ...labels }
    const resolvedContentLocale = (contentLocale ?? locale ?? 'en').split(/[-_]/)[0].toLowerCase() || 'en'
    const allowedBlockTypesKey = buildAllowedBlockTypesKey(allowedBlockTypes)
    const normalizedAllowedBlockTypes = useMemo(() => {
        const source = allowedBlockTypesKey ? allowedBlockTypesKey.split('\u001f') : undefined
        return normalizeAllowedBlockTypes(source)
    }, [allowedBlockTypesKey])
    const normalizedAllowedBlockTypesKey = normalizedAllowedBlockTypes.join('|')
    const defaultBlockType = normalizedAllowedBlockTypes.includes('paragraph') ? 'paragraph' : normalizedAllowedBlockTypes[0] ?? 'paragraph'
    const validationOptions = useMemo<PageBlockContentValidationOptions>(
        () => ({
            allowedBlockTypes: normalizedAllowedBlockTypes,
            maxBlocks
        }),
        [maxBlocks, normalizedAllowedBlockTypes]
    )

    initialValueRef.current = value

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        onValidationErrorRef.current = onValidationError
    }, [onValidationError])

    useEffect(() => {
        const nextValueJson = buildEditorValueSignature(value, resolvedContentLocale)
        initialValueRef.current = value
        setFallbackText(JSON.stringify(value, null, 2))

        if (nextValueJson === lastAppliedValueJsonRef.current) {
            return
        }

        const editor = editorRef.current
        if (!editor?.render) {
            return
        }

        void editor.isReady
            .then(() => editor.render?.(buildEditableEditorJsData(value, resolvedContentLocale, normalizedAllowedBlockTypes, maxBlocks)))
            .then(() => {
                lastAppliedValueJsonRef.current = nextValueJson
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : mergedLabels.validationError
                onValidationErrorRef.current?.(message)
            })
    }, [maxBlocks, mergedLabels.validationError, normalizedAllowedBlockTypes, resolvedContentLocale, value])

    useEffect(() => {
        let cancelled = false

        async function mountEditor() {
            setIsLoading(true)
            setLoadError(null)

            try {
                const [{ default: EditorJS }, toolBundle] = await Promise.all([
                    import('@editorjs/editorjs') as Promise<{ default: EditorJsConstructor }>,
                    loadEditorJsToolBundle()
                ])

                if (!holderRef.current || cancelled) {
                    return
                }

                const initialEditorData = buildEditableEditorJsData(
                    initialValueRef.current,
                    resolvedContentLocale,
                    normalizedAllowedBlockTypes,
                    maxBlocks
                )
                const initialEditorValueJson = buildEditorValueSignature(initialValueRef.current, resolvedContentLocale)

                const editor = new EditorJS({
                    holder: holderRef.current,
                    data: initialEditorData,
                    defaultBlock: defaultBlockType,
                    tools: buildEditorJsTools(toolBundle, normalizedAllowedBlockTypes),
                    readOnly,
                    i18n: buildEditorJsI18n(locale),
                    async onChange(api: { saver: { save: () => Promise<unknown> } }) {
                        if (changeTimerRef.current) {
                            clearTimeout(changeTimerRef.current)
                        }

                        changeTimerRef.current = setTimeout(async () => {
                            try {
                                const saved = await api.saver.save()
                                const normalized = mergeEditorJsOutputDataWithLocale(
                                    saved,
                                    initialValueRef.current,
                                    resolvedContentLocale,
                                    validationOptions
                                )
                                initialValueRef.current = normalized
                                lastAppliedValueJsonRef.current = buildEditorValueSignature(normalized, resolvedContentLocale)
                                onValidationErrorRef.current?.(null)
                                onChangeRef.current(normalized)
                            } catch (error) {
                                const message = error instanceof Error ? error.message : mergedLabels.validationError
                                onValidationErrorRef.current?.(message)
                            }
                        }, 250)
                    }
                })

                await editor.isReady

                if (cancelled) {
                    editor.destroy()
                    return
                }

                editorRef.current = editor
                const currentValueJson = buildEditorValueSignature(initialValueRef.current, resolvedContentLocale)
                if (currentValueJson !== initialEditorValueJson) {
                    await editor.render?.(
                        buildEditableEditorJsData(initialValueRef.current, resolvedContentLocale, normalizedAllowedBlockTypes, maxBlocks)
                    )
                }
                lastAppliedValueJsonRef.current = currentValueJson
                setIsLoading(false)
            } catch (error) {
                if (cancelled) {
                    return
                }

                const message = error instanceof Error && error.message ? error.message : mergedLabels.loadError
                setLoadError(message)
                setIsLoading(false)
                onValidationErrorRef.current?.(message)
            }
        }

        void mountEditor()

        return () => {
            cancelled = true
            if (changeTimerRef.current) {
                clearTimeout(changeTimerRef.current)
                changeTimerRef.current = null
            }

            const editor = editorRef.current
            editorRef.current = null
            if (editor) {
                void editor.isReady.then(() => editor.destroy()).catch(() => undefined)
            }
        }
    }, [
        defaultBlockType,
        locale,
        maxBlocks,
        mergedLabels.loadError,
        mergedLabels.validationError,
        normalizedAllowedBlockTypes,
        normalizedAllowedBlockTypesKey,
        readOnly,
        resolvedContentLocale,
        retryToken,
        validationOptions
    ])

    const handleFallbackChange = (nextValue: string) => {
        setFallbackText(nextValue)
        try {
            const parsed = normalizePageBlockContentForStorage(JSON.parse(nextValue), validationOptions)
            lastAppliedValueJsonRef.current = buildEditorValueSignature(parsed, resolvedContentLocale)
            onValidationError?.(null)
            onChange(parsed)
        } catch (error) {
            const message = error instanceof Error ? error.message : mergedLabels.validationError
            onValidationError?.(message)
        }
    }

    return (
        <Stack spacing={1.5}>
            {isLoading ? (
                <Stack direction='row' spacing={1} alignItems='center' color='text.secondary' data-testid='editorjs-block-editor-loading'>
                    <CircularProgress size={18} />
                    <Typography variant='body2'>{mergedLabels.loading}</Typography>
                </Stack>
            ) : null}

            {loadError ? (
                <Alert
                    severity='warning'
                    action={
                        <Button size='small' onClick={() => setRetryToken((current) => current + 1)}>
                            {mergedLabels.retry}
                        </Button>
                    }
                >
                    {mergedLabels.loadError}
                </Alert>
            ) : null}

            <Box
                ref={holderRef}
                data-testid='editorjs-block-editor'
                sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    minHeight: EDITOR_HOLDER_MIN_HEIGHT,
                    px: { xs: 1.5, sm: 2 },
                    py: 1,
                    bgcolor: 'background.paper',
                    position: 'relative',
                    overflow: 'visible',
                    zIndex: 0,
                    '& .codex-editor': {
                        position: 'relative',
                        zIndex: 0
                    },
                    '& .codex-editor__redactor': {
                        pb: '32px !important'
                    },
                    '& .ce-block__content, & .ce-toolbar__content': {
                        maxWidth: { xs: '100%', sm: 'calc(100% - 48px)' },
                        ml: { xs: 0, sm: '48px !important' },
                        mr: '0 !important'
                    },
                    '& .ce-toolbar__actions': {
                        right: 'auto !important',
                        left: { xs: 0, sm: '-56px !important' }
                    },
                    '& .ce-popover, & .ce-conversion-toolbar': {
                        zIndex: (theme) => theme.zIndex.modal + 1,
                        maxWidth: { xs: 'calc(100vw - 32px)', sm: 280 },
                        maxHeight: 240,
                        overflowY: 'auto'
                    },
                    '& .ce-popover__items': {
                        maxHeight: 'inherit',
                        overflowY: 'auto'
                    },
                    '& .ce-popover--opened': {
                        right: 'auto !important'
                    }
                }}
            />

            {loadError ? (
                <TextField
                    label={mergedLabels.fallbackLabel}
                    value={fallbackText}
                    onChange={(event) => handleFallbackChange(event.target.value)}
                    helperText={mergedLabels.fallbackHelper}
                    fullWidth
                    multiline
                    minRows={10}
                    inputProps={{ spellCheck: false }}
                />
            ) : null}
        </Stack>
    )
}

export default EditorJsBlockEditor
