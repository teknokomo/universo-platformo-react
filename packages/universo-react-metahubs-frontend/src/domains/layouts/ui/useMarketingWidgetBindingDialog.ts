import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebouncedSearch } from '@universo-react/template-mui'
import { useCommonTranslations } from '@universo-react/i18n'
import { encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'
import { replaceLayoutZoneWidgetBindings, type WidgetBindingRecordOption, type WidgetBindingSourceOption } from '../api'
import { metahubsQueryKeys } from '../../shared'
import {
    createBindingEnvelope,
    EMPTY_MARKETING_ACTION_SECTION_TARGETS,
    EMPTY_WIDGET_BINDING_SLOTS,
    makeApiSelector,
    normalizeLocale,
    sameBindings,
    toDraftBindings,
    type DraftBinding,
    type MarketingWidgetBindingDialogProps
} from './marketingWidgetBindingDialogModel'
import { useMarketingWidgetBindingDialogData } from './useMarketingWidgetBindingDialogData'
import { useMarketingWidgetBindingRecordCopy } from './useMarketingWidgetBindingRecordCopy'
import { useMarketingWidgetBindingRecordForm } from './useMarketingWidgetBindingRecordForm'
import { useMarketingWidgetBindingSourceProvision } from './useMarketingWidgetBindingSourceProvision'
import { useMarketingWidgetBindingSelectionState } from './useMarketingWidgetBindingSelectionState'

export function useMarketingWidgetBindingDialog(props: MarketingWidgetBindingDialogProps) {
    const {
        open,
        metahubId,
        layoutId,
        widgetKey,
        templateKey = 'marketing-page',
        zone,
        widgetId,
        sourceWidgetId = null,
        duplicateMode = false,
        rendererConfigPending = false,
        openSelectedRecordOnOpen = false,
        widgetVersion,
        rendererConfig,
        sectionTargets = EMPTY_MARKETING_ACTION_SECTION_TARGETS,
        locale: rawLocale,
        canManageLayouts,
        canEditContent,
        onClose,
        onBindingSaved,
        onSelection,
        onConfigurePresentation
    } = props

    const { t } = useCommonTranslations()
    const queryClient = useQueryClient()
    const locale = normalizeLocale(rawLocale)
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    const slots = definition?.bindingSlots ?? EMPTY_WIDGET_BINDING_SLOTS
    const initialBindingSlotKey =
        rendererConfigPending && definition?.initialBindingSlotKey && slots.some(({ key }) => key === definition.initialBindingSlotKey)
            ? definition.initialBindingSlotKey
            : slots[0]?.key ?? ''
    const slotSignature = slots.map(({ key }) => key).join('|')
    const placementId = widgetId ?? sourceWidgetId
    const variant = typeof rendererConfig.variant === 'string' ? rendererConfig.variant : ''
    const identity = `${metahubId}:${layoutId}:${placementId ?? ''}:${widgetKey}:${variant}:${locale}:${slotSignature}`
    const [activeSlotKey, setActiveSlotKey] = useState(initialBindingSlotKey)
    const [draftBindings, setDraftBindings] = useState<Record<string, DraftBinding>>({})
    const [hydratedIdentity, setHydratedIdentity] = useState('')
    const [saveError, setSaveError] = useState(false)
    const [attemptedSubmit, setAttemptedSubmit] = useState(false)
    const [focusTarget, setFocusTarget] = useState<{ slotKey: string; control: 'source' | 'record' } | null>(null)
    const autocompleteRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const sourceProvisionNameInputRef = useRef<HTMLInputElement | null>(null)
    const autoDuplicateIdentityRef = useRef<string | null>(null)
    const autoOpenRecordIdentityRef = useRef<string | null>(null)
    const [sourceSearch, setSourceSearch] = useState('')
    const [recordSearch, setRecordSearch] = useState('')
    const { setSearchValue: setSourceSearchValue } = useDebouncedSearch({ onSearchChange: setSourceSearch, delay: 200 })
    const { setSearchValue: setRecordSearchValue } = useDebouncedSearch({ onSearchChange: setRecordSearch, delay: 200 })
    const [isCreatingSelection, setIsCreatingSelection] = useState(false)

    useEffect(() => {
        setAttemptedSubmit(false)
        setFocusTarget(null)
    }, [identity, open])

    const activeSlot = slots.find(({ key }) => key === activeSlotKey) ?? slots[0]
    const activeDraft = activeSlot ? draftBindings[activeSlot.key] : undefined
    const parentDraft = activeSlot?.relation ? draftBindings[activeSlot.relation.parentSlot] : undefined
    const parentSignature = parentDraft
        ? [parentDraft.sourceKey, parentDraft.selectorKind, parentDraft.semanticKey ?? ''].join(':')
        : 'missing'
    const relationSlotsWithDraft = slots.filter(
        (slot) => slot.relation && draftBindings[slot.key]?.sourceKey && draftBindings[slot.relation.parentSlot]?.sourceKey
    )

    const {
        bindingQuery,
        hubsQuery,
        objectsQuery,
        pagesQuery,
        componentsQuery,
        sourcesQuery,
        recordsQuery,
        relationChecksReady,
        relationCheckFailed,
        incompatibleRelationSlot,
        shouldLoadRecordMetadata,
        sourceMetadataReady,
        treeEntityId,
        sourceEntity,
        sourceEntityKind,
        recordComponents,
        recordFields,
        hasUnsupportedRequiredFields,
        semanticKeyRequirement,
        sourceOptions,
        recordOptions,
        activeSourceOption,
        activeRecordOption
    } = useMarketingWidgetBindingDialogData({
        metahubId,
        layoutId,
        widgetKey,
        widgetId,
        open,
        canManageLayouts,
        canEditContent,
        placementId,
        locale,
        variant,
        activeSlot,
        activeDraft,
        parentDraft,
        parentSignature,
        relationSlotsWithDraft,
        draftBindings,
        sourceSearch,
        recordSearch,
        t
    })

    useEffect(() => {
        if (!open) {
            autoDuplicateIdentityRef.current = null
            setDraftBindings({})
            setHydratedIdentity('')
            setSaveError(false)
            setAttemptedSubmit(false)
            setFocusTarget(null)
            setActiveSlotKey(initialBindingSlotKey)
            return
        }
        if (!placementId && hydratedIdentity !== identity) {
            setDraftBindings({})
            setHydratedIdentity(identity)
            return
        }
        if (bindingQuery.data && hydratedIdentity !== identity) {
            const bindings = toDraftBindings(bindingQuery.data.bindings)
            setDraftBindings(bindings)
            setHydratedIdentity(identity)
        }
    }, [bindingQuery.data, hydratedIdentity, identity, initialBindingSlotKey, open, placementId, slotSignature, slots])

    useEffect(() => {
        setActiveSlotKey(initialBindingSlotKey)
    }, [initialBindingSlotKey, slotSignature, variant])

    useEffect(() => {
        setSourceSearchValue('')
        setRecordSearchValue('')
    }, [activeSlot?.key, activeDraft?.sourceKey, identity, setRecordSearchValue, setSourceSearchValue])

    const incompatibleRelationSlotKey = incompatibleRelationSlot?.key

    useEffect(() => {
        if (incompatibleRelationSlotKey) setActiveSlotKey(incompatibleRelationSlotKey)
    }, [incompatibleRelationSlotKey])

    useEffect(() => {
        if (!focusTarget || activeSlotKey !== focusTarget.slotKey) return
        autocompleteRefs.current[`${focusTarget.slotKey}:${focusTarget.control}`]?.querySelector('input')?.focus()
        setFocusTarget(null)
    }, [activeSlotKey, focusTarget])

    const { missingRequiredSlots, isSelectionValid, focusFirstInvalidSlot } = useMarketingWidgetBindingSelectionState({
        slots,
        draftBindings,
        incompatibleRelationSlot,
        relationChecksReady,
        setActiveSlotKey,
        setFocusTarget
    })
    const isBindingReady = widgetId ? hydratedIdentity === identity && Boolean(bindingQuery.data) : hydratedIdentity === identity

    const invalidateBindingQueries = async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.layoutZoneWidgetBinding(metahubId, layoutId, placementId ?? '', locale)
            }),
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
        ])
    }

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!widgetId || !bindingQuery.data) throw new Error('MARKETING_WIDGET_BINDING_CONTEXT_UNAVAILABLE')
            const bindings = slots
                .filter((slot) => draftBindings[slot.key])
                .map((slot) => {
                    const draft = draftBindings[slot.key]
                    if (!draft) throw new Error('MARKETING_WIDGET_BINDING_SELECTION_INVALID')
                    return { slot: slot.key, sourceKey: draft.sourceKey, selector: makeApiSelector(slot, draft) }
                })
            return replaceLayoutZoneWidgetBindings(metahubId, layoutId, widgetId, {
                expectedVersion: bindingQuery.data.version ?? widgetVersion ?? 0,
                bindings,
                ...(rendererConfigPending ? { rendererConfig } : {}),
                locale
            })
        },
        onSuccess: async () => {
            setSaveError(false)
            await invalidateBindingQueries()
            await onBindingSaved?.()
            if (rendererConfigPending) onClose()
        },
        onError: () => setSaveError(true)
    })

    const slotLabel = (slotKey: string) => {
        const slot = slots.find(({ key }) => key === slotKey)
        if (!slot) return ''
        return t(slot.authoring.labelKey, { defaultValue: slot.authoring.defaultLabel })
    }

    const updateDraft = (slotKey: string, nextDraft: DraftBinding | undefined) => {
        setDraftBindings((current) => {
            const next = { ...current }
            if (nextDraft) next[slotKey] = nextDraft
            else delete next[slotKey]
            return next
        })
        setSaveError(false)
    }

    const handleSourceChange = (source: WidgetBindingSourceOption | null) => {
        if (!activeSlot) return
        if (!source) {
            updateDraft(activeSlot.key, undefined)
            return
        }
        const selectorKind =
            source.selectorKinds.find((kind) => activeSlot.selectorKinds.includes(kind) && kind === activeDraft?.selectorKind) ??
            source.selectorKinds.find((kind) => activeSlot.selectorKinds.includes(kind))
        if (!selectorKind) return
        updateDraft(activeSlot.key, {
            sourceKey: source.sourceKey,
            sourceName: source.label,
            selectorKind,
            ...(source.sourceKey === activeDraft?.sourceKey && activeDraft.selectorKind === selectorKind
                ? {
                      entityKind: activeDraft.entityKind,
                      semanticKey: activeDraft.semanticKey,
                      selectionLabel: activeDraft.selectionLabel
                  }
                : {})
        })
    }

    useEffect(() => {
        if (!open || !activeSlot || !activeDraft || !sourceEntityKind || activeDraft.entityKind === sourceEntityKind) return
        setDraftBindings((current) => {
            const currentDraft = current[activeSlot.key]
            if (!currentDraft || currentDraft.sourceKey !== activeDraft.sourceKey || currentDraft.entityKind === sourceEntityKind)
                return current
            return { ...current, [activeSlot.key]: { ...currentDraft, entityKind: sourceEntityKind } }
        })
    }, [activeDraft, activeSlot, open, sourceEntityKind])

    const sourceProvision = useMarketingWidgetBindingSourceProvision({
        metahubId,
        layoutId,
        widgetKey,
        locale,
        variant,
        activeSlot,
        activeDraft,
        parentDraft,
        onSourceChange: handleSourceChange
    })
    const {
        sourceProvisionMutation,
        sourceProvisionOpen,
        sourceProvisionName,
        sourceProvisionError,
        setSourceProvisionName,
        setSourceProvisionError,
        openSourceProvision,
        closeSourceProvision
    } = sourceProvision

    useEffect(() => {
        if (sourceProvisionOpen) sourceProvisionNameInputRef.current?.focus()
    }, [sourceProvisionOpen])

    const handleRecordChange = (record: WidgetBindingRecordOption | null) => {
        if (!activeSlot || !activeDraft || activeDraft.selectorKind !== 'semantic-key') return
        updateDraft(
            activeSlot.key,
            record
                ? { ...activeDraft, semanticKey: record.semanticKey, selectionLabel: record.label }
                : { ...activeDraft, semanticKey: undefined, selectionLabel: undefined }
        )
    }

    const recordForm = useMarketingWidgetBindingRecordForm({
        metahubId,
        layoutId,
        widgetKey,
        locale,
        variant,
        canEditContent,
        canCreateRecord: !hasUnsupportedRequiredFields,
        activeSlot,
        activeDraft,
        sourceEntity,
        sourceEntityKind,
        treeEntityId,
        semanticKeyRequirement,
        recordComponents,
        recordFields,
        updateDraft,
        t
    })
    const { isRecordSaving, isRecordResolving } = recordForm.state
    const { openEditRecord } = recordForm.actions

    useEffect(() => {
        if (!open || !openSelectedRecordOnOpen) {
            autoOpenRecordIdentityRef.current = null
            return
        }
        if (autoOpenRecordIdentityRef.current === identity) return
        if (recordForm.state.recordFormMode) {
            autoOpenRecordIdentityRef.current = identity
            return
        }
        if (
            definition?.authoring.metahub.contentEditing !== 'single-record' ||
            !widgetId ||
            !canEditContent ||
            !isBindingReady ||
            !activeDraft?.semanticKey ||
            !componentsQuery.isSuccess ||
            recordFields.length === 0
        ) {
            return
        }
        autoOpenRecordIdentityRef.current = identity
        void openEditRecord()
    }, [
        activeDraft?.semanticKey,
        canEditContent,
        componentsQuery.isSuccess,
        definition?.authoring.metahub.contentEditing,
        identity,
        isBindingReady,
        open,
        openSelectedRecordOnOpen,
        recordFields.length,
        openEditRecord,
        recordForm.state.recordFormMode,
        widgetId,
        widgetKey
    ])

    const copySelectedRecord = useMarketingWidgetBindingRecordCopy({
        metahubId,
        shouldCloneRecord: Boolean(duplicateMode && definition?.authoring?.metahub.duplicate === 'clone-record'),
        slots,
        sourceEntity,
        sourceEntityKind,
        treeEntityId
    })

    const handleCreateSelection = useCallback(async () => {
        if (isCreatingSelection) return
        if (!isSelectionValid) {
            setAttemptedSubmit(true)
            focusFirstInvalidSlot()
            return
        }
        if (
            !canManageLayouts ||
            !isBindingReady ||
            !sourceMetadataReady ||
            sourcesQuery.isError ||
            recordsQuery.isError ||
            relationCheckFailed
        )
            return
        setIsCreatingSelection(true)
        setSaveError(false)
        try {
            const draftSelections =
                activeSlot && activeDraft && sourceEntityKind
                    ? { ...draftBindings, [activeSlot.key]: { ...activeDraft, entityKind: sourceEntityKind } }
                    : draftBindings
            const copyResult = await copySelectedRecord(draftSelections)
            const selections = copyResult.selections
            const bindings = createBindingEnvelope(widgetKey, rendererConfig, slots, selections)
            const config = encodeWidgetConfigEnvelope(
                { rendererConfig, neutral: { bindings } },
                { templateKey, widgetKey, zone, rendererConfig }
            )
            await onSelection({ bindings, config, ...(copyResult.recordCopy ? { recordCopy: copyResult.recordCopy } : {}) })
        } catch {
            setSaveError(true)
        } finally {
            setIsCreatingSelection(false)
        }
    }, [
        canManageLayouts,
        activeDraft,
        activeSlot,
        copySelectedRecord,
        draftBindings,
        focusFirstInvalidSlot,
        isBindingReady,
        isCreatingSelection,
        isSelectionValid,
        onSelection,
        recordsQuery.isError,
        relationCheckFailed,
        rendererConfig,
        slots,
        sourcesQuery.isError,
        sourceMetadataReady,
        sourceEntityKind,
        templateKey,
        widgetKey,
        zone
    ])

    const handleConfigurePresentation = () => {
        if (!isSelectionValid || !sourceMetadataReady || !onConfigurePresentation) return
        const selections =
            activeSlot && activeDraft && sourceEntityKind
                ? { ...draftBindings, [activeSlot.key]: { ...activeDraft, entityKind: sourceEntityKind } }
                : draftBindings
        const bindings = createBindingEnvelope(widgetKey, rendererConfig, slots, selections)
        const config = encodeWidgetConfigEnvelope(
            { rendererConfig, neutral: { bindings } },
            { templateKey, widgetKey, zone, rendererConfig }
        )
        onConfigurePresentation({ bindings, config })
    }

    const handleSave = () => {
        if (!isSelectionValid) {
            setAttemptedSubmit(true)
            focusFirstInvalidSlot()
            return
        }
        if (!canManageLayouts || !isBindingReady || !widgetId || !bindingQuery.data) return
        updateMutation.mutate()
    }

    const isInitialBindingLoading = open && Boolean(placementId) && bindingQuery.isLoading
    const isDirty =
        Boolean(placementId) && (rendererConfigPending || !sameBindings(draftBindings, toDraftBindings(bindingQuery.data?.bindings ?? [])))
    const hasDiscoveryError = sourcesQuery.isError || recordsQuery.isError || relationCheckFailed
    const canSubmit =
        canManageLayouts &&
        !updateMutation.isPending &&
        isBindingReady &&
        !bindingQuery.isError &&
        !hasDiscoveryError &&
        relationChecksReady
    const requiresRecordCopy = duplicateMode && definition?.authoring?.metahub.duplicate === 'clone-record'
    const canCreatePlacement =
        canManageLayouts &&
        isBindingReady &&
        sourceMetadataReady &&
        !isCreatingSelection &&
        !hasDiscoveryError &&
        relationChecksReady &&
        (!requiresRecordCopy ||
            Boolean(
                sourceEntity && semanticKeyRequirement && !componentsQuery.isLoading && !componentsQuery.isError && !recordsQuery.isLoading
            ))

    useEffect(() => {
        if (!open) {
            autoDuplicateIdentityRef.current = null
            return
        }
        if (
            !duplicateMode ||
            !requiresRecordCopy ||
            !canCreatePlacement ||
            !isSelectionValid ||
            autoDuplicateIdentityRef.current === identity
        ) {
            return
        }
        autoDuplicateIdentityRef.current = identity
        void handleCreateSelection()
    }, [canCreatePlacement, duplicateMode, handleCreateSelection, identity, isSelectionValid, open, requiresRecordCopy])
    const title = definition ? t(definition.labelKey, { defaultValue: definition.defaultLabel }) : widgetKey
    const isBusy =
        updateMutation.isPending || sourceProvisionMutation.isPending || isCreatingSelection || isRecordSaving || isRecordResolving

    return {
        dialog: {
            open,
            widgetId,
            canManageLayouts,
            canEditContent,
            openSelectedRecordOnOpen,
            onClose,
            onConfigurePresentation,
            rawLocale,
            sectionTargets
        },
        state: {
            saveError,
            attemptedSubmit,
            draftBindings,
            ...recordForm.state,
            isCreatingSelection,
            sourceProvisionOpen,
            sourceProvisionName,
            sourceProvisionError
        },
        queries: {
            bindingQuery,
            updateMutation,
            sourcesQuery,
            recordsQuery,
            sourceProvisionMutation,
            hubsQuery,
            objectsQuery,
            pagesQuery,
            componentsQuery
        },
        data: {
            title,
            isBusy,
            canSubmit,
            isDirty,
            canCreatePlacement,
            isInitialBindingLoading,
            isBindingReady,
            placementId,
            slots,
            missingRequiredSlots,
            activeSlot,
            activeDraft,
            sourceOptions,
            recordOptions,
            activeSourceOption,
            activeRecordOption,
            incompatibleRelationSlot,
            sourceEntity,
            shouldLoadRecordMetadata,
            recordFields,
            hasUnsupportedRequiredFields
        },
        actions: {
            handleConfigurePresentation,
            handleSave,
            handleCreateSelection,
            setActiveSlotKey,
            slotLabel,
            updateDraft,
            handleSourceChange,
            openSourceProvision,
            closeSourceProvision,
            handleRecordChange,
            ...recordForm.actions,
            setSourceProvisionName,
            setSourceProvisionError,
            setSourceSearchValue,
            setRecordSearchValue
        },
        refs: { autocompleteRefs, sourceProvisionNameInputRef },
        t
    }
}

export type MarketingWidgetBindingDialogViewModel = ReturnType<typeof useMarketingWidgetBindingDialog>
