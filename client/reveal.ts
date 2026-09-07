import { useEffect, useRef, useState } from "react";

const STREAM_SETTLE_MS = 1200;
const REVEAL_TICK_MS = 16;

/**
 * Paseo 0.7.2 does not expose the timeline transform phase that v0.8 provides.
 * Treat a reasoning row as streaming while its text is actively changing, then
 * consider it complete after a short quiet period.
 */
export function useInferredReasoningPhase(text: string): "streaming" | "complete" {
  const previousTextRef = useRef(text);
  const [streaming, setStreaming] = useState(false);
  const textChanged = previousTextRef.current !== text;

  if (textChanged) {
    previousTextRef.current = text;
  }

  useEffect(() => {
    if (!textChanged) return;

    setStreaming(true);
    const timeout = setTimeout(() => setStreaming(false), STREAM_SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [text]);

  return textChanged || streaming ? "streaming" : "complete";
}

/**
 * Local equivalent of the v0.8 useRevealedText helper. Existing text stays
 * visible immediately; newly streamed text is revealed over a few frames.
 */
export function useRevealedTextCompat(
  text: string,
  phase: "streaming" | "complete",
): string {
  const previousTargetRef = useRef(text);
  const [revealedLength, setRevealedLength] = useState(text.length);

  useEffect(() => {
    const previousTarget = previousTargetRef.current;
    previousTargetRef.current = text;

    if (phase === "complete" || !text.startsWith(previousTarget)) {
      setRevealedLength(text.length);
      return;
    }

    setRevealedLength((current) => Math.min(current, text.length));
    const interval = setInterval(() => {
      setRevealedLength((current) => {
        if (current >= text.length) {
          clearInterval(interval);
          return text.length;
        }

        const remaining = text.length - current;
        const step = Math.max(1, Math.min(12, Math.ceil(remaining / 5)));
        const next = Math.min(text.length, current + step);
        if (next >= text.length) clearInterval(interval);
        return next;
      });
    }, REVEAL_TICK_MS);

    return () => clearInterval(interval);
  }, [phase, text]);

  return text.slice(0, revealedLength);
}
