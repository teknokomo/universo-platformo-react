# Release screenshots: 0.86–0.90 Alpha

Captured on 2026-11-17. All PNGs are **1920×1080**, taken directly from Chromium with a full page viewport, without compositing or enlargement. Modal dialogs retain the surrounding page.

| Release | Subject | English | Russian |
| --- | --- | --- | --- |
| 0.86 | Sixth Muse block quiz with timer and translated question | [EN](0.86.0-block-quiz-en.png) | [RU](0.86.0-block-quiz-ru.png) |
| 0.87 | Anonymous public Interpretation Network Matrix and Materials | [EN](0.87.0-public-network-en.png) | [RU](0.87.0-public-network-ru.png) |
| 0.88 | Anonymous Messenger App desktop runtime | [EN](0.88.0-messenger-en.png) | [RU](0.88.0-messenger-ru.png) |
| 0.89 | Theme manager over the layout appearance page, with Ocean demo preset | [EN](0.89.0-theme-manager-en.png) | [RU](0.89.0-theme-manager-ru.png) |
| 0.90 | Economy dialog over the MMOOMM flight page after a sale and purchase | [EN](0.90.0-economy-en.png) | [RU](0.90.0-economy-ru.png) |

Alternative for 0.86: block introduction with timer, [EN](0.86.0-block-intro-en.png) / [RU](0.86.0-block-intro-ru.png).

## Provenance and scope

These are current-build demonstrations of the target release features, not separate builds of historical tags. Screenshots were made with disposable fixtures on the dedicated local E2E instance; the normal app on port 3000 was preserved. GitHub releases were not edited.

For the English quiz screenshots, the visible title, description, first block and question were translated in a temporary fixture before importing it. The original source assessment and committed fixture were preserved. Other questions were outside the capture scope.

The final capture run passed all five scenarios, including setup. All PNG dimensions, locale-pair checksums, and absence of page-level horizontal overflow were verified. Primary frames and the alternatives were visually reviewed. This verifies the selected screenshots, not every feature or external messenger client.

Source commit, image dimensions, SHA-256 hashes and detailed limitations are recorded in [manifest.json](manifest.json).

Minor existing localization issue: the Messenger RU table pagination still displays “Rows per page” in English. The screenshot preserves the real UI.
