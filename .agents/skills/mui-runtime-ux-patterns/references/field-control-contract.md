# Runtime Field Control Contract

Use this contract for runtime CRUD dialogs and metadata-generated forms.

| Semantics                                                                   | Default Control                                                         | Forbidden Default                                       | Metadata / Runtime Contract                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| owner, author, learner, assignee, reviewer, user, group, role               | User/record picker with name/email, or hidden server-owned current user | Raw editable text/UUID ID                               | `widget: "reference"`, record picker metadata, `defaultValue: runtime.currentUserId`, `formHidden`, or server-owned config |
| foreign key to known runtime object                                         | `Autocomplete`, `Select`, relation builder, or generic record picker    | Raw text field unless admin/debug                       | target object metadata, display field, filters, search endpoint                                                            |
| description, notes, summary, details, body, instructions, feedback, comment | `TextField multiline` / textarea with `rows` or `minRows` 2-4           | Single-line input                                       | `uiConfig.widget = "textarea"`, `uiConfig.rows`                                                                            |
| cover, avatar, media, file, URL, resource source                            | preview, link badge, icon chip, or hidden from grid                     | Raw JSON object                                         | `uiConfig.widget = "resourceSource"`, renderer contract, `gridHidden` when not useful                                      |
| Editor.js/block content                                                     | shared block editor                                                     | raw JSON textarea or grid cell                          | `uiConfig.widget = "editorjsBlockContent"`, `gridHidden: true`                                                             |
| enum/status/boolean                                                         | select, checkbox, switch, localized chip                                | raw codename when labels exist                          | enum labels and i18n keys                                                                                                  |
| dates/numbers/progress                                                      | localized formatting, percent/status display                            | unformatted raw strings when semantic formatting exists | formatter metadata or generic display helper                                                                               |

## Local Precedents

-   `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx` already supports `textarea`, rows, hidden fields, resource-source widgets, localized validation, REF/select controls, and Editor.js block content.
-   Runtime workspace/member UI already uses human-readable names, emails, and role chips instead of requiring users to manually type IDs.
-   Metadata should drive the generic renderer. A field that is bad in LMS is usually bad in any runtime app with the same semantics.

## Acceptance Checklist

-   [ ] No editable user/owner/reference ID field is visible to normal users.
-   [ ] Owner/current-user fields are hidden, server-owned, or selected by human label.
-   [ ] Long text is multiline with enough rows for real authoring.
-   [ ] Optional resource-source fields are quiet when empty.
-   [ ] Validation messages are localized and do not reveal implementation internals.
