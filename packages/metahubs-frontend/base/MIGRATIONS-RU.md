# Metahubs Frontend — Гард миграций

> Извлечено из [README-RU.md](README-RU.md). Общий обзор пакета см. в README.

## MetahubMigrationGuard

Компонент-гард маршрутов, который блокирует навигацию при наличии незавершённых миграций метахаба. Использует `MigrationGuardShell` из `@universo/migration-guard-shared` для общей логики гарда.

```tsx
import { MetahubMigrationGuard } from '@universo/metahubs-frontend'

// Использование: оберните маршруты метахаба для проверки миграций перед доступом
<MetahubMigrationGuard>
  <MetahubBoard />
</MetahubMigrationGuard>

// Возможности:
// - Вызывает GET /metahub/:id/migrations/status при монтировании
// - Блокирует доступ когда migrationRequired=true (обновление структуры или шаблона)
// - Показывает модальный диалог с чипами статуса (структура/шаблон нуждаются в обновлении)
// - Кнопка "Применить (сохранить данные)" — POST /metahub/:id/migrations/apply
// - Кнопка "Открыть миграции" — навигация к /metahub/:id/migrations
// - Пропускает маршрут /migrations без блокировки
// - Отображает структурированные блокировки с i18n: t('migrations.blockers.${code}', params)
// - Отключает "Применить" при наличии блокировок (проверка hasBlockers)
```

## Общие компоненты

Гард делегирует общую логику `MigrationGuardShell` из `@universo/migration-guard-shared`:

- **Проверка ID сущности** — нет ID → пропуск
- **Пропуск маршрута** — маршрут миграций → пропуск
- **Состояния загрузки/ошибки** — спиннер и алерт ошибки с повтором
- **Логика серьёзности** — OPTIONAL → пропуск, RECOMMENDED → закрываемый диалог, MANDATORY → блокирующий диалог
- **Состояние отклонения** — сохраняется в рамках жизненного цикла компонента

### Специфичная отрисовка метахаба:
- Чип обновления структуры + Чип обновления шаблона
- Кнопка "Применить (сохранить данные)" с состоянием загрузки
- Кнопка навигации "Открыть миграции"
- Отображение ошибок применения

## Структурированные блокировки (i18n)

Блокировки миграций используют структурированные объекты для интернационализированного отображения:

```typescript
// Тип StructuredBlocker (из @universo/types):
interface StructuredBlocker {
  code: string        // Суффикс ключа i18n (например, 'entityCountMismatch')
  params: Record<string, unknown>  // Параметры интерполяции (например, { expected: 5, actual: 3 })
  message: string     // Резервное сообщение на английском
}

// Паттерн отрисовки на фронтенде (MetahubMigrationGuard.tsx):
t(`migrations.blockers.${blocker.code}`, {
  defaultValue: blocker.message,
  ...blocker.params
})

// 15 ключей i18n блокировок определены в EN/RU локалях
```

## Хуки

- `useMetahubMigrationsStatus` — хук TanStack Query использующий `MIGRATION_STATUS_QUERY_OPTIONS` из общего пакета
- `useMetahubMigrationsList` — загружает историю миграций
- `useMetahubMigrationsPlan` — загружает детали плана миграций
