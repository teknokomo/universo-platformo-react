# Browser E2E Testing

Use the Playwright browser suite when a change must be validated through the real rendered UI, the real backend, and the real metahub/application contracts.

## When To Run It

- Run `test:e2e:smoke` after changes to auth, startup, route guards, or global navigation.
- Run `test:e2e:permissions` after changes to roles, members, or access checks.
- Run `test:e2e:flows` after changes to metahub authoring, entity types, Resources, publications, linked applications, or connector flows.
- Run `test:e2e:visual` only when layout-sensitive pages or dialogs changed.
- Run `test:e2e:restart-safe` after bootstrap, migrations, or first-start logic changes.
- Run the generator project when GitBook screenshots or product fixtures must be regenerated from the actual product UI.

## Environment Contract

- Keep browser-test secrets in `packages/universo-core-backend/base/.env.e2e.local`.
- Keep optional frontend overrides in `packages/universo-core-frontend/base/.env.e2e.local`.
- Use only the dedicated Supabase test project.
- Never commit real secrets, generated auth state, or production credentials.
- Keep Playwright runtime deterministic: timezone, locale, reduced motion, cleanup of artifacts, and explicit navigation/action timeouts must stay pinned.

## What The Suite Must Cover

- Real login and least-privilege navigation boundaries.
- Metahub create, copy, delete, settings, members, and publication flows.
- Entity-type authoring through the real Entities workspace, including preset-backed creation and manual creation from the `empty` metahub template.
- Shared Resources flows for layouts, attributes, constants, values, and shared scripts.
- Runtime-facing publication and linked-application flows.
- Snapshot export/import fixtures that match the currently shipped entity-first schema.
- GitBook screenshot generators that open the real UI and capture the real product state.

## Engineering Rules

1. Prefer user-facing locators such as roles, labels, and stable test ids.
2. Reuse existing dialogs, cards, and list surfaces instead of adding test-only UI branches.
3. Use API-assisted setup only when it removes irrelevant boilerplate without hiding the product behavior under test.
4. Fail closed when a required backend state never appears; do not mask product defects with broad retries.
5. Keep browser assertions focused on visible behavior and persisted backend state, not on implementation details.
6. When a flow covers Resources, verify the real labels shown in the UI, not only the API payload.
7. When a flow covers templates, include the `empty` path so manual entity-type authoring stays protected against regressions.

## Recommended Workflow

1. Run `pnpm run build:e2e`.
2. Run the smallest relevant Playwright slice first.
3. Inspect HTML report, trace, screenshots, and video only on failures.
4. Regenerate screenshots or fixtures only after the product flow itself is green.
5. Let cleanup finish so the manifest can remove test users and metahubs safely.

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts)
