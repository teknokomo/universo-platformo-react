import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import {
    addEditorJsContentLocale,
    collectEditorJsContentLocales,
    EditorJsBlockEditor,
    normalizeEditorContentLocale,
    removeEditorJsContentLocale,
    renameEditorJsContentLocale,
    resolveEditorJsContentPrimaryLocale,
    setEditorJsContentPrimaryLocale
} from '@universo-react/block-editor'
import { normalizePageBlockContentForStorage, type PageBlockContent, type PageBlockContentValidationOptions } from '@universo-react/types'
import type { TFunction } from 'i18next'
import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import { LocalizedVariantTabs, type LocalizedVariantTabItem } from './LocalizedVariantTabs'
import { isRecord } from './model'

const FALLBACK_CONTENT_LOCALES = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' }
] as const

const EMPTY_BLOCK_CONTENT: PageBlockContent = {
    format: 'editorjs',
    data: {
        blocks: []
    }
}

const readStringArray = (value: unknown): string[] | undefined =>
    Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined

const readFiniteInteger = (value: unknown): number | null | undefined => {
    if (value === null) return null
    return Number.isInteger(value) && typeof value === 'number' ? value : undefined
}

const readBlockEditorOptions = (field: FieldConfig): PageBlockContentValidationOptions => {
    const blockEditorConfig = isRecord(field.uiConfig?.blockEditor) ? field.uiConfig.blockEditor : field.uiConfig ?? {}
    return {
        allowedBlockTypes: readStringArray(blockEditorConfig.allowedBlockTypes),
        maxBlocks: readFiniteInteger(blockEditorConfig.maxBlocks)
    }
}

const normalizeBlockContentValue = (value: unknown, options: PageBlockContentValidationOptions): PageBlockContent => {
    try {
        return normalizePageBlockContentForStorage(value ?? EMPTY_BLOCK_CONTENT, options)
    } catch {
        return EMPTY_BLOCK_CONTENT
    }
}

const getLocaleLabel = (locale: string, t: TFunction<'interpretationNetwork'>): string => {
    const normalized = normalizeEditorContentLocale(locale)
    if (normalized === 'en') return t('workspace.material.languages.en', 'English')
    if (normalized === 'ru') return t('workspace.material.languages.ru', 'Russian')
    return normalized.toUpperCase()
}

const orderContentLocales = (locales: string[], primaryLocale: string, uiLocale: string): string[] => {
    const normalized = Array.from(new Set(locales.map((locale) => normalizeEditorContentLocale(locale))))
    const priority = [normalizeEditorContentLocale(primaryLocale), normalizeEditorContentLocale(uiLocale)]
    return normalized.sort((left, right) => {
        const leftPriority = priority.indexOf(left)
        const rightPriority = priority.indexOf(right)
        if (leftPriority !== -1 || rightPriority !== -1) {
            return (leftPriority === -1 ? priority.length : leftPriority) - (rightPriority === -1 ? priority.length : rightPriority)
        }
        return left.localeCompare(right)
    })
}

export interface MaterialContentEditorProps {
    t: TFunction<'interpretationNetwork'>
    locale: string
    bodyField: FieldConfig
    value: unknown
    readOnly: boolean
    isSaving: boolean
    error: string | null
    onSave: (data: Record<string, unknown>) => Promise<void>
}

export function MaterialContentEditor({ t, locale, bodyField, value, readOnly, isSaving, error, onSave }: MaterialContentEditorProps) {
    const uiLocale = normalizeEditorContentLocale(locale)
    const validationOptions = useMemo(() => readBlockEditorOptions(bodyField), [bodyField])
    const [draftValue, setDraftValue] = useState<PageBlockContent>(() => normalizeBlockContentValue(value, validationOptions))
    const [activeLocale, setActiveLocale] = useState(uiLocale)
    const [selectedLocales, setSelectedLocales] = useState<string[]>(() => collectEditorJsContentLocales(draftValue, uiLocale))
    const [primaryLocale, setPrimaryLocale] = useState<string>(() => resolveEditorJsContentPrimaryLocale(draftValue, uiLocale))
    const [validationError, setValidationError] = useState<string | null>(null)
    const [languageMenuPosition, setLanguageMenuPosition] = useState<{ top: number; left: number } | null>(null)
    const [languageMenuLocale, setLanguageMenuLocale] = useState<string | null>(null)
    const [languageMenuMode, setLanguageMenuMode] = useState<'add' | 'actions' | 'change'>('add')

    useEffect(() => {
        const nextValue = normalizeBlockContentValue(value, validationOptions)
        setDraftValue(nextValue)
        const nextPrimaryLocale = resolveEditorJsContentPrimaryLocale(nextValue, uiLocale)
        const nextLocales = orderContentLocales(collectEditorJsContentLocales(nextValue, uiLocale), nextPrimaryLocale, uiLocale)
        setPrimaryLocale(nextPrimaryLocale)
        setSelectedLocales(nextLocales)
        setActiveLocale((current) => (nextLocales.includes(current) ? current : nextPrimaryLocale))
    }, [uiLocale, validationOptions, value])

    const activeLocales = useMemo(
        () => orderContentLocales(selectedLocales, primaryLocale, uiLocale),
        [primaryLocale, selectedLocales, uiLocale]
    )
    const availableLocales = useMemo(
        () => FALLBACK_CONTENT_LOCALES.filter((candidate) => !activeLocales.includes(candidate.code)),
        [activeLocales]
    )
    const languageTabs = useMemo<LocalizedVariantTabItem[]>(
        () => activeLocales.map((contentLocale) => ({ code: contentLocale, label: getLocaleLabel(contentLocale, t) })),
        [activeLocales, t]
    )
    const normalizedAllowedBlockTypes = readStringArray(validationOptions.allowedBlockTypes)
    const normalizedMaxBlocks = readFiniteInteger(validationOptions.maxBlocks)
    const closeLanguageMenu = useCallback(() => {
        setLanguageMenuPosition(null)
        setLanguageMenuLocale(null)
        setLanguageMenuMode('add')
    }, [])

    const handleAddLocale = useCallback(
        (nextLocale: string) => {
            const normalized = normalizeEditorContentLocale(nextLocale)
            setDraftValue((current) => addEditorJsContentLocale(current, normalized, activeLocale))
            setSelectedLocales((current) => orderContentLocales([...current, normalized], primaryLocale, uiLocale))
            setActiveLocale(normalized)
            closeLanguageMenu()
        },
        [activeLocale, closeLanguageMenu, primaryLocale, uiLocale]
    )

    const handleChangeLocale = useCallback(
        (nextLocale: string) => {
            const sourceLocale = languageMenuLocale
            const normalized = normalizeEditorContentLocale(nextLocale)
            if (!sourceLocale || activeLocales.includes(normalized)) return
            setDraftValue((current) => renameEditorJsContentLocale(current, sourceLocale, normalized))
            setSelectedLocales((current) => current.map((candidate) => (candidate === sourceLocale ? normalized : candidate)))
            setPrimaryLocale((current) => (current === sourceLocale ? normalized : current))
            setActiveLocale(normalized)
            closeLanguageMenu()
        },
        [activeLocales, closeLanguageMenu, languageMenuLocale]
    )

    const handleMakePrimary = useCallback(() => {
        if (!languageMenuLocale) return
        setDraftValue((current) => setEditorJsContentPrimaryLocale(current, languageMenuLocale))
        setPrimaryLocale(languageMenuLocale)
        setSelectedLocales((current) => orderContentLocales(current, languageMenuLocale, uiLocale))
        setActiveLocale(languageMenuLocale)
        closeLanguageMenu()
    }, [closeLanguageMenu, languageMenuLocale, uiLocale])

    const handleRemoveLocale = useCallback(() => {
        if (!languageMenuLocale || activeLocales.length <= 1) return
        const nextLocales = activeLocales.filter((candidate) => candidate !== languageMenuLocale)
        const nextPrimaryLocale = primaryLocale === languageMenuLocale ? nextLocales[0] ?? uiLocale : primaryLocale
        setDraftValue((current) => {
            const withoutLocale = removeEditorJsContentLocale(current, languageMenuLocale)
            return primaryLocale === languageMenuLocale ? setEditorJsContentPrimaryLocale(withoutLocale, nextPrimaryLocale) : withoutLocale
        })
        setSelectedLocales(nextLocales)
        setPrimaryLocale(nextPrimaryLocale)
        setActiveLocale((current) => (current === languageMenuLocale ? nextPrimaryLocale : current))
        closeLanguageMenu()
    }, [activeLocales, closeLanguageMenu, languageMenuLocale, primaryLocale, uiLocale])

    const handleTabKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>, contentLocale: string) => {
            const currentIndex = activeLocales.indexOf(contentLocale)
            if (currentIndex < 0) return
            let nextIndex: number | null = null
            if (event.key === 'ArrowLeft') {
                nextIndex = currentIndex <= 0 ? activeLocales.length - 1 : currentIndex - 1
            } else if (event.key === 'ArrowRight') {
                nextIndex = currentIndex >= activeLocales.length - 1 ? 0 : currentIndex + 1
            } else if (event.key === 'Home') {
                nextIndex = 0
            } else if (event.key === 'End') {
                nextIndex = activeLocales.length - 1
            }
            if (nextIndex === null) return
            event.preventDefault()
            setActiveLocale(activeLocales[nextIndex])
        },
        [activeLocales]
    )

    const handleSave = useCallback(async () => {
        if (validationError) return
        await onSave({ [bodyField.id]: draftValue })
    }, [bodyField.id, draftValue, onSave, validationError])

    return (
        <Stack spacing={1.5} data-testid='interpretation-network-material-editor'>
            <LocalizedVariantTabs
                items={languageTabs}
                value={activeLocale}
                primaryValue={primaryLocale}
                canEdit={!readOnly && !isSaving}
                canAdd={availableLocales.length > 0}
                labels={{
                    tabList: t('workspace.material.contentLanguage', 'Material language'),
                    add: t('workspace.material.addLanguage', 'Add language'),
                    primary: t('workspace.material.primaryLanguage', 'Default language'),
                    actions: (language) =>
                        t('workspace.material.languageActions', {
                            defaultValue: 'Language actions: {{language}}',
                            language
                        })
                }}
                onChange={(nextLocale) => setActiveLocale(normalizeEditorContentLocale(nextLocale))}
                onAdd={(event) => {
                    setLanguageMenuMode('add')
                    setLanguageMenuLocale(null)
                    setLanguageMenuPosition({ top: event.clientY + 4, left: event.clientX })
                }}
                onOpenActions={(event, contentLocale) => {
                    setLanguageMenuMode('actions')
                    setLanguageMenuLocale(contentLocale)
                    setLanguageMenuPosition({ top: event.clientY + 4, left: event.clientX })
                }}
                onTabKeyDown={handleTabKeyDown}
            />
            <Menu
                anchorReference='anchorPosition'
                anchorPosition={languageMenuPosition ?? undefined}
                open={Boolean(languageMenuPosition)}
                onClose={closeLanguageMenu}
            >
                {languageMenuMode === 'actions' ? (
                    <>
                        {availableLocales.length > 0 ? (
                            <MenuItem onClick={() => setLanguageMenuMode('change')}>
                                {t('workspace.material.changeLanguage', 'Change language')}
                            </MenuItem>
                        ) : null}
                        {languageMenuLocale === primaryLocale ? (
                            <MenuItem disabled>{t('workspace.material.primaryVariant', 'Primary variant')}</MenuItem>
                        ) : (
                            <MenuItem onClick={handleMakePrimary}>{t('workspace.material.makePrimary', 'Make primary')}</MenuItem>
                        )}
                        {activeLocales.length > 1 ? (
                            <>
                                <Divider />
                                <MenuItem onClick={handleRemoveLocale}>{t('workspace.material.removeLanguage', 'Remove')}</MenuItem>
                            </>
                        ) : null}
                    </>
                ) : null}
                {languageMenuMode !== 'actions' ? (
                    <>
                        {languageMenuMode === 'change' ? (
                            <>
                                <MenuItem onClick={() => setLanguageMenuMode('actions')}>
                                    <Stack direction='row' spacing={1} alignItems='center'>
                                        <ArrowBackRoundedIcon fontSize='small' />
                                        <span>{t('workspace.material.backToLanguageActions', 'Back')}</span>
                                    </Stack>
                                </MenuItem>
                                <Divider />
                            </>
                        ) : null}
                        {availableLocales.length > 0 ? (
                            availableLocales.map((contentLocale) => (
                                <MenuItem
                                    key={contentLocale.code}
                                    onClick={() =>
                                        languageMenuMode === 'change'
                                            ? handleChangeLocale(contentLocale.code)
                                            : handleAddLocale(contentLocale.code)
                                    }
                                >
                                    {getLocaleLabel(contentLocale.code, t)}
                                </MenuItem>
                            ))
                        ) : (
                            <MenuItem disabled>{t('workspace.material.noLanguagesAvailable', 'No languages available')}</MenuItem>
                        )}
                    </>
                ) : null}
            </Menu>

            <Box sx={{ minWidth: 0 }}>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                    {t('workspace.material.editorHint', 'Material content')}
                </Typography>
                <EditorJsBlockEditor
                    value={draftValue}
                    allowedBlockTypes={normalizedAllowedBlockTypes}
                    maxBlocks={normalizedMaxBlocks}
                    readOnly={readOnly || isSaving}
                    locale={uiLocale}
                    contentLocale={activeLocale}
                    labels={{
                        loading: t('workspace.material.blockEditor.loading', 'Loading editor...'),
                        loadError: t('workspace.material.blockEditor.loadError', 'The block editor could not be loaded.'),
                        validationError: t('workspace.material.blockEditor.validationError', 'The editor content is not valid.'),
                        fallbackLabel: t('workspace.material.blockEditor.fallbackLabel', 'Editor.js blocks JSON'),
                        fallbackHelper: t(
                            'workspace.material.blockEditor.fallbackHelper',
                            'Fallback JSON editor for recovery when the visual editor cannot be loaded.'
                        ),
                        retry: t('workspace.material.blockEditor.retry', 'Retry')
                    }}
                    onChange={setDraftValue}
                    onValidationError={setValidationError}
                />
            </Box>

            {error || validationError ? <Alert severity='error'>{validationError ?? error}</Alert> : null}

            <Stack direction='row' justifyContent='flex-end'>
                <Button
                    type='button'
                    size='small'
                    variant='contained'
                    startIcon={<SaveRoundedIcon />}
                    disabled={readOnly || isSaving || Boolean(validationError)}
                    onClick={handleSave}
                >
                    {t('workspace.actions.save', 'Save')}
                </Button>
            </Stack>
        </Stack>
    )
}

export default MaterialContentEditor
