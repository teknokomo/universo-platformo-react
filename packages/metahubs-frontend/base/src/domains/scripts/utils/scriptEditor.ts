import type { PaletteMode } from '@mui/material'
import { autocompletion, completeFromList, type Completion } from '@codemirror/autocomplete'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { SCRIPT_LIFECYCLE_EVENTS, resolveAllowedScriptCapabilities, type ScriptCapability, type ScriptModuleRole } from '@universo/types'

export interface ScriptRoleGuidance {
    summary: string
    entryPoints: string[]
    allowedCapabilities: ScriptCapability[]
}

const BASE_SCRIPT_EDITOR_COMPLETIONS: Completion[] = [
    {
        label: 'ExtensionScript',
        type: 'class',
        detail: 'SDK base class',
        info: 'Base class for all embedded metahub scripts.'
    },
    {
        label: 'SharedLibraryScript',
        type: 'class',
        detail: 'SDK base class',
        info: 'Marker base class for import-only shared libraries attached to the Common section.'
    },
    {
        label: "import SharedHelpers from '@shared/example-helpers'",
        type: 'keyword',
        detail: 'Shared library import',
        info: 'Imports another Common library by codename through the @shared/<codename> resolver.',
        apply: "import SharedHelpers from '@shared/example-helpers'"
    },
    {
        label: '@AtClient()',
        type: 'keyword',
        detail: 'Decorator',
        info: 'Marks a method for client-side runtime execution.',
        apply: '@AtClient()'
    },
    {
        label: '@AtServer()',
        type: 'keyword',
        detail: 'Decorator',
        info: 'Marks a method for server-side runtime execution.',
        apply: '@AtServer()'
    },
    {
        label: '@AtServerAndClient()',
        type: 'keyword',
        detail: 'Decorator',
        info: 'Keeps a method available in both the server and client bundles.',
        apply: '@AtServerAndClient()'
    },
    {
        label: 'mount()',
        type: 'method',
        detail: 'Widget entry point',
        info: 'Client widget entry point used by QuizWidget and other runtime widgets.',
        apply: 'mount()'
    },
    {
        label: 'submit(payload)',
        type: 'method',
        detail: 'Widget submit hook',
        info: 'Optional widget method that can proxy answer validation to the server.',
        apply: 'submit(payload)'
    },
    {
        label: 'this.ctx.records.list',
        type: 'property',
        detail: 'records.read',
        info: 'Lists records for the attached runtime entity.',
        apply: 'this.ctx.records.list'
    },
    {
        label: 'this.ctx.records.get',
        type: 'property',
        detail: 'records.read',
        info: 'Loads a single record by id.',
        apply: 'this.ctx.records.get'
    },
    {
        label: 'this.ctx.records.findByCodename',
        type: 'property',
        detail: 'records.read',
        info: 'Resolves a runtime record by codename.',
        apply: 'this.ctx.records.findByCodename'
    },
    {
        label: 'this.ctx.records.create',
        type: 'property',
        detail: 'records.write',
        info: 'Creates a runtime record inside the current application context.',
        apply: 'this.ctx.records.create'
    },
    {
        label: 'this.ctx.records.update',
        type: 'property',
        detail: 'records.write',
        info: 'Patches an existing runtime record.',
        apply: 'this.ctx.records.update'
    },
    {
        label: 'this.ctx.records.delete',
        type: 'property',
        detail: 'records.write',
        info: 'Deletes a runtime record with lifecycle enforcement.',
        apply: 'this.ctx.records.delete'
    },
    {
        label: 'this.ctx.metadata.getAttachedEntity',
        type: 'property',
        detail: 'metadata.read',
        info: 'Returns the current metahub attachment target.',
        apply: 'this.ctx.metadata.getAttachedEntity'
    },
    {
        label: 'this.ctx.metadata.getByCodename',
        type: 'property',
        detail: 'metadata.read',
        info: 'Resolves metadata by attachment kind and codename.',
        apply: 'this.ctx.metadata.getByCodename'
    },
    {
        label: 'this.ctx.callServerMethod',
        type: 'property',
        detail: 'rpc.client',
        info: 'Calls a server-side script method from client code.',
        apply: 'this.ctx.callServerMethod'
    },
    {
        label: 'this.ctx.http?.request',
        type: 'property',
        detail: 'Reserved SDK seam',
        info: 'Forward-compatible HTTP bridge surface reserved by the SDK contract.',
        apply: 'this.ctx.http?.request'
    },
    {
        label: 'this.ctx.state?.get',
        type: 'property',
        detail: 'Reserved SDK seam',
        info: 'Forward-compatible state API surface reserved by the SDK contract.',
        apply: 'this.ctx.state?.get'
    },
    {
        label: 'this.ctx.log?.info',
        type: 'property',
        detail: 'Reserved SDK seam',
        info: 'Forward-compatible logging API surface reserved by the SDK contract.',
        apply: 'this.ctx.log?.info'
    },
    {
        label: 'this.ctx.i18n?.translate',
        type: 'property',
        detail: 'Reserved SDK seam',
        info: 'Forward-compatible i18n API surface reserved by the SDK contract.',
        apply: 'this.ctx.i18n?.translate'
    }
]

const LIFECYCLE_COMPLETIONS: Completion[] = SCRIPT_LIFECYCLE_EVENTS.map((eventName) => ({
    label: `@OnEvent('${eventName}')`,
    type: 'keyword',
    detail: 'Lifecycle decorator',
    info: `Subscribes the method to the ${eventName} lifecycle event.`,
    apply: `@OnEvent('${eventName}')`
}))

export const SCRIPT_EDITOR_COMPLETIONS: Completion[] = [...BASE_SCRIPT_EDITOR_COMPLETIONS, ...LIFECYCLE_COMPLETIONS]

const scriptEditorCompletionSource = completeFromList(SCRIPT_EDITOR_COMPLETIONS)

export const buildScriptEditorExtensions = () => [
    javascript({ typescript: true }),
    autocompletion({ override: [scriptEditorCompletionSource] })
]

export const getScriptEditorTheme = (mode: PaletteMode) => (mode === 'dark' ? vscodeDark : vscodeLight)

export const getScriptRoleGuidance = (moduleRole: ScriptModuleRole): ScriptRoleGuidance => {
    switch (moduleRole) {
        case 'lifecycle':
            return {
                summary:
                    'Lifecycle modules are optimized for before/after entity events and usually validate, enrich, or veto record mutations.',
                entryPoints: SCRIPT_LIFECYCLE_EVENTS.map((eventName) => `@OnEvent('${eventName}')`),
                allowedCapabilities: resolveAllowedScriptCapabilities(moduleRole)
            }
        case 'widget':
            return {
                summary:
                    'Widget modules should expose a client mount() method and can optionally proxy submit(payload) to the server through callServerMethod().',
                entryPoints: ['mount()', 'submit(payload)'],
                allowedCapabilities: resolveAllowedScriptCapabilities(moduleRole)
            }
        case 'library':
            return {
                summary:
                    'Library modules are import-only shared helpers for the Common section. Keep them pure, reuse @shared/<codename> imports when needed, and avoid decorators or runtime ctx access.',
                entryPoints: ['static formatValue()', "import Utils from '@shared/example-helpers'"],
                allowedCapabilities: resolveAllowedScriptCapabilities(moduleRole)
            }
        case 'module':
        default:
            return {
                summary: 'General modules can mix record and metadata operations and may also subscribe to lifecycle hooks when needed.',
                entryPoints: ['mount()', 'ping()', "@OnEvent('afterCreate')"],
                allowedCapabilities: resolveAllowedScriptCapabilities(moduleRole)
            }
    }
}
