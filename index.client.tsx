import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ReasoningDisplaySettings, ReasoningTimelineItem } from "./client/reasoning";
import { transformReasoning } from "./client/transform";
import {
  REASONING_RENDERER_KIND,
  REASONING_RENDERER_VERSION,
  reasoningItemDataSchema,
} from "./shared/reasoning";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "display",
    title: "Reasoning Display",
    icon: "Brain",
    Component: ReasoningDisplaySettings,
  });
  client.addTimelineTransformer({
    id: "reasoning-display",
    query: { itemType: "reasoning" },
    transform: transformReasoning,
  });
  client.addTimelineRenderer({
    kind: REASONING_RENDERER_KIND,
    version: REASONING_RENDERER_VERSION,
    schema: reasoningItemDataSchema,
    Component: ReasoningTimelineItem,
  });

  return () => {};
}
