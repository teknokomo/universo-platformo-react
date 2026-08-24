---
description: Delta ledger for the PlayCanvas Engine runtime upgrade from 2.18.1 to 2.21.4 in `@universo-react/playcanvas-engine`.
---

# PlayCanvas Engine Upgrade Ledger: 2.18.1 → 2.21.4

This ledger documents the runtime dependency bump of `playcanvas` from `2.18.1` to `2.21.4` in the pnpm workspace catalog and maps every upstream breaking change onto the local surface.

Local usage profile (verified by grep on 2026-08-22): strictly WebGL2 rendering, procedural primitives (`BoxGeometry`, `SphereGeometry`), `StandardMaterial`, `MeshInstance` created as `new pc.MeshInstance(mesh, material)` in `packages/universo-react-playcanvas-engine/src/runtime.ts` (~line 147). No audio playback, no GSplat, no XR, and no WebGPU code exists in `packages/universo-react-playcanvas-engine/src/` or `apps-template-mui` PlayCanvas widget sources. Examples-only upstream churn is ignored.

## Release Notes Reviewed

| Tag       | Released   | Source                                                    |
| --------- | ---------- | --------------------------------------------------------- |
| `v2.19.0` | 2026-05-28 | https://github.com/playcanvas/engine/releases/tag/v2.19.0 |
| `v2.20.0` | 2026-06-23 | https://github.com/playcanvas/engine/releases/tag/v2.20.0 |
| `v2.21.0` | 2026-07-21 | https://github.com/playcanvas/engine/releases/tag/v2.21.0 |
| `v2.21.4` | 2026-08-13 | https://github.com/playcanvas/engine/releases/tag/v2.21.4 |

## Breaking Changes Ledger

| Release   | Upstream breaking change                                                                                               | Upstream change summary                                                                                                              | Affected local symbol/path or verdict                                                                                                                                  | Required verification                                                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v2.19.0` | Remove HTMLAudioElement fallback from sound system ([#8636](https://github.com/playcanvas/engine/pull/8636))           | The sound system drops its `HTMLAudioElement` fallback path and requires Web Audio support.                                          | N/A: no audio playback exists anywhere in the wrapper or the PlayCanvas canvas widget.                                                                                 | N/A (no audio surface; neither test suite exercises sound).                                                                                                                                                                                                                                 |
| `v2.19.0` | Deprecate `GSplatComponent#unified` and default it to `true` ([#8802](https://github.com/playcanvas/engine/pull/8802)) | Gaussian splat unified rendering becomes the default and the `unified` flag is deprecated.                                           | N/A: no GSplat assets, components, or scripts are used locally.                                                                                                        | N/A.                                                                                                                                                                                                                                                                                        |
| `v2.20.0` | Move gsplat `lodRangeMin`/`lodRangeMax` to `GSplatComponent` ([#8908](https://github.com/playcanvas/engine/pull/8908)) | GSplat LOD range options move onto `GSplatComponent` init data instead of the splat resource.                                        | N/A: no GSplat components exist locally.                                                                                                                               | N/A.                                                                                                                                                                                                                                                                                        |
| `v2.20.0` | World-space PCSS penumbra ([#8818](https://github.com/playcanvas/engine/pull/8818))                                    | PCSS soft-shadow penumbra sizing switches to world-space units, changing shadow edge appearance for PCSS users.                      | N/A: local scenes keep default shadow modes and never enable PCSS penumbra.                                                                                            | browser proof via mmoomm flows (procedural scenes render without shadow regressions).                                                                                                                                                                                                       |
| `v2.21.0` | Remove `MeshInstance` parameter pass flags ([#9071](https://github.com/playcanvas/engine/pull/9071))                   | Per-pass flag constructor parameters are removed from `MeshInstance`; the plain `(mesh, material)` constructor form stays supported. | `createLowPolySphereEntity` in `src/runtime.ts` (~line 147): `new pc.MeshInstance(mesh, material)` remains valid after the removal; no pass flags were passed locally. | `index.test.ts` “re-exports the PlayCanvas engine API”; `PlayCanvasCanvasWidget.test.tsx` “renders a published MMOOMM visual linkup lab manifest as a static PlayCanvas scene” and “cleans up the static MMOOMM visual linkup lab runtime on unmount”; plus browser proof via mmoomm flows. |
| `v2.21.0` | Rename gsplat script classes to match core `GSplat` casing ([#9040](https://github.com/playcanvas/engine/pull/9040))   | ESM gsplat example/script classes are renamed for consistent casing.                                                                 | N/A: no gsplat ESM scripts are registered locally.                                                                                                                     | N/A.                                                                                                                                                                                                                                                                                        |

`v2.21.4` contains no breaking changes (a single VSM shadow-caster depth fix, [#9124](https://github.com/playcanvas/engine/pull/9124)).

Verdict totals: 5 × N/A (with justification), 1 × mapped-to-local-symbol and confirmed compatible.

## Notable Behavior Fixes Relevant To The Local Surface

Non-breaking fixes that touch the WebGL2/procedural/material/canvas-lifecycle paths this repository relies on:

-   `v2.19.0`: opacity dither now fully hides at alpha 0 and fully shows at alpha 1 ([#8767](https://github.com/playcanvas/engine/pull/8767)) — sharpens translucent edges produced by `createTranslucentStandardMaterial`; verified by `index.test.ts` “creates translucent materials with bounded opacity” plus browser proof via mmoomm flows.
-   `v2.19.0`: asset load retries enabled by default ([#8744](https://github.com/playcanvas/engine/pull/8744)) — local scenes are procedural, so retry behavior only affects optional future asset loads.
-   `v2.20.0`: reset active WebGL texture unit on device init for reused contexts ([#8894](https://github.com/playcanvas/engine/pull/8894)) — hardens remount paths exercised by `PlayCanvasCanvasWidget.test.tsx` “cleans up PlayCanvas and Colyseus resources on unmount before remounting a fresh room”.
-   `v2.20.0`: `app.assets` is available immediately after AppBase construction ([#8952](https://github.com/playcanvas/engine/pull/8952)); `camera.screenToWorld` no longer returns NaN when called in `initialize` ([#8950](https://github.com/playcanvas/engine/pull/8950)) — lifecycle hardening; local camera math is manual and unaffected.
-   `v2.21.0`: view-level uniforms moved to uniform buffers on WebGL2 ([#8987](https://github.com/playcanvas/engine/pull/8987), [#8967](https://github.com/playcanvas/engine/pull/8967)) — internal WebGL2 pipeline change invisible to the wrapper API; covered by browser proof via mmoomm flows.
-   `v2.21.0`: device constructor no longer crashes when the canvas lacks `getBoundingClientRect` ([#9000](https://github.com/playcanvas/engine/pull/9000)); inverted buffer usage flags in `Mesh.clear()` fixed ([#9023](https://github.com/playcanvas/engine/pull/9023)).
-   `v2.21.4`: out-of-range depth discarded in VSM shadow casters ([#9124](https://github.com/playcanvas/engine/pull/9124)) — N/A locally (no VSM shadows).

## Verified Facts

-   **npm integrity**: `sha512-L4UGy3z/YT8AaNBEY4ITsZup548UFMabF7loh0YQ0DRwQLdjIW8grmZPoQ1+B83+N6sejRS0/XlXV2Vfb11+fw==`, published `2026-08-13T11:52:03Z`.
-   **Bundle impact (baseline → after)**: main chunk `5107.7 KiB` → `3085.3 KiB` raw, gzip `1439.6` → `916.7 KiB`. The engine moved to a lazy chunk `PlayCanvasCanvasWidget-*.js` (≈ `2033.5 KiB`) loaded only for `playcanvasCanvas` widgets.
-   **Canvas identity contract**: `createBasicApplication` accepts an options object (`{ canvas, applicationId?, windowKeyboard? }`). Providing `applicationId` sets `canvas.id` because the engine keys its application registry by canvas id; `destroy()` removes that id again. Keyboard input attaches to the canvas unless `windowKeyboard: true` is set, so concurrent widgets never steal each other's keyboard events.
-   **WebGL2-unavailable terminal state**: when WebGL2 is unavailable the widget skips engine mount and renders the localized terminal state keyed by `playcanvasCanvas.webglUnavailable`; verified by `PlayCanvasCanvasWidget.test.tsx` “renders a localized terminal state and skips engine mount when WebGL2 is unavailable”.

## Disposition Decisions

-   **Presence made explicit**: `LocalPresence` is now passed explicitly instead of relying on implicit defaults; details live in the multiplayer documentation.
-   **Zod override kept at 3.x**: the core package declares peer metadata `^4.1.12` for Zod 4 compatibility, but the override stays at 3.x because it is metadata-only — zero `zod` imports were verified in shipped core builds on 2026-08-22.
