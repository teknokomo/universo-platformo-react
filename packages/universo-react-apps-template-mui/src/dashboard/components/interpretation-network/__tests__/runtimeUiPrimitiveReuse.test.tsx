import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicRuntimeRoot = path.resolve(runtimeRoot, '../../../public-runtime')
const nonDestructiveDialogSurfaces = ['CellEditDialog.tsx', 'workspace/WorkspaceDialogs.tsx', 'workspace/StructurePane.tsx']
const destructiveDialogSurfaces = ['workspace/WorkspaceDialogs.tsx', 'InterpretationNetworkDetailsPane.tsx']
const favoritesSurface = 'workspace/FavoritesWorkspacePanel.tsx'
const formDialogPath = path.resolve(runtimeRoot, '../../../components/dialogs/FormDialog.tsx')

function listRuntimeTsxFiles(directory = runtimeRoot) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : listRuntimeTsxFiles(entryPath)
        return entry.isFile() && entry.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(entry.name) ? [entryPath] : []
    })
}

function hasRuntimeBindings(importClause: ts.ImportClause | undefined) {
    if (!importClause) return true
    if (importClause.isTypeOnly) return false
    if (importClause.name) return true

    const bindings = importClause.namedBindings
    if (!bindings) return false
    if (ts.isNamespaceImport(bindings)) return true
    return bindings.elements.some((element) => !element.isTypeOnly)
}

function getImportedLocals(sourceFile: ts.SourceFile, moduleSuffix: string, importedName: string) {
    const localNames: string[] = []

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
        if (!statement.moduleSpecifier.text.endsWith(moduleSuffix)) continue

        const clause = statement.importClause
        if (!clause || clause.isTypeOnly) continue
        if (importedName === 'default' && clause.name) localNames.push(clause.name.text)

        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
                if (element.isTypeOnly) continue
                const name = element.propertyName?.text ?? element.name.text
                if (name === importedName) localNames.push(element.name.text)
            }
        }
    }

    return localNames
}

function usesJsxComponent(sourceFile: ts.SourceFile, localName: string) {
    let found = false

    function visit(node: ts.Node) {
        if (
            (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
            ts.isIdentifier(node.tagName) &&
            node.tagName.text === localName
        ) {
            found = true
        }
        if (!found) ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return found
}

function jsxComponentsOpenedByState(sourceFile: ts.SourceFile, stateName: string) {
    const components: string[] = []

    function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const openAttribute = node.attributes.properties.find(
                (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'open'
            )
            if (
                openAttribute &&
                ts.isJsxAttribute(openAttribute) &&
                openAttribute.initializer &&
                ts.isJsxExpression(openAttribute.initializer) &&
                openAttribute.initializer.expression?.getText(sourceFile).includes(stateName)
            ) {
                const tagName = node.tagName
                if (ts.isIdentifier(tagName)) components.push(tagName.text)
                else if (ts.isPropertyAccessExpression(tagName)) components.push(tagName.name.text)
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return components
}

function sourceFileFor(filePath: string, sourceText: string) {
    return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function staticJsxString(value: ts.JsxAttributeValue | undefined): string | undefined {
    if (value && ts.isStringLiteral(value)) return value.text
    if (value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) return value.expression.text
    return undefined
}

function primitiveViolations(filePath: string, sourceText: string) {
    const sourceFile = sourceFileFor(filePath, sourceText)
    const violations = new Set<string>()
    const materialNamespaces = new Set<string>()
    const dataGridNamespaces = new Set<string>()
    const muiDialogLocals = new Set<string>()
    const muiDataGridLocals = new Set<string>()
    const sharedDialogLocals = new Set([
        ...getImportedLocals(sourceFile, '/StandardDialog', 'StandardDialog'),
        ...getImportedLocals(sourceFile, '/ConfirmDeleteDialog', 'ConfirmDeleteDialog'),
        ...getImportedLocals(sourceFile, '/FormDialog', 'FormDialog')
    ])

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue

        const moduleName = statement.moduleSpecifier.text
        const clause = statement.importClause

        if (/^@mui\/x-data-grid(?:-pro)?(?:\/|$)/.test(moduleName)) {
            if (hasRuntimeBindings(clause)) {
                violations.add('imports MUI X DataGrid at runtime instead of reusing CustomizedDataGrid')
                if (clause?.name) muiDataGridLocals.add(clause.name.text)
                if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
                    dataGridNamespaces.add(clause.namedBindings.name.text)
                }
                if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
                    for (const element of clause.namedBindings.elements) {
                        const importedName = element.propertyName?.text ?? element.name.text
                        if (!element.isTypeOnly && ['DataGrid', 'DataGridPro'].includes(importedName)) {
                            muiDataGridLocals.add(element.name.text)
                        }
                    }
                }
            }
        }

        if (/^@mui\/material\/Dialog(?:Actions)?(?:\/|$)/.test(moduleName) && hasRuntimeBindings(clause)) {
            violations.add('imports a raw MUI Dialog or DialogActions component')
            if (clause?.name) muiDialogLocals.add(clause.name.text)
        }

        if (moduleName !== '@mui/material' || !clause) continue
        const bindings = clause.namedBindings
        if (bindings && ts.isNamespaceImport(bindings)) materialNamespaces.add(bindings.name.text)
        if (!bindings || !ts.isNamedImports(bindings)) continue

        for (const element of bindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text
            if (!element.isTypeOnly && !clause.isTypeOnly && ['Dialog', 'DialogActions'].includes(importedName)) {
                violations.add('imports a raw MUI Dialog or DialogActions component')
                muiDialogLocals.add(element.name.text)
            }
        }
    }

    function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            if (ts.isIdentifier(node.tagName) && node.tagName.text === 'table') {
                violations.add('renders a hand-built HTML table instead of shared runtime table primitives')
            }
            if (ts.isIdentifier(node.tagName) && muiDialogLocals.has(node.tagName.text)) {
                violations.add('renders a raw MUI Dialog or DialogActions component')
            }
            if (
                ts.isPropertyAccessExpression(node.tagName) &&
                ts.isIdentifier(node.tagName.expression) &&
                materialNamespaces.has(node.tagName.expression.text) &&
                ['Dialog', 'DialogActions'].includes(node.tagName.name.text)
            ) {
                violations.add('renders a raw MUI Dialog or DialogActions component')
            }
            if (ts.isIdentifier(node.tagName) && muiDataGridLocals.has(node.tagName.text)) {
                violations.add('renders a raw MUI DataGrid component')
            }
            if (ts.isIdentifier(node.tagName) && node.tagName.text === 'form') {
                violations.add('renders a hand-built form instead of the shared dialog/form surface')
            }
            const roleAttribute = node.attributes.properties.find(
                (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'role'
            )
            const roleValue = roleAttribute && ts.isJsxAttribute(roleAttribute) ? staticJsxString(roleAttribute.initializer) : undefined
            const dynamicRoleExpression =
                roleAttribute &&
                ts.isJsxAttribute(roleAttribute) &&
                roleAttribute.initializer &&
                ts.isJsxExpression(roleAttribute.initializer)
                    ? roleAttribute.initializer.expression?.getText(sourceFile) ?? ''
                    : ''
            const componentName = ts.isIdentifier(node.tagName)
                ? node.tagName.text
                : ts.isPropertyAccessExpression(node.tagName)
                ? node.tagName.name.text
                : ''
            if (roleValue === 'dialog' && !sharedDialogLocals.has(componentName)) {
                violations.add('renders a hand-built role="dialog" surface instead of shared dialog primitives')
            }
            if (roleValue && ['grid', 'list', 'table'].includes(roleValue)) {
                violations.add(`renders a hand-built role="${roleValue}" surface instead of shared runtime primitives`)
            }
            if (!roleValue && dynamicRoleExpression && /\b(?:dialog|grid|list|table)\b/u.test(dynamicRoleExpression)) {
                violations.add('uses a computed dialog, grid, list, or table role instead of shared runtime primitives')
            }
            if (
                ts.isPropertyAccessExpression(node.tagName) &&
                ts.isIdentifier(node.tagName.expression) &&
                dataGridNamespaces.has(node.tagName.expression.text) &&
                ['DataGrid', 'DataGridPro'].includes(node.tagName.name.text)
            ) {
                violations.add('renders a raw MUI DataGrid component')
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return [...violations].map((violation) => `${filePath}: ${violation}`)
}

function readSurface(relativePath: string) {
    const absolutePath = path.join(runtimeRoot, relativePath)
    return {
        absolutePath,
        sourceFile: sourceFileFor(relativePath, readFileSync(absolutePath, 'utf8'))
    }
}

function expectImportedAndRendered(relativePath: string, moduleSuffix: string, importedName: string) {
    const { sourceFile } = readSurface(relativePath)
    const localNames = getImportedLocals(sourceFile, moduleSuffix, importedName)
    expect(localNames.length, `${relativePath} must import ${importedName} from ${moduleSuffix}`).toBeGreaterThan(0)
    expect(
        localNames.some((localName) => usesJsxComponent(sourceFile, localName)),
        `${relativePath} must render ${importedName}`
    ).toBe(true)
}

function expectOpenStateUsesComponent(relativePath: string, stateName: string, moduleSuffix: string, importedName: string) {
    const { sourceFile } = readSurface(relativePath)
    const localNames = getImportedLocals(sourceFile, moduleSuffix, importedName)
    const components = jsxComponentsOpenedByState(sourceFile, stateName)

    expect(components.length, `${relativePath} must render a dialog for ${stateName}`).toBeGreaterThan(0)
    expect(
        components.every((component) => localNames.includes(component)),
        `${stateName} must use ${importedName}`
    ).toBe(true)
}

function destructiveDialogViolations(filePath: string, sourceText: string) {
    const sourceFile = sourceFileFor(filePath, sourceText)
    const confirmDeleteNames = getImportedLocals(sourceFile, '/ConfirmDeleteDialog', 'ConfirmDeleteDialog')
    const violations: string[] = []

    function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const openAttribute = node.attributes.properties.find(
                (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'open'
            )
            if (
                openAttribute &&
                ts.isJsxAttribute(openAttribute) &&
                openAttribute.initializer &&
                ts.isJsxExpression(openAttribute.initializer) &&
                /delete|remove|discard|reset/i.test(openAttribute.initializer.expression?.getText(sourceFile) ?? '')
            ) {
                const tagName = node.tagName
                const component = ts.isIdentifier(tagName) ? tagName.text : ts.isPropertyAccessExpression(tagName) ? tagName.name.text : ''
                if (!confirmDeleteNames.includes(component)) {
                    violations.push(`${filePath}: destructive confirmation must render ConfirmDeleteDialog`)
                }
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return violations
}

describe('Interpretation Network runtime UI primitive reuse', () => {
    it('keeps non-destructive dialogs on StandardDialog', () => {
        for (const relativePath of nonDestructiveDialogSurfaces) {
            expectImportedAndRendered(relativePath, '/StandardDialog', 'StandardDialog')
        }
    })

    it('keeps destructive confirmations on ConfirmDeleteDialog', () => {
        for (const relativePath of destructiveDialogSurfaces) {
            expectImportedAndRendered(relativePath, '/ConfirmDeleteDialog', 'ConfirmDeleteDialog')
            const source = readFileSync(path.join(runtimeRoot, relativePath), 'utf8')
            expect(destructiveDialogViolations(relativePath, source)).toEqual([])
        }
    })

    it('uses the shared FormDialog backed by StandardDialog for template authoring', () => {
        expectOpenStateUsesComponent('workspace/WorkspaceDialogs.tsx', 'templateDialogMode', '/FormDialog', 'FormDialog')
        const formDialogSource = readFileSync(formDialogPath, 'utf8')
        const formDialogFile = sourceFileFor('components/dialogs/FormDialog.tsx', formDialogSource)
        const standardDialogLocals = getImportedLocals(formDialogFile, '/StandardDialog', 'StandardDialog')

        expect(standardDialogLocals.length, 'FormDialog must import the shared StandardDialog').toBeGreaterThan(0)
        expect(standardDialogLocals.some((localName) => usesJsxComponent(formDialogFile, localName))).toBe(true)
        expect(primitiveViolations('components/dialogs/FormDialog.tsx', formDialogSource)).toEqual([])
    })

    it('uses StandardDialog for template details', () => {
        expectOpenStateUsesComponent('workspace/StructurePane.tsx', 'openTemplate', '/StandardDialog', 'StandardDialog')
    })

    it('renders Favorites directly with CustomizedDataGrid', () => {
        expectImportedAndRendered(favoritesSurface, '/CustomizedDataGrid', 'default')
    })

    it('reuses the canonical workspace panes and Matrix for anonymous public browsing', () => {
        const publicWorkspaceSurface = '../../../public-runtime/PublicInterpretationNetworkViewer.tsx'
        const publicDashboardSurface = '../../../public-runtime/PublicDashboardRuntime.tsx'
        expectImportedAndRendered(publicWorkspaceSurface, '/InterpretationNetworkWorkspaceContent', 'InterpretationNetworkWorkspaceContent')
        const publicWorkspaceSource = readFileSync(path.join(runtimeRoot, publicWorkspaceSurface), 'utf8')
        expect(publicWorkspaceSource).not.toMatch(/from ['"][^'"]*\/WorkspaceShell['"]/u)
        expect(publicWorkspaceSource).not.toMatch(/from ['"][^'"]*\/MatrixWorkspace['"]/u)
        expectImportedAndRendered(publicDashboardSurface, '/dashboard/Dashboard', 'default')
    })

    it('rejects raw MUI dialogs and one-off DataGrids across runtime surfaces', () => {
        const violations = [runtimeRoot, publicRuntimeRoot].flatMap((surfaceRoot) =>
            listRuntimeTsxFiles(surfaceRoot).flatMap((absolutePath) => {
                const relativePath = path.relative(runtimeRoot, absolutePath)
                return primitiveViolations(relativePath, readFileSync(absolutePath, 'utf8'))
            })
        )

        expect(violations).toEqual([])
    })

    it('allows type-only MUI X column and locale imports', () => {
        const source = `
            import type { GridColDef, GridLocaleText } from '@mui/x-data-grid'
            import { type GridColDef as Columns, type GridLocaleText as Locale } from '@mui/x-data-grid'
            type GridTypes = GridColDef[] | Partial<GridLocaleText> | Columns[] | Partial<Locale>
        `

        expect(primitiveViolations('type-only-fixture.tsx', source)).toEqual([])
    })

    it('detects aliased raw MUI dialogs and runtime DataGrid imports', () => {
        const source = `
            import { Dialog as MuiDialog, DialogActions } from '@mui/material'
            import * as MUI from '@mui/material'
            import Grid from '@mui/x-data-grid'
            export const Fixture = () => <MuiDialog><DialogActions /><MUI.Dialog /><Grid /></MuiDialog>
        `

        expect(primitiveViolations('forbidden-fixture.tsx', source)).toEqual([
            'forbidden-fixture.tsx: imports a raw MUI Dialog or DialogActions component',
            'forbidden-fixture.tsx: imports MUI X DataGrid at runtime instead of reusing CustomizedDataGrid',
            'forbidden-fixture.tsx: renders a raw MUI Dialog or DialogActions component',
            'forbidden-fixture.tsx: renders a raw MUI DataGrid component'
        ])
    })

    it('detects a hand-built HTML table and computed role surfaces', () => {
        const source = `
            export const Fixture = ({ enabled }: { enabled: boolean }) => (
                <><table><tbody><tr><td>value</td></tr></tbody></table><section role={enabled ? 'grid' : undefined} /></>
            )
        `

        expect(primitiveViolations('unshared-table-fixture.tsx', source)).toEqual([
            'unshared-table-fixture.tsx: renders a hand-built HTML table instead of shared runtime table primitives',
            'unshared-table-fixture.tsx: uses a computed dialog, grid, list, or table role instead of shared runtime primitives'
        ])
    })

    it('rejects an imported one-off layout component used as a dialog surface', () => {
        const source = `
            import { Paper as OneOffDialogSurface } from '@mui/material'
            export const Fixture = ({ open }: { open: boolean }) => open
                ? <OneOffDialogSurface role="dialog" aria-modal="true" />
                : null
        `

        expect(primitiveViolations('one-off-dialog-fixture.tsx', source)).toEqual([
            'one-off-dialog-fixture.tsx: renders a hand-built role="dialog" surface instead of shared dialog primitives'
        ])
    })

    it('does not treat unrelated imported components named Dialog or DataGrid as raw MUI primitives', () => {
        const source = `
            import { StandardDialog as Dialog } from './StandardDialog'
            import { CustomizedDataGrid as DataGrid } from './CustomizedDataGrid'
            export const Fixture = () => <><Dialog /><DataGrid /></>
        `

        expect(primitiveViolations('shared-primitives-fixture.tsx', source)).toEqual([])
    })

    it('rejects hand-built dialog, grid, and list roles and raw forms in runtime surfaces', () => {
        const source = `
            export const Fixture = () => <>
                <div role="dialog" />
                <div role="grid" />
                <div role={'list'} />
                <form />
            </>
        `

        expect(primitiveViolations('hand-built-runtime-fixture.tsx', source)).toEqual([
            'hand-built-runtime-fixture.tsx: renders a hand-built role="dialog" surface instead of shared dialog primitives',
            'hand-built-runtime-fixture.tsx: renders a hand-built role="grid" surface instead of shared runtime primitives',
            'hand-built-runtime-fixture.tsx: renders a hand-built role="list" surface instead of shared runtime primitives',
            'hand-built-runtime-fixture.tsx: renders a hand-built form instead of the shared dialog/form surface'
        ])
    })

    it('detects custom role=dialog bypasses while allowing shared dialog primitives', () => {
        const sharedDialogSource = `
            import { StandardDialog } from './StandardDialog'
            export const Fixture = () => <StandardDialog role="dialog" />
        `
        expect(primitiveViolations('shared-dialog-fixture.tsx', sharedDialogSource)).toEqual([])

        const bypassSource = `
            import { StandardDialog } from './StandardDialog'
            export const Fixture = () => <><StandardDialog /><section role={'dialog'} /></>
        `
        expect(primitiveViolations('dialog-bypass-fixture.tsx', bypassSource)).toEqual([
            'dialog-bypass-fixture.tsx: renders a hand-built role="dialog" surface instead of shared dialog primitives'
        ])
    })

    it('detects a destructive confirmation routed through a different dialog', () => {
        const source = `
            import { StandardDialog } from './StandardDialog'
            export const Fixture = () => <StandardDialog open={deleteDialogOpen} />
        `

        expect(destructiveDialogViolations('destructive-fixture.tsx', source)).toEqual([
            'destructive-fixture.tsx: destructive confirmation must render ConfirmDeleteDialog'
        ])
    })
})
