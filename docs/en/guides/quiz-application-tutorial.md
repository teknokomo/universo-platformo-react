---
description: Browser-authored tutorial for building a quiz application with metahub scripts, layout wiring, application settings, and runtime verification.
---

# Quiz Application Tutorial

This tutorial walks through the real browser-authored path used by the repository's Playwright coverage.
By the end, you will have a metahub-hosted quiz widget script, a layout that renders the widget, a linked application, and a verified runtime quiz.

## Before You Start

- Use an environment where metahubs, publications, and applications are already available.
- Sign in with a user that can manage the target metahub and the linked application.
- Keep the current scripting contract in mind: only embedded scripts and `sdkApiVersion = 1.0.0` are supported.

## Step 1: Open Or Create The Metahub

1. Open the target metahub from the main list.
2. Verify that you can reach General and Publications, then use the Layouts tab inside General when needed.
3. If you are starting from scratch, create the metahub first and keep its default branch active.

## Step 2: Create The Quiz Widget Script

1. Open the metahub edit dialog and switch to the Scripts tab.
2. Create a new script with the `widget` role.
3. Use `quiz-widget` as the codename.
4. Keep the source kind as Embedded.
5. Save the script after pasting the quiz widget source or after adapting the starter template.

![Metahub scripts tab](../assets/quiz-tutorial/metahub-scripts.png)

The browser-authored Playwright flow uses this step to prove that the quiz script is visible in the true metahub-level Scripts scope.

## Step 3: Attach The Widget To A Layout

1. Open Common -> Layouts and select the layout that should host the quiz.
2. Add or edit a `quizWidget` widget in the center zone.
3. Set `scriptCodename` to `quiz-widget`.
4. Save the layout and verify that the widget stays in the layout details view.

![Layout details with quiz widget](../assets/quiz-tutorial/layout-quiz-widget.png)

The shipped quiz contract keeps the quiz widget centered so the runtime is focused on the question flow instead of side panels.

## Step 4: Publish And Create The Application

1. Create or update a publication from the prepared metahub state.
2. Wait until the publication exposes a ready active version.
3. Create a linked application from that publication, or update the existing linked application.
4. Run the schema creation or sync flow if the application still needs runtime tables.

This is the point where publication data, layout data, and script bundles move from the metahub side into the application side.

## Step 5: Tune Application Settings

1. Open the application control panel at `/a/:applicationId/admin`.
2. Go to Settings.
3. Use the General tab to choose the preferred dialog size, fullscreen behavior, resize behavior, and close behavior.
4. Save the settings and confirm that later control-panel dialogs reuse the same presentation contract.

![Application settings general tab](../assets/quiz-tutorial/application-settings-general.png)

These settings affect the application control panel only.
They do not change the quiz content or layout owned by the metahub publication.

## Step 6: Verify The Runtime Quiz

1. Open the public runtime at `/a/:applicationId`.
2. Wait for the widget to load the first question.
3. Submit an answer and confirm that the widget advances through the flow.
4. Finish the quiz and check the final score summary.

![Quiz widget runtime view](../assets/quiz-tutorial/runtime-quiz.png)

The shipped starter expects a client `mount()` method and a server `submit()` method, so a working runtime proves both client and server script paths.

## Troubleshooting

- If the script saves but never appears at runtime, republish the metahub and resync the application.
- If the widget renders without data, verify that the layout widget `scriptCodename` exactly matches the saved script codename.
- If runtime RPC calls fail, verify that the script role and capabilities still expose the client RPC path.
- If control-panel dialogs ignore your preferred size, verify that you changed application settings rather than metahub or admin settings.
- If you need a known-good reference, inspect `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` and the committed `tools/fixtures/metahubs-quiz-app-snapshot.json` fixture.

## Related Reading

- [Metahub Scripting](metahub-scripting.md)
- [Metahubs](../platform/metahubs.md)
- [Applications](../platform/applications.md)
- [Admin](../platform/admin.md)