import type { ModuleContext } from './types'

export abstract class ExtensionModule<Context extends ModuleContext = ModuleContext> {
    declare ctx: Context
}
