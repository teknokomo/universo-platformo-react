// Universo Platformo | Agents Frontend - i18n Registration
// Registers 'agents' namespace for validation and agent components

import { registerNamespace } from '@universo/i18n'

// Import translation files
import en from './en/agents.json'
import ru from './ru/agents.json'

// Register the 'agents' namespace with translations
registerNamespace('agents', { en, ru })

export { en, ru }
