import {
  type PluginSurfaceProps,
  type PluginTimelineItemProps,
  useSettings,
} from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsCard,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { z } from "zod";
import {
  DEFAULT_REASONING_SETTINGS,
  reasoningDisplayModeSchema,
  reasoningItemDataSchema,
  reasoningPreferences,
  type ReasoningDisplayMode,
  type ReasoningSettings,
} from "../shared/reasoning";
import { useInferredReasoningPhase, useRevealedTextCompat } from "./reveal";

const MAX_REASONING_HEIGHT = 400;
const DISPLAY_MODE_OPTIONS = [
  { label: "Expand last", value: "expand_last" },
  { label: "Collapsed", value: "collapsed" },
  { label: "Always expand", value: "expanded" },
] as const;

const LOG_PREFIX = "[reasoning-display]";
let isDebugLoggingEnabled = false;

function logReasoning(event: string, details: Record<string, unknown>): void {
  if (!isDebugLoggingEnabled) return;
  const formatted = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(`${LOG_PREFIX} event=${event} ${formatted}`);
}

type ReasoningItemData = z.output<typeof reasoningItemDataSchema>;

interface MarkdownStyles {
  container: StyleProp<ViewStyle>;
  paragraph: StyleProp<TextStyle>;
  heading: StyleProp<TextStyle>;
  bullet: StyleProp<TextStyle>;
  bulletRow: StyleProp<ViewStyle>;
  quote: StyleProp<TextStyle>;
  code: StyleProp<TextStyle>;
  codeBlock: StyleProp<TextStyle>;
  spacer: StyleProp<ViewStyle>;
  scroll: StyleProp<ViewStyle>;
}

const latestReasoningTimestamps = new Map<string, number>();
const latestReasoningListeners = new Set<() => void>();

function updateLatestReasoningTimestamp(agentId: string, timestamp: number): void {
  const current = latestReasoningTimestamps.get(agentId) ?? 0;
  if (timestamp > current) {
    latestReasoningTimestamps.set(agentId, timestamp);
    logReasoning("store-update", { agentId, prev: current, next: timestamp });
    for (const listener of latestReasoningListeners) {
      listener();
    }
  }
}

function subscribeLatestReasoning(listener: () => void): () => void {
  latestReasoningListeners.add(listener);
  return () => {
    latestReasoningListeners.delete(listener);
  };
}

function useReasoningSettings(): ReasoningSettings {
  const settings = useSettings(reasoningPreferences);
  const values = settings.status === "ready" ? settings.values : DEFAULT_REASONING_SETTINGS;
  isDebugLoggingEnabled = settings.status === "ready" && Boolean(values.debug);
  return values;
}

function useIsLatestReasoning(agentId: string, timestamp: Date, isStreaming: boolean): boolean {
  const itemTime = timestamp.getTime();
  if (isStreaming || itemTime > (latestReasoningTimestamps.get(agentId) ?? 0)) {
    updateLatestReasoningTimestamp(agentId, itemTime);
  }

  const latestTime = useSyncExternalStore(
    subscribeLatestReasoning,
    () => latestReasoningTimestamps.get(agentId) ?? 0,
    () => 0,
  );

  return isStreaming || (latestTime > 0 && itemTime >= latestTime);
}

function renderInlineMarkdown(text: string, styles: MarkdownStyles): ReactNode[] {
  const tokenPattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let nodeIndex = 0;

  while ((match = tokenPattern.exec(text)) !== null) {
    const start = match.index;
    const token = match[0];
    if (start > cursor) nodes.push(text.slice(cursor, start));

    let tokenStyle = styles.paragraph;
    let tokenText = token;
    if (token.startsWith("**") || token.startsWith("__")) {
      tokenStyle = [styles.paragraph, { fontWeight: "700" }];
      tokenText = token.slice(2, -2);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokenStyle = styles.code;
      tokenText = token.slice(1, -1);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      tokenStyle = [styles.paragraph, { fontStyle: "italic" }];
      tokenText = token.slice(1, -1);
    }
    nodes.push(
      <Text key={`inline-${nodeIndex}`} style={tokenStyle}>
        {tokenText}
      </Text>,
    );
    nodeIndex += 1;
    cursor = start + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function InlineMarkdown({ text, styles }: { text: string; styles: MarkdownStyles }) {
  return <Text style={styles.paragraph}>{renderInlineMarkdown(text, styles)}</Text>;
}

function MarkdownContent({ text, styles }: { text: string; styles: MarkdownStyles }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let codeLines: string[] | null = null;

  const addCodeBlock = (key: string, linesToAdd: string[]) => {
    blocks.push(
      <Text key={key} selectable style={styles.codeBlock}>
        {linesToAdd.join("\n")}
      </Text>,
    );
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (codeLines !== null) {
      if (trimmed.startsWith("```") || trimmed === "```") {
        addCodeBlock(`code-${blocks.length}`, codeLines);
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      return;
    }

    if (trimmed.startsWith("```")) {
      codeLines = [];
      return;
    }
    if (trimmed.length === 0) {
      blocks.push(<View key={`space-${blocks.length}`} style={styles.spacer} />);
      return;
    }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <Text key={`heading-${blocks.length}-${heading[1]}`} selectable style={styles.heading}>
          {renderInlineMarkdown(heading[1], styles)}
        </Text>,
      );
      return;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      blocks.push(
        <View key={`unordered-${blocks.length}-${unordered[1]}`} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <InlineMarkdown text={unordered[1]} styles={styles} />
        </View>,
      );
      return;
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      blocks.push(
        <View key={`ordered-${blocks.length}-${ordered[1]}`} style={styles.bulletRow}>
          <Text style={styles.bullet}>{ordered[1]}.</Text>
          <InlineMarkdown text={ordered[2]} styles={styles} />
        </View>,
      );
      return;
    }

    if (trimmed.startsWith(">")) {
      blocks.push(
        <Text key={`quote-${blocks.length}-${trimmed}`} selectable style={styles.quote}>
          {renderInlineMarkdown(trimmed.slice(1).trimStart(), styles)}
        </Text>,
      );
      return;
    }

    blocks.push(
      <InlineMarkdown key={`paragraph-${blocks.length}-${line}`} text={line} styles={styles} />,
    );
  });

  if (codeLines !== null) addCodeBlock(`code-${blocks.length}`, codeLines);
  return <View style={styles.container}>{blocks}</View>;
}

function ThinkingBody({
  text,
  phase,
  styles,
}: {
  text: string;
  phase: "streaming" | "complete";
  styles: MarkdownStyles;
}) {
  const revealedText = useRevealedTextCompat(text, phase);
  const scrollRef = useRef<ScrollView | null>(null);
  const isNearBottom = useRef(true);

  useEffect(() => {
    logReasoning("body-mount", { phase, textLength: text.length });
    return () => {
      logReasoning("body-unmount", { phase, textLength: text.length });
    };
  }, [phase, text.length]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    isNearBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 32;
  }, []);
  const handleContentSizeChange = useCallback(() => {
    if (isNearBottom.current) scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      nestedScrollEnabled
      onContentSizeChange={handleContentSizeChange}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator
      style={styles.scroll}
    >
      <MarkdownContent text={revealedText} styles={styles} />
    </ScrollView>
  );
}

function useMarkdownStyles(theme: PluginTimelineItemProps["theme"]): MarkdownStyles {
  return useMemo(
    () => ({
      container: { gap: 6, paddingBottom: 12, paddingHorizontal: 13, paddingTop: 8 },
      paragraph: {
        color: theme.colors.foreground,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "monospace",
      },
      heading: {
        color: theme.colors.foreground,
        fontSize: 14,
        fontWeight: "700",
        lineHeight: 20,
        fontFamily: "monospace",
      },
      bullet: {
        color: theme.colors.foregroundMuted,
        minWidth: 20,
        lineHeight: 20,
        fontFamily: "monospace",
        fontSize: 13,
      },
      bulletRow: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
      quote: {
        borderLeftWidth: 2,
        borderLeftColor: theme.colors.accent,
        color: theme.colors.foregroundMuted,
        paddingLeft: 8,
        lineHeight: 20,
        fontFamily: "monospace",
        fontSize: 13,
      },
      code: {
        backgroundColor: theme.colors.surface2,
        color: theme.colors.foreground,
        fontFamily: "monospace",
        fontSize: 12,
        paddingHorizontal: 3,
      },
      codeBlock: {
        backgroundColor: theme.colors.surface1,
        borderColor: theme.colors.border,
        borderRadius: 6,
        borderWidth: 1,
        color: theme.colors.foreground,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 18,
        padding: 10,
      },
      spacer: { height: 4 },
      scroll: {
        maxHeight: MAX_REASONING_HEIGHT,
      },
    }),
    [theme],
  );
}

export function ReasoningTimelineItem({
  agentId,
  item,
  theme,
  timestamp,
}: PluginTimelineItemProps<ReasoningItemData>) {
  const settings = useReasoningSettings();
  const mode = settings.mode;
  const phase = useInferredReasoningPhase(item.data.text);
  const isStreaming = phase === "streaming";
  const isLatest = useIsLatestReasoning(agentId, timestamp, isStreaming);
  const preferredExpanded = mode === "expanded" || (mode === "expand_last" && isLatest);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const isExpanded = isStreaming || (userExpanded !== null ? userExpanded : preferredExpanded);
  const styles = useMarkdownStyles(theme);

  useEffect(() => {
    logReasoning("item-mount", {
      agentId,
      timestamp: timestamp.toISOString(),
      phase,
    });
    return () => {
      logReasoning("item-unmount", {
        agentId,
        timestamp: timestamp.toISOString(),
        phase,
      });
    };
  }, [agentId, phase, timestamp]);

  logReasoning("item-render", {
    agentId,
    timestamp: timestamp.toISOString(),
    phase,
    mode,
    isStreaming,
    isLatest,
    preferredExpanded,
    userExpanded: userExpanded === null ? "auto" : userExpanded,
    isExpanded,
  });

  const toggleExpanded = useCallback(() => {
    const nextState = !isExpanded;
    logReasoning("user-toggle", { agentId, from: isExpanded, to: nextState });
    setUserExpanded(nextState);
  }, [agentId, isExpanded]);
  const cardStyle = useMemo(
    () => ({
      marginHorizontal: -13,
      marginVertical: 2,
    }),
    [],
  );
  const pressableStyle = useMemo(
    () => ({
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 1,
      overflow: "hidden" as const,
      paddingHorizontal: 8,
      paddingVertical: 3,
    }),
    [],
  );
  const pressableExpandedStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surface1,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderColor: theme.colors.border,
    }),
    [theme.colors.border, theme.colors.surface1],
  );
  const headerStyle = useMemo(
    () => ({
      alignItems: "center" as const,
      flexDirection: "row" as const,
    }),
    [],
  );
  const iconBadgeStyle = useMemo(
    () => ({
      alignItems: "center" as const,
      borderRadius: 10,
      height: 20,
      justifyContent: "center" as const,
      marginRight: 4,
      width: 20,
    }),
    [],
  );
  const headerTitleStyle = useMemo(
    () => ({
      color: theme.colors.foregroundMuted,
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 20,
    }),
    [theme.colors.foregroundMuted],
  );
  const headerTitleActiveStyle = useMemo(
    () => ({ color: theme.colors.foreground }),
    [theme.colors.foreground],
  );
  const detailStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surface0,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderTopWidth: 0,
      flexShrink: 1,
      minWidth: 0,
      overflow: "hidden" as const,
    }),
    [theme.colors.border, theme.colors.surface0],
  );

  return (
    <View style={cardStyle}>
      <Pressable
        accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} thinking`}
        accessibilityRole="button"
        onPress={toggleExpanded}
        style={[pressableStyle, isExpanded && pressableExpandedStyle]}
      >
        <View style={headerStyle}>
          <View style={iconBadgeStyle}>
            {isExpanded ? (
              <Icon color={theme.colors.foreground} name="ChevronDown" size={12} />
            ) : (
              <Icon color={theme.colors.foregroundMuted} name="Brain" size={12} />
            )}
          </View>
          <Text style={[headerTitleStyle, isExpanded && headerTitleActiveStyle]}>Thinking</Text>
        </View>
      </Pressable>
      {isExpanded ? (
        <View style={detailStyle}>
          <ThinkingBody text={item.data.text} phase={phase} styles={styles} />
        </View>
      ) : null}
    </View>
  );
}

export function ReasoningDisplaySettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(reasoningPreferences);
  const messageStyle = useMemo(() => ({ color: theme.colors.foreground }), [theme.colors.foreground]);
  const errorStyle = useMemo(
    () => ({ color: theme.colors.statusDanger }),
    [theme.colors.statusDanger],
  );

  if (settings.status === "loading") {
    return <Text style={messageStyle}>Loading settings…</Text>;
  }

  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Reasoning Display">
        <Text accessibilityRole="alert" style={errorStyle}>
          {settings.error}
        </Text>
        <SettingsAction label="Try again" actionLabel="Reload" onPress={settings.reload} />
        {settings.status === "invalid" ? (
          <SettingsAction
            label="Restore default settings"
            actionLabel="Reset"
            onPress={settings.reset}
          />
        ) : null}
      </SettingsSection>
    );
  }

  const changeMode = (value: string) => {
    const parsed = reasoningDisplayModeSchema.safeParse(value);
    if (!parsed.success) return;
    void settings.save({ ...settings.values, mode: parsed.data }, settings.revision);
  };
  const changeDebug = (debug: boolean) => {
    void settings.save({ ...settings.values, debug }, settings.revision);
  };

  return (
    <>
      <SettingsSection title="Display">
        <SettingsCard>
          <SettingsSelect
            label="Display mode"
            hint="Choose which reasoning blocks start expanded."
            value={settings.values.mode}
            options={DISPLAY_MODE_OPTIONS}
            disabled={settings.saving}
            onValueChange={changeMode}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Diagnostics">
        <SettingsCard>
          <SettingsSwitch
            label="Debug logging"
            hint="Log timeline render ticks, streaming phase transitions, and expansion events."
            value={settings.values.debug}
            disabled={settings.saving}
            onValueChange={changeDebug}
          />
        </SettingsCard>
        {settings.saveError ? (
          <Text accessibilityRole="alert" style={errorStyle}>
            {settings.saveError}
          </Text>
        ) : null}
      </SettingsSection>
    </>
  );
}
