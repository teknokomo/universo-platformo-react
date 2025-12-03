# Шаблон `template-playcanvas-mmoomm` — [Статус: Планируется]

Назначение: специализированный плагин для генерации PlayCanvas‑проекта с MMOOMM‑наложениями (UI/логика клиента: предикция/интерполяция, HUD, сетевые события).

Роль в дорожной карте: Этап 1 (workspace‑плагины), Этап 5 (клиентская предикция/реконсилиация), Этап 6 (минимальные домены).

Состав (MVP):

-   Зависит от `template-playcanvas-core`.
-   Встраивание сетевого рантайма (Colyseus client, буферы снапшотов, интерполяция).
-   Базовый HUD (скорость, состояние корабля, цели), примеры подписок на события.

Интеграции: `@universo-platformo/client-sdk`, `@universo-mmoomm/client-sdk`, `multiplayer-backend`.

См. также: `roadmap/technical-specifications/authoritative-mmo-networking.md`, `applications/technical-systems/multiplayer.md`.
