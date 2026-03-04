# Template Usage Guide

This template provides a standardized structure for README documentation across all Universo Platformo packages.

## Template Placeholders

### Package Information Placeholders
- `{Package Name}`: Replace with the actual package name
- `{package-name}`: Package identifier (e.g., `@universo/auth-backend`)
- `{version}`: Current package version
- `{language}`: Programming language for code examples (js, ts, tsx, bash, etc.)

### Conditional Sections

#### Legacy Package Sections
Include these sections only for legacy packages (flowise-*):

```markdown
{LEGACY_WARNING_SECTION_IF_APPLICABLE}
🚨 **LEGACY CODE WARNING** 🚨  
This package is part of the legacy Flowise architecture and is scheduled for removal/refactoring after the Universo Platformo migration is complete (estimated Q2 2026). New features should be developed in the modern `@universo/*` packages instead.
```

```markdown
{LEGACY_STATUS_SECTION_IF_APPLICABLE}
## Legacy Status & Migration Plan
[Include full legacy status section]
```

```markdown
{LEGACY_PACKAGE_DEVELOPMENT};NOTES}
### Adding New Features (Legacy Package)
⚠️ **Important**: This is legacy code...
```

```markdown
{LEGACY_PACKAGE_CONTRIBUTING}
⚠️ **Legacy Package Notice**: This package is in maintenance mode...
```

```markdown
{MIGRATION_SUPPORT_FOOTER_IF_LEGACY}
**Migration Support**: If you need help migrating features...
```

#### Modern Package Sections
Include these sections only for modern packages (@universo/*):

```markdown
{MODERN_PACKAGE_INDICATOR_IF_APPLICABLE}
✨ **Modern Package** - Part of the new Universo Platformo architecture
```

```markdown
{MODERN_PACKAGE_DEVELOPMENT_NOTES}
### Development Guidelines
- Follow TypeScript-first development...
```

```markdown
{MODERN_PACKAGE_CONTRIBUTING}
### Development Workflow
1. Create feature branch from `main`...
```

```markdown
{SUPPORT_FOOTER_IF_MODERN}
**Support**: For questions, issues, or feature requests...
```

### Structure Placeholders

#### Modern Package Structure
```markdown
{STRUCTURE_FOR_MODERN_PACKAGES}
├── base/                   # Default implementation
│   ├── src/               # Source code
│   │   ├── components/    # Main components
│   │   ├── hooks/         # Custom hooks (for React packages)
│   │   ├── utils/         # Utility functions
│   │   ├── types/         # TypeScript definitions
│   │   └── index.ts       # Entry point
│   ├── dist/              # Compiled output (CJS, ESM, types)
│   ├── i18n/              # Internationalization (for frontend)
│   │   ├── en/            # English translations
│   │   └── ru/            # Russian translations
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md          # This file
│   └── README-RU.md       # Russian documentation
├── package.json           # Workspace package configuration
└── README.md              # Package overview
```

#### Legacy Package Structure
```markdown
{STRUCTURE_FOR_LEGACY_PACKAGES}
├── src/                   # Source code
│   ├── {specific-dirs}/   # Package-specific directories
│   └── index.ts           # Entry point
├── dist/                  # Compiled output
├── package.json
├── README.md              # This file
└── README-RU.md           # Russian documentation
```

## Usage Instructions

1. **Copy the template**: Start with the base template structure
2. **Replace placeholders**: Fill in all `{placeholder}` values
3. **Include/exclude sections**: Add or remove conditional sections based on package type
4. **Customize content**: Adapt the content to the specific package's functionality
5. **Create Russian version**: Use the same structure for README-RU.md with Russian content

## Package Type Guidelines

### Modern Packages (@universo/*)
- Include modern package indicator
- Focus on TypeScript-first development
- Emphasize workspace integration
- Include dual-build system information
- Provide modern development workflow

### Legacy Packages (flowise-*)
- Include legacy warning at the top
- Add migration timeline and strategy
- Provide maintenance mode notices
- Include migration support information
- Emphasize that new features should go to modern packages

## Content Guidelines

1. **Be specific**: Replace generic placeholders with actual package details
2. **Be consistent**: Use the same structure across all packages
3. **Be helpful**: Include practical examples and usage instructions
4. **Be accurate**: Ensure all information reflects the current state
5. **Be bilingual**: Create both English and Russian versions following i18n guidelines

## Quality Checklist

- [ ] All placeholders replaced with actual content
- [ ] Appropriate sections included/excluded based on package type
- [ ] Code examples are accurate and tested
- [ ] Dependencies list is current
- [ ] File structure matches actual package structure
- [ ] Russian version matches English version exactly
- [ ] Migration timeline is accurate (for legacy packages)
- [ ] Integration points are documented
- [ ] API reference is complete