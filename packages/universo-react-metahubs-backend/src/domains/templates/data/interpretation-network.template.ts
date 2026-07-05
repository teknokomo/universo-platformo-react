// Interpretation Network — interpretation network template.
//
// Re-uses the base presets and materialises the Stage-1
// interpretation-network model through template definitions: Structure,
// Interpretation, Relation, Material, Context, RelationType, CellColor,
// plus a localized intro page. User-authored structures, matrix rows,
// materials, relations, and templates are intentionally created in the
// published application workspace, not prefilled by the product fixture.

import type { MetahubTemplateManifest, TemplateSeedLayout, TemplateSeedZoneWidget } from '@universo-react/types'
import { enrichConfigWithVlcTimestamps, vlc } from './basic.template'
import { INTERPRETATION_NETWORK_STAGE2 } from './interpretation-network.stage2'

/**
 * Generic interpretation-network workspace: the application shell keeps the left
 * main menu, and the center widget renders the structure/matrix plus selected
 * cell materials in two panes.
 */
const INTERPRETATION_NETWORK_SEED_LAYOUT: TemplateSeedLayout = {
    codename: 'main',
    templateKey: 'dashboard',
    name: vlc('Main', 'Основной'),
    description: vlc(
        'Interpretation network workspace: left application menu plus a two-pane structure/matrix and materials surface.',
        'Рабочее пространство трактовочной сети: левое меню приложения и двухпанельная поверхность со структурой, матрицей и материалами.'
    ),
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    config: enrichConfigWithVlcTimestamps({
        showOverviewTitle: false,
        showOverviewCards: false,
        showSessionsChart: false,
        showPageViewsChart: false,
        showDetailsTitle: false,
        showDetailsTable: false,
        showColumnsContainer: false,
        showHeader: false,
        showFooter: false
    })
}

const INTERPRETATION_NETWORK_SEED_ZONE_WIDGETS: TemplateSeedZoneWidget[] = [
    {
        zone: 'left',
        widgetKey: 'workspaceSwitcher',
        sortOrder: 1,
        isActive: true
    },
    {
        zone: 'left',
        widgetKey: 'menuWidget',
        sortOrder: 2,
        isActive: true,
        config: enrichConfigWithVlcTimestamps({
            showTitle: true,
            title: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Interpretation Network', version: 1, isActive: true },
                    ru: { content: 'Трактовочная сеть', version: 1, isActive: true }
                }
            },
            autoShowAllSections: false,
            bindToHub: true,
            boundTreeEntityId: null,
            startPage: 'InterpretationNetworkIntro',
            items: [
                {
                    id: 'interpretationNetwork-nav-intro',
                    kind: 'section',
                    title: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Start', version: 1, isActive: true },
                            ru: { content: 'Начало', version: 1, isActive: true }
                        }
                    },
                    icon: 'home',
                    href: null,
                    sectionId: 'InterpretationNetworkIntro',
                    sortOrder: 0,
                    isActive: true
                },
                {
                    id: 'interpretationNetwork-nav-structures',
                    kind: 'section',
                    title: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Structures', version: 1, isActive: true },
                            ru: { content: 'Структуры', version: 1, isActive: true }
                        }
                    },
                    icon: 'object',
                    href: null,
                    sectionId: 'Structure',
                    objectCollectionId: 'Structure',
                    sortOrder: 1,
                    isActive: true
                }
            ]
        })
    },
    {
        zone: 'center',
        widgetKey: 'interpretationNetworkWorkspace',
        sortOrder: 1,
        isActive: true,
        config: enrichConfigWithVlcTimestamps({
            visibleFor: {
                sectionCodenames: ['Structure'],
                objectCollectionCodenames: ['Structure']
            },
            matrixMode: 'hierarchicalCells',
            hierarchyLayout: 'horizontalRows',
            hierarchyRowMode: 'focusedPath',
            positionNumbering: {
                enabled: true,
                includeRoot: true,
                startIndex: 1
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
        })
    }
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
        { presetCodename: 'page', includedByDefault: true },
        { presetCodename: 'object', includedByDefault: true },
        { presetCodename: 'set', includedByDefault: true },
        { presetCodename: 'enumeration', includedByDefault: true }
    ],
    seed: {
        layouts: [INTERPRETATION_NETWORK_SEED_LAYOUT],
        layoutZoneWidgets: {
            main: INTERPRETATION_NETWORK_SEED_ZONE_WIDGETS
        },
        entities: INTERPRETATION_NETWORK_STAGE2.seedEntities,
        optionValues: {
            Context: INTERPRETATION_NETWORK_STAGE2.contextValues,
            RelationType: INTERPRETATION_NETWORK_STAGE2.relationTypeValues,
            CellColor: INTERPRETATION_NETWORK_STAGE2.cellColorValues
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
