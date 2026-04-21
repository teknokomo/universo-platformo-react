---
description: Переключение рабочих пространств, создание shared workspace и управление участниками в workspace-enabled applications.
---

# Управление Рабочими Пространствами

Applications с включёнными workspaces теперь напрямую показывают runtime-модель рабочих пространств в общем MUI shell.

## Что может делать пользователь

- переключаться между доступными workspace из navbar приложения;
- создавать shared workspace;
- приглашать участников по `userId` и назначать runtime workspace role;
- удалять участников из shared workspace;
- делать рабочее пространство текущим default workspace.

## Почему это важно для LMS

LMS MVP использует workspaces как границу совместной работы.
Например, одна команда преподавателей может работать в одном workspace, а другая команда класса в другом, и при этом runtime rows изолируются backend-предикатами с учётом workspace.

## Текущие роли

- `owner`
- `member`

Эти роли хранятся в schema приложения и отделены от глобальных platform roles.

## UI-компоненты

Текущая реализация использует:

- `WorkspaceSwitcher`
- `WorkspaceManagerDialog`

Оба компонента живут в `packages/apps-template-mui` и являются общими для любого workspace-enabled application.
