# GitHub Labels Guidelines

**CRITICAL**: Always fetch the current list of repository labels before creating Issues or Pull Requests. Use ONLY existing labels from the repository. Do not create new labels unless explicitly requested by the user.

## Dynamic Label Selection Process

1. **ALWAYS start by fetching current repository labels** using available GitHub API tools
2. **Analyze the fetched labels** to understand available categories
3. **Select appropriate labels** from the actual repository labels
4. **Use the core label guidelines below** as a reference for selection logic

## Core Label Categories (Reference Only)

These are common label patterns found in the repository. Always verify against actual repository labels:

### Project Area Labels (Common Patterns)
- `platformo` - Concerns the Universo Platformo
- `mmoomm` - Concerns the Universo MMOOMM  
- `web` - Concerns the web version of the project
- `repository` - Concerns tasks on the repository
- `releases` - Concerns releases

### Technical Area Labels (Common Patterns)
- `frontend` - Frontend functionality
- `backend` - Backend functionality
- `documentation` - Documentation improvements
- `i18n` - Internationalization functionality
- `publication` - Publication functionality
- `multiplayer` - Multiplayer features
- `architecture` - Architecture concerns

### Type Labels (Common Patterns)
- `enhancement` - Improvements or new features
- `feature` - New functionality
- `bug` - Bug fixes (if exists)

**NOTE**: These are reference patterns only. Always use the actual labels fetched from the repository.

## Label Selection Process

### Step 1: Fetch Repository Labels
- Use GitHub API tools to get the current list of all repository labels
- Examine the labels to understand available categories and naming patterns

### Step 2: Select Appropriate Labels
**For Issues:**
1. **Include appropriate Type label** (look for enhancement/feature/bug/documentation patterns)
2. **Include relevant Project Area labels** (look for platformo/mmoomm/web/repository/releases patterns)
3. **Include relevant Technical Area labels** (look for frontend/backend/i18n/publication/multiplayer patterns)
4. **Add specific labels** for frameworks or special cases (look for colyseus, architecture, etc.)

**For Pull Requests:**
1. **Include Type label** matching the work performed
2. **Include Area labels** for affected parts of the codebase  
3. **Keep labels minimal** - only the most relevant ones

### Step 3: Validate Selection
- Ensure all selected labels actually exist in the fetched repository labels
- Do not use labels that don't exist in the repository

## Examples

### New Feature Issue
```
Labels: feature, platformo, frontend, backend
```

### Documentation Update Issue
```
Labels: documentation, repository
```

### Enhancement Issue
```
Labels: enhancement, platformo, frontend
```

### Multiplayer Feature Issue
```
Labels: feature, platformo, backend, multiplayer, colyseus
```

## Special Cases

- **Release tasks**: Always use `releases` + `repository`
- **Architecture changes**: Use `architecture` + relevant technical area
- **Multi-area changes**: Include all relevant area labels
- **Internationalization**: Always include `i18n` label
- **Multiplayer features**: Use `multiplayer` + `colyseus` if applicable

## Implementation Notes

- **CRITICAL**: Always fetch current repository labels first - never assume labels exist
- **NEVER** create new labels unless explicitly requested by the user
- Labels help with project organization and filtering
- Consistent labeling improves issue tracking and project metrics
- When in doubt, prefer labels that match the work type (enhancement/feature/documentation)
- If unsure about label selection, choose fewer rather than more labels
- Repository labels may change over time, so always fetch the current list

## Troubleshooting

- If label fetching fails, proceed without labels rather than guessing
- If no appropriate labels are found, create the Issue/PR without labels
- Document any label selection decisions in commit messages or PR descriptions