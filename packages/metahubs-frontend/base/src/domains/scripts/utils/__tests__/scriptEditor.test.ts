import { describe, expect, it } from 'vitest'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { getScriptEditorTheme, getScriptRoleGuidance, SCRIPT_EDITOR_COMPLETIONS } from '../scriptEditor'

describe('scriptEditor utils', () => {
    it('exposes SDK and lifecycle completions for embedded script authoring', () => {
        const labels = SCRIPT_EDITOR_COMPLETIONS.map((completion) => completion.label)

        expect(labels).toContain('ExtensionScript')
        expect(labels).toContain('@AtClient()')
        expect(labels).toContain('@AtServer()')
        expect(labels).toContain('@AtServerAndClient()')
        expect(labels).toContain("@OnEvent('afterDelete')")
        expect(labels).toContain('this.ctx.callServerMethod')
        expect(labels).toContain('this.ctx.http?.request')
    })

    it('uses VSCode themes that follow the current MUI palette mode', () => {
        expect(getScriptEditorTheme('dark')).toBe(vscodeDark)
        expect(getScriptEditorTheme('light')).toBe(vscodeLight)
    })

    it('returns widget-specific authoring guidance with the effective capability set', () => {
        const guidance = getScriptRoleGuidance('widget')

        expect(guidance.entryPoints).toEqual(['mount()', 'submit(payload)'])
        expect(guidance.allowedCapabilities).toEqual(['metadata.read', 'rpc.client'])
        expect(guidance.summary).toContain('mount()')
    })
})
