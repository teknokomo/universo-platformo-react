// Interpretation Network — interpretation network template.
//
// Re-uses the base presets and materialises the Stage-1
// interpretation-network model through template definitions: Structure,
// Interpretation, Relation, Material, Context, RelationType,
// plus a localized intro page. User-authored structures, matrix rows,
// materials, relations, and templates are intentionally created in the
// published application workspace, not prefilled by the product fixture.

import { INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS } from '@universo-react/types'
import type { MetahubTemplateManifest, TemplateSeedLayout, TemplateSeedScopedLayout, TemplateSeedZoneWidget } from '@universo-react/types'
import { makeDashboardSeedPlacement } from '../services/dashboardSeedPlacement'
import { vlc } from './basic.template'
import { INTERPRETATION_NETWORK_STAGE2 } from './interpretation-network.stage2'

/**
 * The global layout contains only shared application chrome. Structure-scoped
 * behavior is added by the Structures overlay below.
 */
const INTERPRETATION_NETWORK_SEED_LAYOUT: TemplateSeedLayout = {
    codename: 'main',
    templateKey: 'dashboard',
    name: vlc('Main', 'Основной'),
    description: vlc(
        'Shared application shell with the generated navigation menu.',
        'Оболочка приложения с автоматически сформированным меню навигации.'
    ),
    isDefault: true,
    isActive: true,
    sortOrder: 0
}

const INTERPRETATION_NETWORK_STRUCTURE_LAYOUT: TemplateSeedScopedLayout = {
    codename: 'structures',
    templateKey: 'dashboard',
    baseLayoutCodename: 'main',
    scopeEntityCodename: 'Structure',
    scopeEntityKind: 'object',
    name: vlc('Structures workspace', 'Рабочая область структур'),
    description: vlc(
        'Structure-scoped workspace for editing the interpretation matrix and its materials.',
        'Рабочая область структуры для работы с матрицей трактовок и материалами.'
    ),
    isDefault: true,
    isActive: true,
    sortOrder: 0
}

const INTERPRETATION_NETWORK_SEED_ZONE_WIDGETS: TemplateSeedZoneWidget[] = [
    makeDashboardSeedPlacement({
        zone: 'left',
        widgetKey: 'workspaceSwitcher',
        instanceKey: 'workspace-switcher',
        sortOrder: 1,
        isActive: true
    }),
    makeDashboardSeedPlacement({
        zone: 'left',
        widgetKey: 'menuWidget',
        instanceKey: 'main-menu',
        sortOrder: 2,
        isActive: true,
        rendererConfig: { variant: 'generated' }
    }),
    makeDashboardSeedPlacement({
        zone: 'top',
        widgetKey: 'appNavbar',
        instanceKey: 'application-navbar',
        sortOrder: 1
    }),
    makeDashboardSeedPlacement({
        zone: 'top',
        widgetKey: 'header',
        instanceKey: 'application-header',
        sortOrder: 2
    }),
    makeDashboardSeedPlacement({
        zone: 'top',
        widgetKey: 'languageSwitcher',
        instanceKey: 'language-switcher',
        sortOrder: 3
    }),
    makeDashboardSeedPlacement({
        zone: 'top',
        widgetKey: 'colorModeSwitcher',
        instanceKey: 'color-mode-switcher',
        sortOrder: 4
    })
]

const INTERPRETATION_NETWORK_STRUCTURE_ZONE_WIDGETS: TemplateSeedZoneWidget[] = [
    makeDashboardSeedPlacement({
        zone: 'center',
        widgetKey: 'interpretationNetworkWorkspace',
        instanceKey: 'interpretation-workspace',
        sortOrder: 1,
        isActive: true,
        rendererConfig: {
            structureMode: 'multiple',
            templatePanel: { showInStructureList: true, showInMatrix: true },
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true,
            splitPane: { enabled: true },
            hierarchyRowMode: 'focusedPath',
            allowNewAxesInCellDialog: false,
            positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 },
            cellStylePolicy: {
                allowedColors: [...INTERPRETATION_NETWORK_DEFAULT_CELL_STYLE_COLORS],
                allowCustomColors: true,
                editable: { fillColor: true, textColor: true, borderColor: true, borderWidth: true, borderStyle: true }
            },
            conceptCodename: 'Structure',
            interpretationCodename: 'Interpretation',
            relationCodename: 'Relation',
            materialCodename: 'Material',
            materialTitleField: 'Title',
            interpretationTitleField: 'Title',
            tableTemplateCodename: 'TableTemplate',
            matrixField: 'InterpretationMatrix',
            tableTemplateMatrixField: 'TemplateMatrix',
            conceptNameField: 'Name',
            conceptDescriptionField: 'Description',
            interpretationParentField: 'ParentStructure'
        }
    })
]

export const interpretationNetworkTemplate: MetahubTemplateManifest = {
    $schema: 'metahub-template/v1',
    codename: 'interpretation-network',
    version: '0.1.0',
    minStructureVersion: '0.1.0',
    name: vlc('Interpretation Network', 'Трактовочная сеть'),
    description: vlc(
        'Interpretation network template with Structures, Interpretations, typed Relations, Editor.js Materials, and matrix cell styling.',
        'Шаблон трактовочной сети с понятиями, трактовками, типизированными связями, материалами Editor.js и стилями ячеек матрицы.'
    ),
    meta: {
        author: 'universo-platformo',
        tags: ['interpretation-network', 'knowledge-graph', 'stage-1'],
        icon: 'IconNetwork'
    },
    presets: [
        { presetCodename: 'hub', includedByDefault: true },
        { presetCodename: 'page', includedByDefault: false },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [INTERPRETATION_NETWORK_SEED_LAYOUT],
        scopedLayouts: [INTERPRETATION_NETWORK_STRUCTURE_LAYOUT],
        layoutZoneWidgets: {
            main: INTERPRETATION_NETWORK_SEED_ZONE_WIDGETS,
            structures: INTERPRETATION_NETWORK_STRUCTURE_ZONE_WIDGETS
        },
        entities: INTERPRETATION_NETWORK_STAGE2.seedEntities,
        optionValues: {
            Context: INTERPRETATION_NETWORK_STAGE2.contextValues,
            RelationType: INTERPRETATION_NETWORK_STAGE2.relationTypeValues
        },
        settings: [
            { key: 'general.language', value: { _value: 'system' } },
            { key: 'general.timezone', value: { _value: 'UTC' } },
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoConvertMixedAlphabets', value: { _value: false } },
            { key: 'general.codenameAutoReformat', value: { _value: true } },
            { key: 'general.codenameRequireReformat', value: { _value: true } },
            { key: 'entity.object.allowComponentCopy', value: { _value: true } },
            { key: 'entity.object.allowComponentDelete', value: { _value: true } },
            { key: 'entity.object.allowDeleteLastDisplayComponent', value: { _value: false } }
        ]
    }
}
