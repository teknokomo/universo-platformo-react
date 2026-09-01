import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT_DIR = process.cwd()
const PACKAGE_DIR = path.join(ROOT_DIR, 'packages')
const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const IGNORED_DIRS = new Set(['.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules'])
const FORBIDDEN_MUI_PACKAGES = new Set(['@mui/base'])
const MUI_SOURCE_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](@mui\/[^'"]+)['"]/g
const MUI_SIDE_EFFECT_IMPORT_RE = /\bimport\s*['"](@mui\/[^'"]+)['"]/g
const MUI_PACKAGE_RE = /^@mui\//
const EMOTION_PACKAGE_RE = /^@emotion\/(?:react|styled)$/
// MUI X uses a small implementation package with an independent 0.x version.
// It is not a second MUI major and must not make the v9 policy fail.
const MUI_LOCKFILE_VERSION_EXCEPTIONS = new Set(['@mui/x-virtualizer'])
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const LEGACY_API_PATTERNS = [
    // These patterns intentionally target JSX/JS assignments. A domain-level
    // presentation metadata field can keep the old name without passing it to
    // MUI; only the removed component API is a migration defect.
    ['disableEscapeKeyDown', /\bdisableEscapeKeyDown\s*=/],
    ['TreeViewBaseItem', /\bTreeViewBaseItem\b/],
    ['areaElementClasses.root', /\bareaElementClasses\.root\b/],
    ['primaryTypographyProps', /\bprimaryTypographyProps\s*=/],
    ['secondaryTypographyProps', /\bsecondaryTypographyProps\s*=/]
]

// MUI v9 removed the component-specific prop aliases below in favor of
// `slots`/`slotProps`. Keep this map scoped to the components for which the
// v9 migration guide defines the replacement. Generic property-name scans are
// intentionally avoided: names such as `PaperProps` are also valid domain
// contracts in our shared dialog presentation model, while `inputProps` is a
// supported prop on InputBase/Select.
const REMOVED_COMPONENT_PROPS = new Map([
    ['Menu', new Set(['MenuListProps', 'PaperProps', 'TransitionComponent', 'TransitionProps'])],
    ['Dialog', new Set(['BackdropComponent', 'BackdropProps', 'PaperProps', 'TransitionComponent', 'TransitionProps'])],
    ['Drawer', new Set(['BackdropComponent', 'BackdropProps', 'PaperProps', 'SlideProps'])],
    ['SwipeableDrawer', new Set(['BackdropComponent', 'BackdropProps', 'PaperProps', 'SlideProps'])],
    ['Popover', new Set(['BackdropComponent', 'BackdropProps', 'PaperProps', 'TransitionComponent', 'TransitionProps'])],
    ['Tooltip', new Set(['components', 'componentsProps', 'PopperComponent', 'PopperProps', 'TransitionComponent', 'TransitionProps'])],
    ['TextField', new Set(['InputProps', 'inputProps', 'SelectProps', 'InputLabelProps', 'FormHelperTextProps'])],
    ['ListItem', new Set(['componentsProps'])],
    ['ListItemText', new Set(['primaryTypographyProps', 'secondaryTypographyProps'])],
    [
        'Autocomplete',
        new Set(['ChipProps', 'ListboxComponent', 'ListboxProps', 'PaperComponent', 'PopperComponent', 'componentsProps', 'renderTags'])
    ],
    ['InputBase', new Set(['components', 'componentsProps'])],
    ['Switch', new Set(['inputProps', 'inputRef'])],
    ['TablePagination', new Set(['backIconButtonProps', 'nextIconButtonProps', 'SelectProps'])],
    ['PaginationItem', new Set(['components'])],
    ['Modal', new Set(['BackdropComponent', 'BackdropProps', 'components', 'componentsProps'])],
    ['MobileStepper', new Set(['LinearProgressProps'])],
    ['StepContent', new Set(['TransitionComponent', 'TransitionProps'])],
    ['StepLabel', new Set(['componentsProps', 'StepIconComponent', 'StepIconProps'])],
    ['Accordion', new Set(['TransitionComponent', 'TransitionProps'])],
    ['Alert', new Set(['components', 'componentsProps'])]
])

const SELECT_MENU_REMOVED_PROPS = new Set(['MenuListProps', 'PaperProps', 'TransitionComponent', 'TransitionProps'])

const isIdentifierStart = (value) => /[A-Za-z_$]/.test(value)
const isIdentifierPart = (value) => /[A-Za-z0-9_$.-]/.test(value)

const readJsxOpeningTags = (sourceText) => {
    const tags = []
    let offset = 0

    while (offset < sourceText.length) {
        const start = sourceText.indexOf('<', offset)
        if (start < 0) break
        if (!isIdentifierStart(sourceText[start + 1] ?? '')) {
            offset = start + 1
            continue
        }

        let nameEnd = start + 2
        while (nameEnd < sourceText.length && isIdentifierPart(sourceText[nameEnd])) nameEnd += 1
        const fullName = sourceText.slice(start + 1, nameEnd)
        const componentName = fullName.split('.').at(-1)
        if (!componentName || componentName[0] !== componentName[0].toUpperCase()) {
            offset = nameEnd
            continue
        }

        let index = nameEnd
        let braceDepth = 0
        let quote = null
        let escaped = false
        let end = -1

        for (; index < sourceText.length; index += 1) {
            const character = sourceText[index]
            if (quote) {
                if (escaped) {
                    escaped = false
                } else if (character === '\\') {
                    escaped = true
                } else if (character === quote) {
                    quote = null
                }
                continue
            }

            if (character === '"' || character === "'" || character === '`') {
                quote = character
            } else if (character === '{') {
                braceDepth += 1
            } else if (character === '}') {
                braceDepth = Math.max(0, braceDepth - 1)
            } else if (character === '>' && braceDepth === 0) {
                end = index
                break
            }
        }

        if (end < 0) break
        tags.push({ componentName, attributes: sourceText.slice(nameEnd, end), start })
        offset = end + 1
    }

    return tags
}

const readJsxExpression = (attributes, startIndex) => {
    let index = startIndex
    while (/\s/.test(attributes[index] ?? '')) index += 1
    if (attributes[index] !== '{') return null

    const expressionStart = index
    let braceDepth = 0
    let quote = null
    let escaped = false
    for (; index < attributes.length; index += 1) {
        const character = attributes[index]
        if (quote) {
            if (escaped) {
                escaped = false
            } else if (character === '\\') {
                escaped = true
            } else if (character === quote) {
                quote = null
            }
            continue
        }

        if (character === '"' || character === "'" || character === '`') {
            quote = character
        } else if (character === '{') {
            braceDepth += 1
        } else if (character === '}') {
            braceDepth -= 1
            if (braceDepth === 0) return attributes.slice(expressionStart + 1, index)
        }
    }

    return null
}

const readMuiComponentAliases = (sourceText) => {
    const aliases = new Map()
    const register = (alias, componentName) => {
        if (componentName === 'Select' || REMOVED_COMPONENT_PROPS.has(componentName)) aliases.set(alias, componentName)
    }

    for (const match of sourceText.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]@mui\/material\/([^'"]+)['"]/g)) {
        const componentName = match[2].split('/')[0]
        register(match[1], componentName)
    }

    for (const match of sourceText.matchAll(
        /\bimport\s*\{\s*default\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s*from\s*['"]@mui\/material\/([^'"]+)['"]/g
    )) {
        const componentName = match[2].split('/')[0]
        register(match[1], componentName)
    }

    for (const match of sourceText.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]@mui\/material['"]/g)) {
        for (const specifier of match[1].split(',')) {
            const [importedName, alias] = specifier.trim().split(/\s+as\s+/)
            if (importedName) register(alias || importedName, importedName)
        }
    }

    return aliases
}

const findRemovedComponentProps = (sourceText) => {
    const usages = new Set()
    const aliases = readMuiComponentAliases(sourceText)
    for (const { componentName, attributes } of readJsxOpeningTags(sourceText)) {
        const canonicalComponentName = aliases.get(componentName) ?? componentName
        const componentProps = REMOVED_COMPONENT_PROPS.get(canonicalComponentName)
        if (componentProps) {
            for (const propName of componentProps) {
                if (new RegExp(`\\b${propName}\\s*=`).test(attributes)) usages.add(`${canonicalComponentName}.${propName}`)
            }
        }

        if (canonicalComponentName === 'Select') {
            const menuPropsMatch = /\bMenuProps\s*=/.exec(attributes)
            if (menuPropsMatch) {
                const menuProps = readJsxExpression(attributes, menuPropsMatch.index + menuPropsMatch[0].length)
                if (menuProps) {
                    for (const propName of SELECT_MENU_REMOVED_PROPS) {
                        if (new RegExp(`\\b${propName}\\s*:`).test(menuProps)) usages.add(`Select.MenuProps.${propName}`)
                    }
                }
            }
        }
    }
    return usages
}

const relativePath = (filePath) => path.relative(ROOT_DIR, filePath) || filePath

const normalizePackageName = (specifier) => {
    const parts = specifier.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier
}

const packageNameFromManifest = (manifestPath, manifest) =>
    manifest.name ||
    relativePath(manifestPath)
        .replace(/\\/g, '/')
        .replace(/^packages\//, '')
        .replace(/\/package\.json$/, '')

const getIndent = (line) => line.match(/^\s*/)?.[0].length ?? 0

export const parseCatalog = (workspaceText) => {
    const catalog = new Map()
    const lines = workspaceText.split(/\r?\n/)
    let inCatalog = false
    let catalogIndent = -1

    for (const line of lines) {
        if (!inCatalog) {
            if (/^\s*catalog:\s*$/.test(line)) {
                inCatalog = true
                catalogIndent = getIndent(line)
            }
            continue
        }

        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && getIndent(line) <= catalogIndent) {
            break
        }

        const match = line.match(/^\s+(['"]?)((?:@(?:mui|emotion)\/[^'":\s]+|react(?:-dom)?))\1\s*:\s*(['"]?)([^'"\s#]+)\3/)
        if (match) {
            catalog.set(match[2], match[4])
        }
    }

    return catalog
}

const extractSemver = (value) => {
    const match = String(value).match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)
    return match?.[1] ?? null
}

const semverMajor = (value) => {
    const version = extractSemver(value)
    return version ? Number(version.split('.')[0]) : null
}

const isExactVersion = (value) => SEMVER_RE.test(String(value))

const isMuiOrEmotionPackage = (name) => MUI_PACKAGE_RE.test(name) || EMOTION_PACKAGE_RE.test(name)

const readSourceFiles = (sourceDir) => {
    if (!fs.existsSync(sourceDir)) return []

    const files = []
    const visit = (currentDir) => {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            if (IGNORED_DIRS.has(entry.name)) continue
            const filePath = path.join(currentDir, entry.name)
            if (entry.isDirectory()) {
                visit(filePath)
            } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
                files.push({ path: relativePath(filePath), text: fs.readFileSync(filePath, 'utf8') })
            }
        }
    }
    visit(sourceDir)
    return files
}

const readWorkspacePackages = () => {
    if (!fs.existsSync(PACKAGE_DIR)) return []
    return fs
        .readdirSync(PACKAGE_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(PACKAGE_DIR, entry.name))
        .filter((packagePath) => fs.existsSync(path.join(packagePath, 'package.json')))
        .map((packagePath) => {
            const manifestPath = path.join(packagePath, 'package.json')
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            return {
                path: relativePath(manifestPath),
                name: packageNameFromManifest(manifestPath, manifest),
                manifest,
                sourceFiles: readSourceFiles(path.join(packagePath, 'src'))
            }
        })
}

const readPackageDocs = () => {
    const docs = []
    for (const packagePath of fs.readdirSync(PACKAGE_DIR, { withFileTypes: true })) {
        if (!packagePath.isDirectory()) continue
        const directory = path.join(PACKAGE_DIR, packagePath.name)
        for (const filename of ['README.md', 'README-RU.md']) {
            const filePath = path.join(directory, filename)
            if (fs.existsSync(filePath)) docs.push({ path: relativePath(filePath), text: fs.readFileSync(filePath, 'utf8') })
        }
    }
    return docs
}

const extractImports = (sourceText) => {
    const imports = new Map()
    const collect = (match, index) => {
        const specifier = match[1]
        const packageName = normalizePackageName(specifier)
        const lineStart = sourceText.lastIndexOf('\n', index) + 1
        const line = sourceText.slice(
            lineStart,
            sourceText.indexOf('\n', index) === -1 ? sourceText.length : sourceText.indexOf('\n', index)
        )
        const typeOnly = /^\s*import\s+type\b/.test(line)
        const existing = imports.get(packageName) ?? { runtime: false, typeOnly: false }
        if (typeOnly) existing.typeOnly = true
        else existing.runtime = true
        imports.set(packageName, existing)
    }

    for (const match of sourceText.matchAll(MUI_SOURCE_RE)) collect(match, match.index ?? 0)
    for (const match of sourceText.matchAll(MUI_SIDE_EFFECT_IMPORT_RE)) collect(match, match.index ?? 0)
    return imports
}

const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

const declaredDependencies = (manifest) => {
    const result = new Map()
    for (const section of dependencySections) {
        for (const [name, version] of Object.entries(manifest[section] ?? {})) {
            result.set(name, { section, version })
        }
    }
    return result
}

const addIssue = (issues, message) => issues.push(message)

const checkCatalog = (catalog, issues) => {
    for (const [name, specifier] of catalog) {
        if (!isMuiOrEmotionPackage(name)) continue
        if (FORBIDDEN_MUI_PACKAGES.has(name)) {
            addIssue(issues, `catalog contains removed package ${name}`)
            continue
        }

        const expectedMajor = EMOTION_PACKAGE_RE.test(name) ? 11 : 9
        const actualMajor = semverMajor(specifier)
        if (actualMajor !== expectedMajor) {
            addIssue(issues, `catalog ${name} must resolve to major ${expectedMajor}, got ${specifier}`)
        }
    }
}

const checkManifest = (workspacePackage, catalog, issues) => {
    const declared = declaredDependencies(workspacePackage.manifest)
    const imports = new Map()
    for (const sourceFile of workspacePackage.sourceFiles) {
        for (const [packageName, kind] of extractImports(sourceFile.text)) {
            const existing = imports.get(packageName) ?? { runtime: false, typeOnly: false, paths: [] }
            existing.runtime ||= kind.runtime
            existing.typeOnly ||= kind.typeOnly
            existing.paths.push(sourceFile.path)
            imports.set(packageName, existing)
        }
    }

    for (const [packageName] of imports) {
        const declaration = declared.get(packageName)
        if (!declaration) {
            addIssue(issues, `${workspacePackage.path} imports ${packageName} but does not declare it`)
            continue
        }

        if (declaration.version === 'catalog:' && !catalog.has(packageName)) {
            addIssue(issues, `${workspacePackage.path} uses catalog: for ${packageName}, but the catalog has no entry`)
        }
    }

    for (const [packageName, declaration] of declared) {
        if (!isMuiOrEmotionPackage(packageName)) continue
        if (FORBIDDEN_MUI_PACKAGES.has(packageName)) {
            addIssue(issues, `${workspacePackage.path} declares removed package ${packageName}`)
            continue
        }
        if (declaration.version === 'catalog:') continue

        if (MUI_PACKAGE_RE.test(packageName) && declaration.section !== 'peerDependencies') {
            addIssue(issues, `${workspacePackage.path} must use catalog: for direct ${packageName} (${declaration.version})`)
        }
        if (declaration.section === 'peerDependencies') checkPeerRange(workspacePackage.path, packageName, declaration.version, issues)
    }

    // Pro packages are commonly imported for MUI X theme augmentation only.
    // A type-only augmentation is a valid compile-time dependency and must not
    // be mistaken for dead runtime code.

    for (const packageName of FORBIDDEN_MUI_PACKAGES) {
        if (declared.has(packageName)) addIssue(issues, `${workspacePackage.path} declares forbidden package ${packageName}`)
    }

    for (const packageName of ['@mui/lab']) {
        if (declared.has(packageName) && !imports.has(packageName)) {
            addIssue(issues, `${workspacePackage.path} declares unused ${packageName}`)
        }
    }

    checkSourcePolicy(workspacePackage.sourceFiles, issues)
}

const checkPeerRange = (manifestPath, packageName, version, issues) => {
    if (version === 'catalog:') return
    const value = String(version)
    const supportsV9 = /(?:^|[\s|^~<>=])9(?:\.\d+)?(?:\.|\s|$)/.test(value)
    const allowsOlderMajor = /(?:^|[\s|^~<>=])(?:[0-8])(?:\.\d+)?(?:\.|\s|$)/.test(value)
    const hasV9UpperBound = /(?:<\s*10\b|\^\s*9(?:\.|\s|$)|~\s*9(?:\.|\s|$))/.test(value)
    if (!supportsV9 || allowsOlderMajor || !hasV9UpperBound) {
        addIssue(issues, `${manifestPath} has invalid MUI peer range ${packageName}: ${version}; use a v9-only range`)
    }
}

const checkSourcePolicy = (sourceFiles, issues) => {
    for (const sourceFile of sourceFiles) {
        for (const [label, pattern] of LEGACY_API_PATTERNS) {
            if (pattern.test(sourceFile.text)) addIssue(issues, `${sourceFile.path} contains removed MUI v9 API ${label}`)
        }
        for (const usage of findRemovedComponentProps(sourceFile.text)) {
            const [componentName, ...propPath] = usage.split('.')
            addIssue(
                issues,
                `${sourceFile.path} uses removed MUI v9 API ${usage}; migrate ${componentName}.${propPath.join('.')} to slotProps`
            )
        }
    }
}

const COHERENT_CATALOG_GROUPS = [
    ['@mui/material', '@mui/system', '@mui/icons-material', '@mui/utils'],
    ['@mui/x-charts', '@mui/x-data-grid', '@mui/x-data-grid-pro', '@mui/x-date-pickers', '@mui/x-date-pickers-pro', '@mui/x-tree-view']
]

const checkCatalogCoherence = (catalog, issues) => {
    for (const packageNames of COHERENT_CATALOG_GROUPS) {
        const versions = packageNames.map((packageName) => catalog.get(packageName)).filter(Boolean)
        if (versions.length < 2) continue
        if (new Set(versions).size > 1) {
            addIssue(issues, `catalog MUI packages in one coordinated group must share one exact version: ${packageNames.join(', ')}`)
        }
    }
}

const checkStaleClaims = (documents, issues) => {
    const staleClaim = /\b(?:MUI(?:\s+X)?|Material\s+UI)\s*(?:v|version)?\s*[5-8](?:\.\d+)?\b/i
    const staleDependency = /@mui\/[^\s`"']+[^\n]*(?:\^|~|>=?)\s*[5-8](?:\.\d+)?/i
    for (const document of documents) {
        for (const [lineNumber, line] of document.text.split(/\r?\n/).entries()) {
            if (staleClaim.test(line) || staleDependency.test(line)) {
                addIssue(issues, `${document.path}:${lineNumber + 1} contains a stale pre-v9 MUI claim`)
            }
        }
    }
}

const extractLockVersions = (lockfileText) => {
    const versions = new Map()
    const lockPackageRe = /(?:^|[\s'"(])((?:@mui|@emotion)\/[A-Za-z0-9._-]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/gm
    for (const match of lockfileText.matchAll(lockPackageRe)) {
        const packageName = match[1]
        const version = match[2]
        const set = versions.get(packageName) ?? new Set()
        set.add(version)
        versions.set(packageName, set)
    }
    return versions
}

const checkLockfile = (lockfileText, catalog, issues) => {
    const lockedVersions = extractLockVersions(lockfileText)
    for (const [packageName, versions] of lockedVersions) {
        // Emotion's internal implementation packages intentionally have 0.x/1.x
        // versions. Only the public react/styled adapters are part of the catalog
        // compatibility contract. Likewise, x-virtualizer is a supported MUI X
        // implementation dependency with its own 0.x release line.
        if (MUI_LOCKFILE_VERSION_EXCEPTIONS.has(packageName)) continue
        if (!MUI_PACKAGE_RE.test(packageName) && !EMOTION_PACKAGE_RE.test(packageName)) continue

        const expectedMajor = EMOTION_PACKAGE_RE.test(packageName) ? 11 : 9
        const majors = new Set([...versions].map((version) => Number(version.split('.')[0])))
        if (majors.size !== 1 || !majors.has(expectedMajor)) {
            addIssue(issues, `lockfile ${packageName} contains non-v9-compatible versions: ${[...versions].sort().join(', ')}`)
        }

        const catalogSpecifier = catalog.get(packageName)
        if (catalogSpecifier && isExactVersion(catalogSpecifier) && !versions.has(catalogSpecifier)) {
            addIssue(issues, `lockfile ${packageName} does not contain catalog version ${catalogSpecifier}`)
        }
    }

    for (const packageName of catalog.keys()) {
        if (!isMuiOrEmotionPackage(packageName)) continue
        if (!lockedVersions.has(packageName)) addIssue(issues, `catalog package ${packageName} is missing from pnpm-lock.yaml`)
    }
}

const checkOrphanSources = (orphanSources, issues) => {
    for (const sourceFile of orphanSources) {
        for (const packageName of extractImports(sourceFile.text).keys()) {
            if (MUI_PACKAGE_RE.test(packageName) || EMOTION_PACKAGE_RE.test(packageName)) continue
            addIssue(issues, `${sourceFile.path} imports ${packageName} without a workspace package owner`)
        }
    }
}

const checkReactIsPolicy = (rootManifest, catalog, issues) => {
    const reactMajor = semverMajor(catalog.get('react') ?? rootManifest.dependencies?.react ?? rootManifest.devDependencies?.react)
    const reactDomMajor = semverMajor(
        catalog.get('react-dom') ?? rootManifest.dependencies?.['react-dom'] ?? rootManifest.devDependencies?.['react-dom']
    )
    if (reactMajor !== 18 || reactDomMajor !== 18) {
        addIssue(
            issues,
            `workspace React and React DOM must remain on major 18 (got react=${reactMajor ?? 'unknown'}, react-dom=${
                reactDomMajor ?? 'unknown'
            })`
        )
    }

    // MUI's React 18 migration contract requires react-is to match React. Keep
    // the resolution pinned at the workspace root so every MUI consumer uses
    // the React 18-compatible implementation.
    const reactIsOverride = rootManifest.pnpm?.overrides?.['react-is']
    if (reactIsOverride !== '18.3.1') {
        addIssue(
            issues,
            `root pnpm.overrides must pin react-is to 18.3.1 for the MUI v9/React 18 workspace (got ${reactIsOverride ?? 'missing'})`
        )
    }
}

export const analyzeMuiV9Policy = ({ catalogText, lockfileText, rootManifest = {}, packages = [], orphanSources = [], documents = [] }) => {
    const catalog = catalogText instanceof Map ? catalogText : parseCatalog(catalogText)
    const issues = []
    checkCatalog(catalog, issues)
    checkCatalogCoherence(catalog, issues)
    for (const workspacePackage of packages) checkManifest(workspacePackage, catalog, issues)
    checkOrphanSources(orphanSources, issues)
    checkStaleClaims(documents, issues)
    if (lockfileText) checkLockfile(lockfileText, catalog, issues)
    checkReactIsPolicy(rootManifest, catalog, issues)
    return { catalog, issues: [...new Set(issues)].sort() }
}

export const formatPolicyResult = ({ issues }) => {
    if (issues.length === 0) return 'mui-v9-policy: ok\n'
    return `mui-v9-policy: failed (${issues.length} issue${issues.length === 1 ? '' : 's'})\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}\n`
}

export const collectRepositoryPolicyInput = () => {
    const workspaceText = fs.readFileSync(path.join(ROOT_DIR, 'pnpm-workspace.yaml'), 'utf8')
    const rootManifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'))
    const orphanSources = readSourceFiles(path.join(ROOT_DIR, 'tools/testing/frontend'))
    return {
        catalogText: workspaceText,
        lockfileText: fs.readFileSync(path.join(ROOT_DIR, 'pnpm-lock.yaml'), 'utf8'),
        rootManifest,
        packages: readWorkspacePackages(),
        orphanSources,
        documents: [{ path: 'pnpm-workspace.yaml', text: workspaceText }, ...readPackageDocs()]
    }
}

export const main = () => {
    const result = analyzeMuiV9Policy(collectRepositoryPolicyInput())
    process.stdout.write(formatPolicyResult(result))
    return result.issues.length === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = main()
}
