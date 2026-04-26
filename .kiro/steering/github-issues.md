---
inclusion: auto
name: github-issues
description: Use when creating, updating, analyzing, labeling, or closing GitHub issues.
---

# GitHub Issues Guidelines

In our GitHub repository, we create Issues with the main text in English, and also use the spoiler functionality with the <details></details> markup to place the Russian version of the text there.

Create the text for Issues using this template, the text of the Issue should be written in the future tense, as if this text is being written for work that has yet to be completed. Always output the generated issue text in a markdown code block.

**IMPORTANT:** 
1. **Always include Russian translation** - Every Issue must have both English and Russian versions of the content
2. **Use exact spoiler tag** - Always use exactly `<summary>In Russian</summary>` for the spoiler tag. 
   - ✅ **CORRECT**: `<summary>In Russian</summary>`
   - ❌ **INCORRECT**: `<summary>🇷🇺 Описание на русском</summary>`
   - Do not use variations like "На русском языке", "Russian version", "🇷🇺 Описание на русском", or any other text
3. **Complete translation required** - The Russian version inside the spoiler must be a complete translation of the English content, not just a summary
4. **Identical structure** - The Russian version must have exactly the same number of lines and sections as the English version. Both texts must be completely identical in structure and meaning

```
# Update menu items Documentation, Chat Flows, Agent Flows

It is necessary to update the menu items:

- Change the label "Documentation" ("Документация") to "Help" ("Справка"), as the documentation will be hosted at docs.universo.pro and be called "Help" ("Справка").
- Rename "Chat Flows" ("Чат‑потоки") to "Spaces" ("Пространства") within the Uniks menu.
- Rename "Agent Flows" ("Агент‑потоки") to "Agents" ("Агенты").
<details>
<summary>In Russian</summary>

# Актуализировать пункты меню Документация, Чат‑потоки, Агент‑потоки

Необходимо доработать пункты меню:

- Изменить пункт "Документация" ("Documentation") на "Справка" ("Help"), поскольку документация будет располагаться на домене docs.universo.pro и именоваться "Справка" ("Help").
- Переименовать в меню Уников пункт "Чат‑потоки" ("Chat Flows") в "Пространства" ("Spaces").
- Переименовать пункт "Агент‑потоки" ("Agent Flows") в "Агенты" ("Agents").
</details>
```
