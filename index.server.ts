import type { PluginServerContext } from "@getpaseo/plugin/server";
import { reasoningPreferences } from "./shared/reasoning";

export default function contribute(server: PluginServerContext) {
  server.registerSettings(reasoningPreferences);
  return () => {};
}
