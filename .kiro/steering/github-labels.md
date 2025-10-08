# GitHub Labels Guidelines

**CRITICAL**: Always fetch the current list of repository labels before creating Issues or Pull Requests. Use ONLY existing labels from the repository. Do not create new labels unless explicitly requested by the user.

## Dynamic Label Selection Process

1. **ALWAYS start by fetching current repository labels** using available GitHub API tools
2. **Analyze the fetched labels** to understand available categories
3. **Select appropriate labels** from the actual repository labels
4. **Use the core label guidelines below** as a reference for selection logic

## Current Repository Labels (Fallback List)

**Updated**: August 2025 - Use this list if API call fails.

### Default GitHub Labels
- `bug` - Something isn't working
- `documentation` - Improvements or additions to documentation  
- `duplicate` - This issue or pull request already exists
- `enhancement` - New feature or request
- `help wanted` - Extra attention is needed
- `invalid` - This doesn't seem right
- `question` - Further information is requested
- `wontfix` - This will not be worked on

### Project-Specific Labels
- `architecture` - Concerns to project architecture
- `backend` - Concerns the backend functionality
- `colyseus` - Colyseus framework related
- `feature` - New functionality or capabilities
- `frontend` - Concerns the frontend functionality
- `i18n` - Concerns the internationalization functionality
- `mmoomm` - Concerns the Universo MMOOMM
- `multiplayer` - Multiplayer related functionality
- `platformo` - Concerns the Universo Platformo
- `publication` - Concerns the functionality of the publication
- `releases` - Concerns releases
- `repository` - Concerns tasks on the repository
- `web` - Concerns the web version of the project

**NOTE**: This is a fallback list. Always try the API call first to get current labels.

## Label Selection Process

### Step 1: Fetch Repository Labels

**CURRENT LIMITATION**: GitHub MCP server does not yet support label management tools.

**WORKAROUND**: Use direct GitHub API call via bash:
```bash
curl -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/repos/teknokomo/universo-platformo-react/labels
```

This will return JSON with all repository labels including name, color, and description.

**Alternative**: If API call fails, use the hardcoded label list below as fallback.

**API Response Processing**:
- The API returns JSON array with objects containing: `name`, `color`, `description`
- Extract the `name` field from each object to get available label names
- Example parsing: `curl ... | jq -r '.[].name'` (if jq is available)
- Or manually parse the JSON response to extract label names

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
