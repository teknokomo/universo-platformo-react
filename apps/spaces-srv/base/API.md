# Spaces API Documentation

## Canvas Management Endpoints

### GET /api/v1/uniks/:unikId/spaces/:spaceId/canvases

Get all canvases for a specific space.

**Parameters:**
- `unikId` (string): The unique identifier of the unik
- `spaceId` (string): The unique identifier of the space

**Response:**
```json
{
  "success": true,
  "data": {
    "canvases": [
      {
        "id": "canvas-uuid",
        "name": "Canvas Name",
        "sortOrder": 1,
        "flowData": "{}",
        "deployed": false,
        "isPublic": false,
        "apikeyid": null,
        "chatbotConfig": null,
        "apiConfig": null,
        "analytic": null,
        "speechToText": null,
        "followUpPrompts": null,
        "category": null,
        "type": null,
        "createdDate": "2024-01-01T00:00:00.000Z",
        "updatedDate": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### POST /api/v1/uniks/:unikId/spaces/:spaceId/canvases

Create a new canvas in a space.

**Parameters:**
- `unikId` (string): The unique identifier of the unik
- `spaceId` (string): The unique identifier of the space

**Request Body:**
```json
{
  "name": "New Canvas Name",
  "flowData": "{}"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "canvas-uuid",
    "name": "New Canvas Name",
    "sortOrder": 2,
    "flowData": "{}",
    "deployed": false,
    "isPublic": false,
    "createdDate": "2024-01-01T00:00:00.000Z",
    "updatedDate": "2024-01-01T00:00:00.000Z"
  },
  "message": "Canvas created successfully"
}
```

### PUT /api/v1/uniks/:unikId/canvases/:canvasId

Update an existing canvas.

**Parameters:**
- `unikId` (string): The unique identifier of the unik
- `canvasId` (string): The unique identifier of the canvas

**Request Body:**
```json
{
  "name": "Updated Canvas Name",
  "flowData": "{}",
  "deployed": true,
  "isPublic": false,
  "chatbotConfig": "{}",
  "apiConfig": "{}",
  "analytic": "{}",
  "speechToText": "{}",
  "followUpPrompts": "{}",
  "category": "category-name",
  "type": "CHATFLOW"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "canvas-uuid",
    "name": "Updated Canvas Name",
    "sortOrder": 1,
    "flowData": "{}",
    "deployed": true,
    "isPublic": false,
    "createdDate": "2024-01-01T00:00:00.000Z",
    "updatedDate": "2024-01-01T00:00:00.000Z"
  },
  "message": "Canvas updated successfully"
}
```

### DELETE /api/v1/uniks/:unikId/canvases/:canvasId

Delete a canvas.

**Parameters:**
- `unikId` (string): The unique identifier of the unik
- `canvasId` (string): The unique identifier of the canvas

**Response:**
- Status: 204 No Content (success)
- Status: 404 Not Found (canvas not found)
- Status: 400 Bad Request (cannot delete last canvas)

**Error Response:**
```json
{
  "success": false,
  "error": "Canvas not found"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created
- `204` - No Content (for successful deletions)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Authentication

All endpoints require authentication via the `upAuth.ensureAuth` middleware. The authenticated user must have access to the specified unik.

## Rate Limiting

Canvas endpoints are rate limited to 30 requests per minute per user.

## Validation Rules

### Canvas Name
- Maximum length: 200 characters
- Cannot be empty when provided

### Flow Data
- Must be valid JSON string
- Defaults to "{}" if not provided

### Sort Order
- Automatically managed by the system
- New canvases get the next available sort order
- Reordering is handled via separate endpoint