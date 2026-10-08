import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { DynamicEntityFormFieldError, DynamicFieldConfig } from '@universo-react/template-mui/components/dialogs'
import type { WidgetBindingSlotDefinition } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import * as recordsApi from '../../entities/metadata/record/api'
import { invalidateRecordsQueries, metahubsQueryKeys } from '../../shared'
import type { Component, RecordItem } from '../../../types'
import {
    getRecordLabel,
    readSemanticKey,
    resolveRequiredLocaleValidationError,
    type DraftBinding,
    type RecordFormMode
} from './marketingWidgetBindingDialogModel'
import { findRecordBySemanticKey } from './marketingWidgetBindingRecordLookup'

type Translate = (key: string, options?: { defaultValue?: string; field?: string; locale?: string }) => string

type UseMarketingWidgetBindingRecordFormParams = {
    metahubId: string
    layoutId: string
    widgetKey: string
    locale: 'en' | 'ru'
    variant: string
    canEditContent: boolean
    activeSlot: WidgetBindingSlotDefinition | undefined
    activeDraft: DraftBinding | undefined
    sourceEntity: { id: string } | null
    sourceEntityKind?: 'object' | 'page'
    treeEntityId: string | null
    canCreateRecord: boolean
    semanticKeyRequirement: { componentCodename: string } | undefined
    recordComponents: readonly Component[]
    recordFields: readonly DynamicFieldConfig[]
    updateDraft: (slotKey: string, nextDraft: DraftBinding | undefined) => void
    t: Translate
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export function useMarketingWidgetBindingRecordForm({
    metahubId,
    layoutId,
    widgetKey,
    locale,
    variant,
    canEditContent,
    activeSlot,
    activeDraft,
    sourceEntity,
    sourceEntityKind,
    treeEntityId,
    canCreateRecord,
    semanticKeyRequirement,
    recordComponents,
    recordFields,
    updateDraft,
    t
}: UseMarketingWidgetBindingRecordFormParams) {
    const queryClient = useQueryClient()
    const [recordFormMode, setRecordFormMode] = useState<RecordFormMode | null>(null)
    const [recordFormInitialData, setRecordFormInitialData] = useState<Record<string, unknown> | undefined>()
    const [recordFormTarget, setRecordFormTarget] = useState<RecordItem | null>(null)
    const [recordFormError, setRecordFormError] = useState<string | null>(null)
    const [recordFieldError, setRecordFieldError] = useState<DynamicEntityFormFieldError | null>(null)
    const [isRecordSaving, setIsRecordSaving] = useState(false)
    const [isRecordResolving, setIsRecordResolving] = useState(false)

    const closeRecordForm = (force = false) => {
        if (isRecordSaving && !force) return
        setRecordFormMode(null)
        setRecordFormInitialData(undefined)
        setRecordFormTarget(null)
        setRecordFormError(null)
        setRecordFieldError(null)
    }

    const openCreateRecord = () => {
        if (!canCreateRecord || !canEditContent || !activeDraft || activeDraft.selectorKind !== 'semantic-key' || !sourceEntity) return
        setRecordFormMode('create')
        setRecordFormInitialData(
            Object.fromEntries(recordFields.filter(({ required, type }) => required && type === 'BOOLEAN').map(({ id }) => [id, false]))
        )
        setRecordFormTarget(null)
        setRecordFormError(null)
        setRecordFieldError(null)
    }

    const openEditRecord = async () => {
        if (!canEditContent || !activeSlot || !activeDraft?.semanticKey || !semanticKeyRequirement || !sourceEntity) return
        setIsRecordResolving(true)
        setRecordFormError(null)
        try {
            const record = await findRecordBySemanticKey(
                metahubId,
                treeEntityId,
                sourceEntity.id,
                semanticKeyRequirement.componentCodename,
                activeDraft.semanticKey,
                sourceEntityKind
            )
            setRecordFormTarget(record)
            setRecordFormInitialData(record.data ?? {})
            setRecordFormMode('edit')
        } catch {
            setRecordFormError(
                t('layouts.widgetBindings.recordLoadError', { defaultValue: 'The selected content record could not be loaded.' })
            )
        } finally {
            setIsRecordResolving(false)
        }
    }

    const saveRecordForm = async (submittedData: Record<string, unknown>) => {
        if (!canEditContent || !activeSlot || !activeDraft || !sourceEntity || !semanticKeyRequirement) return
        if (recordFormMode !== 'edit' && !canCreateRecord) return
        setIsRecordSaving(true)
        setRecordFormError(null)
        setRecordFieldError(null)
        try {
            const isEditingRecord = recordFormMode === 'edit' && Boolean(recordFormTarget)
            const semanticKeyField = semanticKeyRequirement.componentCodename
            const existingSemanticKey = submittedData[semanticKeyField]
            const recordData = isEditingRecord
                ? submittedData
                : {
                      ...submittedData,
                      [semanticKeyField]:
                          typeof existingSemanticKey === 'string' && existingSemanticKey.trim()
                              ? existingSemanticKey
                              : `content-${generateUuidV7()}`
                  }
            const kindKey = sourceEntityKind && sourceEntityKind !== 'object' ? { kindKey: sourceEntityKind } : {}
            const expectedVersion =
                recordFormMode === 'edit' &&
                recordFormTarget &&
                Number.isSafeInteger(recordFormTarget.version) &&
                recordFormTarget.version > 0
                    ? { expectedVersion: recordFormTarget.version }
                    : {}
            const recordResponse =
                recordFormMode === 'edit' && recordFormTarget
                    ? treeEntityId
                        ? await recordsApi.updateRecord(metahubId, treeEntityId, sourceEntity.id, recordFormTarget.id, {
                              data: recordData,
                              ...kindKey,
                              ...expectedVersion
                          })
                        : await recordsApi.updateRecordDirect(metahubId, sourceEntity.id, recordFormTarget.id, {
                              data: recordData,
                              ...kindKey,
                              ...expectedVersion
                          })
                    : treeEntityId
                    ? await recordsApi.createRecord(metahubId, treeEntityId, sourceEntity.id, { data: recordData, ...kindKey })
                    : await recordsApi.createRecordDirect(metahubId, sourceEntity.id, { data: recordData, ...kindKey })
            const record = recordResponse.data
            const semanticKey = readSemanticKey(activeSlot, record.data ?? recordData)
            if (!semanticKey) throw new Error('MARKETING_WIDGET_CREATED_RECORD_KEY_MISSING')
            const selectionLabel = getRecordLabel(
                record.data ?? recordData,
                recordComponents,
                locale,
                t('layouts.widgetBindings.untitledRecord', { defaultValue: 'Untitled content record' })
            )
            updateDraft(activeSlot.key, { ...activeDraft, semanticKey, selectionLabel })
            await Promise.all([
                treeEntityId
                    ? invalidateRecordsQueries.all(queryClient, metahubId, treeEntityId, sourceEntity.id)
                    : queryClient.invalidateQueries({
                          queryKey: metahubsQueryKeys.recordsDirect(metahubId, sourceEntity.id, sourceEntityKind)
                      }),
                queryClient.invalidateQueries({
                    queryKey: [
                        ...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
                        'widgetBindingRecords',
                        widgetKey,
                        activeSlot.key,
                        activeDraft.sourceKey,
                        variant
                    ]
                }),
                queryClient.invalidateQueries({
                    queryKey: [
                        ...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId),
                        'widgetBindingSources',
                        widgetKey,
                        activeSlot.key
                    ]
                })
            ])
            closeRecordForm(true)
        } catch (error: unknown) {
            const responseData = asRecord(asRecord(asRecord(error).response).data)
            const validationErrors =
                responseData.code === 'VALIDATION_ERROR' && Array.isArray(responseData.fields)
                    ? responseData.fields.filter((value): value is string => typeof value === 'string')
                    : []
            const fieldError = resolveRequiredLocaleValidationError(validationErrors, recordFields, t, submittedData)
            if (fieldError) {
                setRecordFieldError(fieldError)
                setRecordFormError(null)
            } else {
                setRecordFormError(
                    t('layouts.widgetBindings.recordSaveError', {
                        defaultValue: 'The content record could not be saved. Review the fields and try again.'
                    })
                )
            }
        } finally {
            setIsRecordSaving(false)
        }
    }

    return {
        state: {
            recordFormMode,
            recordFormInitialData,
            recordFormError,
            recordFieldError,
            isRecordSaving,
            isRecordResolving
        },
        actions: {
            closeRecordForm,
            openCreateRecord,
            openEditRecord,
            saveRecordForm,
            setRecordFieldError
        }
    }
}
