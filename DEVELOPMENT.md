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

Use the full absolute path to the project folder instead of the package name:

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "npx",
      "args": ["/absolute/path/to/intervals-icu-mcp"],
      "env": {
        "INTERVALS_API_KEY": "your_api_key_here",
        "INTERVALS_ATHLETE_ID": "0",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

### Hot reload (no build step)

```bash
INTERVALS_API_KEY=your_key TRANSPORT=stdio npm run dev
```

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
