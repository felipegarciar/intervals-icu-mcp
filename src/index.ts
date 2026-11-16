#!/usr/bin/env node
/**
 * Intervals.icu MCP Server
 * Read-only access to activities, health, and fitness data, plus opt-in
 * tools to create, update and delete calendar events (planned workouts).
 *
 * Required env vars:
 *   INTERVALS_API_KEY      — your API key from intervals.icu/settings
 *   INTERVALS_ATHLETE_ID   — your athlete ID (or "0" to auto-resolve from key)
 *
 * Optional env vars:
 *   TRANSPORT              — "http" (default), "sse", or "stdio"
 *   PORT                   — HTTP port (default 3000)
 *   INTERVALS_ALLOW_WRITES — "true" to register the write tools (default off)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "node:http";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.INTERVALS_API_KEY;
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID ?? "0";
const BASE_URL = "https://intervals.icu/api/v1";
const TRANSPORT = process.env.TRANSPORT ?? "http";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
// Write tools (create/update/delete calendar events) are opt-in. Without this
// flag the server registers only the read-only tools.
const ALLOW_WRITES = ["true", "1", "yes"].includes(
  (process.env.INTERVALS_ALLOW_WRITES ?? "").trim().toLowerCase()
);

if (!API_KEY) {
  console.error("[intervals-mcp] ERROR: INTERVALS_API_KEY environment variable is not set.");
  process.exit(1);
}
if (ALLOW_WRITES) {
  console.error("[intervals-mcp] Write tools enabled (INTERVALS_ALLOW_WRITES)");
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

type QueryParams = Record<string, string | number | boolean | undefined>;

async function apiFetch(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  params: QueryParams = {},
  body?: unknown
): Promise<Response> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const credentials = Buffer.from(`API_KEY:${API_KEY}`).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${credentials}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Intervals.icu API error ${res.status} (${method} ${path}): ${text}`);
  }
  return res;
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  params: QueryParams = {},
  body?: unknown
): Promise<T> {
  const res = await apiFetch(method, path, params, body);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

function apiGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  return apiRequest<T>("GET", path, params);
}

// ─── Tool registration ────────────────────────────────────────────────────────

function registerTools(s: McpServer) {

  // ── Athlete ────────────────────────────────────────────────────────────────

  s.tool(
    "get_athlete",
    "Get profile information for the athlete: name, sport, FTP, weight, VO2max, thresholds, HR and power zones, and all settings.",
    {},
    async () => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_athlete_zones",
    "Get the power, heart rate and pace training zones configured for the athlete.",
    {},
    async () => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/zones`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_athlete_gear",
    "Get the athlete's gear (bikes, shoes, etc.) including usage stats.",
    {},
    async () => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/gear`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_training_plan",
    "Get the training plan currently assigned to the athlete.",
    {},
    async () => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/training-plan`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Activities ─────────────────────────────────────────────────────────────

  s.tool(
    "list_activities",
    "List activities for a date range. Returns summary data per activity: type, date, duration, distance, power, HR, TSS, ATL, CTL, zone times, etc. Optionally filter by sport type.",
    {
      oldest: z.string().optional().describe("Start date (yyyy-MM-dd). Defaults to 30 days ago."),
      newest: z.string().optional().describe("End date (yyyy-MM-dd). Defaults to today."),
      activity_type: z.string().optional().describe("Filter by sport type, e.g. 'Ride', 'Run', 'Swim', 'VirtualRide', 'Walk'."),
    },
    async ({ oldest, newest, activity_type }) => {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const data = await apiGet(`/athlete/${ATHLETE_ID}/activities`, {
        oldest: oldest ?? thirtyDaysAgo,
        newest: newest ?? today,
      });
      let activities = data as any[];
      if (activity_type) {
        activities = activities.filter((a) => a.type?.toLowerCase() === activity_type.toLowerCase());
      }
      return { content: [{ type: "text", text: JSON.stringify(activities, null, 2) }] };
    }
  );

  s.tool(
    "get_activity",
    "Get full details for a single activity by ID: all metrics, zone times, power/HR data, and optionally detected intervals. Use list_activities to find IDs.",
    {
      activity_id: z.string().describe("The activity ID (e.g. 'i132547490')."),
      include_intervals: z.boolean().optional().default(true).describe("Include detected and manual intervals."),
    },
    async ({ activity_id, include_intervals }) => {
      const data = await apiGet(`/activity/${activity_id}`, { intervals: include_intervals });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_activity_streams",
    "Get raw second-by-second time-series data for an activity: power (watts), heart rate, cadence, speed, altitude, temperature, etc. Each stream is an array aligned by time index.",
    {
      activity_id: z.string().describe("The activity ID."),
      types: z.string().optional().describe("Comma-separated stream types to return, e.g. 'watts,heartrate,cadence,altitude'. Leave empty for all available streams."),
    },
    async ({ activity_id, types }) => {
      const path = `/activity/${activity_id}/streams.json`;
      const data = await apiGet(path, types ? { types } : {});
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_activity_power_curve",
    "Get the mean maximal power (MMP) curve for a single activity. Returns the best average power achievable for every duration from 1 second to the full activity length. Also includes estimated VO2max.",
    {
      activity_id: z.string().describe("The activity ID."),
    },
    async ({ activity_id }) => {
      const data = await apiGet(`/activity/${activity_id}/power-curve`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Fitness ────────────────────────────────────────────────────────────────

  s.tool(
    "get_fitness",
    "Get the fitness/fatigue/form time series (CTL, ATL, TSB) for a date range. Also includes per-sport breakdown and weekly ramp rate. Essential for understanding training load trends.",
    {
      oldest: z.string().describe("Start date (yyyy-MM-dd)."),
      newest: z.string().describe("End date (yyyy-MM-dd)."),
    },
    async ({ oldest, newest }) => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/fitness`, { oldest, newest });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Wellness ───────────────────────────────────────────────────────────────

  s.tool(
    "list_wellness",
    "List daily wellness entries for a date range. Includes HRV, resting HR, sleep hours and quality, weight, fatigue, mood, soreness, steps, SpO2, and any custom fields.",
    {
      oldest: z.string().describe("Start date (yyyy-MM-dd)."),
      newest: z.string().describe("End date (yyyy-MM-dd)."),
    },
    async ({ oldest, newest }) => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/wellness`, { oldest, newest });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_wellness",
    "Get the wellness entry for a specific date. Includes HRV, resting HR, sleep, weight, fatigue, mood, soreness, steps, SpO2, and CTL/ATL for that day.",
    {
      date: z.string().describe("Date in yyyy-MM-dd format, e.g. '2024-03-15'."),
    },
    async ({ date }) => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/wellness/${date}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Calendar & Events ──────────────────────────────────────────────────────

  s.tool(
    "list_calendars",
    "List all calendars configured for the athlete (training calendars, external calendars, etc.).",
    {},
    async () => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/calendars`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "list_events",
    "List calendar events for a date range: planned workouts, races, notes, and targets. Filter by category to focus on specific event types.",
    {
      oldest: z.string().describe("Start date (yyyy-MM-dd)."),
      newest: z.string().describe("End date (yyyy-MM-dd)."),
      category: z.enum(["WORKOUT", "RACE", "NOTE", "TARGET", "GROUP"]).optional()
        .describe("Filter by event category: WORKOUT, RACE, NOTE, TARGET, or GROUP."),
      calendar_id: z.number().optional().describe("Filter by a specific calendar ID (from list_calendars)."),
    },
    async ({ oldest, newest, category, calendar_id }) => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/events`, {
        oldest,
        newest,
        category,
        calendar_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "get_event",
    "Get a single calendar event by its ID.",
    {
      event_id: z.number().describe("The event ID (from list_events)."),
    },
    async ({ event_id }) => {
      const data = await apiGet(`/athlete/${ATHLETE_ID}/events/${event_id}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  if (ALLOW_WRITES) registerWriteTools(s);
}

// ─── Write tools (opt-in via INTERVALS_ALLOW_WRITES) ─────────────────────────

const EVENT_CATEGORIES = [
  "WORKOUT", "RACE_A", "RACE_B", "RACE_C", "NOTE", "HOLIDAY", "SICK", "INJURED",
] as const;

const WORKOUT_TEXT_HELP =
  "Native Intervals.icu workout text, one step per line starting with '- ', e.g. " +
  "'- 10m 55%' (10 minutes at 55% FTP), '- 2km 200w' (2 km at 200 W), '- 500mtr Z2' " +
  "(500 metres in Z2; 'm' alone means minutes, use 'mtr' for metres), '- 5m 60-80%' (ramp). " +
  "A repeat block is a line like '3x' (or 'Main set 3x') followed by its steps, ended by a " +
  "blank line. Free text lines become section headers. Steps are parsed by Intervals.icu; " +
  "check the returned workout_doc to confirm the structure was understood.";

/** Accept yyyy-MM-dd or a full local datetime; the API stores local datetimes. */
function toLocalDateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return value.length === 16 ? `${value}:00` : value;
  }
  throw new Error(`Invalid date '${value}': use yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss (local time, no zone).`);
}

function registerWriteTools(s: McpServer) {

  s.tool(
    "create_event",
    "Create a calendar event on the athlete's Intervals.icu calendar, typically a planned workout " +
      "(category WORKOUT) whose steps are given as native workout text in 'description'. " +
      "Planned workouts are pushed to Garmin Connect only if 'Upload planned workouts' is enabled " +
      "in Intervals.icu settings. Returns the created event, including its id and parsed workout_doc.",
    {
      start_date_local: z.string().describe("Local date (yyyy-MM-dd) or local datetime (yyyy-MM-ddTHH:mm:ss) of the event."),
      name: z.string().describe("Event name shown on the calendar and on the device."),
      description: z.string().optional().describe(WORKOUT_TEXT_HELP),
      category: z.enum(EVENT_CATEGORIES).optional().default("WORKOUT").describe("Event category. Defaults to WORKOUT."),
      type: z.string().optional().default("Ride").describe("Sport type, e.g. 'Ride', 'VirtualRide', 'Run'. Defaults to 'Ride'."),
      indoor: z.boolean().optional().describe("Mark the workout as indoor."),
      external_id: z.string().optional().describe("Optional id of your own, to find the event again later."),
    },
    async ({ start_date_local, name, description, category, type, indoor, external_id }) => {
      const body = {
        start_date_local: toLocalDateTime(start_date_local),
        name,
        description,
        category,
        type,
        indoor,
        external_id,
      };
      const data = await apiRequest("POST", `/athlete/${ATHLETE_ID}/events`, {}, body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "update_event",
    "Update an existing calendar event by id. Only the fields given are sent; others are left as they are. " +
      "Use get_event or list_events to find the id.",
    {
      event_id: z.number().describe("The event ID (from list_events or create_event)."),
      start_date_local: z.string().optional().describe("New local date (yyyy-MM-dd) or datetime (yyyy-MM-ddTHH:mm:ss)."),
      name: z.string().optional().describe("New event name."),
      description: z.string().optional().describe(WORKOUT_TEXT_HELP),
      type: z.string().optional().describe("New sport type, e.g. 'Ride'."),
      indoor: z.boolean().optional().describe("Mark the workout as indoor or outdoor."),
    },
    async ({ event_id, start_date_local, name, description, type, indoor }) => {
      const body: Record<string, unknown> = { name, description, type, indoor };
      if (start_date_local !== undefined) body.start_date_local = toLocalDateTime(start_date_local);
      for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
      if (Object.keys(body).length === 0) {
        throw new Error("Nothing to update: give at least one field to change.");
      }
      const data = await apiRequest("PUT", `/athlete/${ATHLETE_ID}/events/${event_id}`, {}, body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  s.tool(
    "delete_event",
    "Delete a single calendar event by id. This cannot be undone. Only this event is deleted, never others.",
    {
      event_id: z.number().describe("The event ID to delete."),
    },
    async ({ event_id }) => {
      const data = await apiRequest("DELETE", `/athlete/${ATHLETE_ID}/events/${event_id}`, { others: false });
      return { content: [{ type: "text", text: JSON.stringify({ deleted: event_id, response: data }, null, 2) }] };
    }
  );

  // Read-only, but registered with the write tools: it exists to check that a
  // workout created through the API converts to a non-empty device file.
  s.tool(
    "download_event_workout",
    "Download a planned workout as a device file (fit, zwo, mrc or erg), as Intervals.icu would export it. " +
      "Returns the file size, and the contents (base64 for fit, text otherwise). A tiny fit file means the " +
      "workout has no steps.",
    {
      event_id: z.number().describe("The event ID of a planned workout."),
      format: z.enum(["fit", "zwo", "mrc", "erg"]).optional().default("fit").describe("File format. Defaults to fit."),
    },
    async ({ event_id, format }) => {
      const res = await apiFetch("GET", `/athlete/${ATHLETE_ID}/events/${event_id}/download.${format}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const result: Record<string, unknown> = {
        event_id,
        format,
        content_type: res.headers.get("content-type"),
        size_bytes: bytes.length,
      };
      if (format === "fit") result.contents_base64 = bytes.toString("base64");
      else result.contents = bytes.toString("utf8");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

// ─── Start ───────────────────────────────────────────────────────────────────

if (TRANSPORT === "stdio") {
  const server = new McpServer({ name: "intervals-icu", version: "1.1.0" });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[intervals-mcp] Running on stdio");

} else {
  const httpSessions = new Map<string, StreamableHTTPServerTransport>();
  const sseSessions = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "intervals-icu-mcp", version: "1.1.0", transport: TRANSPORT }));
      return;
    }

    // Streamable HTTP: POST /
    if (url.pathname === "/" && req.method === "POST") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && httpSessions.has(sessionId)) {
        await httpSessions.get(sessionId)!.handleRequest(req, res);
        return;
      }
      const server = new McpServer({ name: "intervals-icu", version: "1.1.0" });
      registerTools(server);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => Math.random().toString(36).slice(2),
        onsessioninitialized: (sid) => { httpSessions.set(sid, transport); },
      });
      transport.onclose = () => { if (transport.sessionId) httpSessions.delete(transport.sessionId); };
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    // Streamable HTTP: GET / DELETE
    if (url.pathname === "/" && (req.method === "GET" || req.method === "DELETE")) {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      const transport = sessionId ? httpSessions.get(sessionId) : undefined;
      if (transport) { await transport.handleRequest(req, res); }
      else { res.writeHead(404); res.end("Session not found"); }
      return;
    }

    // Legacy SSE: GET /sse
    if (url.pathname === "/sse" && req.method === "GET") {
      const server = new McpServer({ name: "intervals-icu", version: "1.1.0" });
      registerTools(server);
      const transport = new SSEServerTransport("/messages", res);
      sseSessions.set(transport.sessionId, transport);
      res.on("close", () => sseSessions.delete(transport.sessionId));
      await server.connect(transport);
      return;
    }

    // Legacy SSE: POST /messages
    if (url.pathname === "/messages" && req.method === "POST") {
      const sid = url.searchParams.get("sessionId");
      const transport = sid ? sseSessions.get(sid) : undefined;
      if (transport) { await transport.handlePostMessage(req, res); }
      else { res.writeHead(404); res.end("Session not found"); }
      return;
    }

    res.writeHead(404); res.end("Not found");
  });

  httpServer.listen(PORT, () => {
    console.error(`[intervals-mcp] Server listening on http://localhost:${PORT}`);
    console.error(`[intervals-mcp]   Streamable HTTP : POST/GET/DELETE http://localhost:${PORT}/`);
    console.error(`[intervals-mcp]   Legacy SSE      : GET http://localhost:${PORT}/sse`);
    console.error(`[intervals-mcp]   Health          : GET http://localhost:${PORT}/health`);
  });
}
