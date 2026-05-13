# Браузерное E2E-тестирование

Эта директория содержит основу браузерного тестирования для агентной верификации.

## Цели

-   Дать агенту возможность проверять реальное состояние браузера, а не делать выводы только по JSX.
-   Запускать повторяемые пользовательские сценарии через Playwright CLI и оставлять MCP как точечный инструмент отладки.
-   Поднимать отдельного аутентифицированного пользователя для каждого прогона и удалять его во время teardown.
-   Возвращать выделенный удалённый E2E Supabase в состояние пустого проекта до и после каждого прогона suite.
-   Держать секреты вне git с помощью выделенных e2e env-файлов.

## Файлы

-   `playwright.config.mjs`: основная конфигурация Playwright test runner.
-   `playwright.mcp.config.json`: конфигурация MCP runtime для интерактивной browser-отладки.
-   `specs/setup/auth.setup.ts`: поднимает свежего e2e user, логинится через UI и сохраняет browser state.
-   `specs/matrix/*`: точечные проверки locale/theme, которые добавляют покрытие русского рендера и тёмной темы без дублирования всего flow-инвентаря на каждый browser project.
-   `specs/smoke/*`: быстрые проверки доступности маршрутов и загрузки аутентифицированной оболочки.
-   `specs/smoke/admin-access.spec.ts`: проверяет redirect-away для least-privilege пользователя на `/admin` и положительный доступ bootstrap-admin в реальную admin-зону.
-   `specs/flows/*`: browser-сценарии, которые нажимают реальные контролы и проверяют сохранённые результаты.
-   `specs/flows/admin-rbac-management.spec.ts`: browser-покрытие создания admin roles, обновления permission matrix, назначения и снятия global-user ролей, удаления roles и создания locale.
-   `specs/flows/admin-instance-settings.spec.ts`: browser-покрытие редактирования instance и platform codename settings через существующий admin UI.
-   `specs/flows/admin-role-users.spec.ts`: browser-покрытие реальной страницы role-users в admin и backend-подтверждённой видимости назначенных пользователей.
-   `specs/flows/application-settings-limits.spec.ts`: browser-покрытие редактирования workspace limits приложения и блокировки runtime create при достижении лимита.
-   `specs/flows/application-workspace-regressions.spec.ts`: browser-покрытие info-state для limits до создания schema и multi-user workspace isolation в приложениях с включёнными workspaces.
-   `specs/flows/application-connectors.spec.ts`: browser-покрытие создания connector, выбора publication link, single-connector guardrails и сохранения edit через существующий application admin UI.
-   `specs/flows/application-connector-board-migrations.spec.ts`: browser-покрытие schema state на connector board, навигации в application migration history и состояния rollback-analysis dialog на реальных migration data.
-   `specs/flows/application-list.spec.ts`: browser-покрытие общего списка applications, прямой навигации в runtime и перехода в application admin через control-panel.
-   `specs/flows/application-runtime-rows.spec.ts`: browser-покрытие create, edit, copy и delete для runtime rows через существующий application runtime UI с backend-проверкой сохранения.
-   `specs/flows/boards-overview.spec.ts`: browser-покрытие счётчиков на metahub board, application board, admin board и instance board с backend-проверкой summary.
-   `specs/flows/codename-mode.spec.ts`: browser-покрытие переключения codename UI mode на platform-default и per-metahub уровнях при сохранении persisted codename в VLC shape.
-   `specs/flows/metahub-create-options-codename.spec.ts`: browser-покрытие codename auto-fill UX, поведения после ручного override/reset и комбинаций metahub create-options при обязательных branch/layout defaults.
-   `specs/flows/metahub-branches-migrations.spec.ts`: browser-покрытие create/copy/default/activate/delete для branches и branch-aware planning metahub migrations через существующий UI.
-   `specs/flows/metahub-domain-entities.spec.ts`: browser-покрытие create/copy/delete для hub, catalog, set, enumeration, attribute, element, value и constant routes через существующие metahub UI surfaces.
-   `specs/flows/metahub-entity-dialog-regressions.spec.ts`: browser-покрытие edit для constants, полноты полей edit/copy для enumeration values и генерации codename при localized attribute copy.
-   `specs/flows/metahub-layouts.spec.ts`: browser-покрытие list/detail маршрутов layouts и сохранения widget-toggle состояния через существующий layout UI.
-   `specs/flows/metahub-members-permissions.spec.ts`: browser-покрытие invite flow для участников metahub и отрицательных permission boundaries для ролей без manageMembers.
-   `specs/flows/application-members-access.spec.ts`: browser-покрытие invite flow для application access, redirect-away поведения и проверок admin promotion.
-   `specs/flows/metahub-settings.spec.ts`: browser-покрытие реальной страницы настроек metahub, unsaved-change affordance и сохранения settings updates.
-   `specs/flows/publication-application-regression.spec.ts`: combined и split покрытие регрессий publication-to-application.
-   `specs/flows/publication-create-variants.spec.ts`: browser-покрытие вариантов creation для publication-only и publication-plus-application-without-schema.
-   `specs/generators/*`: on-demand snapshot generators, которые создают конфигурации метахабов и экспортируют persistent fixture файлы. Исключены из обычных тестовых прогонов; вызываются явно через `pnpm run test:e2e:generators`.
-   `specs/visual/*`: screenshot assertions для выявления layout regression.
-   `restart-safe-check.mjs`: последовательная built-app start/stop/start валидация для restart safety на fresh-db.
-   `dialog-idle-diagnostics.mjs`: ограниченный diagnostics script, который держит create dialog открытым, снимает Chromium metrics через CDP и сохраняет trace/heap artifacts для расследования idle resource issues.
-   `support/backend/e2eFullReset.mjs`: guarded full reset/inspection helpers для project-owned schemas, `upl_migrations` и Supabase auth users.
-   `support/backend/e2eDatabase.mjs`: общие direct PostgreSQL connection и advisory-lock helpers для hosted E2E maintenance scripts.
-   `support/backend/run-e2e-doctor.mjs`: CLI report для leftover project-owned schemas, auth users и локальных E2E artifacts.
-   `support/backend/*`: provisioning, API login, run manifest и cleanup helpers.
-   `support/browser/preferences.ts`: browser-local helpers для locale/theme preferences, используемые целевыми matrix assertions.
-   `support/env/*`: env-loading helpers, которые принудительно держат `e2e` configuration boundary.

## Env Strategy

Используйте выделенные локальные файлы:

-   `packages/universo-core-backend/base/.env.e2e.local`
-   `packages/universo-core-frontend/base/.env.e2e.local`
-   `packages/universo-core-backend/base/.env.e2e.local-supabase` для необязательных E2E-запусков на локальном Supabase
-   `packages/universo-core-frontend/base/.env.e2e.local-supabase` для необязательных E2E-запусков на локальном Supabase

Коммитьте только стандартные `.example` варианты. Файлы `*.local-supabase` генерируются из выбранного локального профиля Supabase CLI и должны оставаться неотслеживаемыми. Никогда не коммитьте реальные секреты или сгенерированное состояние хранилища браузера.

Backend e2e env должен содержать:

-   `SUPABASE_URL`
-   `SUPABASE_PUBLISHABLE_DEFAULT_KEY` или `SUPABASE_ANON_KEY`
-   `SERVICE_ROLE_KEY`
-   `BOOTSTRAP_SUPERUSER_EMAIL`
-   `BOOTSTRAP_SUPERUSER_PASSWORD`

Дополнительные e2e-specific overrides:

-   `SUPABASE_JWT_SECRET`
-   `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`
-   `AUTH_LOGIN_RATE_LIMIT_MAX`
-   `E2E_TEST_USER_PASSWORD`
-   `E2E_TEST_USER_ROLE_CODENAMES`
-   `E2E_TEST_USER_EMAIL_DOMAIN`
-   `E2E_FULL_RESET_MODE` (`strict` по умолчанию, `off` только для ручной отладки)

Для больших suite повышайте `AUTH_LOGIN_RATE_LIMIT_MAX` только в выделенном e2e backend env вместо ослабления production defaults. Browser suite легитимно делает много auth round-trips между disposable users, bootstrap-admin setup и API-assisted provisioning.

Все wrapper-based E2E команды теперь принудительно соблюдают hosted-Supabase reset contract: удаляют все application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations` и Supabase auth users перед стартом suite и ещё раз после остановки сервера. Инфраструктурные схемы вроде `public` сохраняются, чтобы стартовые migrations могли пересобрать platform state поверх валидной базы Supabase/Postgres. Прямые `pnpm exec playwright test ...` обходят этот контракт и поэтому допустимы только для debug-only сценариев. Для обычной валидации используйте wrapper-команды ниже.

## Run Modes

Один раз установите browser binaries:

```bash
pnpm run playwright:install
```

Запускайте быстрый browser contract:

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
pnpm run test:e2e:flows
```

Запускайте точечные RBAC и high-risk chained regressions:

```bash
pnpm run build:e2e
pnpm run test:e2e:permissions
pnpm run test:e2e:combined
```

Запускайте полный suite вместе со screenshot-проверками:

```bash
pnpm run build:e2e
pnpm run test:e2e:full
```

Запускайте точечные matrix-проверки locale/theme:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs specs/matrix/auth-locale-theme.spec.ts
```

Проверяйте restart-safe поведение на том же fresh e2e environment:

```bash
pnpm run build:e2e
pnpm run test:e2e:restart-safe
```

Снимайте ограниченную idle-dialog диагностику с trace и Chromium metrics:

```bash
pnpm run build:e2e
pnpm run test:e2e:diagnostics
```

E2E runner намеренно однопроходный:

-   Он захватывает lock в `tools/testing/e2e/.artifacts/run.lock` и сразу падает, если другой suite уже активен.
-   Он сразу падает, если `E2E_BASE_URL` уже обслуживает запущенное приложение, предотвращая случайное повторное использование stale server.
-   Он запрещает `--no-deps`, потому что обход Playwright dependencies ломает контракт аутентифицированного setup.
-   `E2E_FULL_RESET_MODE=strict` несовместим с `E2E_ALLOW_REUSE_SERVER=true`; устанавливайте `E2E_FULL_RESET_MODE=off` только для ручной отладки против уже запущенного instance.

Использование тегов:

-   `@smoke`: startup/auth/access boundary checks. Сюда входят и deny-by-default admin access, и положительный вход bootstrap-admin.
-   `@flow`: основные пользовательские и admin workflows.
-   `@permission`: ожидания по RBAC и access-denied.
-   `@combined`: chained regressions для publication/application/connectors.
-   `@visual`: screenshot assertions для layout drift.
-   `@generator`: on-demand snapshot generators (исключены из обычных прогонов).

Текущий инвентарь `@flow`: `30` tests в `25` files, подтверждено через `pnpm exec playwright test -c tools/testing/e2e/playwright.config.mjs --grep @flow --list` на 2026-04-02. Текущий статус полной валидации suite: `pnpm run test:e2e:full` прошёл с результатом `42/42` tests на 2026-04-02 после завершения QA remediation wave, закрытия Gap D CRUD breadth и стабилизации combined publication-plus-schema flow.

Обновляйте просмотренные screenshot baselines после осознанного UI change:

```bash
pnpm run build:e2e
pnpm run test:e2e:visual:update
```

Запускайте on-demand snapshot generators (см. **Snapshot Generators** ниже):

```bash
pnpm run build:e2e
pnpm run test:e2e:generators
```

Принудительно запускайте teardown, если предыдущий run упал:

```bash
pnpm run test:e2e:cleanup
```

Проверяйте состояние hosted E2E Supabase без мутаций:

```bash
pnpm run test:e2e:doctor
```

Запускайте быстрый smoke-slice против локального Supabase:

Предварительное требование: установите Docker Desktop или Docker Engine, запустите Docker daemon и проверьте, что `docker ps` работает. Supabase CLI использует Docker-контейнеры для локального E2E-стека.

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Локальные команды запускают выделенный локальный E2E-проект Supabase, генерируют локальный E2E-профиль и запускают `doctor:e2e:local-supabase` до старта сервера. Doctor проверяет Auth, REST, доступ service-role Admin API, прямое подключение PostgreSQL и JWT-конфигурацию только против `localhost`. Выделенный локальный E2E-профиль Supabase использует отдельные от разработки порты: API `55321`, база данных `55322` и Studio `55323`. Используйте `pnpm supabase:e2e:start` или `*:local-supabase:full` только когда тесту нужны Storage, Realtime, Edge Functions или сервисы логирования.

Сгенерированный профиль бэкенда использует `.env.e2e`, если он есть, затем `.env`, затем `.env.e2e.example`, затем `.env.example`, сохраняя не связанные настройки и заменяя только локальные значения Supabase/PostgreSQL и безопасные значения E2E по умолчанию.

Просматривайте план полного reset без удаления схем и пользователей:

```bash
pnpm run test:e2e:reset:dry
```

Принудительно запускайте полный reset hosted Supabase вручную:

```bash
pnpm run test:e2e:reset
```

## Snapshot Generators

Generator specs живут в `specs/generators/` и создают persistent fixture файлы без необходимости запускать `pnpm dev`. Они используют ту же E2E инфраструктуру (built app через `pnpm start`, disposable test user, API helpers), но **исключены из всех обычных тестовых прогонов** (`test:e2e:full`, `test:e2e:flows` и др.).

### Как это работает

1.  Конфигурация Playwright определяет выделенный `generators` проект, который матчит только `specs/generators/*.spec.ts`.
2.  Проект `chromium` явно игнорирует generator файлы через `testIgnore`, поэтому они никогда не запускаются при `test:e2e:full` или любой команде `--grep @flow`/`@smoke`/и т.д.
3.  Generator specs записывают свой output в `tools/fixtures/` — эта директория **не** очищается E2E runner'ом и **не** находится в `.gitignore`, поэтому fixture файлы сохраняются до ручного удаления и могут быть закоммичены в репозиторий.
4.  Информационные скриншоты попадают в `test-results/self-hosted-app/` (или аналогичную generator-specific директорию), которая **очищается** при следующем E2E прогоне — это ожидаемое поведение.

### Запуск генераторов

Запустить все генераторы:

```bash
pnpm run build:e2e
pnpm run test:e2e:generators
```

Запустить конкретный генератор по имени:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "self-hosted app"
```

Если сервер уже запущен (например, от предыдущего E2E прогона), переиспользовать его:

```bash
E2E_FULL_RESET_MODE=off E2E_ALLOW_REUSE_SERVER=true pnpm run test:e2e:generators
```

### Доступные генераторы

| Генератор | Output | Описание |
| --- | --- | --- |
| `metahubs-self-hosted-app-export` | `tools/fixtures/metahubs-self-hosted-app-snapshot.json` | Создаёт локализованный fixture Metahubs Self-Hosted App, сажает baseline runtime settings, публикует его и экспортирует snapshot для self-hosted parity flows. |
| `metahubs-quiz-app-export` | `tools/fixtures/metahubs-quiz-app-snapshot.json` | Создаёт локализованный fixture quiz-приложения и экспортирует snapshot для quiz runtime import flows. |
| `metahubs-lms-app-export` | `tools/fixtures/metahubs-lms-app-snapshot.json` | Создаёт локализованный fixture LMS-приложения и экспортирует snapshot для LMS runtime import flows. |

### Создание новых генераторов

Чтобы добавить новый генератор:

1.  Создайте spec файл в `specs/generators/`, например `admin-config-export.spec.ts`.
2.  Пометьте тест тегом `@generator` (не `@flow`).
3.  Используйте `createLoggedInApiContext` + API helpers из `support/backend/api-session.mjs` для создания ресурсов через API.
4.  Записывайте output fixtures в `tools/fixtures/` с помощью `fs.writeFileSync`.
5.  Используйте `recordCreatedMetahub` / `recordCreatedApplication` чтобы runner мог очистить ресурсы базы данных после завершения генератора.
6.  Устанавливайте щедрый `test.setTimeout()` (генераторы — длительные операции, 300s+ — типичная продолжительность).

Generator specs следуют тем же конвенциям, что и flow specs — они зависят от проекта `setup` для аутентификации, используют тот же E2E env и участвуют в том же цикле очистки.

## Manual Screenshots and Video

Используйте прямые Playwright artifacts, когда нужен визуальный материал до или после изменения без запуска всего suite.

Ручные скриншоты по уже запущенному приложению:

```bash
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' --full-page http://127.0.0.1:3100 test-results/manual-cli/home-full.png
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' http://127.0.0.1:3100/auth test-results/manual-cli/auth.png
pnpm exec playwright screenshot --wait-for-timeout 2500 --viewport-size '1440,900' --color-scheme dark http://127.0.0.1:3100 test-results/manual-cli/home-dark.png
```

Полезные флаги:

-   `--full-page` снимает весь документ, а не только видимую область.
-   `--viewport-size '1440,900'` фиксирует поверхность ревью на стандартном desktop-размере suite.
-   `--color-scheme dark` полезен для matrix-style проверок UI без запуска полного matrix project.
-   `--wait-for-timeout 2500` или `--wait-for-selector <selector>` помогает дождаться hydration, dialog и async content.

Предпочитайте ручные скриншоты для:

-   before/after сравнения UI во время реализации;
-   точечного материала по одному route, dialog или role state;
-   быстрой визуальной проверки, когда полный `@visual` run был бы избыточным.

Artifacts и failure media:

-   Сохраняйте ad hoc screenshots в `test-results/manual-cli/`, чтобы они оставались отдельно от suite-managed artifacts.
-   Обычные Playwright test runs уже пишут failure screenshots, traces и HTML report data в `test-results/` и `playwright-report/`.
-   Текущая конфигурация suite использует `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` и `video: 'retain-on-failure'`.

Ручной video capture тоже возможен, но у Playwright нет отдельной `playwright video` CLI subcommand. Используйте короткий inline Node script с Playwright library, когда нужна запись для ревью:

```bash
pnpm exec node --input-type=module <<'EOF'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const outDir = path.resolve('test-results/manual-cli-video')
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }
})

const page = await context.newPage()
await page.goto('http://127.0.0.1:3100', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.goto('http://127.0.0.1:3100/auth', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const video = page.video()
await context.close()
const savedPath = await video.path()
console.log(savedPath)
EOF
```

Сохранённый файл обычно будет `.webm` artifact внутри `test-results/manual-cli-video/`, который можно открыть прямо в VS Code.

## Agent Workflow

Используйте такую последовательность для agent-driven implementation:

1. `pnpm run build:e2e`
2. `pnpm run test:e2e:smoke`
3. Если изменение затрагивает permissions, запускайте `pnpm run test:e2e:permissions`
4. Если изменение затрагивает publication/application chaining, запускайте `pnpm run test:e2e:combined`
5. Запускайте `pnpm run test:e2e:flows` для более широкого browser flow slice
6. Если изменение чувствительно к layout, запускайте `pnpm run test:e2e:visual`
7. Смотрите `playwright-report/` и `test-results/` только при failures
8. Используйте MCP только когда нужна интерактивная инспекция и CLI artifacts уже недостаточны
9. Считайте transient `/auth` error alerts retryable только внутри общего login helper; persistent auth failures всё равно должны валить suite
10. Когда меняются platform codename defaults, проверяйте `/api/v1/metahubs/codename-defaults` через browser-driven coverage, а не полагайтесь только на то, что admin-settings write уже прошёл
11. Держите admin-role API-assisted setup совместимым с тем же VLC codename contract, который использует браузер; single-locale enforcement не должен деградировать codenames в legacy flat objects
12. Для application runtime CRUD предпочитайте общие `apps-template-mui` row-actions и form-dialog contracts; browser coverage должна продолжать проверять persisted row state вместо изобретения runtime-specific test surfaces
13. Для board pages предпочитайте backend-backed summary assertions через существующие dashboard cards вместо добавления отдельных test widgets или duplicate overview components
14. Для connector-board и migration pages предпочитайте backend-подтверждённые migration names, summaries и rollback-analysis results вместо DOM-only предположений или ad-hoc timeout-based waits
15. Держите детерминированные Playwright defaults зафиксированными для suite work: fixed locale/timezone/light theme, reduced motion, blocked service workers и явные action/navigation timeouts должны оставаться синхронизированы с runner contract
16. Рассматривайте `test-results/` и `playwright-report/` как per-run artifacts; runner теперь очищает их перед каждым suite, чтобы содержимое report всегда соответствовало последнему execution
17. Для setup `publication -> linked application` дожидайтесь, пока publication сообщит о готовой active version перед созданием linked application; если создание всё равно падает, считайте это реальным product defect и оставляйте helper fail-closed, не маскируя проблему retry-логикой
18. Держите targeted matrix slice сфокусированным: проверяйте русский рендер и тёмную тему через отдельные matrix specs вместо клонирования каждого CRUD flow на множество locale/theme projects
19. Используйте `test:e2e:restart-safe` всякий раз, когда меняются bootstrap, migrations или first-run initialization, чтобы second-start regressions на fresh database ловились до ручного QA
20. Используйте `test:e2e:diagnostics`, когда create/edit dialog кажется перегруженным в простое; script записывает Chromium performance metrics и Playwright trace вместо попытки угадывать CPU churn по обычным DOM assertions

## Safety Rules

-   Browser suite никогда не должна отдавать `SERVICE_ROLE_KEY` во frontend code.
-   Disposable users создаются через аутентифицированные admin routes и удаляются через Supabase admin cleanup.
-   Сгенерированные artifacts живут только в `tools/testing/e2e/.auth` и `tools/testing/e2e/.artifacts`.
-   Cleanup сохраняет run manifest при неполном teardown, чтобы следующий `test:e2e:cleanup` мог восстановить orphaned resources.
-   Не запускайте несколько e2e commands параллельно в одном workspace; runner принудительно поддерживает последовательное выполнение ради безопасности данных.
-   Screenshot baselines нужно принимать только после ручной проверки.
-   Общие browser login retries намеренно ограничены и срабатывают только когда страница остаётся на `/auth` с видимым error alert.
-   Restart-safe validation намеренно запускает и останавливает built app дважды; дочерний `pnpm start` process может логировать `ELIFECYCLE` при контролируемом shutdown, но сама команда должна завершаться успешно, иначе проверка считается проваленной.

## MCP Usage

Репозиторий содержит `playwright.mcp.config.json` и `playwright.mcp.client.example.json`.

Запускайте закреплённый MCP server из корня репозитория:

```bash
pnpm run mcp:playwright
```

Затем направьте локальный MCP client на example JSON и один раз выполните обычный e2e setup, чтобы появился `storage-state.json`. MCP следует использовать как вспомогательный инструмент отладки, а не как основной regression runner.
