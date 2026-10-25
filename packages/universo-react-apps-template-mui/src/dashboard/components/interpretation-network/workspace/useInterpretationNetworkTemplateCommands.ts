import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import {
    deleteInterpretationNetworkTemplate,
    fetchInterpretationNetworkTemplateDetail,
    fetchInterpretationNetworkTemplates,
    saveInterpretationNetworkTemplate,
    updateInterpretationNetworkTemplate
} from '../../../../api/interpretationNetwork'
import type { MatrixCell, MatrixMode, RuntimeRow } from '../model'
import type { InterpretationNetworkTemplateSaveScope } from '../../../../api/interpretationNetwork'
import type { StructureSummary } from './StructurePane'
import { readRuntimeRowVersion } from './workspaceRuntime'
import { resolveTemplateBranchPath, type TemplateSaveScopeKind } from './templateSaveScope'

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
    matrixCells: MatrixCell[]
    matrixMode: MatrixMode
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
    matrixCells,
    matrixMode,
    structureSummaries,
    closeStructureMenu,
    t
}: UseInterpretationNetworkTemplateCommandsOptions) {
    const queryClient = useQueryClient()
    const templatesQuery = useQuery({
        queryKey: ['interpretationNetworkTemplates', applicationId, workspaceId, widgetId, layoutId],
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
    const [saveTemplateRootCellId, setSaveTemplateRootCellId] = useState<string | null>(null)
    const [saveTemplateScopeKind, setSaveTemplateScopeKind] = useState<TemplateSaveScopeKind>('wholeStructure')
    const [templateDialogError, setTemplateDialogError] = useState<string | null>(null)
    const saveTemplateBranchPath = useMemo(
        () => resolveTemplateBranchPath(matrixCells, saveTemplateRootCellId),
        [matrixCells, saveTemplateRootCellId]
    )
    const canSaveSelectedBranch = matrixMode === 'hierarchicalCells' && saveTemplateBranchPath.length > 0
    const changeSaveTemplateScopeKind = (scope: TemplateSaveScopeKind) => {
        if (scope === 'selectedBranch' && !canSaveSelectedBranch) return
        setSaveTemplateScopeKind(scope)
    }
    const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
    const templateDetailQuery = useQuery({
        queryKey: ['interpretationNetworkTemplateDetail', applicationId, workspaceId, widgetId, layoutId, openTemplateId],
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
            const scope: InterpretationNetworkTemplateSaveScope =
                saveTemplateScopeKind === 'selectedBranch' && canSaveSelectedBranch && saveTemplateRootCellId
                    ? { kind: 'selectedBranch', rootCellId: saveTemplateRootCellId }
                    : { kind: 'wholeStructure' }
            if (saveTemplateScopeKind === 'selectedBranch' && scope.kind !== 'selectedBranch') {
                throw new Error('selected-branch-unavailable')
            }
            return saveInterpretationNetworkTemplate({
                apiBaseUrl,
                applicationId,
                workspaceId,
                sourceStructureId,
                templateName: data.templateName,
                description: data.description,
                includeMaterials: data.templatePolicy === 'withMaterials',
                scope,
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
            setSaveTemplateRootCellId(null)
            setSaveTemplateScopeKind('wholeStructure')
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
        setSaveTemplateRootCellId(null)
        setSaveTemplateScopeKind('wholeStructure')
    }
    const openSaveTemplateDialog = (structureId?: string, rootCellId?: string) => {
        closeStructureMenu()
        setTemplateDialogError(null)
        setTemplateActionId(null)
        setSaveTemplateSourceStructureId(structureId ?? selectedConcept?.id ?? null)
        const selectedRoot = rootCellId && matrixCells.some((cell) => cell.id === rootCellId) ? rootCellId : null
        setSaveTemplateRootCellId(selectedRoot)
        setSaveTemplateScopeKind('wholeStructure')
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
        saveTemplateRootCellId,
        saveTemplateBranchPath,
        canSaveSelectedBranch,
        saveTemplateScopeKind,
        setSaveTemplateScopeKind: changeSaveTemplateScopeKind,
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
