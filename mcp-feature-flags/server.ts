#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../project-data/features.json");
const today = () => new Date().toISOString().slice(0, 10);
const load = async (): Promise<Record<string, any>> => JSON.parse(await readFile(FILE, "utf8"));
const save = async (data: Record<string, any>) => { const tmp = FILE + ".tmp"; await writeFile(tmp, JSON.stringify(data, null, 2)); await rename(tmp, FILE); };
const depsState = (data: Record<string, any>, f: any) => (f.dependencies ?? []).map((d: string) => ({ feature_name: d, status: data[d]?.status ?? "MISSING" }));
const out = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });

const server = new McpServer({ name: "feature-flags", version: "1.0.0" });

server.registerTool("get_feature_info", {
  description: `What: Returns full state of ONE feature flag (status, traffic_percentage, last_modified, dependencies) plus the current status of each dependency.\nWhen to call: user asks "what is the status of X", "is X enabled", "show feature X"; ALWAYS call before set_feature_state to "Enabled" so you can verify dependencies are satisfied.\nWhen NOT to call: do not call to list/discover all flags (one feature per call); do not call with a non-snake_case guess — only with a known feature_name.\nInput: { feature_name: string (snake_case, e.g. "search_v2") }\nOutput on success: { feature_name, name, description, status, traffic_percentage, last_modified, targeted_segments?, rollout_strategy?, dependencies?, dependencies_state: [{feature_name, status}] }\nOutput on error: { error: "FEATURE_NOT_FOUND", feature_name }\nExamples:\n  1) get_feature_info({ feature_name: "dark_mode" })\n  2) get_feature_info({ feature_name: "semantic_search" })  // dependencies_state shows search_v2 status\n  3) get_feature_info({ feature_name: "photo_reviews" })`,
  inputSchema: { feature_name: z.string().describe("snake_case feature ID, e.g. search_v2") },
}, async ({ feature_name }) => {
  const data = await load(); const f = data[feature_name];
  if (!f) return out({ error: "FEATURE_NOT_FOUND", feature_name });
  return out({ feature_name, ...f, dependencies_state: depsState(data, f) });
});

server.registerTool("set_feature_state", {
  description: `What: Changes a feature flag's status to Disabled | Testing | Enabled. Auto-sets traffic_percentage (Disabled→0, Enabled→100, Testing→keep if 1-99 else 10). Updates last_modified to today.\nWhen to call: user asks to enable, disable, kill-switch, promote, or roll back a feature.\nWhen NOT to call: do NOT use to change traffic percentage — use adjust_traffic_rollout. Do NOT use to read state — use get_feature_info.\nInput: { feature_name: string, state: "Disabled" | "Testing" | "Enabled" } (case-sensitive).\nOutput on success: { feature_name, status, traffic_percentage, last_modified, dependencies_state }\nOutput on error: { error, feature_name, ... }\nYou MUST NEVER set state="Enabled" while any dependency has status="Disabled" — the server returns DEPENDENCY_NOT_ENABLED and refuses the write. Enable each blocking dependency first (call get_feature_info to inspect, then set_feature_state on each dep). You MUST pass state exactly as "Disabled"/"Testing"/"Enabled".\nExamples:\n  1) set_feature_state({ feature_name: "stripe_alternative", state: "Disabled" })  // kill switch\n  2) set_feature_state({ feature_name: "search_v2", state: "Enabled" })  // promote to GA\n  3) set_feature_state({ feature_name: "semantic_search", state: "Testing" })  // start canary`,
  inputSchema: { feature_name: z.string(), state: z.enum(["Disabled", "Testing", "Enabled"]) },
}, async ({ feature_name, state }) => {
  const data = await load(); const f = data[feature_name];
  if (!f) return out({ error: "FEATURE_NOT_FOUND", feature_name });
  if (state === "Enabled") {
    const blocking = (f.dependencies ?? []).filter((d: string) => data[d]?.status === "Disabled");
    if (blocking.length) return out({ error: "DEPENDENCY_NOT_ENABLED", feature_name, blocking_dependencies: blocking, message: `Cannot enable '${feature_name}' — dependencies are Disabled: ${blocking.join(", ")}. Enable them first.` });
  }
  f.status = state;
  f.traffic_percentage = state === "Disabled" ? 0 : state === "Enabled" ? 100 : (f.traffic_percentage >= 1 && f.traffic_percentage <= 99 ? f.traffic_percentage : 10);
  f.last_modified = today();
  await save(data);
  return out({ feature_name, status: f.status, traffic_percentage: f.traffic_percentage, last_modified: f.last_modified, dependencies_state: depsState(data, f) });
});

server.registerTool("adjust_traffic_rollout", {
  description: `What: Sets traffic_percentage (integer 0-100) for a feature. Updates last_modified. Does NOT change status.\nWhen to call: canary ramp-ups (5→25→50→100), A/B split adjustments, dialing back live traffic without flipping status.\nWhen NOT to call: do NOT use to enable/disable a feature — use set_feature_state. Do NOT pass decimals or values outside 0-100.\nInput: { feature_name: string, percentage: integer in [0, 100] }\nOutput on success: { feature_name, status, traffic_percentage, last_modified, hint? }\nOutput on error: { error, feature_name, ... }\nYou MUST NEVER pass percentage > 0 when the feature's current status is "Disabled" — this is a HARD LOCK and the server returns DISABLED_TRAFFIC_LOCKED. To start a rollout on a Disabled feature, FIRST call set_feature_state({state:"Testing"}). You MUST pass an integer percentage; non-integers are rejected.\nExamples:\n  1) adjust_traffic_rollout({ feature_name: "dark_mode", percentage: 50 })  // ramp 20→50\n  2) adjust_traffic_rollout({ feature_name: "search_v2", percentage: 25 })  // canary step\n  3) adjust_traffic_rollout({ feature_name: "code_splitting_optimisation", percentage: 100 })  // soak before promotion`,
  inputSchema: { feature_name: z.string(), percentage: z.number().int().min(0).max(100) },
}, async ({ feature_name, percentage }) => {
  const data = await load(); const f = data[feature_name];
  if (!f) return out({ error: "FEATURE_NOT_FOUND", feature_name });
  if (f.status === "Disabled" && percentage > 0) return out({ error: "DISABLED_TRAFFIC_LOCKED", feature_name, message: `Cannot set traffic_percentage=${percentage} while status="Disabled". Call set_feature_state with state="Testing" first.` });
  f.traffic_percentage = percentage;
  f.last_modified = today();
  await save(data);
  const hint = percentage === 0 ? "Consider set_feature_state({state:'Disabled'}) for kill-switch semantics." : percentage === 100 && f.status === "Testing" ? "Consider set_feature_state({state:'Enabled'}) to promote." : null;
  return out({ feature_name, status: f.status, traffic_percentage: f.traffic_percentage, last_modified: f.last_modified, hint });
});

await server.connect(new StdioServerTransport());
