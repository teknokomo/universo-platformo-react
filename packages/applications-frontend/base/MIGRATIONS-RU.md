# Applications Frontend — Гард миграций

> Обзор системы гарда миграций приложений. Полный обзор пакета см. в [README-RU.md](README-RU.md).

## ApplicationMigrationGuard

Компонент-гард маршрутов, который блокирует навигацию при необходимости обновления рантайм-схемы приложения. Использует `MigrationGuardShell` из `@universo/migration-guard-shared` для общей логики гарда.

```tsx
import { ApplicationMigrationGuard } from '@universo/applications-frontend'

// Использование: оберните маршруты приложения для проверки миграций
<ApplicationMigrationGuard>
  <ApplicationBoard />
</ApplicationMigrationGuard>

// Возможности:
// - Вызывает GET /application/:id/migrations/status при монтировании
// - Блокирует доступ когда migrationRequired=true (схема или структура устарели)
// - Показывает UnderDevelopmentPage когда schemaExists=false (серьёзность MANDATORY)
// - Показывает MaintenancePage когда structureUpgradeRequired=true (серьёзность MANDATORY)
// - Отображает модальный диалог с чипами серьёзности и структурированными блокировками
// - Кнопка "Перейти к миграциям" для ручного управления миграциями
// - Пропускает маршрут /migrations без блокировки
// - Отображает структурированные блокировки с i18n: t('migrations.blockers.${code}', params)
```

## Общие компоненты

Гард делегирует общую логику `MigrationGuardShell` из `@universo/migration-guard-shared`:

- **Проверка ID сущности** — нет ID → пропуск
- **Пропуск маршрута** — маршрут миграций → пропуск
- **Состояния загрузки/ошибки** — спиннер и алерт ошибки с повтором
- **Логика серьёзности** — OPTIONAL → пропуск, RECOMMENDED → закрываемый диалог, MANDATORY → блокирующий диалог
- **Состояние отклонения** — сохраняется в рамках жизненного цикла компонента

### Специфичная отрисовка приложения:
- Пре-диалог: `UnderDevelopmentPage` / `MaintenancePage` для MANDATORY серьёзности
- Чип: схема нуждается в обновлении (при `migrationRequired && !schemaExists`)
- Чип: структура нуждается в обновлении (при `structureUpgradeRequired`)
- Кнопка перехода к миграциям

## Хуки

- `useApplicationMigrationStatus` — хук TanStack Query использующий `MIGRATION_STATUS_QUERY_OPTIONS` из общего пакета
- Паттерн ключа запроса: `['applications', applicationId, 'migrations', 'status']`

## Ключи i18n

Ключи гарда миграций расположены в пространстве имён `migrationGuard.*`:

| Ключ | Назначение |
|---|---|
| `migrationGuard.checking` | Текст состояния загрузки |
| `migrationGuard.statusError` | Текст состояния ошибки |
| `migrationGuard.retry` | Подпись кнопки повтора |
| `migrationGuard.title` | Заголовок диалога |
| `migrationGuard.descriptionMandatory` | Описание обязательного обновления |
| `migrationGuard.descriptionRecommended` | Описание рекомендуемого обновления |
| `migrationGuard.navigateToMigrations` | Подпись кнопки навигации |
| `migrationGuard.dismiss` | Подпись кнопки отклонения |
