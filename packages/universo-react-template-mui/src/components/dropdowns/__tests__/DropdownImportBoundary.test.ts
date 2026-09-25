import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ts from 'typescript'

const repositoryRoot = resolve(__dirname, '../../../../../../')
const sharedDropdownImplementations = new Set([
    'packages/universo-react-template-mui/src/components/dropdowns/DropdownSelect.tsx',
    'packages/universo-react-template-mui/src/components/dropdowns/DropdownAutocomplete.tsx'
])
const dropdownComponentNames = new Set(['Autocomplete', 'Select'])

function collectPackageSources(directory: string, files: string[] = []): string[] {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const entryPath = resolve(directory, entry.name)
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'universo-react-apps-template-mui') continue
            collectPackageSources(entryPath, files)
        } else if (entry.isFile() && /\.(?:tsx?|jsx?)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            files.push(entryPath)
        }
    }

    return files
}

function getImportedDropdownComponents(moduleName: string, clause: ts.ImportClause | ts.ExportDeclaration['exportClause']): string[] {
    if (!clause) return []

    const importedComponents: string[] = []
    const isMaterialRoot = moduleName === '@mui/material'
    const componentSubpath = /^@mui\/material\/(Autocomplete|Select)$/u.exec(moduleName)?.[1]

    if (ts.isImportClause(clause)) {
        if (clause.isTypeOnly) return []
        if (clause.name && componentSubpath) importedComponents.push(componentSubpath)

        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const specifier of clause.namedBindings.elements) {
                if (specifier.isTypeOnly) continue
                const importedName = specifier.propertyName?.text ?? specifier.name.text
                if (isMaterialRoot && dropdownComponentNames.has(importedName)) importedComponents.push(importedName)
                if (componentSubpath && (importedName === componentSubpath || importedName === 'default')) {
                    importedComponents.push(componentSubpath)
                }
            }
        }
    } else if (ts.isNamedExports(clause)) {
        for (const specifier of clause.elements) {
            if (specifier.isTypeOnly) continue
            const importedName = specifier.propertyName?.text ?? specifier.name.text
            if (isMaterialRoot && dropdownComponentNames.has(importedName)) importedComponents.push(importedName)
            if (componentSubpath && (importedName === componentSubpath || importedName === 'default')) {
                importedComponents.push(componentSubpath)
            }
        }
    }

    return importedComponents
}

function findDirectMUIComponentImports(filePath: string, sourceText?: string): string[] {
    const contents = sourceText ?? readFileSync(filePath, 'utf8')
    const scriptKind = /\.jsx?$/u.test(filePath) ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
    const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, scriptKind)
    const fileName = relative(repositoryRoot, filePath).replace(/\\/gu, '/')
    if (sharedDropdownImplementations.has(fileName)) return []

    const violations: string[] = []
    const namespaceImports = new Set<string>()

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
            const moduleName = statement.moduleSpecifier.text
            const components = getImportedDropdownComponents(moduleName, statement.importClause)
            violations.push(...components.map((component) => `${fileName} imports MUI ${component} from ${moduleName}`))
            const bindings = statement.importClause?.namedBindings
            const componentSubpath = /^@mui\/material\/(Autocomplete|Select)$/u.exec(moduleName)?.[1]
            if (moduleName === '@mui/material' && bindings && ts.isNamespaceImport(bindings)) {
                namespaceImports.add(bindings.name.text)
            }
            if (!statement.importClause?.isTypeOnly && componentSubpath && bindings && ts.isNamespaceImport(bindings)) {
                violations.push(`${fileName} imports MUI ${componentSubpath} through a namespace import from ${moduleName}`)
            }
        }

        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
            const moduleName = statement.moduleSpecifier.text
            const components = getImportedDropdownComponents(moduleName, statement.exportClause)
            violations.push(...components.map((component) => `${fileName} re-exports MUI ${component} from ${moduleName}`))
            const componentSubpath = /^@mui\/material\/(Autocomplete|Select)$/u.exec(moduleName)?.[1]
            if (!statement.isTypeOnly && !statement.exportClause) {
                if (componentSubpath) {
                    violations.push(`${fileName} re-exports all of MUI ${componentSubpath} from ${moduleName}`)
                } else if (moduleName === '@mui/material') {
                    violations.push(
                        ...Array.from(dropdownComponentNames, (component) => `${fileName} re-exports MUI ${component} from ${moduleName}`)
                    )
                }
            }
            if (!statement.isTypeOnly && statement.exportClause && ts.isNamespaceExport(statement.exportClause)) {
                if (componentSubpath) {
                    violations.push(`${fileName} re-exports MUI ${componentSubpath} as a namespace from ${moduleName}`)
                } else if (moduleName === '@mui/material') {
                    violations.push(
                        ...Array.from(
                            dropdownComponentNames,
                            (component) => `${fileName} re-exports MUI ${component} through a namespace from ${moduleName}`
                        )
                    )
                }
            }
        }
    }

    if (namespaceImports.size > 0) {
        const visit = (node: ts.Node) => {
            if (
                ts.isPropertyAccessExpression(node) &&
                ts.isIdentifier(node.expression) &&
                namespaceImports.has(node.expression.text) &&
                dropdownComponentNames.has(node.name.text)
            ) {
                violations.push(`${fileName} accesses MUI ${node.name.text} through a namespace import`)
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
    }

    return violations
}

describe('shared dropdown import boundary', () => {
    it.each(['js', 'jsx'])('detects direct MUI dropdown imports in .%s sources', (extension) => {
        const filePath = resolve(repositoryRoot, `packages/boundary-fixtures/direct-import.${extension}`)
        const violations = findDirectMUIComponentImports(filePath, "import { Select } from '@mui/material'\n")

        expect(violations).toEqual([`packages/boundary-fixtures/direct-import.${extension} imports MUI Select from @mui/material`])
    })

    it('detects namespace imports from direct component subpaths', () => {
        const filePath = resolve(repositoryRoot, 'packages/boundary-fixtures/namespace-import.tsx')
        const violations = findDirectMUIComponentImports(filePath, "import * as SelectModule from '@mui/material/Select'\n")

        expect(violations).toEqual([
            'packages/boundary-fixtures/namespace-import.tsx imports MUI Select through a namespace import from @mui/material/Select'
        ])
    })

    it('allows type-only namespace imports from component subpaths', () => {
        const filePath = resolve(repositoryRoot, 'packages/boundary-fixtures/type-namespace-import.ts')
        const violations = findDirectMUIComponentImports(filePath, "import type * as SelectModule from '@mui/material/Select'\n")

        expect(violations).toEqual([])
    })

    it('detects wildcard re-exports from direct component subpaths', () => {
        const filePath = resolve(repositoryRoot, 'packages/boundary-fixtures/wildcard-export.ts')
        const violations = findDirectMUIComponentImports(filePath, "export * from '@mui/material/Autocomplete'\n")

        expect(violations).toEqual([
            'packages/boundary-fixtures/wildcard-export.ts re-exports all of MUI Autocomplete from @mui/material/Autocomplete'
        ])
    })

    it('detects namespace re-exports from direct component subpaths', () => {
        const filePath = resolve(repositoryRoot, 'packages/boundary-fixtures/namespace-export.ts')
        const violations = findDirectMUIComponentImports(filePath, "export * as MaterialSelect from '@mui/material/Select'\n")

        expect(violations).toEqual([
            'packages/boundary-fixtures/namespace-export.ts re-exports MUI Select as a namespace from @mui/material/Select'
        ])
    })

    it('detects wildcard re-exports from the MUI root module', () => {
        const filePath = resolve(repositoryRoot, 'packages/boundary-fixtures/root-wildcard-export.ts')
        const violations = findDirectMUIComponentImports(filePath, "export * from '@mui/material'\n")

        expect(violations).toEqual([
            'packages/boundary-fixtures/root-wildcard-export.ts re-exports MUI Autocomplete from @mui/material',
            'packages/boundary-fixtures/root-wildcard-export.ts re-exports MUI Select from @mui/material'
        ])
    })

    it('uses shared controls across package UIs and keeps published apps isolated', () => {
        const packageSources = collectPackageSources(resolve(repositoryRoot, 'packages'))
        const violations = packageSources.flatMap((filePath) => findDirectMUIComponentImports(filePath))

        expect(violations).toEqual([])
    })
})
