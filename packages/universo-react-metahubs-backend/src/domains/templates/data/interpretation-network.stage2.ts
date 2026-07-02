// Generic interpretation-network active seed model.
//
// This file is imported by `interpretation-network.template.ts`; the active template
// ships the first-stage interpretation-network model directly instead
// of creating a shell-only metahub.
//
// Components exported here:
//   - `INTERPRETATION_NETWORK_INTERPRETATION_MATRIX_CHILD_COMPONENTS` — the 20-column
//     child-component definition for the InterpretationMatrix TABLE
//     (CellId, CellFillColor, per-side Border*Color/Width/Style, MaterialRef)
//   - `INTERPRETATION_NETWORK_STRUCTURE_OBJECT_COMPONENTS` — Structure Object preset
//     (Name, Description)
//   - `INTERPRETATION_NETWORK_INTERPRETATION_OBJECT_COMPONENTS` — Interpretation Object
//     preset (Title, ParentStructure, Context, InterpretationMatrix TABLE)
//   - `INTERPRETATION_NETWORK_RELATION_OBJECT_COMPONENTS` — Relation Object preset
//     (SourceKind, SourceId, TargetKind, TargetId, RelationType, Description)
//   - `INTERPRETATION_NETWORK_MATERIAL_OBJECT_COMPONENTS` — Material Object preset
//     (Title, Description, Body Editor.js block content, hidden CellId attachment)
//   - `INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME` — default hub codename (Main)
//   - `INTERPRETATION_NETWORK_SEED_ENTITIES` — the Interpretation Network entity/page definitions
//     (InterpretationNetworkIntro page, Structure / Interpretation / Relation /
//     Material / TableTemplate + Context / RelationType / CellColor) wired into
//     `seed.entities`
//   - `INTERPRETATION_NETWORK_CONTEXT_VALUES` / `INTERPRETATION_NETWORK_RELATION_TYPE_VALUES` /
//     `INTERPRETATION_NETWORK_CELL_COLOR_VALUES` — pre-defined enumeration value sets
//
import { vlc } from './basic.template'
import type { TemplateSeedComponent, TemplateSeedEntity, TemplateSeedEnumerationValue } from '@universo-react/types'

const INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME = 'Main'

const buildEditorText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

const buildEditorHeaderBlock = (id: string, level: number, en: string, ru: string) => ({
    id,
    type: 'header',
    data: {
        level,
        text: buildEditorText(en, ru)
    }
})

const buildEditorParagraphBlock = (id: string, en: string, ru: string) => ({
    id,
    type: 'paragraph',
    data: {
        text: buildEditorText(en, ru)
    }
})

const buildEditorBlockContent = (blocks: Array<Record<string, unknown>>) => ({
    format: 'editorjs',
    version: '2.29.0',
    blocks
})

const INTERPRETATION_NETWORK_INTERPRETATION_MATRIX_CHILD_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'CellId',
        dataType: 'STRING',
        name: vlc('Cell ID', 'ID ячейки'),
        description: vlc(
            'Stable UUID v7 identifier for this matrix cell. Used by relations and E2E locators.',
            'Стабильный UUID v7 идентификатор ячейки матрицы. Используется связями и E2E-локаторами.'
        ),
        sortOrder: 1,
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'ColKey',
        dataType: 'STRING',
        name: vlc('Column Key', 'Ключ колонки'),
        sortOrder: 2,
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'ColLabel',
        dataType: 'STRING',
        name: vlc('Column Label', 'Метка колонки'),
        sortOrder: 3,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 1 }
    },
    {
        codename: 'RowKey',
        dataType: 'STRING',
        name: vlc('Row Key', 'Ключ строки'),
        sortOrder: 4,
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'RowLabel',
        dataType: 'STRING',
        name: vlc('Row Label', 'Метка строки'),
        sortOrder: 5,
        validationRules: { localized: true, versioned: true }
    },
    {
        codename: 'CellValue',
        dataType: 'STRING',
        name: vlc('Cell Title', 'Название ячейки'),
        sortOrder: 6,
        validationRules: { localized: true, versioned: true },
        uiConfig: {
            widget: 'textarea',
            rows: 2,
            cellStylePreview: {
                fillColorField: 'CellFillColor',
                borderTopColorField: 'BorderTopColor',
                borderRightColorField: 'BorderRightColor',
                borderBottomColorField: 'BorderBottomColor',
                borderLeftColorField: 'BorderLeftColor',
                borderTopWidthField: 'BorderTopWidth',
                borderRightWidthField: 'BorderRightWidth',
                borderBottomWidthField: 'BorderBottomWidth',
                borderLeftWidthField: 'BorderLeftWidth',
                borderTopStyleField: 'BorderTopStyle',
                borderRightStyleField: 'BorderRightStyle',
                borderBottomStyleField: 'BorderBottomStyle',
                borderLeftStyleField: 'BorderLeftStyle'
            }
        }
    },
    {
        codename: 'CellDescription',
        dataType: 'STRING',
        name: vlc('Cell Description', 'Описание ячейки'),
        sortOrder: 7,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 4, gridHidden: true }
    },
    {
        codename: 'CellFillColor',
        dataType: 'REF',
        name: vlc('Fill Color', 'Цвет заливки'),
        sortOrder: 8,
        targetEntityCodename: 'CellColor',
        targetEntityKind: 'enumeration',
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'fill', cellStyleValue: 'color' }
    },
    {
        codename: 'BorderTopColor',
        dataType: 'REF',
        name: vlc('Top Border Color', 'Цвет верхней границы'),
        sortOrder: 9,
        targetEntityCodename: 'CellColor',
        targetEntityKind: 'enumeration',
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'color' }
    },
    {
        codename: 'BorderRightColor',
        dataType: 'REF',
        name: vlc('Right Border Color', 'Цвет правой границы'),
        sortOrder: 10,
        targetEntityCodename: 'CellColor',
        targetEntityKind: 'enumeration',
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'right', cellStyleValue: 'color' }
    },
    {
        codename: 'BorderBottomColor',
        dataType: 'REF',
        name: vlc('Bottom Border Color', 'Цвет нижней границы'),
        sortOrder: 11,
        targetEntityCodename: 'CellColor',
        targetEntityKind: 'enumeration',
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'bottom', cellStyleValue: 'color' }
    },
    {
        codename: 'BorderLeftColor',
        dataType: 'REF',
        name: vlc('Left Border Color', 'Цвет левой границы'),
        sortOrder: 12,
        targetEntityCodename: 'CellColor',
        targetEntityKind: 'enumeration',
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'left', cellStyleValue: 'color' }
    },
    {
        codename: 'BorderTopWidth',
        dataType: 'STRING',
        name: vlc('Top Border Width', 'Толщина верхней границы'),
        sortOrder: 13,
        validationRules: { maxLength: 8 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'width' }
    },
    {
        codename: 'BorderRightWidth',
        dataType: 'STRING',
        name: vlc('Right Border Width', 'Толщина правой границы'),
        sortOrder: 14,
        validationRules: { maxLength: 8 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'right', cellStyleValue: 'width' }
    },
    {
        codename: 'BorderBottomWidth',
        dataType: 'STRING',
        name: vlc('Bottom Border Width', 'Толщина нижней границы'),
        sortOrder: 15,
        validationRules: { maxLength: 8 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'bottom', cellStyleValue: 'width' }
    },
    {
        codename: 'BorderLeftWidth',
        dataType: 'STRING',
        name: vlc('Left Border Width', 'Толщина левой границы'),
        sortOrder: 16,
        validationRules: { maxLength: 8 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'left', cellStyleValue: 'width' }
    },
    {
        codename: 'BorderTopStyle',
        dataType: 'STRING',
        name: vlc('Top Border Style', 'Стиль верхней границы'),
        sortOrder: 17,
        validationRules: { maxLength: 16 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'lineStyle' }
    },
    {
        codename: 'BorderRightStyle',
        dataType: 'STRING',
        name: vlc('Right Border Style', 'Стиль правой границы'),
        sortOrder: 18,
        validationRules: { maxLength: 16 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'right', cellStyleValue: 'lineStyle' }
    },
    {
        codename: 'BorderBottomStyle',
        dataType: 'STRING',
        name: vlc('Bottom Border Style', 'Стиль нижней границы'),
        sortOrder: 19,
        validationRules: { maxLength: 16 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'bottom', cellStyleValue: 'lineStyle' }
    },
    {
        codename: 'BorderLeftStyle',
        dataType: 'STRING',
        name: vlc('Left Border Style', 'Стиль левой границы'),
        sortOrder: 20,
        validationRules: { maxLength: 16 },
        uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'left', cellStyleValue: 'lineStyle' }
    },
    {
        codename: 'MaterialRef',
        dataType: 'REF',
        name: vlc('Attached Material', 'Прикреплённый материал'),
        sortOrder: 21,
        targetEntityCodename: 'Material',
        targetEntityKind: 'object',
        uiConfig: { enumPresentationMode: 'label' }
    }
]

const INTERPRETATION_NETWORK_STRUCTURE_OBJECT_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'Name',
        dataType: 'STRING',
        name: vlc('Name', 'Название'),
        sortOrder: 1,
        isDisplayComponent: true,
        validationRules: { localized: true, maxLength: 255, versioned: true },
        uiConfig: { isDisplay: true }
    },
    {
        codename: 'Description',
        dataType: 'STRING',
        name: vlc('Description', 'Описание'),
        sortOrder: 2,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 4 }
    }
]

const INTERPRETATION_NETWORK_INTERPRETATION_OBJECT_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'Title',
        dataType: 'STRING',
        name: vlc('Title', 'Название'),
        sortOrder: 1,
        isDisplayComponent: true,
        validationRules: { localized: true, maxLength: 255, versioned: true },
        uiConfig: { isDisplay: true }
    },
    {
        codename: 'ParentStructure',
        dataType: 'REF',
        name: vlc('Parent Structure', 'Родительская структура'),
        sortOrder: 2,
        targetEntityCodename: 'Structure',
        targetEntityKind: 'object'
    },
    {
        codename: 'Context',
        dataType: 'REF',
        name: vlc('Context', 'Контекст'),
        sortOrder: 3,
        targetEntityCodename: 'Context',
        targetEntityKind: 'enumeration'
    },
    {
        codename: 'InterpretationMatrix',
        dataType: 'TABLE',
        name: vlc('Interpretation Matrix', 'Матрица трактовки'),
        description: vlc(
            'Tabular part with one row per cell. Each row carries its own value, color, and per-side border attributes.',
            'Табличная часть с одной строкой на ячейку. В каждой строке — значение, цвет и атрибуты границ по сторонам.'
        ),
        sortOrder: 4,
        validationRules: { minRows: 0, maxRows: 5000, maxChildComponents: 21 },
        childComponents: INTERPRETATION_NETWORK_INTERPRETATION_MATRIX_CHILD_COMPONENTS
    }
]

const INTERPRETATION_NETWORK_TABLE_TEMPLATE_OBJECT_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'Name',
        dataType: 'STRING',
        name: vlc('Name', 'Название'),
        sortOrder: 1,
        isDisplayComponent: true,
        validationRules: { localized: true, maxLength: 255, versioned: true },
        uiConfig: { isDisplay: true }
    },
    {
        codename: 'Description',
        dataType: 'STRING',
        name: vlc('Description', 'Описание'),
        sortOrder: 2,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 4 }
    },
    {
        codename: 'TemplateMatrix',
        dataType: 'TABLE',
        name: vlc('Template Matrix', 'Шаблон матрицы'),
        description: vlc(
            'Workspace-authored reusable matrix structure. Users can copy it and use it as a starting point for Interpretation matrices.',
            'Переиспользуемая структура матрицы, создаваемая в рабочем пространстве. Пользователи могут копировать её и использовать как основу матриц трактовок.'
        ),
        sortOrder: 3,
        validationRules: { minRows: 0, maxRows: 5000, maxChildComponents: 21 },
        childComponents: INTERPRETATION_NETWORK_INTERPRETATION_MATRIX_CHILD_COMPONENTS
    }
]

const INTERPRETATION_NETWORK_RELATION_OBJECT_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'SourceLabel',
        dataType: 'STRING',
        name: vlc('Source', 'Источник'),
        sortOrder: 1,
        isDisplayComponent: true,
        validationRules: { localized: true, versioned: true },
        uiConfig: { isDisplay: true, readOnly: true }
    },
    {
        codename: 'SourceKind',
        dataType: 'STRING',
        name: vlc('Source Kind', 'Тип источника'),
        description: vlc('concept | interpretation | cell', 'concept | interpretation | cell'),
        sortOrder: 2,
        validationRules: { maxLength: 32 },
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'SourceId',
        dataType: 'STRING',
        name: vlc('Source ID', 'ID источника'),
        sortOrder: 3,
        validationRules: { maxLength: 64 },
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'TargetLabel',
        dataType: 'STRING',
        name: vlc('Target', 'Цель'),
        sortOrder: 4,
        validationRules: { localized: true, versioned: true },
        uiConfig: { readOnly: true }
    },
    {
        codename: 'TargetKind',
        dataType: 'STRING',
        name: vlc('Target Kind', 'Тип цели'),
        sortOrder: 5,
        validationRules: { maxLength: 32 },
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'TargetId',
        dataType: 'STRING',
        name: vlc('Target ID', 'ID цели'),
        sortOrder: 6,
        validationRules: { maxLength: 64 },
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    },
    {
        codename: 'RelationType',
        dataType: 'REF',
        name: vlc('Relation Type', 'Тип связи'),
        sortOrder: 7,
        targetEntityCodename: 'RelationType',
        targetEntityKind: 'enumeration'
    },
    {
        codename: 'Description',
        dataType: 'STRING',
        name: vlc('Description', 'Описание'),
        sortOrder: 8,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 3 }
    }
]

const INTERPRETATION_NETWORK_MATERIAL_OBJECT_COMPONENTS: TemplateSeedComponent[] = [
    {
        codename: 'Title',
        dataType: 'STRING',
        name: vlc('Title', 'Название'),
        sortOrder: 1,
        isDisplayComponent: true,
        validationRules: { localized: true, maxLength: 255, versioned: true },
        uiConfig: { isDisplay: true }
    },
    {
        codename: 'Description',
        dataType: 'STRING',
        name: vlc('Description', 'Описание'),
        sortOrder: 2,
        validationRules: { localized: true, versioned: true },
        uiConfig: { widget: 'textarea', rows: 3 }
    },
    {
        codename: 'Body',
        dataType: 'JSON',
        name: vlc('Body', 'Содержимое'),
        description: vlc(
            'Structured Editor.js content attached to a Structure or Interpretation cell.',
            'Структурированный контент Editor.js, прикрепляемый к ячейке структуры или трактовки.'
        ),
        sortOrder: 3,
        uiConfig: {
            gridHidden: true,
            widget: 'editorjsBlockContent',
            blockEditor: {
                allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
                maxBlocks: 200
            }
        }
    },
    {
        codename: 'CellId',
        dataType: 'STRING',
        name: vlc('Cell ID', 'ID ячейки'),
        sortOrder: 4,
        validationRules: { maxLength: 64 },
        uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
    }
]

const INTERPRETATION_NETWORK_SEED_ENTITIES: TemplateSeedEntity[] = [
    {
        codename: 'InterpretationNetworkIntro',
        kind: 'page',
        name: vlc('Interpretation Network', 'Трактовочная сеть'),
        description: vlc(
            'Start page for the interpretation-network workspace.',
            'Стартовая страница рабочего пространства трактовочной сети.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        config: {
            blockContent: buildEditorBlockContent([
                buildEditorHeaderBlock('interpretationNetwork-intro-title', 2, 'Interpretation Network', 'Трактовочная сеть'),
                buildEditorParagraphBlock(
                    'interpretationNetwork-intro-purpose',
                    'The interpretation network helps build a hierarchy of structures, cells, relations, and Editor.js materials for analyzing meanings across contexts.',
                    'Трактовочная сеть помогает создавать иерархию структур, ячеек, связей и материалов Editor.js для анализа смыслов в разных контекстах.'
                ),
                buildEditorParagraphBlock(
                    'interpretationNetwork-intro-start',
                    'Open Structures, create a new structure, and then add matrix cells. Materials for selected cells are created on the right side of the workspace.',
                    'Откройте раздел «Структуры», создайте новую структуру и добавьте ячейки матрицы. Материалы для выбранных ячеек создаются в правой части рабочего пространства.'
                )
            ]),
            runtime: {
                menuVisibility: 'primary',
                routeSegment: 'start'
            }
        }
    },
    {
        codename: 'Structure',
        kind: 'object',
        name: vlc('Structures', 'Структуры'),
        description: vlc(
            'Dictionary of structures that can have multiple interpretations across contexts.',
            'Словарь структур, которые могут иметь несколько трактовок в разных контекстах.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        components: INTERPRETATION_NETWORK_STRUCTURE_OBJECT_COMPONENTS,
        config: { recordBehavior: 'reference' }
    },
    {
        codename: 'Interpretation',
        kind: 'object',
        name: vlc('Interpretations', 'Трактовки'),
        description: vlc(
            'An interpretation of a Structure in a specific Context. Carries a TABLE of cells with per-cell value, color and border.',
            'Трактовка структуры в конкретном контексте. Содержит таблицу ячеек со значением, цветом и границами.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        components: INTERPRETATION_NETWORK_INTERPRETATION_OBJECT_COMPONENTS,
        config: { recordBehavior: 'reference' }
    },
    {
        codename: 'Relation',
        kind: 'object',
        name: vlc('Relations', 'Связи'),
        description: vlc(
            'Typed edge between two nodes (structures, interpretations, or cells).',
            'Типизированное ребро между двумя узлами (структуры, трактовки или ячейки).'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        components: INTERPRETATION_NETWORK_RELATION_OBJECT_COMPONENTS,
        config: { recordBehavior: 'reference' }
    },
    {
        codename: 'Material',
        kind: 'object',
        name: vlc('Materials', 'Материалы'),
        description: vlc(
            'Editor.js material records attached to Structure or Interpretation cells via REF fields.',
            'Записи материалов Editor.js, прикрепляемые к ячейкам структур или трактовок через REF-поля.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        components: INTERPRETATION_NETWORK_MATERIAL_OBJECT_COMPONENTS,
        config: { recordBehavior: 'reference' }
    },
    {
        codename: 'TableTemplate',
        kind: 'object',
        name: vlc('Table Templates', 'Шаблоны таблиц'),
        description: vlc(
            'Workspace-authored reusable table and matrix structures for interpretation work.',
            'Создаваемые в рабочем пространстве переиспользуемые структуры таблиц и матриц для трактовочной работы.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME],
        components: INTERPRETATION_NETWORK_TABLE_TEMPLATE_OBJECT_COMPONENTS,
        config: { recordBehavior: 'reference' }
    },
    {
        codename: 'Context',
        kind: 'enumeration',
        name: vlc('Contexts', 'Контексты'),
        description: vlc(
            'Closed list of contexts in which a structure can be interpreted.',
            'Закрытый список контекстов, в которых может быть истолкована структура.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME]
    },
    {
        codename: 'RelationType',
        kind: 'enumeration',
        name: vlc('Relation Types', 'Типы связей'),
        description: vlc(
            'Closed list of typed relation kinds: partOf, causes, causedBy, analogue, opposite, relatedProcess.',
            'Закрытый список типов связей: partOf, causes, causedBy, analogue, opposite, relatedProcess.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME]
    },
    {
        codename: 'CellColor',
        kind: 'enumeration',
        name: vlc('Cell Colors', 'Цвета ячеек'),
        description: vlc(
            'Twelve named colors used by the Interpretation Matrix cell style picker.',
            'Двенадцать именованных цветов, используемых picker-ом стиля ячеек матрицы трактовок.'
        ),
        hubs: [INTERPRETATION_NETWORK_DEFAULT_HUB_CODENAME]
    }
]

const INTERPRETATION_NETWORK_CONTEXT_VALUES: TemplateSeedEnumerationValue[] = [
    { codename: 'Science', name: vlc('Science', 'Наука'), sortOrder: 1 },
    { codename: 'Education', name: vlc('Education', 'Образование'), sortOrder: 2 },
    { codename: 'Law', name: vlc('Law', 'Право'), sortOrder: 3 },
    { codename: 'Economy', name: vlc('Economy', 'Экономика'), sortOrder: 4 },
    { codename: 'Programming', name: vlc('Programming', 'Программирование'), sortOrder: 5 },
    { codename: 'Culture', name: vlc('Culture', 'Культура'), sortOrder: 6 },
    { codename: 'General', name: vlc('General', 'Общее'), sortOrder: 7, isDefault: true }
]

const INTERPRETATION_NETWORK_RELATION_TYPE_VALUES: TemplateSeedEnumerationValue[] = [
    { codename: 'partOf', name: vlc('Part of', 'Часть целого'), sortOrder: 1 },
    { codename: 'causes', name: vlc('Causes', 'Причина'), sortOrder: 2 },
    { codename: 'causedBy', name: vlc('Caused by', 'Следствие'), sortOrder: 3 },
    { codename: 'analogue', name: vlc('Analogue', 'Аналог'), sortOrder: 4 },
    { codename: 'opposite', name: vlc('Opposite', 'Противоположность'), sortOrder: 5 },
    { codename: 'relatedProcess', name: vlc('Related process', 'Связанный процесс'), sortOrder: 6 }
]

const INTERPRETATION_NETWORK_CELL_COLOR_VALUES: TemplateSeedEnumerationValue[] = [
    { codename: 'none', name: vlc('None', 'Нет'), sortOrder: 1, isDefault: true },
    { codename: 'gray', name: vlc('Gray', 'Серый'), sortOrder: 2 },
    { codename: 'red', name: vlc('Red', 'Красный'), sortOrder: 3 },
    { codename: 'orange', name: vlc('Orange', 'Оранжевый'), sortOrder: 4 },
    { codename: 'yellow', name: vlc('Yellow', 'Жёлтый'), sortOrder: 5 },
    { codename: 'green', name: vlc('Green', 'Зелёный'), sortOrder: 6 },
    { codename: 'teal', name: vlc('Teal', 'Бирюзовый'), sortOrder: 7 },
    { codename: 'blue', name: vlc('Blue', 'Синий'), sortOrder: 8 },
    { codename: 'indigo', name: vlc('Indigo', 'Индиго'), sortOrder: 9 },
    { codename: 'purple', name: vlc('Purple', 'Фиолетовый'), sortOrder: 10 },
    { codename: 'pink', name: vlc('Pink', 'Розовый'), sortOrder: 11 },
    { codename: 'black', name: vlc('Black', 'Чёрный'), sortOrder: 12 }
]

export const INTERPRETATION_NETWORK_STAGE2 = {
    seedEntities: INTERPRETATION_NETWORK_SEED_ENTITIES,
    contextValues: INTERPRETATION_NETWORK_CONTEXT_VALUES,
    relationTypeValues: INTERPRETATION_NETWORK_RELATION_TYPE_VALUES,
    cellColorValues: INTERPRETATION_NETWORK_CELL_COLOR_VALUES
}
