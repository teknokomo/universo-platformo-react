# Canvas And WebGL QA Oracles

## Canvas Rendered

Required checks:

-   canvas locator is visible;
-   canvas bounding box is nonzero;
-   canvas is inside its expected widget/container;
-   canvas pixels are not blank after the ready state;
-   screenshot evidence is captured after the page is settled.

For WebGL, a nonblank screenshot or pixel sample is usually more reliable than
DOM assertions alone.

## Framing And Responsiveness

Run the runtime viewport matrix unless the feature explicitly documents a
narrower support boundary:

-   `1920x1080`
-   `768x1024`
-   `390x844`

At each viewport:

-   primary object/camera is framed;
-   HUD/control overlays do not cover the primary object incoherently;
-   canvas stays bounded by the widget;
-   document-level horizontal overflow is absent.

Component-internal constrained scroll is acceptable only when the component is
explicitly bounded.

## Interaction

Check the interactions claimed by the feature:

-   click/tap or pointer move changes selection/aim/state;
-   keyboard movement/action works when the canvas owns focus;
-   focus can leave the canvas area;
-   Escape exits pointer lock or closes the expected overlay;
-   dialogs and text inputs are usable while the canvas exists.

## Related Playwright References

-   `.agents/skills/playwright-best-practices/testing-patterns/canvas-webgl.md`
-   `.agents/skills/runtime-ux-qa/references/playwright-ux-oracles.md`
