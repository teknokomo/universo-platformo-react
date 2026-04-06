import { createHash } from 'crypto'
import { parse } from 'acorn'
import { build } from 'esbuild'
import * as ts from 'typescript'
import {
    DEFAULT_SCRIPT_MODULE_ROLE,
    DEFAULT_SCRIPT_SDK_API_VERSION,
    DEFAULT_SCRIPT_SOURCE_KIND,
    normalizeScriptCapabilities,
    normalizeScriptModuleRole,
    normalizeScriptSourceKind,
    resolveScriptSdkApiVersion,
    type CompiledScriptArtifact,
    type ScriptCompilationInput,
    type ScriptManifest,
    type ScriptMethodManifest,
    type ScriptMethodTarget
} from '@universo/types'

type BundleTarget = 'server' | 'client'

interface DecoratedMethod {
    name: string
    target: ScriptMethodTarget
    eventName: string | null
    bodyStart: number
    bodyEnd: number
}

interface ScriptAnalysis {
    className: string
    manifest: ScriptManifest
    methods: DecoratedMethod[]
}

type MethodBindingUsage = {
    methodName: string
    target: ScriptMethodTarget
    referencedBindings: string[]
}

interface SourceValidationResult {
    unsupportedImports: string[]
    hasDynamicImport: boolean
    hasRequireCall: boolean
    hasImportMeta: boolean
}

const METHOD_DECORATORS = {
    atServer: 'AtServer',
    atClient: 'AtClient',
    atServerAndClient: 'AtServerAndClient',
    onEvent: 'OnEvent'
} as const

const ALLOWED_SCRIPT_IMPORTS = new Set(['@universo/extension-sdk'])

const getDecorators = (node: ts.Node): readonly ts.Decorator[] => {
    if (!ts.canHaveDecorators(node)) {
        return []
    }

    return ts.getDecorators(node) ?? []
}

const getDecoratorName = (decorator: ts.Decorator): string | null => {
    const expression = decorator.expression

    if (ts.isIdentifier(expression)) {
        return expression.text
    }

    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
        return expression.expression.text
    }

    return null
}

const getDecoratorStringArgument = (decorator: ts.Decorator): string | null => {
    const expression = decorator.expression

    if (!ts.isCallExpression(expression) || expression.arguments.length === 0) {
        return null
    }

    const [firstArgument] = expression.arguments

    if (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument)) {
        return firstArgument.text
    }

    return null
}

const resolveTarget = (decorators: readonly ts.Decorator[]): ScriptMethodTarget => {
    const decoratorNames = new Set(decorators.map(getDecoratorName).filter(Boolean))
    const hasServer = decoratorNames.has(METHOD_DECORATORS.atServer)
    const hasClient = decoratorNames.has(METHOD_DECORATORS.atClient)
    const hasServerAndClient = decoratorNames.has(METHOD_DECORATORS.atServerAndClient)

    if ((hasServer && hasClient) || (hasServerAndClient && (hasServer || hasClient))) {
        throw new Error('A script method cannot combine @AtServerAndClient with @AtServer or @AtClient')
    }

    if (hasServerAndClient) {
        return 'server_and_client'
    }

    if (hasClient) {
        return 'client'
    }

    return 'server'
}

const findScriptClass = (sourceFile: ts.SourceFile): ts.ClassDeclaration => {
    let firstClass: ts.ClassDeclaration | null = null
    let extensionClass: ts.ClassDeclaration | null = null

    const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node)) {
            firstClass ??= node

            const heritageClause = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
            const extendsExtensionScript = heritageClause?.types.some((typeNode) => {
                const expression = typeNode.expression
                return ts.isIdentifier(expression) && expression.text === 'ExtensionScript'
            })

            if (extendsExtensionScript) {
                extensionClass = node
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    const selectedClass = extensionClass ?? firstClass

    if (!selectedClass) {
        throw new Error('Script source must contain a class declaration')
    }

    return selectedClass
}

const normalizeImportSpecifier = (value: string): string => value.trim()

const collectBindingIdentifiers = (name: ts.BindingName): string[] => {
    if (ts.isIdentifier(name)) {
        return [name.text]
    }

    const identifiers: string[] = []
    for (const element of name.elements) {
        identifiers.push(...collectBindingIdentifiers(element.name))
    }
    return identifiers
}

const collectTopLevelRuntimeBindings = (sourceFile: ts.SourceFile, scriptClass: ts.ClassDeclaration): Set<string> => {
    const bindings = new Set<string>()

    for (const statement of sourceFile.statements) {
        if (statement === scriptClass) {
            continue
        }

        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                for (const binding of collectBindingIdentifiers(declaration.name)) {
                    bindings.add(binding)
                }
            }
            continue
        }

        if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
            if (statement.name) {
                bindings.add(statement.name.text)
            }
        }
    }

    return bindings
}

const isReferenceIdentifier = (node: ts.Identifier): boolean => {
    const parent = node.parent

    if (!parent) {
        return true
    }

    if (
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isPropertyDeclaration(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node) ||
        (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
        (ts.isBindingElement(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isParameter(parent) && parent.name === node) ||
        (ts.isFunctionDeclaration(parent) && parent.name === node) ||
        (ts.isFunctionExpression(parent) && parent.name === node) ||
        (ts.isClassDeclaration(parent) && parent.name === node) ||
        (ts.isClassExpression(parent) && parent.name === node) ||
        (ts.isEnumDeclaration(parent) && parent.name === node) ||
        (ts.isImportClause(parent) && parent.name === node) ||
        (ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) ||
        (ts.isNamespaceImport(parent) && parent.name === node) ||
        (ts.isImportEqualsDeclaration(parent) && parent.name === node) ||
        (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
        (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
        (ts.isTypeParameterDeclaration(parent) && parent.name === node) ||
        (ts.isLabeledStatement(parent) && parent.label === node) ||
        (ts.isBreakOrContinueStatement(parent) && parent.label === node) ||
        (ts.isExportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) ||
        (ts.isQualifiedName(parent) && parent.right === node)
    ) {
        return false
    }

    return true
}

const collectMethodBindingUsage = (
    method: ts.MethodDeclaration,
    methodName: string,
    target: ScriptMethodTarget,
    topLevelBindings: Set<string>
): MethodBindingUsage => {
    const referencedBindings = new Set<string>()
    const scopeStack: Set<string>[] = [new Set<string>()]

    const declareBindings = (name: ts.BindingName) => {
        for (const binding of collectBindingIdentifiers(name)) {
            scopeStack[scopeStack.length - 1].add(binding)
        }
    }

    for (const parameter of method.parameters) {
        declareBindings(parameter.name)
    }

    const isShadowed = (name: string): boolean => scopeStack.some((scope) => scope.has(name))

    const visit = (node: ts.Node): void => {
        let pushedScope = false

        if (node !== method && (ts.isBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node) || ts.isCatchClause(node))) {
            scopeStack.push(new Set<string>())
            pushedScope = true

            if (ts.isCatchClause(node) && node.variableDeclaration) {
                declareBindings(node.variableDeclaration.name)
            }
        }

        if (ts.isVariableDeclaration(node)) {
            if (node.initializer) {
                visit(node.initializer)
            }
            declareBindings(node.name)
            if (pushedScope) {
                scopeStack.pop()
            }
            return
        }

        if (ts.isFunctionDeclaration(node)) {
            if (node !== method && node.name) {
                scopeStack[scopeStack.length - 1].add(node.name.text)
            }

            if (node !== method) {
                scopeStack.push(new Set<string>())
                if (node.name) {
                    scopeStack[scopeStack.length - 1].add(node.name.text)
                }
                for (const parameter of node.parameters) {
                    declareBindings(parameter.name)
                }
                ts.forEachChild(node, visit)
                scopeStack.pop()
                if (pushedScope) {
                    scopeStack.pop()
                }
                return
            }
        }

        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            scopeStack.push(new Set<string>())
            if (ts.isFunctionExpression(node) && node.name) {
                scopeStack[scopeStack.length - 1].add(node.name.text)
            }
            for (const parameter of node.parameters) {
                declareBindings(parameter.name)
            }
            ts.forEachChild(node, visit)
            scopeStack.pop()
            if (pushedScope) {
                scopeStack.pop()
            }
            return
        }

        if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)) {
            if (node !== method && node.name) {
                scopeStack[scopeStack.length - 1].add(node.name.text)
            }
        }

        if (ts.isIdentifier(node) && topLevelBindings.has(node.text) && isReferenceIdentifier(node) && !isShadowed(node.text)) {
            referencedBindings.add(node.text)
        }

        ts.forEachChild(node, visit)

        if (pushedScope) {
            scopeStack.pop()
        }
    }

    if (method.body) {
        visit(method.body)
    }

    return {
        methodName,
        target,
        referencedBindings: [...referencedBindings].sort()
    }
}

const validateNoCrossTargetTopLevelBindings = (
    sourceFile: ts.SourceFile,
    scriptClass: ts.ClassDeclaration,
    methodUsages: readonly MethodBindingUsage[]
): void => {
    const topLevelBindings = collectTopLevelRuntimeBindings(sourceFile, scriptClass)
    if (topLevelBindings.size === 0 || methodUsages.length === 0) {
        return
    }

    const bindingTargets = new Map<string, Set<ScriptMethodTarget>>()

    for (const usage of methodUsages) {
        for (const binding of usage.referencedBindings) {
            const targets = bindingTargets.get(binding) ?? new Set<ScriptMethodTarget>()
            targets.add(usage.target)
            bindingTargets.set(binding, targets)
        }
    }

    const sharedBindings = [...bindingTargets.entries()]
        .filter(([, targets]) => targets.has('client') && targets.has('server'))
        .map(([binding]) => binding)
        .sort()

    if (sharedBindings.length > 0) {
        throw new Error(
            `Embedded script source cannot share top-level runtime bindings between client and server methods. ` +
                `Move the binding behind target-specific methods or duplicate a safe client-only subset. ` +
                `Conflicting bindings: ${sharedBindings.join(', ')}`
        )
    }
}

const validateScriptSource = (sourceFile: ts.SourceFile): void => {
    const unsupportedImports = new Set<string>()
    let hasDynamicImport = false
    let hasRequireCall = false
    let hasImportMeta = false

    const addImport = (value: string) => {
        const normalized = normalizeImportSpecifier(value)
        if (!ALLOWED_SCRIPT_IMPORTS.has(normalized)) {
            unsupportedImports.add(normalized)
        }
    }

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            addImport(node.moduleSpecifier.text)
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            addImport(node.moduleSpecifier.text)
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            ts.isStringLiteral(node.moduleReference.expression)
        ) {
            addImport(node.moduleReference.expression.text)
        } else if (ts.isImportTypeNode(node)) {
            const argument = node.argument

            if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) {
                addImport(argument.literal.text)
            }
        } else if (ts.isCallExpression(node)) {
            if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
                hasDynamicImport = true
            }

            if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
                hasRequireCall = true
            }
        } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta') {
            hasImportMeta = true
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    const result: SourceValidationResult = {
        unsupportedImports: [...unsupportedImports].sort(),
        hasDynamicImport,
        hasRequireCall,
        hasImportMeta
    }

    const violations: string[] = []

    if (result.unsupportedImports.length > 0) {
        violations.push(`unsupported imports: ${result.unsupportedImports.map((item) => JSON.stringify(item)).join(', ')}`)
    }

    if (result.hasDynamicImport) {
        violations.push('dynamic import expressions')
    }

    if (result.hasRequireCall) {
        violations.push('CommonJS require() calls')
    }

    if (result.hasImportMeta) {
        violations.push('import.meta access')
    }

    if (violations.length > 0) {
        throw new Error(
            `Embedded script source contains unsupported module-loading patterns (${violations.join('; ')}). ` +
                `Only ${[...ALLOWED_SCRIPT_IMPORTS].join(', ')} imports are supported.`
        )
    }
}

const analyzeScriptSource = (input: ScriptCompilationInput): ScriptAnalysis => {
    const sdkApiVersion = resolveScriptSdkApiVersion({
        sdkApiVersion: input.sdkApiVersion ?? DEFAULT_SCRIPT_SDK_API_VERSION
    })
    const sourceFile = ts.createSourceFile('extension-script.ts', input.sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    validateScriptSource(sourceFile)
    const selectedClass = findScriptClass(sourceFile)
    const topLevelBindings = collectTopLevelRuntimeBindings(sourceFile, selectedClass)
    const methods: DecoratedMethod[] = []
    const manifestMethods: ScriptMethodManifest[] = []
    const methodBindingUsages: MethodBindingUsage[] = []

    for (const member of selectedClass.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) {
            continue
        }

        const methodNameNode = member.name
        if (!ts.isIdentifier(methodNameNode) && !ts.isStringLiteral(methodNameNode)) {
            continue
        }

        const decorators = getDecorators(member)
        const decoratorNames = decorators.map(getDecoratorName).filter(Boolean)
        const eventDecorator = decorators.find((decorator) => getDecoratorName(decorator) === METHOD_DECORATORS.onEvent)
        const eventName = eventDecorator ? getDecoratorStringArgument(eventDecorator) : null
        const isExposed =
            decoratorNames.includes(METHOD_DECORATORS.atServer) ||
            decoratorNames.includes(METHOD_DECORATORS.atClient) ||
            decoratorNames.includes(METHOD_DECORATORS.atServerAndClient) ||
            Boolean(eventName)

        if (!isExposed) {
            continue
        }

        const name = methodNameNode.text
        const target = resolveTarget(decorators)

        if (eventName && target !== 'server') {
            throw new Error('Lifecycle event handlers must remain server-only methods')
        }

        methods.push({
            name,
            target,
            eventName,
            bodyStart: member.body.getStart(sourceFile) + 1,
            bodyEnd: member.body.end - 1
        })

        methodBindingUsages.push(collectMethodBindingUsage(member, name, target, topLevelBindings))

        manifestMethods.push({
            name,
            target,
            eventName
        })
    }

    validateNoCrossTargetTopLevelBindings(sourceFile, selectedClass, methodBindingUsages)

    return {
        className: selectedClass.name?.text ?? 'ExtensionScriptModule',
        manifest: {
            className: selectedClass.name?.text ?? 'ExtensionScriptModule',
            sdkApiVersion,
            moduleRole: normalizeScriptModuleRole(input.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE),
            sourceKind: normalizeScriptSourceKind(input.sourceKind ?? DEFAULT_SCRIPT_SOURCE_KIND),
            capabilities: normalizeScriptCapabilities(input.moduleRole ?? DEFAULT_SCRIPT_MODULE_ROLE, input.capabilities),
            methods: manifestMethods
        },
        methods
    }
}

const buildReplacementBody = (method: DecoratedMethod, bundleTarget: BundleTarget): string | null => {
    if (bundleTarget === 'server' && method.target === 'client') {
        return `throw new Error(${JSON.stringify(`Client-only method "${method.name}" is unavailable in the server bundle`)})`
    }

    if (bundleTarget === 'client' && method.target === 'server') {
        return `return this.ctx.callServerMethod(${JSON.stringify(method.name)}, Array.from(arguments))`
    }

    return null
}

const applyBundleTransform = (sourceCode: string, methods: readonly DecoratedMethod[], bundleTarget: BundleTarget): string => {
    const replacements = methods
        .map((method) => ({
            start: method.bodyStart,
            end: method.bodyEnd,
            replacement: buildReplacementBody(method, bundleTarget)
        }))
        .filter((item): item is { start: number; end: number; replacement: string } => typeof item.replacement === 'string')
        .sort((left, right) => right.start - left.start)

    let transformed = sourceCode

    for (const replacement of replacements) {
        transformed = `${transformed.slice(0, replacement.start)}${replacement.replacement}${transformed.slice(replacement.end)}`
    }

    return transformed
}

const bundleSource = async (sourceCode: string, platform: 'node' | 'browser'): Promise<string> => {
    const result = await build({
        stdin: {
            contents: sourceCode,
            sourcefile: 'extension-script.ts',
            loader: 'ts',
            resolveDir: process.cwd()
        },
        write: false,
        bundle: true,
        platform,
        format: 'cjs',
        target: 'es2022',
        logLevel: 'silent',
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                useDefineForClassFields: false
            }
        }
    })

    const output = result.outputFiles?.[0]?.text

    if (!output) {
        throw new Error('esbuild did not return a bundled output file')
    }

    parse(output, {
        ecmaVersion: 'latest',
        sourceType: 'script'
    })

    return output
}

export const compileScriptSource = async (input: ScriptCompilationInput): Promise<CompiledScriptArtifact> => {
    const analysis = analyzeScriptSource(input)
    const serverSource = applyBundleTransform(input.sourceCode, analysis.methods, 'server')
    const clientSource = applyBundleTransform(input.sourceCode, analysis.methods, 'client')

    const [serverBundle, clientBundle] = await Promise.all([bundleSource(serverSource, 'node'), bundleSource(clientSource, 'browser')])

    const checksum = createHash('sha256').update(JSON.stringify(analysis.manifest)).update(serverBundle).update(clientBundle).digest('hex')

    return {
        manifest: {
            ...analysis.manifest,
            checksum
        },
        serverBundle,
        clientBundle,
        checksum
    }
}
