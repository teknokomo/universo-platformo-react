---
description: Create Matrix cells and attach Materials to the selected cell.
---

# Cells And Materials

Cells describe concepts or interpretations. Materials add authored notes and source content to the selected cell.

![Cells and Materials](../.gitbook/assets/interpretation-network/cells-and-materials.png)

## Role And Goal

This page is for an editor who creates child cells, styles them, and attaches Materials without touching placement internals.

## Prerequisites

-   You can open the Matrix.
-   Your role allows content creation and editing.
-   The cell that should receive the new child or Material is selected.

## Workflow

1. Select a parent cell and click **Add** to open the child-cell dialog.

![Add cell dialog](../.gitbook/assets/interpretation-network/cells-and-materials-step-1.png)

2. Enter the Title and optional multiline Description, then save the cell.

![Created child cell](../.gitbook/assets/interpretation-network/cells-and-materials-step-2.png)

3. In the Materials pane, click **Create** to attach a Material to the selected cell.

![Add material](../.gitbook/assets/interpretation-network/cells-and-materials-step-3.png)

4. Open the Material editor when you need to author longer block content.

![Material editor](../.gitbook/assets/interpretation-network/cells-and-materials-step-4.png)

## Expected Result

The new child cell appears under the selected parent, and the Material appears in the Materials pane for that cell. The Material body is edited through the block editor and is not shown as technical text in tables or cards.

## What To Check

-   Description fields are multiline.
-   Placement fields are not visible in the dialog.
-   Materials show titles and descriptions, not stored block data.
-   Validation messages are localized for the active language.

## Related Pages

-   [Workspace And Matrix](workspace-and-matrix.md)
-   [Templates](templates.md)
-   [Interpretation Network data model](../architecture/interpretation-network-data-model.md)
