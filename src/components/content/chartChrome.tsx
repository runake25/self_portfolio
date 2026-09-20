import type { ReactNode } from "react";

/** Mono style shared by every chart's axis text and annotations. */
export const mono = { fontFamily: "var(--font-mono)" } as const;

interface Props {
  /** Uppercase caption shown above the chart */
  label?: string;
  /** Label colour — charts use this to carry a per-opponent verdict tone */
  labelColor?: string;
  /** Explainer rendered under the chart */
  caption?: string;
  /** Caveat rendered under the caption — scale, simplifications, and so on */
  note?: string;
  children: ReactNode;
}

/**
 * Shared frame for the inline charts embedded in articles: label above, plot in
 * the middle, caption below. Keeps the chrome in one place instead of the same
 * wrapper, label block and caption block being pasted into every component.
 */
export default function ChartFrame({ label, labelColor = "var(--text-faint)", caption, note, children }: Props) {
  return (
    <div style={{ margin: "1.75em 0" }}>
      {label && (
        <p
          style={{
            ...mono,
            fontSize: "0.78rem",
            color: labelColor,
            marginBottom: "0.75em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
      )}

      {children}

      {caption && (
        <p
          style={{
            ...mono,
            fontSize: "0.68rem",
            color: "var(--text-faint)",
            marginTop: "0.6em",
            lineHeight: 1.6,
          }}
        >
          {caption}
        </p>
      )}

      {note && (
        <p
          style={{
            ...mono,
            fontSize: "0.68rem",
            color: "var(--text-faint)",
            marginTop: "0.5em",
            lineHeight: 1.6,
            borderLeft: "2px solid var(--border)",
            paddingLeft: "0.7em",
          }}
        >
          {note}
        </p>
      )}
    </div>
  );
}
