# GitHub Pull Request Guidelines

When creating Pull Requests, follow these formatting and content guidelines to maintain consistency and provide comprehensive information about the changes.

## PR Title Format

**ALWAYS** start the PR title with the GitHub issue number it closes:
```
GH123 Update menu items Documentation, Chat Flows, Agent Flows
```

Format: `GH{issue_number} {descriptive_title}`

## PR Description Template

Create PR descriptions using this template structure. Write the main content in English with Russian translation in a spoiler section.

**IMPORTANT:** 
1. **Always include Russian translation** - Every PR must have both English and Russian versions of the content
2. **Use exact spoiler tag** - Always use exactly `<summary>In Russian</summary>` for the spoiler tag.
   - ✅ **CORRECT**: `<summary>In Russian</summary>`
   - ❌ **INCORRECT**: `<summary>🇷🇺 Описание на русском</summary>`
   - Do not use variations like "На русском языке", "Russian version", "🇷🇺 Описание на русском", or any other text
3. **Complete translation required** - The Russian version inside the spoiler must be a complete translation of the English content, not just a summary
4. **Identical structure** - The Russian version must have exactly the same number of lines and sections as the English version. Both texts must be completely identical in structure and meaning

```markdown
Fixes #123

# Description

Brief description of the changes made in this PR.

## Changes Made

- List of specific changes
- Another change
- Third change

## Additional Work

This section includes supplementary work completed as part of this PR:

- Documentation updates
- Memory bank updates
- Test additions
- Configuration changes
- Any other related improvements or "side files" that made it into this PR

## Testing

- [ ] Manual testing completed
- [ ] Automated tests pass
- [ ] No breaking changes introduced

<details>
<summary>In Russian</summary>

Исправляет #123

# Описание

Краткое описание изменений, внесенных в этом PR.

## Внесенные изменения

- Список конкретных изменений
- Другое изменение
- Третье изменение

## Дополнительная работа

Этот раздел включает дополнительную работу, выполненную в рамках данного PR:

- Обновления документации
- Обновления банка памяти
- Добавление тестов
- Изменения конфигурации
- Любые другие связанные улучшения или "попутные файлы", которые попали в этот PR

## Тестирование

- [ ] Ручное тестирование завершено
- [ ] Автоматические тесты проходят
- [ ] Не внесено критических изменений
</details>
```

## Content Guidelines

### Main Description
- Focus on **what was implemented** and **why**
- Use present tense (describing completed work)
- Be specific about the functionality added or changed
- Include technical details relevant for reviewers

### Changes Made Section
- List specific files or components modified
- Highlight important architectural decisions
- Mention any breaking changes or migration requirements
- Include performance implications if relevant

### Additional Work Section
- **Always include this section** in PR descriptions
- List supplementary work that supports the main changes:
  - Documentation updates (README files, code comments)
  - Memory bank file updates
  - Test additions or modifications
  - Configuration file changes
  - Build system improvements
  - Dependency updates
  - Code formatting or linting fixes

### Testing Section
- Include testing checklist
- Mention specific test scenarios covered
- Note any manual testing performed
- Highlight edge cases tested

## Labels

Apply labels according to `.kiro/steering/github-labels.md`:
- **Type label**: Required (bug/feature/enhancement/documentation/refactor/maintenance)
- **Area labels**: Include all relevant areas (frontend/backend/build/testing/i18n)
- **Priority labels**: Optional (inherited from linked Issue)

## Auto-closing Issues

Always include `Fixes #123` (or `Closes #123`) in the PR description to automatically close the related issue when the PR is merged.

## Examples

### Feature Implementation PR
```
Title: GH45 Add user authentication system

Labels: type: feature, area: backend, area: frontend
```

### Bug Fix PR
```
Title: GH67 Fix camera rotation jitter in 3D viewer

Labels: type: bug, area: frontend
```

### Documentation Update PR
```
Title: GH89 Update installation guide and API documentation

Labels: type: documentation
```

## Notes

- PR descriptions should be more comprehensive than Issue descriptions
- Include context that helps reviewers understand the changes
- The "Additional Work" section helps track all improvements made
- Always reference the original issue for traceability
- Use the same bilingual format as Issues for consistency