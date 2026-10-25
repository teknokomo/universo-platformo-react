# Public Dashboard runtime

`PublicDashboardRuntime` renders the strict public Dashboard DTO. Its host in
applications-frontend owns the application route and `AppMainLayout` theme. The
renderer reuses `MenuContent`, runtime language/color controls, MUI Paper, List,
Card and the shared Interpretation Network workspace composition, including its
Structure Pane, Matrix bridge and Details Pane. It never mounts authenticated
Dashboard, row adapters, workspace settings, template or Favorite commands.

## UI contract

Anonymous visitors select Structure → Interpretation → Matrix cell → Materials.
Only labels, descriptions and plain-text public content are displayed. Server
opaque handles remain in memory and public GET query parameters; placement
identity is the semantic `instanceKey`. No row, widget or layout UUID is generated.
Page/Object menu targets use semantic codenames. Hub menu entries are headings,
since the public runtime has no Hub target endpoint.

Navigation, retry, pagination and selection use native accessible controls.
Loading, empty and error states use the separate `publicInterpretationNetwork`
EN/RU namespace. Navigation restores focus to the current view heading; direct
Primary opening and Back to materials focus their respective headings. At narrow
widths the menu stacks above content and text wraps; scrolling stays within the
embedded Matrix table. No authoring controls exist in this component tree.

## DTO boundary and reuse

Authenticated row stores and mutation callbacks are not used by public runtime.
Public DTOs are adapted into response-local Matrix rows with ephemeral display
IDs; these IDs never reach the server or become persistent identity. The shared
Matrix and Details Pane receive read-only permissions and no-op mutation
callbacks. Material cards likewise use response-local positions, and body text
is rendered as React text, never as HTML.

The specialized transport validates input selectors, strict shared response
schemas and response view/locale/offset/opaque-parent correlation. It uses GET,
`credentials: 'omit'`, `cache: 'no-store'` and cancellation signals. Query keys
include applicationRef, locale, semantic target, placement, view, opaque parent
and offset. The host remounts navigation on scope changes. There is no mutation
transport or authenticated fallback.

The public DTO supplies bounded cell records and material lists. The shared
Matrix component presents configured read-only views from that data; this does
not enable authenticated row stores or editor actions. Primary material opens
when present in the materials response. The backend must place Primary on the
first materials page to guarantee direct opening under pagination. There is no
material handle/detail endpoint in this contract; Back returns to the same
response page without creating a persistent material link.
