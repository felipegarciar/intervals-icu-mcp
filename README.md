# intervals-icu-mcp

A read-only MCP (Model Context Protocol) server for [Intervals.icu](https://intervals.icu).  
Gives Claude access to your activities, wellness data, fitness curves, training zones, and calendar.

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

## Get your Intervals.icu credentials

1. Log in to [intervals.icu](https://intervals.icu)
2. Go to **Settings** → scroll down to **Developer Settings**
3. Generate (or copy) your **API Key**
4. Use `0` as the athlete ID — the API resolves it automatically from your key

---

## Option A — npx (recommended, no installation needed)

Requires [Node.js](https://nodejs.org) v18+. The package is downloaded automatically on first run.

> **Before publishing to npm**, use the full local path to the project folder instead of the package name (see below).

**If the package is published on npm:**

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

**If running from a local clone (before publishing):**

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

Replace `/absolute/path/to/intervals-icu-mcp` with the actual path on your machine, e.g. `/Users/yourname/projects/intervals-icu-mcp`. You must run `npm install && npm run build` in the project folder first.

Add the config block to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then fully restart Claude Desktop (Cmd+Q, not just close the window).

---

## Option B — Docker

Useful for running the server as a persistent background service, or for exposing it remotely via ngrok.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### 1. Set up credentials

```bash
cp .env.example .env
# Edit .env and set INTERVALS_API_KEY to your key
```

### 2. Start the container

```bash
docker compose up -d
```

Verify it's running:

```bash
curl http://localhost:3000/health
# {"status":"ok","server":"intervals-icu-mcp","version":"1.1.0","transport":"http"}
```

### 3. Connect Claude Desktop via docker exec

Since Claude Desktop communicates over stdio, use `docker exec` to pipe directly into the running container. No API key needed in the config — it's already in the container via `.env`.

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

### 4. Connect remotely via ngrok

To access the server from Claude.ai web or another machine, expose port 3000 with ngrok:

```bash
ngrok http 3000
```

Then add the connector in Claude Desktop or Claude.ai using:

```
https://your-ngrok-subdomain.ngrok-free.app/sse
```

> Note: Claude.ai web requires a Pro plan to use custom MCP connectors.

---

## Option C — Claude Code (CLI)

**From npm (after publishing):**

```bash
claude mcp add intervals-icu \
  -e INTERVALS_API_KEY=your_api_key_here \
  -e INTERVALS_ATHLETE_ID=0 \
  -e TRANSPORT=stdio \
  -- npx -y intervals-icu-mcp
```

**From a local clone:**

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
| `TRANSPORT` | — | `http` | `stdio` for Claude Desktop/Code, `http` for Docker/remote |
| `PORT` | — | `3000` | HTTP port (Docker/remote mode only) |

---

## Publishing to npm

```bash
npm login       # log in to your npmjs.com account
npm publish     # builds automatically then uploads
```

After publishing, users can install via the npm package name (no local path needed).

---

## Example prompts

```
"Show me my last 10 cycling activities"
"What was my CTL/ATL trend over the past 3 months?"
"Get the power curve for activity i132547490"
"How did my HRV look last week?"
"What are my current power training zones?"
"List my planned workouts for the next 2 weeks"
"What gear do I have configured?"
"Show me today's wellness entry"
```
