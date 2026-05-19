# Runtime UI UX Quality Gate

Этот quality gate предотвращает ситуацию, когда runtime-интерфейс технически подключён, но им неудобно или невозможно пользоваться в опубликованных MUI-приложениях.

Он применяется, когда работа затрагивает runtime-экраны MUI, dashboard-шаблон приложения, UI metadata в metahub-шаблонах, CRUD-диалоги, DataGrid/table/card отображение, relation builders, resource-source поля или UI E2E-сценарии.

## Обязательные agent skills

Используйте project-local skills:

-   `.agents/skills/mui-runtime-ux-patterns`
-   `.agents/skills/runtime-ux-qa`

Reviewer profiles находятся в `.agents/agent-profiles` и продублированы в нативные директории агентов: `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, `.kiro/steering/agent_profiles`.

После изменений запускайте проверку дрейфа:

```bash
pnpm check:runtime-ux-agents
```

## Обязательные правила

-   Не показывать raw user-facing IDs и workflows, требующие скрытых технических знаний, на обычных пользовательских экранах.
-   Не показывать raw JSON, `[object Object]` или object cells в обычных таблицах и карточках.
-   Для смысловых длинных текстов, таких как description, notes, summary, details, body, instructions, feedback и comments, использовать multiline controls.
-   Локализовать validation messages и не показывать raw Zod/internal messages.
-   Сначала использовать существующие MUI dashboard/app-template primitives, а не создавать новый UI без необходимости.
-   Для реализованного UI нужны browser evidence и проверка отсутствия page-level horizontal overflow.

## UI Contract

Каждый план runtime UI должен включать UI Contract для каждого затронутого экрана, диалога, таблицы или карточки:

| Область              | Обязательное решение                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| Field semantics      | Что поле означает для пользователя                                                   |
| Control type         | Text input, textarea, select, picker, resource-source editor, block editor           |
| Display value        | Что показывается в DataGrid/cards вместо raw stored values                           |
| Hidden/system fields | Owner/current-user/server-owned fields, которые пользователь не должен редактировать |
| Defaults             | Значения из runtime context                                                          |
| Validation           | Локализованные пользовательские ошибки                                               |
| Responsive proof     | Browser widths и screenshots/checks                                                  |

## Примеры

Плохо:

-   `OwnerId` как свободное текстовое поле.
-   `Cover` в таблице как `{"type":"video","url":"..."}`.
-   `Description` как однострочное поле.
-   Русский UI показывает `String must contain at least 1 character(s)`.

Хорошо:

-   Owner задаётся сервером как текущий пользователь или выбирается через human-readable picker.
-   Cover использует общий resource-source editor и скрыт из default grids, если нет preview renderer.
-   Description использует textarea минимум на две строки.
-   Optional resource-source fields не показывают ошибку, пока источник не задан.

## Playwright UX oracles

Используйте `tools/testing/e2e/support/browser/runtimeUx.ts` для reusable checks:

-   `expectNoTechnicalLeakage`
-   `expectSemanticFieldControls`
-   `expectLocalizedValidation`
-   `expectNoPageHorizontalOverflow`
-   `expectRuntimeUxViewportMatrix`
-   `expectElementFitsViewport`

Общая viewport matrix: `1920x1080`, `768x1024` и mobile `390x844`. Более узкая matrix допустима только если documented support boundary явно исключает конкретный viewport.

Тесты должны использовать user-facing locators, labels, roles, stable test IDs и web-first assertions. Одного успешного CRUD-запроса недостаточно.
