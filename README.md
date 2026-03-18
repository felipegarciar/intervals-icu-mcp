# intervals-icu-mcp

A read-only MCP (Model Context Protocol) server for [Intervals.icu](https://intervals.icu).
Gives any MCP-compatible AI assistant access to your activities, wellness data, fitness curves, training zones, and calendar.

Compatible with any client that supports the MCP protocol, including [Claude](https://claude.ai) (Desktop, Code, and Web), [Cursor](https://cursor.com), [Windsurf](https://windsurf.com), and others.

---

## Available Tools

| Tool | Description |
|---|---|
| `get_athlete` | Profile, FTP, weight, VO2max, thresholds |
| `get_athlete_zones` | Power, HR and pace training zones |
| `get_athlete_gear` | Bikes, shoes and usage stats |
| `get_training_plan` | Currently assigned training plan |
| `list_activities` | Activities list with date range and sport type filters |
| `get_activity` | Full activity detail + detected intervals |
| `get_activity_streams` | Raw second-by-second data (power, HR, cadence, altitude…) |
| `get_activity_power_curve` | Mean maximal power (MMP) curve |
| `get_fitness` | CTL/ATL/TSB fitness curve over a date range |
| `list_wellness` | Daily wellness entries over a date range (HRV, sleep, weight, mood…) |
| `get_wellness` | Single-day wellness entry |
| `list_calendars` | All calendars configured for the athlete |
| `list_events` | Calendar events with date range and category filter |
| `get_event` | Single calendar event by ID |

---

## Get your Intervals.icu API key

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to **Settings** → scroll down to **Developer Settings**
3. Generate (or copy) your **API Key**

You can use `0` as the athlete ID in all configs — the API resolves it automatically from your key.

---

## Installation

### Option A — npx (recommended)

The easiest option for most users. Requires [Node.js](https://nodejs.org) v18+ but no manual installation — the package is downloaded and run automatically.

**Published package (once available on npm):**

Add the following to your MCP client config, replacing `your_api_key_here` with your key:

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "npx",
      "args": ["-y", "intervals-icu-mcp"],
      "env": {
        "INTERVALS_API_KEY": "your_api_key_here",
        "INTERVALS_ATHLETE_ID": "0",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

**Local clone (before publishing to npm):**

First build the project:

```bash
npm install
npm run build
```

Then use the full absolute path to the project folder in your config:

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

**Where is the config file?**

| Client | Config file location |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` globally |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

After editing the config, fully restart your client.

---

### Option B — Docker

Useful for running the server as a persistent background service, or for exposing it over the network via ngrok.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

**1. Set up credentials:**

```bash
cp .env.example .env
# Edit .env and set INTERVALS_API_KEY to your key
```

**2. Start the container:**

```bash
docker compose up -d
```

Verify it's running:

```bash
curl http://localhost:3000/health
# {"status":"ok","server":"intervals-icu-mcp","version":"1.1.0","transport":"http"}
```

**3. Connect via config (stdio over docker exec):**

This approach pipes directly into the running container. No API key is needed in the config since it's already set in `.env`.

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

**4. Connect remotely via ngrok:**

To expose the server over the internet (e.g. for use in a web-based MCP client):

```bash
ngrok http 3000
```

Then add the connector in your client using:

```
https://your-subdomain.ngrok-free.app/sse
```

> Note: Claude.ai web requires a Pro plan to use custom MCP connectors.

---

### Option C — Claude Code (CLI)

**Published package:**

```bash
claude mcp add intervals-icu \
  -e INTERVALS_API_KEY=your_api_key_here \
  -e INTERVALS_ATHLETE_ID=0 \
  -e TRANSPORT=stdio \
  -- npx -y intervals-icu-mcp
```

**Local clone:**

```bash
claude mcp add intervals-icu \
  -e INTERVALS_API_KEY=your_api_key_here \
  -e INTERVALS_ATHLETE_ID=0 \
  -e TRANSPORT=stdio \
  -- npx /absolute/path/to/intervals-icu-mcp
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INTERVALS_API_KEY` | ✅ | — | Your Intervals.icu API key |
| `INTERVALS_ATHLETE_ID` | — | `0` | Your athlete ID (`0` = auto-resolved from key) |
| `TRANSPORT` | — | `http` | `stdio` for local clients, `http` for Docker/remote |
| `PORT` | — | `3000` | HTTP port (Docker/remote mode only) |

---

## Publishing to npm

```bash
npm login       # log in to your npmjs.com account
npm publish     # builds automatically via prepublishOnly, then uploads
```

After publishing, users can use the package name directly — no local path needed.

---

## Example prompts

```
"Show me my last 10 cycling activities"
"What was my CTL/ATL trend over the past 3 months?"
"Get the power curve for activity i132547490"
"How did my HRV look last week?"
"What are my current power training zones?"
"List my planned workouts for the next 2 weeks"
"What bikes do I have configured?"
"Show me today's wellness entry"
```

---

## License

MIT
