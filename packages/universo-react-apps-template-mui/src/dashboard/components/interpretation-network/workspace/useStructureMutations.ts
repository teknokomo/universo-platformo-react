import { useMutation, type QueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { createInterpretationNetworkStructure, instantiateInterpretationNetworkTemplate } from '../../../../api/interpretationNetwork'
import { updateAppRow, type AppDataResponse } from '../../../../api/api'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import { getSectionId, type RuntimeRow } from '../model'
import type { SelectMatrixCell } from './useMatrixWorkspaceActions'
import { readRuntimeRowVersion } from './workspaceRuntime'

export function useStructureMutations({
    t,
    queryClient,
    canCreateContent,
    canEditContent,
    singleSystemMode,
    apiBaseUrl,
    applicationId,
    workspaceId,
    widgetId,
    layoutId,
    locale,
    concepts,
    structureFields,
    structureCreateSource,
    structureCreateTemplateId,
    templates,
    editingStructureId,
    editingStructure,
    clearEditingStructure,
    setStructureDialogMode,
    setStructureCreateSource,
    setStructureCreateTemplateId,
    setStructureDialogError,
    setSelectedConceptId,
    setSelectedInterpretationId,
    selectMatrixCell,
    navigateToStructure
}: {
    t: TFunction<'interpretationNetwork'>
    queryClient: QueryClient
    canCreateContent: boolean
    canEditContent: boolean
    singleSystemMode: boolean
    apiBaseUrl?: string | null
    applicationId?: string | null
    workspaceId?: string | null
    widgetId?: string | null
    layoutId?: string | null
    locale: string
    concepts?: AppDataResponse | null
    structureFields: FieldConfig[]
    structureCreateSource: 'blank' | 'template'
    structureCreateTemplateId: string
    templates: Array<{ id: string; version: number }>
    editingStructureId: string | null
    editingStructure: RuntimeRow | undefined
    clearEditingStructure: () => void
    setStructureDialogMode: (mode: 'create' | 'edit' | null) => void
    setStructureCreateSource: (source: 'blank' | 'template') => void
    setStructureCreateTemplateId: (templateId: string) => void
    setStructureDialogError: (error: string | null) => void
    setSelectedConceptId: (id: string | null) => void
    setSelectedInterpretationId: (id: string | null) => void
    selectMatrixCell: SelectMatrixCell
    navigateToStructure: (structureId: string | null, options?: { replace?: boolean; focusedCellId?: string | null }) => void
}) {
    const createStructureMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) =>
            structureCreateSource === 'template'
                ? (async () => {
                      if (!canCreateContent || !canEditContent || singleSystemMode || !apiBaseUrl || !applicationId) {
                          throw new Error('permission-denied')
                      }
                      if (!structureCreateTemplateId) throw new Error('template-required')
                      const selectedTemplate = templates.find((template) => template.id === structureCreateTemplateId)
                      return instantiateInterpretationNetworkTemplate({
                          apiBaseUrl,
                          applicationId,
                          workspaceId,
                          templateId: structureCreateTemplateId,
                          structureName:
                              data[structureFields.find((field) => field.codename === 'Name' || field.id === 'Name')?.id ?? 'Name'],
                          description:
                              data[
                                  structureFields.find((field) => field.codename === 'Description' || field.id === 'Description')?.id ??
                                      'Description'
                              ],
                          expectedVersion: selectedTemplate?.version,
                          locale,
                          widgetId,
                          layoutId
                      })
                  })()
                : (async () => {
                      if (!canCreateContent || !canEditContent || singleSystemMode || !apiBaseUrl || !applicationId) {
                          throw new Error('permission-denied')
                      }
                      const nameField = structureFields.find((field) => field.codename === 'Name' || field.id === 'Name')?.id ?? 'Name'
                      const descriptionField =
                          structureFields.find((field) => field.codename === 'Description' || field.id === 'Description')?.id ??
                          'Description'
                      return createInterpretationNetworkStructure({
                          apiBaseUrl,
                          applicationId,
                          workspaceId,
                          name: data[nameField],
                          description: data[descriptionField],
                          locale,
                          widgetId,
                          layoutId
                      })
                  })(),
        onSuccess: async (created) => {
            if (!created) return
            setStructureDialogMode(null)
            setStructureCreateSource('blank')
            setStructureCreateTemplateId('')
            clearEditingStructure()
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            let createdConceptId: string | null = null
            if (Object.prototype.hasOwnProperty.call(created, 'structureId')) {
                const templateCreated = created as { structureId: string; interpretationId: string }
                createdConceptId = templateCreated.structureId
                setSelectedConceptId(templateCreated.structureId)
                setSelectedInterpretationId(templateCreated.interpretationId)
                selectMatrixCell(null, { replace: true })
            }
            if (createdConceptId) {
                navigateToStructure(createdConceptId)
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onError: () => {
            setStructureDialogError(t('workspace.structure.error', 'Failed to create structure'))
        }
    })

    const updateStructureMutation = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            if (!canEditContent || !editingStructureId) throw new Error('permission-denied')
            const conceptSectionId = getSectionId(concepts ?? undefined)
            if (!apiBaseUrl || !applicationId || !conceptSectionId) return null
            return updateAppRow({
                apiBaseUrl,
                applicationId,
                workspaceId,
                objectCollectionId: conceptSectionId,
                rowId: editingStructureId,
                data,
                expectedVersion: readRuntimeRowVersion(editingStructure)
            })
        },
        onSuccess: async () => {
            setStructureDialogMode(null)
            clearEditingStructure()
            setStructureDialogError(null)
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
        },
        onError: () => {
            setStructureDialogError(t('workspace.structure.updateError', 'Failed to update structure'))
        }
    })

    return { createStructureMutation, updateStructureMutation }
}
