import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeMuiV9Policy } from './check-mui-v9-policy.mjs'

const catalogText = `catalog:
    '@mui/material': 9.2.0
    '@mui/system': 9.2.0
    '@mui/icons-material': 9.2.0
    '@mui/utils': 9.2.0
    '@mui/x-charts': 9.8.0
    '@mui/x-data-grid': 9.8.0
`

const rootManifest = {
    dependencies: {
        react: '18.3.1',
        'react-dom': '18.3.1'
    },
    pnpm: {
        overrides: {
            'react-is': '18.3.1'
        }
    }
}

const analyzeSource = (sourceText) =>
    analyzeMuiV9Policy({
        catalogText,
        rootManifest,
        packages: [
            {
                path: 'packages/fixture/package.json',
                name: '@universo-react/fixture',
                manifest: { dependencies: { '@mui/material': 'catalog:' } },
                sourceFiles: [{ path: 'packages/fixture/src/fixture.tsx', text: sourceText }]
            }
        ],
        documents: []
    }).issues

test('detects removed Menu and Select menu props', () => {
    const issues = analyzeSource(`
        <Menu TransitionProps={{ onExited: onExited }} />
        <Select MenuProps={{ PaperProps: { elevation: 1 }, MenuListProps: { disablePadding: true } }} />
    `)

    assert.equal(
        issues.some((issue) => issue.includes('Menu.TransitionProps')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('Select.MenuProps.PaperProps')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('Select.MenuProps.MenuListProps')),
        true
    )
})

test('detects removed slot aliases on component-specific MUI APIs', () => {
    const issues = analyzeSource(`
        <Dialog PaperProps={{ elevation: 1 }} />
        <Drawer BackdropProps={{ transitionDuration: 100 }} />
        <Tooltip componentsProps={{ tooltip: { role: 'status' } }} />
        <TextField inputProps={{ autoComplete: 'email' }} />
    `)

    assert.equal(
        issues.some((issue) => issue.includes('Dialog.PaperProps')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('Drawer.BackdropProps')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('Tooltip.componentsProps')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('TextField.inputProps')),
        true
    )
})

test('detects removed Autocomplete, InputBase and transition aliases', () => {
    const issues = analyzeSource(`
        <Autocomplete PopperComponent={CustomPopper} componentsProps={{ paper: { elevation: 1 } }} renderTags={renderTags} />
        <InputBase components={{ Root: CustomRoot }} componentsProps={{ input: { id: 'input' } }} />
        <Switch inputProps={{ 'aria-label': 'Toggle' }} inputRef={inputRef} />
        <TablePagination SelectProps={{ variant: 'outlined' }} backIconButtonProps={{ disabled: true }} />
        <Modal BackdropComponent={CustomBackdrop} />
        <StepContent TransitionProps={{ unmountOnExit: true }} />
        <StepLabel StepIconComponent={CustomStepIcon} />
        <MobileStepper LinearProgressProps={{ color: 'primary' }} />
        <ListItemText primaryTypographyProps={{ noWrap: true }} />
    `)

    for (const usage of [
        'Autocomplete.PopperComponent',
        'Autocomplete.componentsProps',
        'Autocomplete.renderTags',
        'InputBase.components',
        'InputBase.componentsProps',
        'Switch.inputProps',
        'TablePagination.SelectProps',
        'Modal.BackdropComponent',
        'StepContent.TransitionProps',
        'StepLabel.StepIconComponent',
        'MobileStepper.LinearProgressProps',
        'ListItemText.primaryTypographyProps'
    ]) {
        assert.equal(
            issues.some((issue) => issue.includes(usage)),
            true,
            `expected policy to report ${usage}`
        )
    }
})

test('detects removed props when MUI components are imported through aliases', () => {
    const issues = analyzeSource(`
        import MuiAutocomplete from '@mui/material/Autocomplete'
        import { Dialog as MuiDialog } from '@mui/material'
        <MuiAutocomplete PopperComponent={CustomPopper} />
        <MuiDialog PaperProps={{ elevation: 1 }} />
    `)

    assert.equal(
        issues.some((issue) => issue.includes('Autocomplete.PopperComponent')),
        true
    )
    assert.equal(
        issues.some((issue) => issue.includes('Dialog.PaperProps')),
        true
    )
})

test('continues scanning after JSX fragments and handles default import aliases', () => {
    const issues = analyzeSource(`
        import { default as MuiAutocomplete } from '@mui/material/Autocomplete'
        <>
            <div />
            <MuiAutocomplete PopperComponent={CustomPopper} />
        </>
    `)

    assert.equal(
        issues.some((issue) => issue.includes('Autocomplete.PopperComponent')),
        true
    )
})

test('detects removed Select menu props through component aliases', () => {
    const issues = analyzeSource(`
        import MuiSelect from '@mui/material/Select'
        <MuiSelect MenuProps={{ PaperProps: { elevation: 1 } }} />
    `)

    assert.equal(
        issues.some((issue) => issue.includes('Select.MenuProps.PaperProps')),
        true
    )
})

test('does not flag valid InputBase/Select props or shared domain presentation names', () => {
    const issues = analyzeSource(`
        const dialogPresentation = { PaperProps: { elevation: 1 } }
        <InputBase inputProps={{ 'aria-label': 'Search' }} />
        <Select inputProps={{ 'aria-label': 'Choose' }} />
        <Dialog slotProps={{ paper: dialogPresentation.PaperProps }} />
    `)

    assert.deepEqual(issues, [])
})

test('requires one exact catalog version within each coordinated MUI group', () => {
    const issues = analyzeMuiV9Policy({
        catalogText: `catalog:
    '@mui/material': 9.2.0
    '@mui/system': 9.3.0
`,
        rootManifest,
        packages: [],
        documents: []
    }).issues

    assert.equal(
        issues.some((issue) => issue.includes('coordinated group')),
        true
    )
})
