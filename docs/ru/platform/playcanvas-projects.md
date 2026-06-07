---
description: Модель хранения проектов PlayCanvas Editor в метахабах.
---

# Проекты PlayCanvas

Проекты PlayCanvas — это design-time записи внутри ветки метахаба. Они позволяют подключённому пакету `@universo-react/playcanvas-editor-frontend` хранить metadata проекта без помещения сцен, ассетов или сгенерированных артефактов в `rel_metahub_packages.config`.

## Модель хранения

-   Metadata проектов, сцен, ассетов, скриптов, привязок, сгенерированных артефактов, совместимости и publication manifests хранится в branch system tables `_mhb_playcanvas_*`.
-   Небольшие локальные payload-файлы сцен и сгенерированные `.js` / `.mjs` артефакты хранятся в отдельном namespace файлов `playcanvas-projects/...`.
-   Config подключения пакета может хранить только настройки отображения и `playcanvasProject.defaultProjectId`.
-   Отключение пакета не удаляет проекты PlayCanvas. Удаление проекта удаляет его файлы проекта PlayCanvas.

## Интерфейс ресурсов

Откройте **Ресурсы → Пакеты**, подключите **PlayCanvas Editor**, затем используйте панель проектов PlayCanvas под списком пакетов.

Панель поддерживает:

-   список проектов и счётчики состояния;
-   создание проекта;
-   выбор проекта по умолчанию для подключения пакета;
-   удаление проекта с подтверждением.

При создании проекта пользователь вводит только отображаемое название. Внутреннее codename генерируется backend.

## API для адаптера

Backend предоставляет endpoints модели хранения и первый manager-only endpoint команд Editor bridge:

-   CRUD проектов в `/metahub/{metahubId}/playcanvas/projects`;
-   metadata сцен в `/projects/{projectId}/scenes`;
-   metadata ассетов и asset-scoped чтение/запись файлов в `/projects/{projectId}/assets`;
-   endpoints script assets, scene bindings, generated artifacts, publish и export.
-   типизированные команды Editor bridge в `/metahub/{metahubId}/playcanvas/editor-bridge/commands`.
-   minimal Editor compatibility REST в `/metahub/{metahubId}/playcanvas/editor-compatible/projects/{projectId}` для `config`, списка/чтения/сохранения сцен, summaries ассетов, scoped settings и явных cloud-only no-op descriptors.

Все routes требуют права управления метахабом и возвращают no-store responses для изменяемого authoring state. Запись файлов ограничена небольшими JSON/JS/MJS payloads, строгим base64, MIME allow-list, project-local paths и optional SHA-256 content assertions. Asset-scoped file routes проверяют, что `{assetId}` уже ссылается на запрошенный file reference.

Текущие bridge и compatibility slices поддерживают загрузку выбранного проекта, список/чтение/сохранение сцен, minimal JSON asset metadata, scoped settings, bridge capabilities, close, dirty-state messages и single-user ShareDB-compatible snapshot persistence для upstream Editor UI. Это ограниченные Universo-hosted authoring surfaces, а не parity с PlayCanvas Cloud API, без durable ShareDB operation-log history и collaborative editing.

## Снимки и копирование

Экспорт снимка метахаба включает секцию `playcanvasProjects`, если проекты существуют. Локальные файлы проекта попадают в снимок как небольшие base64 payloads с checksums. Импорт восстанавливает metadata проектов и локальные файлы, remaps project-local IDs и file roots, а снимки без `playcanvasProjects` продолжают импортироваться как legacy snapshots.

Копирование метахаба клонирует branch metadata и копирует дерево файлов `playcanvas-projects/...`. Удаление метахаба и cleanup неудачного импорта удаляют PlayCanvas project file trees вместе с файлами исходников модулей.

## Runtime публикации

Синхронизация опубликованного приложения использует нормализованные `playcanvasRuntimeManifests`, а не live authoring files. Runtime manifests участвуют в publication hash и сохраняются в runtime table приложения `_app_playcanvas_manifests`.

Опубликованные приложения должны читать immutable hashed runtime assets или сохранённые runtime manifests. В текущем ограниченном JSON/JS/MJS срезе локальные файлы PlayCanvas проецируются в самодостаточные runtime URLs формата `data:` с отдельными SHA-256 hashes; runtime manifests не должны раскрывать изменяемые authoring paths `playcanvas-projects/...`.

## Отложенная работа

-   Более широкая эмуляция PlayCanvas Cloud API.
-   Загрузка и обработка бинарных textures, models и audio.
-   Настройка S3/admin storage providers.
-   Collaborative authoring и UI слияния конфликтов за пределами checksum-based save protection.
-   Colyseus authoring state.
-   AI/MCP scene editing.
