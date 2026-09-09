import { describe, expect, it } from "vitest";
import { transformReasoning } from "./client/transform";
import {
  formatThinkingText,
  getReasoningExpansionState,
  reasoningSettingsSchema,
} from "./shared/reasoning";

function reasoning(text: string) {
  return { type: "reasoning" as const, text };
}

describe("reasoning display timeline plugin", () => {
  it("replaces reasoning rows with formatted plugin items", () => {
    expect(
      transformReasoning({ item: reasoning("**Plan****Result**"), phase: "complete" }),
    ).toEqual({
      items: [
        {
          type: "plugin",
          kind: "reasoning-display",
          version: 1,
          data: { text: "**Plan**\n\n**Result**" },
        },
      ],
    });
  });

  it("preserves code blocks and inline code while formatting headers", () => {
    const text = "**Plan****Result**\n\n`**inline**`\n\n```\n**code****code**\n```";
    expect(formatThinkingText(text)).toBe(
      "**Plan**\n\n**Result**\n\n`**inline**`\n\n```\n**code****code**\n```",
    );
  });

  it("does not split ordinary prose bold spans", () => {
    const text = "Use **AgentStreamView** and **MarkdownRenderer** for this change.";
    expect(formatThinkingText(text)).toBe(text);
  });

  it("keeps the latest reasoning block expanded until a newer block starts", () => {
    expect(getReasoningExpansionState(false, true)).toBe(true);
    expect(getReasoningExpansionState(true, false)).toBe(true);
    expect(getReasoningExpansionState(false, false)).toBe(false);
  });

  it("applies the complete settings defaults", () => {
    expect(reasoningSettingsSchema.parse({})).toEqual({
      mode: "expand_last",
      debug: false,
    });
  });

  it("accepts every supported settings value", () => {
    expect(reasoningSettingsSchema.parse({ mode: "collapsed" })).toEqual({
      mode: "collapsed",
      debug: false,
    });
    expect(reasoningSettingsSchema.parse({ mode: "expanded", debug: true })).toEqual({
      mode: "expanded",
      debug: true,
    });
  });

  it("rejects an invalid display mode", () => {
    expect(reasoningSettingsSchema.safeParse({ mode: "sometimes" }).success).toBe(false);
  });
});
