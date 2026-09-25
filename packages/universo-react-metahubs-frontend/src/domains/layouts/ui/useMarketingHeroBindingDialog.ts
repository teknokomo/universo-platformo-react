import { useEffect, useRef, useState } from 'react'
import { useCommonTranslations } from '@universo-react/i18n'

import * as recordsApi from '../../entities/metadata/record/api'
import type { RecordItem } from '../../../types'
import { normalizeLocale } from '../../../types'
import * as layoutsApi from '../api'
import { getHeroComponentKey, validateHeroRecordData } from './marketingHeroAuthoring'
import { useMarketingHeroBindingData } from './useMarketingHeroBindingData'
import type { HeroRecordOption } from './useMarketingHeroBindingData'

export type HeroRecordFormMode = 'create' | 'edit' | null
type HeroRecordFieldError = { fieldId: string; locale: string; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isVersionConflict = (error: unknown): boolean => {
    if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.data)) return false
    return error.response.status === 409 && error.response.data.code === 'CONFLICT'
}

const hasHeroActionTargetError = (error: unknown): boolean => {
    if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.data)) return false
    const details = error.response.data.details
    return isRecord(details) && details.reason === 'HERO_ACTION_TARGET_UNAVAILABLE'
}

type UseMarketingHeroBindingDialogOptions = {
    open: boolean
    metahubId: string
    layoutId: string
    widgetId: string | null
    widgetVersion: number | null
    heroObjectId: string | null
    locale: string
    canManageLayouts: boolean
    canEditContent: boolean
    onClose: () => void
    onBindingSaved: () => Promise<void>
}

/** Loads and coordinates the Hero record selection, binding, and content form state. */
export function useMarketingHeroBindingDialog({
    open,
    metahubId,
    layoutId,
    widgetId,
    widgetVersion,
    heroObjectId,
    locale: rawLocale,
    canManageLayouts,
    canEditContent,
    onClose,
    onBindingSaved
}: UseMarketingHeroBindingDialogOptions) {
    const { t } = useCommonTranslations()
    const locale = normalizeLocale(rawLocale)
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(heroObjectId)
    const [recordSearch, setRecordSearch] = useState('')
    const [isRecordSearchActive, setIsRecordSearchActive] = useState(false)
    const [recordFormMode, setRecordFormMode] = useState<HeroRecordFormMode>(null)
    const [isDirectBoundEdit, setIsDirectBoundEdit] = useState(false)
    const [recordFormError, setRecordFormError] = useState<string | null>(null)
    const [recordFieldError, setRecordFieldError] = useState<HeroRecordFieldError | null>(null)
    const [bindingError, setBindingError] = useState<string | null>(null)
    const [isSavingRecord, setIsSavingRecord] = useState(false)
    const [isSavingBinding, setIsSavingBinding] = useState(false)
    const [bindingRefreshRequired, setBindingRefreshRequired] = useState(false)
    const [lastSavedRecord, setLastSavedRecord] = useState<RecordItem | null>(null)
    const initializedWidgetId = useRef<string | null>(null)
    const initialBoundEditWidgetId = useRef<string | null>(null)

    const data = useMarketingHeroBindingData({
        open,
        metahubId,
        layoutId,
        widgetId,
        canManageLayouts,
        canEditContent,
        heroObjectId: selectedSourceId,
        locale,
        selectedRecordId,
        recordSearch,
        lastSavedRecord
    })
    const currentWidgetVersion = data.bindingWidgetVersion ?? widgetVersion

    useEffect(() => {
        if (!open) return
        setRecordSearch('')
        setIsRecordSearchActive(false)
        setRecordFormMode(null)
        setIsDirectBoundEdit(false)
        setRecordFormError(null)
        setRecordFieldError(null)
        setBindingError(null)
        setBindingRefreshRequired(false)
        initialBoundEditWidgetId.current = null
        setSelectedSourceId(heroObjectId)
    }, [heroObjectId, open, widgetId])

    useEffect(() => {
        if (!open || !widgetId || !data.bindingRecordId || initializedWidgetId.current === widgetId) return
        setSelectedRecordId(data.bindingRecordId)
        initializedWidgetId.current = widgetId
    }, [data.bindingRecordId, open, widgetId])

    useEffect(() => {
        const bindingRecordId = data.currentBindingId
        if (
            !open ||
            !widgetId ||
            !canEditContent ||
            !bindingRecordId ||
            selectedRecordId !== bindingRecordId ||
            data.selectedRecord?.id !== bindingRecordId ||
            data.isSelectedRecordFetching ||
            initialBoundEditWidgetId.current === widgetId
        ) {
            return
        }
        initialBoundEditWidgetId.current = widgetId
        setRecordFormMode('edit')
        setIsDirectBoundEdit(true)
    }, [canEditContent, data.currentBindingId, data.isSelectedRecordFetching, data.selectedRecord?.id, open, selectedRecordId, widgetId])

    useEffect(() => {
        if (open) return
        setSelectedRecordId(null)
        setRecordSearch('')
        setIsRecordSearchActive(false)
        setRecordFormMode(null)
        setIsDirectBoundEdit(false)
        setLastSavedRecord(null)
        setRecordFieldError(null)
        setBindingRefreshRequired(false)
        initializedWidgetId.current = null
    }, [open])

    const handleSaveBinding = async () => {
        const selectedRecordVersion = data.selectedRecordVersion
        if (
            !widgetId ||
            !currentWidgetVersion ||
            !selectedRecordId ||
            !selectedRecordVersion ||
            !data.selectedOption ||
            isSavingBinding ||
            bindingRefreshRequired
        )
            return
        setIsSavingBinding(true)
        setBindingError(null)
        try {
            const response = await layoutsApi.updateLayoutZoneWidgetBinding(metahubId, layoutId, widgetId, {
                recordId: selectedRecordId,
                expectedVersion: currentWidgetVersion
            })
            data.setBindingCache({
                recordId: selectedRecordId,
                recordVersion: selectedRecordVersion,
                widgetVersion: response.data.version,
                label: data.selectedOption.label
            })
            await onBindingSaved()
        } catch (error: unknown) {
            if (isVersionConflict(error)) {
                setBindingRefreshRequired(true)
                try {
                    const latestBinding = await data.refreshBindingState()
                    setBindingRefreshRequired(false)
                    setBindingError(
                        t('layouts.marketing.heroAuthoring.bindingVersionConflict', {
                            current: latestBinding.label || t('layouts.marketing.heroAuthoring.noSavedContent', 'No saved content'),
                            selected: data.selectedOption?.label ?? t('layouts.marketing.heroAuthoring.noContentSelected', 'No selection'),
                            defaultValue:
                                'The latest saved content is “{{current}}”. Your selection “{{selected}}” was not saved. Review and save again.'
                        })
                    )
                } catch {
                    setBindingError(
                        t(
                            'layouts.marketing.heroAuthoring.bindingRefreshError',
                            'The layout changed, but its latest binding could not be loaded. Retry before saving.'
                        )
                    )
                }
            } else if (hasHeroActionTargetError(error)) {
                setBindingError(
                    t('layouts.marketing.heroAuthoring.sections.unavailable', 'This section is no longer in the current layout')
                )
            } else {
                setBindingError(
                    t('layouts.marketing.heroAuthoring.bindingSaveError', 'The Hero content selection could not be saved. Try again.')
                )
            }
        } finally {
            setIsSavingBinding(false)
        }
    }

    const handleRecordSubmit = async (submittedData: Record<string, unknown>) => {
        const treeEntityId = data.treeEntityId
        if (!treeEntityId || !selectedSourceId || !canEditContent || isSavingRecord) return
        const wasDirectBoundEdit = isDirectBoundEdit
        setRecordFormError(null)
        setRecordFieldError(null)
        const validation = validateHeroRecordData(submittedData, data.components, locale)
        if (!validation.success) {
            const message =
                validation.error === 'missingLocale'
                    ? t('layouts.marketing.heroAuthoring.missingLocale', 'Add {{field}} in {{locale}} before saving.', {
                          field:
                              data.formFields.find((field) => field.id === validation.field)?.label ??
                              t('layouts.marketing.heroAuthoring.contentField', 'Content field'),
                          locale: t(
                              `layouts.marketing.heroAuthoring.locales.${validation.locale}`,
                              validation.locale === 'en' ? 'English' : 'Russian'
                          )
                      })
                    : validation.error === 'termsGroup'
                    ? t('layouts.marketing.heroAuthoring.termsGroupError', 'Complete all three terms fields or leave them all empty.')
                    : t('layouts.marketing.heroAuthoring.actionError', 'Enter a valid action destination before saving.')
            if (validation.error === 'missingLocale') {
                setRecordFieldError({ fieldId: validation.field, locale: validation.locale, message })
            } else {
                setRecordFormError(message)
            }
            return
        }

        const activeSectionTargets = new Set(data.actionSectionTargets.map(({ href }) => href))
        const anchorTargetUnavailable = data.components.some((component) => {
            if (component.validationRules?.format !== 'marketingAction') return false
            const action = submittedData[getHeroComponentKey(component)]
            return isRecord(action) && action.kind === 'anchor' && !activeSectionTargets.has(String(action.href))
        })
        if (anchorTargetUnavailable) {
            setRecordFormError(
                data.actionSectionTargetsState === 'ready'
                    ? t('layouts.marketing.heroAuthoring.sections.unavailable', 'This section is no longer in the current layout')
                    : t(
                          'layouts.marketing.heroAuthoring.actionTargetsUnavailable',
                          'Active page sections could not be loaded. Retry before saving.'
                      )
            )
            return
        }

        setIsSavingRecord(true)
        try {
            let savedRecord: RecordItem
            if (recordFormMode === 'edit' && data.selectedRecord) {
                const recordData = { ...data.selectedRecord.data, ...validation.data }
                for (const field of data.formFields) {
                    if (!Object.prototype.hasOwnProperty.call(validation.data, field.id) && !field.required) recordData[field.id] = null
                }
                const semanticKeyField = data.components.find((component) => getHeroComponentKey(component) === 'HeroKey')
                if (semanticKeyField)
                    recordData[getHeroComponentKey(semanticKeyField)] = data.selectedRecord.data[getHeroComponentKey(semanticKeyField)]
                const response = await recordsApi.updateRecord(metahubId, treeEntityId, selectedSourceId!, data.selectedRecord.id, {
                    data: recordData,
                    expectedVersion: data.selectedRecord.version
                })
                savedRecord = response.data
            } else {
                const response = await recordsApi.createRecord(metahubId, treeEntityId, selectedSourceId!, {
                    data: validation.data
                })
                savedRecord = response.data
            }

            setLastSavedRecord(savedRecord)
            setSelectedRecordId(savedRecord.id)
            setRecordFormMode(null)
            setIsDirectBoundEdit(false)
            await data.invalidateHeroRecords(savedRecord.id)
            if (wasDirectBoundEdit && !canManageLayouts) onClose()
        } catch (error: unknown) {
            setRecordFormError(
                isVersionConflict(error)
                    ? t(
                          'layouts.marketing.heroAuthoring.recordVersionConflict',
                          'This Hero record changed in another session. Close and reopen the form to load the latest content.'
                      )
                    : t(
                          'layouts.marketing.heroAuthoring.recordSaveError',
                          'Hero content could not be saved. Check the fields and try again.'
                      )
            )
        } finally {
            setIsSavingRecord(false)
        }
    }

    const handleRecordInputChange = (value: string, reason: string) => {
        if (reason === 'input') {
            setRecordSearch(value)
            data.setRecordPage(0)
            setIsRecordSearchActive(true)
        } else if (reason === 'clear') {
            setRecordSearch('')
            data.setRecordPage(0)
            setIsRecordSearchActive(false)
            setSelectedRecordId(null)
        }
    }

    const handleRecordChange = (option: HeroRecordOption | null) => {
        setSelectedRecordId(option?.id ?? null)
        setRecordSearch('')
        data.setRecordPage(0)
        setIsRecordSearchActive(false)
        setBindingError(null)
    }

    const handleSourceChange = (sourceId: string | null) => {
        setSelectedSourceId(sourceId)
        setSelectedRecordId(null)
        setRecordSearch('')
        setIsRecordSearchActive(false)
        data.setRecordPage(0)
        setBindingError(null)
    }

    const handleProvisionSource = async (input: { codename: string; name: string }) => {
        const response = await layoutsApi.provisionWidgetBindingSource(metahubId, layoutId, 'marketing.hero', 'content', input)
        data.setSourceCache(response.data.source)
        handleSourceChange(response.data.source.entityId)
        setSelectedRecordId(response.data.initialRecord.recordId)
        return response.data
    }

    const openRecordForm = (mode: Exclude<HeroRecordFormMode, null>) => {
        setRecordFormError(null)
        setRecordFieldError(null)
        setIsDirectBoundEdit(false)
        setRecordFormMode(mode)
    }

    const closeRecordForm = () => {
        const wasDirectBoundEdit = isDirectBoundEdit
        setRecordFormMode(null)
        setIsDirectBoundEdit(false)
        setRecordFormError(null)
        setRecordFieldError(null)
        if (wasDirectBoundEdit) onClose()
    }

    const chooseAnotherRecord = () => {
        if (!canManageLayouts || isSavingRecord) return
        setRecordFormMode(null)
        setIsDirectBoundEdit(false)
        setRecordFormError(null)
        setRecordFieldError(null)
    }

    const isBindingDirty = Boolean(widgetId && selectedRecordId && data.currentBindingId && selectedRecordId !== data.currentBindingId)
    const selectedBindingReady = Boolean(selectedRecordId && data.selectedRecordVersion && currentWidgetVersion && !bindingRefreshRequired)
    const canConfigure = Boolean(
        canManageLayouts && selectedRecordId && (!widgetId || (data.currentBindingId && data.currentBindingId === selectedRecordId))
    )

    return {
        ...data,
        locale,
        selectedRecordId,
        selectedSourceId,
        recordSearch,
        recordPage: data.recordPage,
        recordPageCount: data.recordPageCount,
        setRecordPage: data.setRecordPage,
        isRecordSearchActive,
        isBindingDirty,
        isDirectBoundEdit,
        recordFormInitialData: recordFormMode === 'edit' ? data.selectedRecord?.data : data.defaultCreateData,
        bindingError,
        recordFormMode,
        recordFormError,
        recordFieldError,
        clearRecordFieldError: () => setRecordFieldError(null),
        isSavingRecord,
        isSavingBinding,
        selectedBindingReady,
        canConfigure,
        handleRecordInputChange,
        handleRecordChange,
        handleSourceChange,
        handleProvisionSource,
        openRecordForm,
        closeRecordForm,
        chooseAnotherRecord,
        handleSaveBinding,
        handleRecordSubmit,
        handleRetry: async () => {
            data.retry()
            if (!bindingRefreshRequired) return
            try {
                await data.refreshBindingState()
                setBindingRefreshRequired(false)
            } catch {
                setBindingError(
                    t(
                        'layouts.marketing.heroAuthoring.bindingRefreshError',
                        'The layout changed, but its latest binding could not be loaded. Retry before saving.'
                    )
                )
            }
        }
    }
}
