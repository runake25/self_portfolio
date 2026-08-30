interface Segment {
  label: string;
  value: number;
  /** CSS color for the segment fill */
  color?: string;
}

interface Props {
  /** Caption shown above the chart */
  label?: string;
  /** Segments rendered left-to-right, sized proportionally to their value */
  segments: Segment[];
  /** Unit suffix shown next to each value (e.g. "µs") */
  unit?: string;
  /** Total, used for the percentage labels; defaults to the sum of segments */
  total?: number;
}

/** A single proportional stacked bar with a legend — for share-of-total breakdowns. */
export default function StackedBar({ label, segments, unit = "", total }: Props) {
  const sum = total ?? segments.reduce((acc, s) => acc + s.value, 0);

  return (
    <div style={{ margin: "1.75em 0" }}>
      {label && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.78rem",
            color: "var(--text-faint)",
            marginBottom: "0.75em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
      )}

      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${((s.value / sum) * 100).toFixed(0)}%`).join(", ")}
        style={{
          display: "flex",
          width: "100%",
          height: "2rem",
          borderRadius: "4px",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              flexGrow: s.value / sum,
              background: s.color ?? "var(--accent)",
              minWidth: "2px",
            }}
            title={`${s.label}: ${s.value}${unit} (${((s.value / sum) * 100).toFixed(0)}%)`}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "1.5em",
          marginTop: "0.65em",
          flexWrap: "wrap",
        }}
      >
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.4em" }}>
            <span
              style={{
                display: "inline-block",
                width: "0.8em",
                height: "0.8em",
                borderRadius: "2px",
                background: s.color ?? "var(--accent)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
              }}
            >
              {s.label}{" "}
              <span style={{ color: "var(--text-faint)" }}>
                {((s.value / sum) * 100).toFixed(0)}% · {s.value}
                {unit}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
