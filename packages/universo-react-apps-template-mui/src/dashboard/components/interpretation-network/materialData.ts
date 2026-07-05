import type { FieldConfig } from '../../../components/dialogs/FormDialog'
import type { RuntimeRow } from './model'

export const buildMaterialInitialData = (
    fields: FieldConfig[],
    mode: 'create' | 'edit' | null,
    editingMaterial: RuntimeRow | undefined
): Record<string, unknown> =>
    Object.fromEntries(fields.map((field) => [field.id, mode === 'edit' ? editingMaterial?.[field.id] : undefined]))

export const buildMaterialEditorInitialData = (
    bodyField: FieldConfig | undefined,
    selectedMaterial: RuntimeRow | undefined
): Record<string, unknown> => (bodyField ? { [bodyField.id]: selectedMaterial?.[bodyField.id] } : {})
