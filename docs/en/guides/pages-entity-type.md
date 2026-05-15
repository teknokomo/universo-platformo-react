---
description: Learn how to use the Pages entity type with Editor.js for rich content authoring.
---

# Pages Entity Type

The Pages entity type provides rich content authoring capabilities through Editor.js integration. Pages are ideal for creating structured content like documentation, landing pages, course materials, and informational sections.

## Overview

Pages are a special entity type that stores content as structured blocks rather than traditional database fields. Each Page can contain multiple content blocks (paragraphs, headers, lists, images, etc.) and supports multilingual content through locale-specific variants.

## Key Features

- **Rich Content Editing**: Built-in Editor.js integration for intuitive block-based editing
- **Structured Blocks**: Content is stored as semantic blocks (paragraph, header, list, etc.)
- **Multilingual Support**: Create content in multiple locales with locale-specific variants
- **Safe Content**: Backend validates and normalizes all content before persistence
- **Runtime Rendering**: Published applications render Pages without bundling Editor.js

## Creating a Page

1. Navigate to your Metahub's **Entities** workspace
2. Click **Create Entity** and select **Page** as the entity type
3. Enter the Page codename and presentation details
4. Click **Create**

The new Page will appear in your Entities list with a document icon.

## Editing Page Content

### Content Editor

Pages use the Editor.js block editor for content authoring:

1. Open a Page entity from the Entities list
2. Navigate to the **Content** tab
3. Use the block editor to add and arrange content blocks

![Entity Workspace](../.gitbook/assets/entities/entities-workspace.png)
*Entity workspace showing all entity types including Pages*

### Supported Block Types

The platform supports the following Editor.js block types:

| Block Type | Purpose | Example Use |
|------------|---------|-------------|
| **Paragraph** | Regular text content | Body text, descriptions |
| **Header** | Section headings (H1-H6) | Page titles, section headers |
| **List** | Ordered or unordered lists | Feature lists, steps, bullet points |
| **Quote** | Blockquotes | Citations, highlighted text |
| **Code** | Code snippets | Technical examples, configuration |
| **Delimiter** | Visual separator | Section breaks |
| **Warning** | Alert boxes | Important notices, warnings |
| **Checklist** | Interactive checkboxes | Task lists, requirements |
| **Table** | Data tables | Structured data, comparisons |
| **Link Tool** | Rich link previews | External references |
| **Image** | Embedded images | Screenshots, diagrams, photos |

### Adding Blocks

1. Click the **+** button in the editor
2. Select the block type from the menu
3. Enter your content
4. Use the drag handle (⋮⋮) to reorder blocks

### Block Actions

Each block supports:

- **Move**: Drag the handle (⋮⋮) to reorder
- **Delete**: Click the delete icon
- **Settings**: Click the settings icon for block-specific options

## Multilingual Content

Pages support content in multiple locales:

### Adding Locale Variants

1. Open the Page's **Content** tab
2. Click the **+ Add Locale** button
3. Select the target locale (e.g., Russian, Spanish)
4. Author content in the selected locale

### Switching Between Locales

Use the locale tabs at the top of the content editor to switch between language variants. Each locale maintains its own independent content.

### Locale Management

- **Primary Locale**: Usually English (en), serves as the default
- **Additional Locales**: Add as many locales as needed
- **Independent Content**: Each locale has completely separate content
- **Fallback Behavior**: Runtime applications fall back to primary locale if requested locale is missing

## Content Validation

The backend validates all Page content before saving:

### Safety Checks

- **Block Type Validation**: Only supported block types are accepted
- **Content Sanitization**: HTML and scripts are stripped from text content
- **URL Validation**: External URLs are validated for safety
- **Structure Validation**: Block structure must match expected schema

### Validation Errors

If validation fails, you'll see an error message describing the issue:

- **Unsupported Block**: The block type is not allowed
- **Invalid Content**: Content contains unsafe elements
- **Invalid URL**: A URL failed validation
- **Structure Error**: Block structure is malformed

## Use Cases

### LMS Content

Pages are used in the LMS template for the **LearnerHome** entity:

- Welcome messages
- Course overviews
- Learning objectives
- Resource links

### Documentation

Create structured documentation with:

- Headers for organization
- Code blocks for examples
- Lists for steps
- Tables for reference data

### Landing Pages

Build informational pages with:

- Rich text content
- Images and media
- Call-to-action sections
- Feature highlights

### Content Management

Use Pages for:

- Help articles
- FAQ sections
- Policy documents
- Announcements

## Runtime Behavior

### Published Applications

When a Metahub is published:

1. Page content is exported in the snapshot
2. Content is synced to the application database
3. Runtime renders Pages using canonical block components
4. Editor.js is **not** bundled in published applications

### Performance

- **Lightweight Rendering**: Runtime uses optimized block renderers
- **No Editor Overhead**: Editor.js is only loaded in design-time
- **Efficient Storage**: Content is stored as normalized JSON

## Best Practices

### Content Organization

- **Use Headers**: Structure content with clear section headers
- **Keep Blocks Focused**: Each block should have a single purpose
- **Leverage Lists**: Use lists for scannable content
- **Add Visual Breaks**: Use delimiters to separate major sections

### Multilingual Content

- **Author Primary First**: Complete primary locale before adding translations
- **Maintain Parity**: Keep structure consistent across locales
- **Test All Locales**: Verify content renders correctly in each locale

### Content Safety

- **Avoid Inline HTML**: Use supported block types instead
- **Validate URLs**: Ensure external links are safe and accessible
- **Test Before Publishing**: Preview content before creating publications

### Performance

- **Optimize Images**: Compress images before embedding
- **Limit Block Count**: Very long Pages may impact performance
- **Use Pagination**: For long content, consider splitting into multiple Pages

## Technical Details

### Storage Format

Page content is stored as normalized JSON in the `_mhb_entities` table:

```json
{
  "content": {
    "en": {
      "blocks": [
        {
          "type": "paragraph",
          "data": {
            "text": "Welcome to our platform."
          }
        }
      ]
    }
  }
}
```

### Editor.js Integration

The platform uses:

- **Component**: `EditorJsBlockEditor` from `@universo/template-mui`
- **Backend Validation**: `PageBlockContentSchema` from `@universo/types`
- **Runtime Rendering**: Generic block renderers in `@universo/apps-template-mui`

### Capabilities

Pages are enabled through the `blockContent` capability in the entity type definition:

```typescript
capabilities: {
  blockContent: {
    enabled: true,
    allowedBlockTypes: ['paragraph', 'header', 'list', ...]
  }
}
```

## Related Documentation

- [LMS Entities Architecture](../architecture/lms-entities.md) - Technical details on Pages in LMS
- [Entity Systems Architecture](../architecture/entity-systems.md) - Entity type system overview
- [Custom Entity Types](custom-entity-types.md) - Creating custom entity types
- [Metahub Scripting](metahub-scripting.md) - Adding scripts to Pages

## Troubleshooting

### Content Not Saving

**Problem**: Changes to Page content are not persisted.

**Solutions**:
- Check for validation errors in the editor
- Verify you have edit permissions on the Metahub
- Ensure the Page entity is not locked

### Blocks Not Rendering

**Problem**: Some blocks don't appear in published applications.

**Solutions**:
- Verify the block type is supported
- Check that content was synced to the application
- Ensure the runtime has the latest schema

### Locale Not Showing

**Problem**: Content in a specific locale is not visible.

**Solutions**:
- Verify the locale was added to the Page
- Check that content was authored for that locale
- Ensure the application supports the requested locale

### Editor Loading Issues

**Problem**: The Editor.js interface doesn't load.

**Solutions**:
- Check browser console for JavaScript errors
- Verify Editor.js dependencies are installed
- Clear browser cache and reload

## Summary

The Pages entity type provides powerful rich content authoring through Editor.js integration. Use Pages for documentation, landing pages, LMS content, and any scenario requiring structured, multilingual content. The platform ensures content safety through validation while providing an intuitive editing experience.
