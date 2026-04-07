# Browser E2E Testing

Используйте Playwright browser suite, когда реализацию нужно проверить по реально отрисованному UI и реальным эффектам на бэкенде.

## When To Run It

- Запускайте `test:e2e:smoke` после изменений в auth, routing, startup или route guards.
- Запускайте `test:e2e:permissions` после изменений в admin roles, users или access rules.
- Запускайте `test:e2e:combined` после изменений в publications, linked applications, connectors или schema generation.
- Запускайте `test:e2e:flows` для более широкого повседневного regression slice.
- Запускайте `test:e2e:visual` только когда менялись layout-sensitive pages или dialogs.
- Запускайте `test:e2e:restart-safe` после изменений в bootstrap, migrations или first-run initialization.
- Запускайте `test:e2e:diagnostics`, когда окно сущности подозрительно нагружает браузер в простое и нужны артефакты, а не предположения.

## Environment Contract

- Храните browser-test secrets в `packages/universo-core-backend/base/.env.e2e.local`.
- Храните optional frontend overrides в `packages/universo-core-frontend/base/.env.e2e.local`.
- Используйте выделенный Supabase test project и никогда не коммитьте реальные secrets или generated auth state.
- Backend e2e env должен включать Supabase URL, `SUPABASE_PUBLISHABLE_DEFAULT_KEY` или `SUPABASE_ANON_KEY`, service-role key, bootstrap admin credentials и database connection settings.
- Production-style auth rate limits по умолчанию сохраняются, но для выделенного e2e backend env нужно повышать `AUTH_LOGIN_RATE_LIMIT_MAX`, когда полный suite делает много легитимных login round-trips.

## What The Suite Covers

- Auth setup с disposable test users и сохранённым browser state.
- Admin smoke coverage для redirect-away поведения least-privilege user и положительного доступа bootstrap admin в реальную `/admin` зону.
- Admin access boundaries и browser CRUD для roles, global users, locales, instances и platform codename settings.
- Browser-покрытие admin role-users page, которое проверяет реальный список пользователей, назначенных на роль, через существующий admin route.
- Metahub create, copy, delete, settings-save, codename-mode и member-permission flows.
- Browser-покрытие metahub layouts: проверка существующих list/detail routes и сохранения widget-toggle состояния без добавления test-only layout components.
- Browser-покрытие metahub domain entities для hubs, catalogs, sets, enumerations, values, attributes, elements и constants через существующие CRUD surfaces.
- Browser-покрытие жизненного цикла metahub branches: create, copy, set default, activate и delete через существующую страницу Branches.
- Browser-покрытие metahub migrations: переключение реального branch selector, проверка branch-aware migration plan и подтверждение, что Apply остаётся disabled, когда upgrade не требуется.
- Browser-покрытие applications list route и навигации в runtime/admin surfaces через существующий список приложений.
- Application access/member flows с проверкой invite, redirect-away поведения для non-admin member и последующего admin promotion.
- Browser-покрытие board overview для metahub, application, admin и instance pages с backend-проверкой счётчиков через существующие dashboard cards.
- Browser-покрытие application connector: создание через UI, выбор publication-backed metahub link, проверка single-connector guardrail и сохранения изменений после edit.
- Browser-покрытие connector board и application migrations: проверка schema-state cards, перехода в migration history, backend-подтверждённых migration rows и состояния rollback-analysis dialog.
- Application settings coverage с сохранением workspace limits и проверкой, что создание runtime rows блокируется на достигнутом лимите.
- Browser-покрытие application workspace regressions: проверка info-state в limits до создания схемы и browser-level изоляции данных между пользователями при включённых workspaces.
- Browser-покрытие application runtime CRUD: создание, редактирование, копирование и удаление runtime rows через существующий shared CRUD UI с backend-проверкой persisted данных после каждого шага.
- Codename coverage, которая проверяет переключение UI между single-locale и localized editor при сохранении одного JSONB/VLC поля codename; отключение localized editing может убирать non-primary locale variants, но не должно превращать storage в plain text.
- Browser-покрытие codename UX: автогенерация от name, остановка синхронизации после ручной правки codename и восстановление автогенерации после полного очищения name.
- Browser-покрытие metahub create options: optional default entities можно отключить, но branch/layout остаются обязательными.
- Browser-покрытие publication creation variants: publication only и publication plus linked application без немедленного schema sync в дополнение к combined regression path.
- Browser-покрытие entity-dialog regressions: edit для set constants, полнота полей в enumeration-value edit/copy и генерация codename при localized attribute copy.
- Publication create/version/sync coverage плюс combined и split flows в linked applications и connectors.
- Targeted matrix coverage для русского интерфейса в светлой и тёмной теме без дублирования всего CRUD suite на каждый locale/theme project.
- Profile update и проверенные visual snapshots.
- Детерминированный Playwright runtime с очисткой артефактов перед каждым прогоном и failure-only traces/screenshots/videos.

## Workflow

1. Запустите `pnpm run build:e2e`.
2. Сначала запускайте самый маленький релевантный tagged suite.
3. Смотрите Playwright HTML report, trace, screenshots и video только при failures.
4. Используйте MCP только для интерактивного исследования, когда CLI artifacts уже недостаточно.
5. Дайте cleanup завершиться, чтобы manifest безопасно удалил test users и test data.
6. Оставляйте browser login retries строго ограниченными и используйте их только для видимых transient auth-error alert на `/auth`; постоянные login failures должны оставаться дефектами.
7. Когда browser-поведение зависит от platform codename defaults, ориентируйтесь на покрытый браузерным тестом контракт `/metahubs/codename-defaults`, а не только на факт успешной записи в admin settings.
8. Держите admin role helpers синхронизированными с общим one-field VLC codename contract, чтобы `general.codenameLocalizedEnabled` только сокращал locale variants внутри persisted JSONB payload и никогда не вёл себя как переключатель типа хранения.
9. Для application runtime CRUD переиспользуйте общий контракт `apps-template-mui` для row actions и form dialogs, а не вводите runtime-specific test-only selectors или параллельные admin surfaces.
10. Для board pages сверяйте реальные dashboard counters с backend summary API, а не создавайте отдельные тестовые overview widgets или фальшивые analytics components.
11. Для connector board и migration history проверяйте существующие cards и migration table через backend migration API, а не добавляйте отдельные test-only widgets или жёстко прошитые DOM-предположения.
12. Для branch selector на MUI держите корректную связку `InputLabel`/`Select` и опирайтесь на стабильные browser contracts, а не на предположения о том, как VLC JSONB будет выглядеть в option text.
13. Держите browser runner детерминированным: locale/timezone/theme, reduced motion, blocked service workers и явные action/navigation timeouts должны оставаться зафиксированными вместе с очисткой `test-results/` и `playwright-report/` перед каждым suite run.
14. Для `publication -> linked application` сначала дожидайтесь, пока publication покажет готовую active version; если после этого создание всё равно падает, трактуйте это как реальный product defect и оставляйте helper fail-closed, не маскируя проблему retry-логикой.
15. Держите language/theme coverage целевым: запускайте отдельный matrix spec для `ru-light` и `ru-dark`, а не размножайте каждый CRUD flow на всю browser matrix.
16. Используйте restart-safe команду для проверки fresh-database сценария, чтобы первый и второй запуск оставались под автоматизацией, а не только под ручной проверкой.
17. Используйте diagnostics-команду, когда long-lived dialogs выглядят resource-heavy; снимайте CDP metrics и traces вместо эвристик производительности в обычных CRUD spec-ах.
