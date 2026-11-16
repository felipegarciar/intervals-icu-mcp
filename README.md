# intervals-icu-mcp

An MCP (Model Context Protocol) server for [Intervals.icu](https://intervals.icu), **read-only by default**.  
Gives any MCP-compatible AI assistant access to your activities, wellness data, fitness curves, training zones, and calendar.
Optionally, it can also create planned workouts on your calendar (see [Write tools](#write-tools-opt-in)).

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

These are the only tools registered unless you opt in to writes.

### Write tools (opt-in)

Set `INTERVALS_ALLOW_WRITES=true` to also register these tools. Without it the server cannot change anything in your account.

| Tool | Description |
|---|---|
| `create_event` | Create a calendar event, typically a planned workout written in Intervals.icu workout text |
| `update_event` | Change the date, name, workout text, sport type or indoor flag of an event |
| `delete_event` | Delete a single event (only that one) |
| `download_event_workout` | Export a planned workout as fit/zwo/mrc/erg, to check it converted to real steps |

Workouts use the same text format as the Intervals.icu workout builder, for example:

```
Warmup
- 10m 55%

Main set 3x
- 2km 90%
- 500mtr 55%

Cooldown
- 10m 50%
```

Each step is a line starting with `- `. `10m` means 10 minutes; distances are written `2km` or `500mtr` (metres). Targets can be `% of FTP`, watts (`200w`) or zones (`Z2`). A line ending in `3x` starts a repeat block that runs until the next blank line.

Planned workouts reach a Garmin device through Garmin Connect only if **Upload planned workouts** is switched on in the Garmin section of Intervals.icu settings.

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- An Intervals.icu account with an API key

**Get your API key:**
1. Log in to [intervals.icu](https://intervals.icu)
2. Go to **Settings** → scroll down to **Developer Settings**
3. Generate (or copy) your **API Key**

---

## Installation

No installation needed — `npx` downloads and runs the package automatically.

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

`INTERVALS_ATHLETE_ID` can be left as `0` — the API resolves it automatically from your key.

To enable the [write tools](#write-tools-opt-in), add `"INTERVALS_ALLOW_WRITES": "true"` to `env`.

**Config file locations:**

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` globally |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

After editing the config, fully restart your client. If an older version keeps loading, use `"intervals-icu-mcp@latest"` in `args` so `npx` doesn't reuse its cached copy.

---

## Claude Code (CLI)

```bash
claude mcp add intervals-icu \
  -e INTERVALS_API_KEY=your_api_key_here \
  -e INTERVALS_ATHLETE_ID=0 \
  -e TRANSPORT=stdio \
  -- npx -y intervals-icu-mcp
```

Add `-e INTERVALS_ALLOW_WRITES=true` to enable the write tools.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INTERVALS_API_KEY` | ✅ | — | Your Intervals.icu API key |
| `INTERVALS_ATHLETE_ID` | — | `0` | Your athlete ID (`0` = auto-resolved from key) |
| `TRANSPORT` | — | `http` | `stdio` for local clients, `http` for Docker/remote |
| `PORT` | — | `3000` | HTTP port (Docker/remote mode only) |
| `INTERVALS_ALLOW_WRITES` | — | off | `true` registers the [write tools](#write-tools-opt-in); anything else keeps the server read-only |

---

## Example prompts

```
"Show me my last 10 cycling activities"
"What was my CTL/ATL trend over the past 3 months?"
"Get the power curve for activity i12345678"
"How did my HRV look last week?"
"What are my current power training zones?"
"List my planned workouts for the next 2 weeks"
"What bikes do I have configured?"
"Show me today's wellness entry"
"Put a 3x2km sweet-spot workout on my calendar for Saturday"   (needs INTERVALS_ALLOW_WRITES=true)
```

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for instructions on running locally, using Docker, and contributing.

---

## License

MIT
