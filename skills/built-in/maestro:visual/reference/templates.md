# Debug Visual Data Schemas

Example JSON for each debug visualization type.

## component-tree

```json
{
  "nodes": [
    { "id": "app", "name": "App", "type": "component", "children": ["header", "main"] },
    { "id": "header", "name": "Header", "type": "component", "errorBoundary": true },
    { "id": "main", "name": "Main", "type": "component", "children": ["sidebar", "content"] },
    { "id": "sidebar", "name": "Sidebar", "type": "component" },
    { "id": "content", "name": "Content", "type": "component", "error": "Cannot read property 'map' of undefined" }
  ]
}
```

## state-flow

```json
{
  "timeline": [
    {
      "timestamp": "2026-03-22T10:00:00Z",
      "action": "SET_USER",
      "prevState": { "user": null, "loading": true },
      "nextState": { "user": { "id": 1, "name": "Alice" }, "loading": false },
      "source": "authReducer"
    },
    {
      "timestamp": "2026-03-22T10:00:01Z",
      "action": "FETCH_POSTS",
      "prevState": { "posts": [], "loading": false },
      "nextState": { "posts": [], "loading": true }
    }
  ]
}
```

## error-cascade

```json
{
  "errors": [
    { "id": "e1", "message": "Network Error", "caught": false, "children": ["e2", "e3"] },
    { "id": "e2", "message": "Failed to fetch /api/users", "caught": true, "boundary": "UserErrorBoundary", "stack": "Error: Failed to fetch\n    at fetch (network.js:42)" },
    { "id": "e3", "message": "Retry failed after 3 attempts", "caught": true, "boundary": "AppErrorBoundary" }
  ]
}
```

## network-waterfall

```json
{
  "requests": [
    { "id": "r1", "url": "https://api.example.com/users", "method": "GET", "startTime": 0, "endTime": 120, "status": 200, "size": 4096 },
    { "id": "r2", "url": "https://api.example.com/posts", "method": "GET", "startTime": 50, "endTime": 350, "status": 200, "size": 8192 },
    { "id": "r3", "url": "https://api.example.com/comments", "method": "POST", "startTime": 360, "endTime": 500, "status": 500, "error": "Internal Server Error" }
  ]
}
```

## dom-diff

```json
{
  "expected": "<div class=\"card\">\n  <h2>Title</h2>\n  <p>Description</p>\n</div>",
  "actual": "<div class=\"card\">\n  <h2>Wrong Title</h2>\n  <p>Description</p>\n  <span>Extra element</span>\n</div>",
  "context": "UserCard component render test"
}
```

## console-timeline

```json
{
  "entries": [
    { "timestamp": "10:00:00.123", "level": "info", "message": "App started", "source": "main.ts" },
    { "timestamp": "10:00:00.456", "level": "warn", "message": "Deprecated API usage", "data": { "api": "v1/users" } },
    { "timestamp": "10:00:01.789", "level": "error", "message": "Failed to connect to database", "source": "db.ts", "data": { "code": "ECONNREFUSED" } },
    { "timestamp": "10:00:02.000", "level": "debug", "message": "Retrying connection", "source": "db.ts" }
  ]
}
```

## Tips for Large Datasets

- For component trees with 200+ nodes, save JSON to a file and pass via `--data /path/to/file.json`
- For network waterfalls, filter to the relevant time window before visualizing
- Console timelines render fastest with < 500 entries
