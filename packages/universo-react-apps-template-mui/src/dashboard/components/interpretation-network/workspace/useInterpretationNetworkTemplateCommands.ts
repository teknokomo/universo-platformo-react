import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import {
    deleteInterpretationNetworkTemplate,
    fetchInterpretationNetworkTemplateDetail,
    fetchInterpretationNetworkTemplates,
    saveInterpretationNetworkTemplate,
    updateInterpretationNetworkTemplate
} from '../../../../api/interpretationNetwork'
import type { RuntimeRow } from '../model'
import type { StructureSummary } from './StructurePane'
import { readRuntimeRowVersion } from './workspaceRuntime'

interface UseInterpretationNetworkTemplateCommandsOptions {
    apiBaseUrl?: string
    applicationId?: string
    workspaceId?: string | null
    widgetId?: string | null
    layoutId?: string | null
    enabled: boolean
    locale: string
    canCreateContent: boolean
    canEditContent: boolean
    canDeleteContent: boolean
    selectedConcept?: RuntimeRow
    structureSummaries: StructureSummary[]
    closeStructureMenu: () => void
    t: TFunction<'interpretationNetwork'>
}

export function useInterpretationNetworkTemplateCommands({
    apiBaseUrl,
    applicationId,
    workspaceId,
    widgetId,
    layoutId,
    enabled,
    locale,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    selectedConcept,
    structureSummaries,
    closeStructureMenu,
    t
}: UseInterpretationNetworkTemplateCommandsOptions) {
    const queryClient = useQueryClient()
    const templatesQuery = useQuery({
        queryKey: ['interpretationNetworkTemplates', applicationId, workspaceId],
        enabled,
        queryFn: () =>
            fetchInterpretationNetworkTemplates({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                workspaceId,
                widgetId,
                layoutId
            })
    })
    const [templateDialogMode, setTemplateDialogMode] = useState<'save' | 'edit' | null>(null)
    const [structureCreateSource, setStructureCreateSource] = useState<'blank' | 'template'>('blank')
    const [structureCreateTemplateId, setStructureCreateTemplateId] = useState('')
    const [templateActionId, setTemplateActionId] = useState<string | null>(null)
    const [saveTemplateSourceStructureId, setSaveTemplateSourceStructureId] = useState<string | null>(null)
    const [templateDialogError, setTemplateDialogError] = useState<string | null>(null)
    const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
    const templateDetailQuery = useQuery({
        queryKey: ['interpretationNetworkTemplateDetail', applicationId, workspaceId, openTemplateId],
        enabled: enabled && Boolean(openTemplateId),
        queryFn: () =>
            fetchInterpretationNetworkTemplateDetail({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                workspaceId,
                templateId: openTemplateId!,
                widgetId,
                layoutId
            })
    })

    const saveTemplateMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const sourceStructureId = saveTemplateSourceStructureId ?? selectedConcept?.id
            const sourceStructure = structureSummaries.find((structure) => structure.id === sourceStructureId)
            if (!canCreateContent || !canEditContent || !sourceStructureId || !apiBaseUrl || !applicationId) {
                throw new Error('permission-denied')
            }
            return saveInterpretationNetworkTemplate({
                apiBaseUrl,
                applicationId,
                workspaceId,
                sourceStructureId,
                templateName: data.templateName,
                description: data.description,
                includeMaterials: data.templatePolicy === 'withMaterials',
                expectedVersion: readRuntimeRowVersion(sourceStructure?.row),
                locale,
                widgetId,
                layoutId
            })
        },
        onSuccess: async () => {
            setTemplateDialogMode(null)
            setTemplateDialogError(null)
            setSaveTemplateSourceStructureId(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkTemplates'] })
        },
        onError: () => setTemplateDialogError(t('workspace.template.saveError', 'Failed to save template'))
    })
    const updateTemplateMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!canEditContent || !templateActionId || !apiBaseUrl || !applicationId) throw new Error('permission-denied')
            const selectedTemplate = templatesQuery.data?.items.find((template) => template.id === templateActionId)
            return updateInterpretationNetworkTemplate({
                apiBaseUrl,
                applicationId,
                workspaceId,
                templateId: templateActionId,
                templateName: data.templateName,
                description: data.description,
                expectedVersion: selectedTemplate?.version,
                locale,
                widgetId,
                layoutId
            })
        },
        onSuccess: async () => {
            setTemplateDialogMode(null)
            setTemplateDialogError(null)
            setTemplateActionId(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkTemplates'] })
        },
        onError: () => setTemplateDialogError(t('workspace.template.updateError', 'Failed to update template'))
    })
    const deleteTemplateMutation = useMutation({
        mutationFn: async () => {
            if (!canDeleteContent || !templateActionId || !apiBaseUrl || !applicationId) throw new Error('permission-denied')
            const selectedTemplate = templatesQuery.data?.items.find((template) => template.id === templateActionId)
            await deleteInterpretationNetworkTemplate({
                apiBaseUrl,
                applicationId,
                workspaceId,
                templateId: templateActionId,
                expectedVersion: selectedTemplate?.version,
                widgetId,
                layoutId
            })
        },
        onSuccess: async () => {
            setTemplateActionId(null)
            setTemplateDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkTemplates'] })
        },
        onError: () => setTemplateDialogError(t('workspace.template.deleteError', 'Failed to delete template'))
    })

    const closeTemplateDialog = () => {
        setTemplateDialogMode(null)
        setTemplateDialogError(null)
        setTemplateActionId(null)
        setSaveTemplateSourceStructureId(null)
    }
    const openSaveTemplateDialog = (structureId?: string) => {
        closeStructureMenu()
        setTemplateDialogError(null)
        setTemplateActionId(null)
        setSaveTemplateSourceStructureId(structureId ?? selectedConcept?.id ?? null)
        setTemplateDialogMode('save')
    }
    const openEditTemplateDialog = (templateId: string) => {
        setTemplateDialogError(null)
        setTemplateActionId(templateId)
        setTemplateDialogMode('edit')
    }
    const requestDeleteTemplate = (templateId: string) => {
        setTemplateDialogError(null)
        setTemplateActionId(templateId)
    }

    return {
        templatesQuery,
        templateDialogMode,
        setTemplateDialogMode,
        structureCreateSource,
        setStructureCreateSource,
        structureCreateTemplateId,
        setStructureCreateTemplateId,
        templateActionId,
        templateDialogError,
        setTemplateDialogError,
        selectedTemplateForDialog: templatesQuery.data?.items.find((template) => template.id === templateActionId),
        saveTemplateMutation,
        updateTemplateMutation,
        deleteTemplateMutation,
        closeTemplateDialog,
        openSaveTemplateDialog,
        openEditTemplateDialog,
        requestDeleteTemplate,
        templateDetailQuery,
        openTemplateDetail: setOpenTemplateId,
        closeTemplateDetail: () => setOpenTemplateId(null)
    }
}
