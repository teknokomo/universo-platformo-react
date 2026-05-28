import { createHash } from 'crypto'
import path from 'path'
import { parse } from 'acorn'
import { build, type Plugin } from 'esbuild'
import * as ts from 'typescript'
import {
    DEFAULT_MODULE_ROLE,
    DEFAULT_MODULE_SDK_API_VERSION,
    DEFAULT_MODULE_SOURCE_KIND,
    normalizeModuleCapabilities,
    normalizeModuleRole,
    normalizeModuleSourceKind,
    resolveModuleSdkApiVersion,
    type CompiledModuleArtifact,
    type ModuleCompilationInput,
    type ModuleCompilationLibraryInput,
    type ModuleManifest,
    type ModuleMethodManifest,
    type ModulePackageImport,
    type ModuleRole,
    type ModuleMethodTarget
} from '@universo-react/types'

type BundleTarget = 'server' | 'client'

interface DecoratedMethod {
    name: string
    target: ModuleMethodTarget
    eventName: string | null
    bodyStart: number
    bodyEnd: number
}

interface ModuleAnalysis {
    className: string
    manifest: ModuleManifest
    methods: DecoratedMethod[]
    packageImports: ModulePackageImport[]
}

type MethodBindingUsage = {
    methodName: string
    target: ModuleMethodTarget
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

const ALLOWED_MODULE_IMPORTS = new Set(['@universo-react/extension-sdk'])
const SHARED_LIBRARY_IMPORT_PREFIX = '@shared/'
const ROOT_SHARED_LIBRARY_NODE = '__root__'
const SUPPORTED_RUNTIME_PACKAGE_EXPORTS: Record<string, Partial<Record<BundleTarget, ReadonlySet<string>>>> = {
    '@universo-react/colyseus-client': {
        client: new Set([
            'createMoveToPointIntent',
            'createMoveToObjectIntent',
            'createStopIntent',
            'lerpNumber',
            'lerpVector3',
            'interpolateSnapshotVector3',
            'isDoubleClickActivation'
        ])
    },
    '@universo-react/playcanvas-engine': {
        client: new Set([
            'resolveFollowCameraPosition',
            'zoomFollowCamera',
            'rotateFollowCamera',
            'createAabbFromCenterAndSize',
            'isPointInsideAabb'
        ])
    },
    '@universo-react/colyseus-server': {
        server: new Set([
            'cloneVector3',
            'createVector3',
            'addVector3',
            'subtractVector3',
            'scaleVector3',
            'vector3Length',
            'normalizeVector3',
            'distanceVector3',
            'isPointInsideAabb',
            'segmentIntersectsAabb',
            'createStoppedMovementState',
            'applyMoveToPointIntent',
            'applyStopIntent',
            'stepFixedTickMovement'
        ])
    }
}
const MODULE_RESOLVE_PATHS = [
    path.resolve(process.cwd(), 'node_modules'),
    path.resolve(process.cwd(), 'packages/universo-react-modules-engine/node_modules')
]

const isSharedLibraryImport = (value: string): boolean => value.startsWith(SHARED_LIBRARY_IMPORT_PREFIX)

const extractSharedLibraryCodename = (value: string): string | null => {
    if (!isSharedLibraryImport(value)) {
        return null
    }

    const codename = value.slice(SHARED_LIBRARY_IMPORT_PREFIX.length).trim()
    if (!/^[a-z][a-z0-9-]*$/.test(codename)) {
        throw new Error(`Invalid shared library codename: "${codename}"`)
    }

    return codename
}

const isAllowedModuleImport = (value: string, allowedPackageNames: Set<string>): boolean =>
    ALLOWED_MODULE_IMPORTS.has(value) || allowedPackageNames.has(value) || isSharedLibraryImport(value)

const getSupportedRuntimePackageExports = (packageName: string, targets: readonly BundleTarget[]): ReadonlySet<string> | null => {
    const byTarget = SUPPORTED_RUNTIME_PACKAGE_EXPORTS[packageName]
    if (!byTarget) {
        return null
    }

    let supported: Set<string> | null = null
    for (const target of targets) {
        const targetExports = byTarget[target]
        if (!targetExports) {
            return null
        }
        supported =
            supported === null ? new Set(targetExports) : new Set([...supported].filter((exportName) => targetExports.has(exportName)))
    }

    return supported
}

const assertRuntimePackageImportSurface = (
    packageName: string,
    targets: readonly BundleTarget[],
    importedNames: readonly string[]
): void => {
    const supportedExports = getSupportedRuntimePackageExports(packageName, targets)
    if (!supportedExports) {
        throw new Error(`Package "${packageName}" is not executable in embedded module runtime for target(s): ${targets.join(', ')}`)
    }

    const unsupported = importedNames.filter((name) => !supportedExports.has(name))
    if (unsupported.length > 0) {
        throw new Error(
            `Package "${packageName}" import(s) are not available in embedded module runtime: ${unsupported
                .map((item) => JSON.stringify(item))
                .join(', ')}. Supported exports: ${[...supportedExports].sort().join(', ')}`
        )
    }
}

const normalizeAllowedPackageImports = (input: ModuleCompilationInput): ModulePackageImport[] => {
    const seen = new Set<string>()
    const normalized: ModulePackageImport[] = []

    for (const item of input.allowedPackageImports ?? []) {
        const packageName = item.packageName.trim()
        const version = item.version.trim()
        const targets = [...new Set(item.targets)].filter((target) => target === 'server' || target === 'client').sort()

        if (!packageName || !version || targets.length === 0 || seen.has(packageName)) {
            continue
        }

        seen.add(packageName)
        normalized.push({
            packageName,
            version,
            targets
        })
    }

    return normalized.sort((left, right) => left.packageName.localeCompare(right.packageName))
}

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

const resolveTarget = (decorators: readonly ts.Decorator[]): ModuleMethodTarget => {
    const decoratorNames = new Set(decorators.map(getDecoratorName).filter(Boolean))
    const hasServer = decoratorNames.has(METHOD_DECORATORS.atServer)
    const hasClient = decoratorNames.has(METHOD_DECORATORS.atClient)
    const hasServerAndClient = decoratorNames.has(METHOD_DECORATORS.atServerAndClient)

    if ((hasServer && hasClient) || (hasServerAndClient && (hasServer || hasClient))) {
        throw new Error('A module method cannot combine @AtServerAndClient with @AtServer or @AtClient')
    }

    if (hasServerAndClient) {
        return 'server_and_client'
    }

    if (hasClient) {
        return 'client'
    }

    return 'server'
}

const resolveExtendedBaseClassName = (node: ts.ClassDeclaration): string | null => {
    const heritageClause = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
    const baseType = heritageClause?.types[0]
    if (!baseType) {
        return null
    }

    const expression = baseType.expression
    if (ts.isIdentifier(expression)) {
        return expression.text
    }

    return null
}

const findModuleClass = (sourceFile: ts.SourceFile, moduleRole: ModuleRole): ts.ClassDeclaration => {
    let firstClass: ts.ClassDeclaration | null = null
    let preferredClass: ts.ClassDeclaration | null = null
    const preferredBaseClassName = moduleRole === 'library' ? 'SharedLibraryModule' : 'ExtensionModule'

    const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node)) {
            firstClass ??= node

            if (resolveExtendedBaseClassName(node) === preferredBaseClassName) {
                preferredClass = node
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    const selectedClass = preferredClass ?? firstClass

    if (!selectedClass) {
        throw new Error('Module source must contain a class declaration')
    }

    return selectedClass
}

const normalizeImportSpecifier = (value: string): string => value.trim()

const collectStaticImportSpecifiers = (sourceFile: ts.SourceFile): string[] => {
    const imports = new Set<string>()

    const addImport = (value: string) => {
        imports.add(normalizeImportSpecifier(value))
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
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    return [...imports].sort()
}

export const extractSharedModuleImports = (sourceCode: string): string[] => {
    const sourceFile = ts.createSourceFile('extension-module.ts', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const sharedImports = new Set<string>()

    for (const importSpecifier of collectStaticImportSpecifiers(sourceFile)) {
        const codename = extractSharedLibraryCodename(importSpecifier)
        if (codename) {
            sharedImports.add(codename)
        }
    }

    return [...sharedImports].sort()
}

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

const collectTopLevelRuntimeBindings = (sourceFile: ts.SourceFile, moduleClass: ts.ClassDeclaration): Set<string> => {
    const bindings = new Set<string>()

    for (const statement of sourceFile.statements) {
        if (statement === moduleClass) {
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
    target: ModuleMethodTarget,
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
    moduleClass: ts.ClassDeclaration,
    methodUsages: readonly MethodBindingUsage[]
): void => {
    const topLevelBindings = collectTopLevelRuntimeBindings(sourceFile, moduleClass)
    if (topLevelBindings.size === 0 || methodUsages.length === 0) {
        return
    }

    const bindingTargets = new Map<string, Set<ModuleMethodTarget>>()

    for (const usage of methodUsages) {
        for (const binding of usage.referencedBindings) {
            const targets = bindingTargets.get(binding) ?? new Set<ModuleMethodTarget>()
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
            `Embedded module source cannot share top-level runtime bindings between client and server methods. ` +
                `Move the binding behind target-specific methods or duplicate a safe client-only subset. ` +
                `Conflicting bindings: ${sharedBindings.join(', ')}`
        )
    }
}

const validateModuleSource = (sourceFile: ts.SourceFile, allowedPackageImports: readonly ModulePackageImport[]): ModulePackageImport[] => {
    const allowedPackageNames = new Set(allowedPackageImports.map((item) => item.packageName))
    const allowedPackageByName = new Map(allowedPackageImports.map((item) => [item.packageName, item]))
    const usedPackageNames = new Set<string>()
    const unsupportedImports = new Set<string>()
    let hasDynamicImport = false
    let hasRequireCall = false
    let hasImportMeta = false

    const addImport = (value: string) => {
        const normalized = normalizeImportSpecifier(value)
        if (!isAllowedModuleImport(normalized, allowedPackageNames)) {
            unsupportedImports.add(normalized)
        } else if (allowedPackageNames.has(normalized)) {
            usedPackageNames.add(normalized)
        }
    }

    const validatePackageImportNames = (packageName: string, importedNames: readonly string[]) => {
        const normalized = normalizeImportSpecifier(packageName)
        const packageImport = allowedPackageByName.get(normalized)
        if (!packageImport) {
            return
        }
        assertRuntimePackageImportSurface(normalized, packageImport.targets as readonly BundleTarget[], importedNames)
    }

    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            addImport(node.moduleSpecifier.text)
            const packageImport = allowedPackageByName.get(normalizeImportSpecifier(node.moduleSpecifier.text))
            if (packageImport && node.importClause && !node.importClause.isTypeOnly) {
                const importedNames: string[] = []
                if (node.importClause.name) {
                    importedNames.push('default')
                }
                const namedBindings = node.importClause.namedBindings
                if (namedBindings) {
                    if (ts.isNamespaceImport(namedBindings)) {
                        importedNames.push('*')
                    } else {
                        for (const specifier of namedBindings.elements) {
                            if (!specifier.isTypeOnly) {
                                importedNames.push((specifier.propertyName ?? specifier.name).text)
                            }
                        }
                    }
                }
                validatePackageImportNames(node.moduleSpecifier.text, importedNames)
            }
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            addImport(node.moduleSpecifier.text)
            const packageImport = allowedPackageByName.get(normalizeImportSpecifier(node.moduleSpecifier.text))
            if (packageImport && !node.isTypeOnly) {
                const importedNames =
                    node.exportClause && ts.isNamedExports(node.exportClause)
                        ? node.exportClause.elements.map((specifier) => (specifier.propertyName ?? specifier.name).text)
                        : ['*']
                validatePackageImportNames(node.moduleSpecifier.text, importedNames)
            }
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            ts.isStringLiteral(node.moduleReference.expression)
        ) {
            addImport(node.moduleReference.expression.text)
            validatePackageImportNames(node.moduleReference.expression.text, ['*'])
        } else if (ts.isImportTypeNode(node)) {
            const argument = node.argument

            if (ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)) {
                const normalized = normalizeImportSpecifier(argument.literal.text)
                if (!isAllowedModuleImport(normalized, allowedPackageNames)) {
                    unsupportedImports.add(normalized)
                }
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
            `Embedded module source contains unsupported module-loading patterns (${violations.join('; ')}). ` +
                `Only ${[...ALLOWED_MODULE_IMPORTS, ...allowedPackageNames].join(
                    ', '
                )} and ${SHARED_LIBRARY_IMPORT_PREFIX}* imports are supported.`
        )
    }

    return allowedPackageImports.filter((item) => usedPackageNames.has(item.packageName))
}

const isThisCtxAccess = (node: ts.PropertyAccessExpression): boolean => {
    if (ts.isThis(node.expression) && node.name.text === 'ctx') {
        return true
    }

    let current: ts.Expression = node.expression
    while (ts.isPropertyAccessExpression(current)) {
        if (ts.isThis(current.expression) && current.name.text === 'ctx') {
            return true
        }
        current = current.expression
    }

    return false
}

const validateLibraryModuleSource = (sourceFile: ts.SourceFile, selectedClass: ts.ClassDeclaration): void => {
    const forbiddenDecorators = new Set<string>()
    let hasCtxAccess = false

    const selectedClassBaseName = resolveExtendedBaseClassName(selectedClass)
    if (selectedClassBaseName === 'ExtensionModule') {
        throw new Error('Library modules cannot extend ExtensionModule. Use SharedLibraryModule or a plain helper class instead.')
    }

    if (selectedClassBaseName && selectedClassBaseName !== 'SharedLibraryModule') {
        throw new Error('Library modules can extend only SharedLibraryModule or a plain helper class.')
    }

    const visit = (node: ts.Node): void => {
        for (const decorator of getDecorators(node)) {
            const decoratorName = getDecoratorName(decorator)
            if (
                decoratorName &&
                Object.values(METHOD_DECORATORS).includes(decoratorName as (typeof METHOD_DECORATORS)[keyof typeof METHOD_DECORATORS])
            ) {
                forbiddenDecorators.add(decoratorName)
            }
        }

        if (ts.isPropertyAccessExpression(node) && isThisCtxAccess(node)) {
            hasCtxAccess = true
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    if (forbiddenDecorators.size > 0) {
        throw new Error(`Library modules cannot use runtime decorators: ${[...forbiddenDecorators].sort().join(', ')}`)
    }

    if (hasCtxAccess) {
        throw new Error('Library modules cannot access this.ctx or runtime-bound SDK APIs.')
    }
}

const resolveSharedLibraryDependencyOrder = (input: ModuleCompilationInput): string[] => {
    const moduleRole = normalizeModuleRole(input.moduleRole ?? DEFAULT_MODULE_ROLE)
    const sharedLibrarySources = new Map<string, string>()

    for (const [codename, library] of Object.entries(input.sharedLibraries ?? {})) {
        sharedLibrarySources.set(codename, library.sourceCode)
    }

    const rootNode = moduleRole === 'library' ? input.codename : ROOT_SHARED_LIBRARY_NODE
    sharedLibrarySources.set(rootNode, input.sourceCode)

    const visited = new Set<string>()
    const visiting: string[] = []
    const ordered: string[] = []

    const visit = (codename: string): void => {
        if (visited.has(codename)) {
            return
        }

        const cycleStartIndex = visiting.indexOf(codename)
        if (cycleStartIndex >= 0) {
            const cycle = [...visiting.slice(cycleStartIndex), codename].map((item) =>
                item === ROOT_SHARED_LIBRARY_NODE ? input.codename : item
            )
            throw new Error(`Circular @shared imports detected: ${cycle.join(' -> ')}`)
        }

        const sourceCode = sharedLibrarySources.get(codename)
        if (!sourceCode) {
            throw new Error(`Shared library "${SHARED_LIBRARY_IMPORT_PREFIX}${codename}" not found in metahub`)
        }

        visiting.push(codename)
        for (const dependency of extractSharedModuleImports(sourceCode)) {
            visit(dependency)
        }
        visiting.pop()

        visited.add(codename)
        ordered.push(codename)
    }

    visit(rootNode)

    return ordered.filter((codename) => codename !== rootNode)
}

const analyzeModuleSource = (input: ModuleCompilationInput): ModuleAnalysis => {
    const sdkApiVersion = resolveModuleSdkApiVersion({
        sdkApiVersion: input.sdkApiVersion ?? DEFAULT_MODULE_SDK_API_VERSION
    })
    const moduleRole = normalizeModuleRole(input.moduleRole ?? DEFAULT_MODULE_ROLE)
    const allowedPackageImports = normalizeAllowedPackageImports(input)
    const sourceFile = ts.createSourceFile('extension-module.ts', input.sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const packageImports = validateModuleSource(sourceFile, allowedPackageImports)
    resolveSharedLibraryDependencyOrder(input)
    const selectedClass = findModuleClass(sourceFile, moduleRole)
    if (moduleRole === 'library') {
        validateLibraryModuleSource(sourceFile, selectedClass)
    }
    const topLevelBindings = collectTopLevelRuntimeBindings(sourceFile, selectedClass)
    const methods: DecoratedMethod[] = []
    const manifestMethods: ModuleMethodManifest[] = []
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
        className: selectedClass.name?.text ?? 'ExtensionModuleModule',
        manifest: {
            className: selectedClass.name?.text ?? 'ExtensionModuleModule',
            sdkApiVersion,
            moduleRole,
            sourceKind: normalizeModuleSourceKind(input.sourceKind ?? DEFAULT_MODULE_SOURCE_KIND),
            capabilities: normalizeModuleCapabilities(moduleRole, input.capabilities),
            methods: manifestMethods,
            packageImports: packageImports.length > 0 ? packageImports : undefined
        },
        methods,
        packageImports
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

const createSharedLibraryPlugin = (sharedLibraries?: Record<string, ModuleCompilationLibraryInput>): Plugin => ({
    name: 'universo-shared-library',
    setup(buildApi) {
        buildApi.onResolve({ filter: /^@shared\// }, (args) => ({
            path: args.path,
            namespace: 'universo-shared-library'
        }))

        buildApi.onLoad({ filter: /.*/, namespace: 'universo-shared-library' }, async (args) => {
            const codename = extractSharedLibraryCodename(args.path)
            if (!codename) {
                throw new Error(`Unsupported shared library import: ${args.path}`)
            }

            const library = sharedLibraries?.[codename]
            if (!library) {
                throw new Error(`Shared library "${args.path}" not found in metahub`)
            }

            return {
                contents: library.sourceCode,
                loader: 'ts',
                resolveDir: process.cwd()
            }
        })
    }
})

const createPackageExternalPlugin = (packageImports: readonly ModulePackageImport[], bundleTarget: BundleTarget): Plugin => ({
    name: 'universo-package-imports',
    setup(buildApi) {
        const imports = new Map(packageImports.map((item) => [item.packageName, item]))

        buildApi.onResolve({ filter: /.*/ }, (args) => {
            const packageImport = imports.get(args.path)
            if (!packageImport) {
                return undefined
            }

            if (!packageImport.targets.includes(bundleTarget)) {
                return {
                    path: args.path,
                    namespace: 'universo-disabled-package-import',
                    pluginData: packageImport
                }
            }

            return {
                path: args.path,
                external: true
            }
        })

        buildApi.onLoad({ filter: /.*/, namespace: 'universo-disabled-package-import' }, (args) => {
            const packageImport = args.pluginData as ModulePackageImport | undefined
            const supportedExports = packageImport
                ? getSupportedRuntimePackageExports(packageImport.packageName, packageImport.targets as readonly BundleTarget[])
                : null
            const unavailableMessage = JSON.stringify(
                `Package "${args.path}" is not available for the ${bundleTarget} module bundle target`
            )
            const exportNames = [...(supportedExports ?? [])].sort()
            const contents = exportNames.map((name) => `export const ${name} = () => { throw new Error(${unavailableMessage}) }`).join('\n')

            return {
                contents,
                loader: 'js'
            }
        })
    }
})

const bundleSource = async (
    sourceCode: string,
    platform: 'node' | 'browser',
    sharedLibraries?: Record<string, ModuleCompilationLibraryInput>,
    packageImports: readonly ModulePackageImport[] = []
): Promise<string> => {
    const bundleTarget: BundleTarget = platform === 'node' ? 'server' : 'client'
    const result = await build({
        stdin: {
            contents: sourceCode,
            sourcefile: 'extension-module.ts',
            loader: 'ts',
            resolveDir: process.cwd()
        },
        write: false,
        bundle: true,
        platform,
        format: 'cjs',
        target: 'es2022',
        logLevel: 'silent',
        nodePaths: MODULE_RESOLVE_PATHS,
        plugins: [createPackageExternalPlugin(packageImports, bundleTarget), createSharedLibraryPlugin(sharedLibraries)],
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
        sourceType: 'module'
    })

    return output
}

export const compileModuleSource = async (input: ModuleCompilationInput): Promise<CompiledModuleArtifact> => {
    const analysis = analyzeModuleSource(input)
    const serverSource = applyBundleTransform(input.sourceCode, analysis.methods, 'server')
    const clientSource = applyBundleTransform(input.sourceCode, analysis.methods, 'client')

    const [serverBundle, clientBundle] = await Promise.all([
        bundleSource(serverSource, 'node', input.sharedLibraries, analysis.packageImports),
        bundleSource(clientSource, 'browser', input.sharedLibraries, analysis.packageImports)
    ])

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
