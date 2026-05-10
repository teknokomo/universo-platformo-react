import type { EntityTypePresetManifest } from '@universo/types'
import {
    LEDGER_DEFAULT_INSTANCES,
    LEDGER_TYPE_COMPONENTS,
    LEDGER_TYPE_CONFIG,
    LEDGER_TYPE_UI,
    STANDARD_LEDGER_DESCRIPTION,
    STANDARD_LEDGER_NAME
} from './standardEntityTypeDefinitions'
import { vlc } from './basic.template'

export const ledgerEntityPreset: EntityTypePresetManifest = {
    $schema: 'entity-type-preset/v1',
    codename: 'ledger',
    version: '0.1.0',
    minStructureVersion: '0.4.0',
    name: STANDARD_LEDGER_NAME,
    description: STANDARD_LEDGER_DESCRIPTION,
    meta: {
        author: 'universo-platformo',
        tags: ['preset', 'standard', 'ledger', 'register'],
        icon: LEDGER_TYPE_UI.iconName
    },
    entityType: {
        kindKey: 'ledger',
        codename: vlc('Ledger', 'Ledger'),
        components: LEDGER_TYPE_COMPONENTS,
        ui: LEDGER_TYPE_UI,
        presentation: {
            name: STANDARD_LEDGER_NAME,
            description: STANDARD_LEDGER_DESCRIPTION,
            dialogTitles: {
                create: vlc('Create Ledger', 'Создать регистр'),
                edit: vlc('Edit Ledger', 'Редактировать регистр'),
                copy: vlc('Copy Ledger', 'Копирование регистра'),
                delete: vlc('Delete Ledger', 'Удалить регистр')
            }
        },
        config: LEDGER_TYPE_CONFIG
    },
    defaultInstances: LEDGER_DEFAULT_INSTANCES
}
