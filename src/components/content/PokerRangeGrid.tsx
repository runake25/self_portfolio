import React from "react";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

function getHand(row: number, col: number): string {
  if (row === col) return RANKS[row] + RANKS[col];
  if (row < col) return RANKS[row] + RANKS[col] + "s";
  return RANKS[col] + RANKS[row] + "o";
}

interface Props {
  /** Hands played at 100% frequency */
  range?: string[];
  /** Hands played at mixed/partial frequency */
  mixed?: string[];
  /** Optional label shown above the grid */
  label?: string;
  /** Optional equity map: { 'AKs': 0.72, ... } — shown inside each cell */
  equity?: Record<string, number>;
  /** Legend entries: { color: 'range' | 'mixed' | 'empty', label: string }[] */
  legend?: { color: "range" | "mixed" | "empty"; label: string }[];
}

export default function PokerRangeGrid({ range = [], mixed = [], label, equity, legend }: Props) {
  const swatchBg: Record<"range" | "mixed" | "empty", string> = {
    range: "var(--accent)",
    mixed: "color-mix(in srgb, var(--accent) 45%, var(--surface))",
    empty: "var(--surface)",
  };
  return (
    <div style={{ margin: "1.5em 0" }}>
      {label && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            color: "var(--text-faint)",
            marginBottom: "0.5em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(13, 1fr)",
          gap: "2px",
          width: "100%",
        }}
      >
          {RANKS.map((_, row) =>
            RANKS.map((_, col) => {
              const hand = getHand(row, col);
              const inRange = range.includes(hand);
              const isMixed = mixed.includes(hand);
              const eq = equity?.[hand];

              let bg = "var(--surface)";
              let color = "var(--text-faint)";
              if (inRange) {
                bg = "var(--accent)";
                color = "var(--bg)";
              } else if (isMixed) {
                bg = "color-mix(in srgb, var(--accent) 45%, var(--surface))";
                color = "var(--text-primary)";
              }

              return (
                <div
                  key={hand}
                  title={eq !== undefined ? `${hand}: ${(eq * 100).toFixed(0)}%` : hand}
                  style={{
                    background: bg,
                    color,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1",
                    borderRadius: "2px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "clamp(0.4rem, 1.1vw, 0.65rem)",
                    lineHeight: 1.2,
                    userSelect: "none",
                    transition: "opacity 0.15s",
                    cursor: "default",
                  }}
                >
                  <span style={{ fontWeight: inRange || isMixed ? 600 : 400 }}>{hand}</span>
                  {eq !== undefined && (
                    <span style={{ fontSize: "0.75em", opacity: 0.75 }}>
                      {(eq * 100).toFixed(0)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      {legend && legend.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "1.25em",
            marginTop: "0.65em",
            flexWrap: "wrap",
          }}
        >
          {legend.map((entry) => (
            <div
              key={entry.label}
              style={{ display: "flex", alignItems: "center", gap: "0.4em" }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "0.8em",
                  height: "0.8em",
                  borderRadius: "2px",
                  background: swatchBg[entry.color],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  color: "var(--text-faint)",
                }}
              >
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
