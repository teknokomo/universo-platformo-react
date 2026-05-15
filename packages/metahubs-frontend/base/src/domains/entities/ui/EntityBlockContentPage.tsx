import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Alert, Box, Button, Divider, Menu, MenuItem, Stack } from '@mui/material'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCommonTranslations } from '@universo/i18n'
import {
    addEditorJsContentLocale,
    collectEditorJsContentLocales,
    EditorJsBlockEditor,
    Loader,
    LocalizedVariantTabs,
    normalizeEditorContentLocale,
    removeEditorJsContentLocale,
    renameEditorJsContentLocale,
    resolveEditorJsContentPrimaryLocale,
    setEditorJsContentPrimaryLocale,
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader
} from '@universo/template-mui'
import { ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { isEnabledCapabilityConfig, normalizePageBlockContentForStorage, type PageBlockContent } from '@universo/types'
import { extractConflictInfo, isOptimisticLockConflict, type ConflictInfo } from '@universo/utils'

import type { Metahub } from '../../../types'
import { useMetahubDetails } from '../../metahubs/hooks'
import { useMetahubPrimaryLocale } from '../../settings/hooks/useMetahubPrimaryLocale'
import { invalidateEntitiesQueries, metahubsQueryKeys } from '../../shared'
import { useEntityInstanceQuery, useEntityTypesQuery, useUpdateEntityInstance } from '../hooks'
import type { MetahubEntityInstance, UpdateEntityInstancePayload } from '../api'
import {
    DEFAULT_PAGE_BLOCK_CONTENT,
    buildInstanceDisplayRow,
    decodeKindKey,
    getEntityConfig,
    resolveEntityTypeName,
    type UiTranslate
} from './entityInstanceListHelpers'

type ContentLocaleOption = {
    code: string
    label: string
    isDefault?: boolean
}

const FALLBACK_CONTENT_LOCALES: ContentLocaleOption[] = [
    { code: 'en', label: 'English', isDefault: true },
    { code: 'ru', label: 'Русский', isDefault: false }
]

const resolveInitialBlockContent = (entity?: MetahubEntityInstance | null): PageBlockContent => {
    const config = getEntityConfig(entity)
    try {
        return normalizePageBlockContentForStorage(config.blockContent ?? DEFAULT_PAGE_BLOCK_CONTENT)
    } catch {
        return normalizePageBlockContentForStorage(DEFAULT_PAGE_BLOCK_CONTENT)
    }
}

const normalizeContentLocale = normalizeEditorContentLocale

const normalizeLocaleOptions = (locales: ContentLocaleOption[]): ContentLocaleOption[] =>
    locales.map((locale) => ({
        ...locale,
        code: normalizeContentLocale(locale.code)
    }))

const orderContentLocales = (
    locales: string[],
    uiLocale: string,
    availableLocales: ContentLocaleOption[],
    primaryLocale: string
): string[] => {
    const unique = Array.from(new Set(locales.map(normalizeContentLocale).filter(Boolean)))
    const orderIndex = new Map(availableLocales.map((locale, index) => [locale.code, index]))
    const normalizedUiLocale = normalizeContentLocale(uiLocale)
    const normalizedPrimaryLocale = normalizeContentLocale(primaryLocale)

    return unique.sort((left, right) => {
        if (left === normalizedPrimaryLocale) return -1
        if (right === normalizedPrimaryLocale) return 1
        if (left === normalizedUiLocale) return -1
        if (right === normalizedUiLocale) return 1
        const leftIndex = orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER
        const rightIndex = orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER
        if (leftIndex !== rightIndex) return leftIndex - rightIndex
        return left.localeCompare(right)
    })
}

const buildContentPatch = (entity: MetahubEntityInstance, blockContent: PageBlockContent): UpdateEntityInstancePayload => ({
    expectedVersion: entity.version,
    config: {
        ...getEntityConfig(entity),
        blockContent: normalizePageBlockContentForStorage(blockContent)
    }
})

export const EntityBlockContentPage = () => {
    const { metahubId, kindKey: routeKindKey, entityId } = useParams<{ metahubId: string; kindKey: string; entityId: string }>()
    const resolvedKindKey = useMemo(() => decodeKindKey(routeKindKey), [routeKindKey])
    const queryClient = useQueryClient()
    const preferredVlcLocale = useMetahubPrimaryLocale()
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const { t: tl } = useCommonTranslations('localizedField')
    const { enqueueSnackbar } = useSnackbar()
    const translate = useCallback<UiTranslate>(
        (key, options) => {
            if (typeof options === 'string') {
                return t(key, { defaultValue: options })
            }

            return t(key, options)
        },
        [t]
    )
    const metahubDetailsQuery = useMetahubDetails(metahubId ?? '', { enabled: Boolean(metahubId) })
    const cachedMetahub = metahubId ? queryClient.getQueryData<Metahub>(metahubsQueryKeys.detail(metahubId)) : undefined
    const resolvedPermissions = metahubDetailsQuery.data?.permissions ?? cachedMetahub?.permissions
    const canEditContent = resolvedPermissions?.manageMetahub === true

    const entityTypesQuery = useEntityTypesQuery(metahubId, {
        limit: 1000,
        offset: 0,
        sortBy: 'codename',
        sortOrder: 'asc'
    })
    const entityType = useMemo(
        () => (entityTypesQuery.data?.items ?? []).find((item) => item.kindKey === resolvedKindKey) ?? null,
        [entityTypesQuery.data?.items, resolvedKindKey]
    )
    const blockContentConfig = isEnabledCapabilityConfig(entityType?.capabilities.blockContent)
        ? entityType.capabilities.blockContent
        : null
    const entityQuery = useEntityInstanceQuery(metahubId, entityId)
    const updateEntityMutation = useUpdateEntityInstance()
    const entity = entityQuery.data ?? null
    const uiContentLocale = normalizeContentLocale(i18n.resolvedLanguage || i18n.language)
    const contentLocalesQuery = useQuery<{ locales: ContentLocaleOption[]; defaultLocale?: string }>({
        queryKey: ['metahubs', 'page-content-locales', 'public'],
        queryFn: async () => {
            const response = await fetch('/api/v1/locales/content')
            if (!response.ok) {
                throw new Error('Failed to fetch content locales')
            }
            return response.json()
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 1
    })
    const availableContentLocales = useMemo(
        () =>
            normalizeLocaleOptions(contentLocalesQuery.data?.locales?.length ? contentLocalesQuery.data.locales : FALLBACK_CONTENT_LOCALES),
        [contentLocalesQuery.data?.locales]
    )
    const [content, setContent] = useState<PageBlockContent>(() => resolveInitialBlockContent(entity))
    const [savedContent, setSavedContent] = useState<PageBlockContent>(() => resolveInitialBlockContent(entity))
    const [contentLocale, setContentLocale] = useState(() => uiContentLocale)
    const [selectedContentLocales, setSelectedContentLocales] = useState<string[]>(() => [uiContentLocale])
    const [primaryContentLocale, setPrimaryContentLocale] = useState(() => uiContentLocale)
    const [languageMenuAnchor, setLanguageMenuAnchor] = useState<HTMLElement | null>(null)
    const [languageMenuLocale, setLanguageMenuLocale] = useState<string | null>(null)
    const [languageMenuMode, setLanguageMenuMode] = useState<'tab' | 'add' | 'change'>('tab')
    const [validationError, setValidationError] = useState<string | null>(null)
    const [conflictState, setConflictState] = useState<{
        open: boolean
        conflict: ConflictInfo | null
        patch: UpdateEntityInstancePayload | null
    }>({ open: false, conflict: null, patch: null })
    const [isResolvingConflict, setIsResolvingConflict] = useState(false)

    useEffect(() => {
        if (!entity) {
            return
        }

        const nextContent = resolveInitialBlockContent(entity)
        const nextPrimaryLocale = resolveEditorJsContentPrimaryLocale(nextContent, uiContentLocale)
        const nextLocales = orderContentLocales(
            collectEditorJsContentLocales(nextContent, uiContentLocale),
            uiContentLocale,
            availableContentLocales,
            nextPrimaryLocale
        )
        setContent(nextContent)
        setSavedContent(nextContent)
        setSelectedContentLocales(nextLocales)
        setPrimaryContentLocale(nextPrimaryLocale)
        setContentLocale(nextLocales[0] ?? uiContentLocale)
        setValidationError(null)
    }, [availableContentLocales, entity, uiContentLocale])

    const row = entity ? buildInstanceDisplayRow(entity, preferredVlcLocale, translate) : null
    const entityTypeName = useMemo(
        () => resolveEntityTypeName(entityType, preferredVlcLocale, translate, resolvedKindKey),
        [entityType, preferredVlcLocale, resolvedKindKey, translate]
    )
    const isDirty = JSON.stringify(content) !== JSON.stringify(savedContent)
    const availableToAdd = useMemo(
        () => availableContentLocales.filter((locale) => !selectedContentLocales.includes(locale.code)),
        [availableContentLocales, selectedContentLocales]
    )
    const getContentLocaleLabel = useCallback(
        (locale: string) =>
            availableContentLocales.find((option) => option.code === normalizeContentLocale(locale))?.label ?? locale.toUpperCase(),
        [availableContentLocales]
    )

    const closeLanguageMenu = useCallback(() => {
        setLanguageMenuAnchor(null)
    }, [])

    const resetClosedLanguageMenu = useCallback(() => {
        setLanguageMenuLocale(null)
        setLanguageMenuMode('tab')
    }, [])

    const handleOpenTabMenu = useCallback((event: MouseEvent<HTMLElement>, locale: string) => {
        event.stopPropagation()
        setLanguageMenuAnchor(event.currentTarget)
        setLanguageMenuLocale(normalizeContentLocale(locale))
        setLanguageMenuMode('tab')
    }, [])

    const handleOpenAddMenu = useCallback((event: MouseEvent<HTMLElement>) => {
        setLanguageMenuAnchor(event.currentTarget)
        setLanguageMenuLocale(null)
        setLanguageMenuMode('add')
    }, [])

    const handleContentLocaleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>, locale: string) => {
            const currentIndex = selectedContentLocales.indexOf(normalizeContentLocale(locale))
            if (currentIndex < 0) return

            let nextLocale: string | null = null
            if (event.key === 'ArrowRight') {
                nextLocale = selectedContentLocales[(currentIndex + 1) % selectedContentLocales.length]
            } else if (event.key === 'ArrowLeft') {
                nextLocale = selectedContentLocales[(currentIndex - 1 + selectedContentLocales.length) % selectedContentLocales.length]
            } else if (event.key === 'Home') {
                nextLocale = selectedContentLocales[0]
            } else if (event.key === 'End') {
                nextLocale = selectedContentLocales[selectedContentLocales.length - 1]
            }

            if (!nextLocale) return

            event.preventDefault()
            setContentLocale(nextLocale)
            window.requestAnimationFrame(() => {
                document.querySelector<HTMLElement>(`[data-content-locale-tab="${nextLocale}"]`)?.focus()
            })
        },
        [selectedContentLocales]
    )

    const handleAddLocale = useCallback(
        (locale: string) => {
            const normalizedLocale = normalizeContentLocale(locale)
            setSelectedContentLocales((current) =>
                orderContentLocales([...current, normalizedLocale], normalizedLocale, availableContentLocales, primaryContentLocale)
            )
            setContent((current) => addEditorJsContentLocale(current, normalizedLocale, contentLocale))
            setContentLocale(normalizedLocale)
            closeLanguageMenu()
        },
        [availableContentLocales, closeLanguageMenu, contentLocale, primaryContentLocale]
    )

    const handleChangeLocale = useCallback(
        (locale: string) => {
            if (!languageMenuLocale) return

            const normalizedLocale = normalizeContentLocale(locale)
            const sourceLocale = normalizeContentLocale(languageMenuLocale)
            setSelectedContentLocales((current) =>
                orderContentLocales(
                    current.map((item) => (item === sourceLocale ? normalizedLocale : item)),
                    normalizedLocale,
                    availableContentLocales,
                    primaryContentLocale === sourceLocale ? normalizedLocale : primaryContentLocale
                )
            )
            setPrimaryContentLocale((current) => (current === sourceLocale ? normalizedLocale : current))
            setContent((current) => renameEditorJsContentLocale(current, sourceLocale, normalizedLocale))
            setContentLocale(normalizedLocale)
            closeLanguageMenu()
        },
        [availableContentLocales, closeLanguageMenu, languageMenuLocale, primaryContentLocale]
    )

    const handleMakePrimary = useCallback(() => {
        if (!languageMenuLocale) return

        const normalizedLocale = normalizeContentLocale(languageMenuLocale)
        setPrimaryContentLocale(normalizedLocale)
        setSelectedContentLocales((current) => orderContentLocales(current, uiContentLocale, availableContentLocales, normalizedLocale))
        setContentLocale(normalizedLocale)
        setContent((current) => setEditorJsContentPrimaryLocale(current, normalizedLocale))
        closeLanguageMenu()
    }, [availableContentLocales, closeLanguageMenu, languageMenuLocale, uiContentLocale])

    const handleRemoveLocale = useCallback(() => {
        if (!languageMenuLocale || selectedContentLocales.length <= 1) return

        const removedLocale = normalizeContentLocale(languageMenuLocale)
        const nextLocales = selectedContentLocales.filter((locale) => locale !== removedLocale)
        const nextPrimary = primaryContentLocale === removedLocale ? nextLocales[0] ?? primaryContentLocale : primaryContentLocale
        const nextActive = contentLocale === removedLocale ? nextLocales[0] ?? uiContentLocale : contentLocale

        setSelectedContentLocales(nextLocales)
        setPrimaryContentLocale(nextPrimary)
        setContentLocale(nextActive)
        setContent((current) => {
            const withoutLocale = removeEditorJsContentLocale(current, removedLocale)
            return primaryContentLocale === removedLocale ? setEditorJsContentPrimaryLocale(withoutLocale, nextPrimary) : withoutLocale
        })
        closeLanguageMenu()
    }, [closeLanguageMenu, contentLocale, languageMenuLocale, primaryContentLocale, selectedContentLocales, uiContentLocale])

    const menuLocalesAvailable = availableToAdd
    const canAddLocale = availableToAdd.length > 0
    const canChangeLocale = Boolean(languageMenuLocale) && availableToAdd.length > 0
    const isMenuLocalePrimary = Boolean(languageMenuLocale) && primaryContentLocale === languageMenuLocale

    const handleSave = useCallback(
        async (overridePatch?: UpdateEntityInstancePayload) => {
            if (!metahubId || !entityId || !entity || !canEditContent) {
                return
            }

            const patch = overridePatch ?? buildContentPatch(entity, content)
            try {
                const updated = await updateEntityMutation.mutateAsync({
                    metahubId,
                    entityId,
                    data: patch
                })
                const nextContent = resolveInitialBlockContent(updated)
                setSavedContent(nextContent)
                setContent(nextContent)
                setValidationError(null)
                setConflictState({ open: false, conflict: null, patch: null })
                await invalidateEntitiesQueries.detail(queryClient, metahubId, entityId)
                await invalidateEntitiesQueries.all(queryClient, metahubId, resolvedKindKey)
            } catch (error) {
                if (isOptimisticLockConflict(error)) {
                    setConflictState({
                        open: true,
                        conflict: extractConflictInfo(error),
                        patch
                    })
                    return
                }

                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : t('entities.instances.content.saveError', 'Failed to save content')
                enqueueSnackbar(message, { variant: 'error' })
            }
        },
        [canEditContent, content, enqueueSnackbar, entity, entityId, metahubId, queryClient, resolvedKindKey, t, updateEntityMutation]
    )

    const handleReloadAfterConflict = () => {
        setConflictState({ open: false, conflict: null, patch: null })
        void queryClient.invalidateQueries({ queryKey: metahubId && entityId ? metahubsQueryKeys.entityDetail(metahubId, entityId) : [] })
    }

    const handleOverwriteConflict = async () => {
        if (!conflictState.patch || isResolvingConflict) {
            return
        }

        const { expectedVersion: _ignored, ...patchWithoutVersion } = conflictState.patch
        setIsResolvingConflict(true)
        try {
            await handleSave(patchWithoutVersion)
        } finally {
            setIsResolvingConflict(false)
        }
    }

    if (entityTypesQuery.isLoading || entityQuery.isLoading) {
        return <Loader />
    }

    if (!entityType || !entity) {
        return (
            <MainCard border={false} shadow={false}>
                <Alert severity='error'>{t('entities.instances.content.notFound', 'Entity content was not found.')}</Alert>
            </MainCard>
        )
    }

    if (!blockContentConfig) {
        return (
            <MainCard border={false} shadow={false}>
                <Alert severity='warning'>
                    {t('entities.instances.content.notEnabled', 'Block content is not enabled for this entity type.')}
                </Alert>
            </MainCard>
        )
    }

    return (
        <MainCard border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding disableHeader>
            <Stack spacing={2}>
                <ViewHeader title={row?.name ?? entityTypeName} controlsAlign='end'>
                    <Button
                        variant='contained'
                        startIcon={<SaveRoundedIcon />}
                        onClick={() => void handleSave()}
                        disabled={!canEditContent || updateEntityMutation.isPending || Boolean(validationError) || !isDirty}
                    >
                        {updateEntityMutation.isPending ? t('entities.instances.content.saving', 'Saving...') : tc('actions.save', 'Save')}
                    </Button>
                </ViewHeader>

                {!canEditContent ? (
                    <Alert severity='info'>
                        {t('entities.instances.content.readOnly', 'You do not have permission to edit this content.')}
                    </Alert>
                ) : null}

                {validationError ? <Alert severity='error'>{validationError}</Alert> : null}

                <Box>
                    <LocalizedVariantTabs
                        items={selectedContentLocales.map((locale) => ({
                            code: locale,
                            label: getContentLocaleLabel(locale)
                        }))}
                        value={contentLocale}
                        primaryValue={primaryContentLocale}
                        canEdit={canEditContent}
                        canAdd={canAddLocale}
                        labels={{
                            tabList: t('entities.instances.content.contentLanguage', 'Content language'),
                            add: t('entities.instances.content.addLanguage', 'Add content language'),
                            primary: tl('primaryVariant', 'Primary variant'),
                            actions: (language) =>
                                t('entities.instances.content.languageActions', {
                                    language,
                                    defaultValue: '{{language}} language actions'
                                })
                        }}
                        onChange={setContentLocale}
                        onAdd={handleOpenAddMenu}
                        onOpenActions={handleOpenTabMenu}
                        onTabKeyDown={handleContentLocaleKeyDown}
                    />
                    <EditorJsBlockEditor
                        key={`${entity.id}:${entity.version ?? 0}`}
                        value={content}
                        allowedBlockTypes={blockContentConfig.allowedBlockTypes}
                        maxBlocks={blockContentConfig.maxBlocks}
                        readOnly={!canEditContent}
                        locale={uiContentLocale}
                        contentLocale={contentLocale}
                        labels={{
                            loading: t('entities.instances.content.editorLoading', 'Loading editor...'),
                            loadError: t('entities.instances.content.editorLoadError', 'The block editor could not be loaded.'),
                            validationError: t('entities.instances.content.validationInvalid', 'The editor content is not valid.'),
                            fallbackLabel: t('entities.instances.fields.blockContent', 'Editor.js blocks JSON'),
                            fallbackHelper: t(
                                'entities.instances.content.fallbackHelper',
                                'Fallback JSON editor for recovery when the visual editor cannot be loaded.'
                            ),
                            retry: tc('actions.retry', 'Retry')
                        }}
                        onChange={(nextContent) => {
                            setContent(nextContent)
                            setSelectedContentLocales((current) =>
                                current.includes(contentLocale)
                                    ? current
                                    : orderContentLocales(
                                          [...current, contentLocale],
                                          contentLocale,
                                          availableContentLocales,
                                          primaryContentLocale
                                      )
                            )
                            setPrimaryContentLocale(resolveEditorJsContentPrimaryLocale(nextContent, primaryContentLocale))
                            setValidationError(null)
                        }}
                        onValidationError={setValidationError}
                    />
                    <Menu
                        anchorEl={languageMenuAnchor}
                        open={Boolean(languageMenuAnchor)}
                        onClose={closeLanguageMenu}
                        TransitionProps={{ onExited: resetClosedLanguageMenu }}
                    >
                        {languageMenuMode === 'tab' ? (
                            <>
                                <MenuItem disabled={!canChangeLocale} onClick={() => setLanguageMenuMode('change')}>
                                    {tl('changeLanguage', 'Change language')}
                                </MenuItem>
                                {isMenuLocalePrimary ? (
                                    <MenuItem disabled tabIndex={-1}>
                                        {tl('primaryVariant', 'Primary variant')}
                                    </MenuItem>
                                ) : (
                                    <MenuItem onClick={handleMakePrimary}>{tl('makePrimary', 'Make primary')}</MenuItem>
                                )}
                                {selectedContentLocales.length > 1 ? (
                                    <>
                                        <Divider />
                                        <MenuItem onClick={handleRemoveLocale}>{tl('removeLanguage', 'Remove')}</MenuItem>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            <>
                                {languageMenuMode === 'change' ? (
                                    <>
                                        <MenuItem onClick={() => setLanguageMenuMode('tab')}>{tl('back', 'Back')}</MenuItem>
                                        <Divider />
                                    </>
                                ) : null}
                                {menuLocalesAvailable.map((locale) => (
                                    <MenuItem
                                        key={locale.code}
                                        onClick={() =>
                                            languageMenuMode === 'change' ? handleChangeLocale(locale.code) : handleAddLocale(locale.code)
                                        }
                                    >
                                        {locale.label}
                                    </MenuItem>
                                ))}
                                {menuLocalesAvailable.length === 0 ? (
                                    <MenuItem disabled tabIndex={-1}>
                                        {tl('noLanguagesAvailable', 'No languages available')}
                                    </MenuItem>
                                ) : null}
                            </>
                        )}
                    </Menu>
                </Box>

                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onCancel={() => setConflictState({ open: false, conflict: null, patch: null })}
                    onReload={handleReloadAfterConflict}
                    onOverwrite={handleOverwriteConflict}
                    isLoading={updateEntityMutation.isPending || isResolvingConflict}
                />
            </Stack>
        </MainCard>
    )
}

export default EntityBlockContentPage
