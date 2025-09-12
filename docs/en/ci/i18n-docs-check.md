# i18n Docs Consistency Check

This page documents how the repository checks English/Russian documentation consistency and how to run the check locally and in CI.

## Overview

The repository includes a small Node script that validates that paired English and Russian docs stay structurally identical:

- Matching line count
- Matching number of headings (`#`)
- Matching number of fenced code blocks (```) 
- Matching number of bullet lines (`- `)

Script location:

```
tools/docs/check-i18n-docs.mjs
```

## Local Usage

Run the check with PNPM:

```
pnpm docs:i18n:check
```

By default, the script runs in a scoped mode to the Resources docs. You can explicitly set the scope via env:

```
I18N_SCOPE=resources pnpm docs:i18n:check
I18N_SCOPE=all        pnpm docs:i18n:check
```

Scopes:

- `resources` — only pairs related to Resources apps (`apps/resources-frt`, `apps/resources-srv`) and their app docs (`docs/en|ru/applications/resources/README.md`)
- `all` — scan the entire repository (enable after fully syncing the rest of the docs)

## CI Workflow

GitHub Actions runs the check on pull requests and pushes that touch Resources docs:

```
.github/workflows/docs-i18n-check.yml
```

The job uses Node 20, PNPM 9, installs dependencies and executes:

```
I18N_SCOPE=resources pnpm docs:i18n:check
```

## Failure Output

On mismatch the script prints the EN/RU file paths and all differences (line count, headings, code fences, bullets) and exits with code 1. Fix the RU file to match the EN file structure (or vice versa) before merging.

## Extending to Full Repo

Once the broader documentation is synchronized, change the workflow step to:

```
I18N_SCOPE=all pnpm docs:i18n:check
```

## Optional Pre‑commit Hook

You may add a Husky pre‑commit step to run the check only when README pairs are modified. Keep in mind it can be strict and block commits until pairs are aligned.

