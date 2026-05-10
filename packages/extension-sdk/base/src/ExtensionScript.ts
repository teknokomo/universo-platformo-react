import type { ScriptContext } from './types'

export abstract class ExtensionScript<Context extends ScriptContext = ScriptContext> {
    declare ctx: Context
}
