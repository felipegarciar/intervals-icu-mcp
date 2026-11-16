# Development Guide

This document covers how to run the server locally, use Docker, and contribute to the project.

---

## Running locally

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- An Intervals.icu API key (see [README](README.md))

### Setup

```bash
git clone https://github.com/felipegarciar/intervals-icu-mcp.git
cd intervals-icu-mcp
npm install
npm run build
```

### Connect to your MCP client

Point the client at the built file instead of the npm package:

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "node",
      "args": ["/absolute/path/to/intervals-icu-mcp/dist/index.js"],
      "env": {
        "INTERVALS_API_KEY": "your_api_key_here",
        "INTERVALS_ATHLETE_ID": "0",
        "TRANSPORT": "stdio",
        "INTERVALS_ALLOW_WRITES": "true"
      }
    }
  }
}
```

Leave out `INTERVALS_ALLOW_WRITES` to run read-only. Run `npm run build` after each change and restart the client.

### Write tools

The write tools (`create_event`, `update_event`, `delete_event`, `download_event_workout`) live in `registerWriteTools` in `src/index.ts` and are registered only when `INTERVALS_ALLOW_WRITES` is `true`, `1` or `yes`. Keep any new tool that changes account data inside that function, so the default install stays read-only.

They call `POST`, `PUT` and `DELETE /api/v1/athlete/{id}/events[/{eventId}]` (see the [API docs](https://intervals.icu/api-docs.html)). Notes:

- `start_date_local` is a local datetime; the tools accept `yyyy-MM-dd` and send `yyyy-MM-ddT00:00:00`.
- The workout steps go in `description` as native workout text; Intervals.icu parses it into `workout_doc` and computes duration and load. Check `workout_doc` in the response to see that the steps were understood.
- `delete_event` always sends `others=false`, so it never deletes the other events created with it.

### Hot reload (no build step)

```bash
INTERVALS_API_KEY=your_key TRANSPORT=stdio npm run dev
```

Add `INTERVALS_ALLOW_WRITES=true` to load the write tools.

---

## Docker

Useful for running the server as a persistent background service, or for exposing it over the network.

### Setup

```bash
cp .env.example .env
# Edit .env and set INTERVALS_API_KEY
```

### Start

```bash
docker compose up -d
```

Verify:

```bash
curl http://localhost:3000/health
# {"status":"ok","server":"intervals-icu-mcp","version":"1.1.0","transport":"http"}
```

### Connect via config (stdio over docker exec)

No API key needed in the config — it's already set in `.env`.

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "docker",
      "args": ["exec", "-i", "-e", "TRANSPORT=stdio", "intervals-icu-mcp", "node", "dist/index.js"]
    }
  }
}
```

### Expose remotely via ngrok

```bash
ngrok http 3000
```

Add the connector in your MCP client using:

```
https://your-subdomain.ngrok-free.app/sse
```

> Note: Claude.ai web requires a Pro plan to use custom MCP connectors.

---

## Transport modes

| Mode | Use case | How to set |
|---|---|---|
| `stdio` | Local MCP clients (Claude Desktop, Cursor, etc.) | `TRANSPORT=stdio` |
| `http` | Docker, remote access, HTTP-based clients | `TRANSPORT=http` (default) |
| `sse` | Legacy SSE clients | `TRANSPORT=sse` |

---

## Publishing to npm

```bash
npm login
npm publish     # runs npm run build automatically via prepublishOnly
```
