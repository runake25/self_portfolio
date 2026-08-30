interface Row {
  label: string;
  value: number;
}

interface Props {
  /** Caption shown above the chart */
  label?: string;
  /** Rows rendered top-to-bottom; bars sized on a log scale */
  rows: Row[];
  /** Human-readable value shown for each row (e.g. "~2 µs") */
  format?: (v: number) => string;
}

/**
 * Horizontal bars on a base-10 log scale. Useful when the values span multiple
 * orders of magnitude (nanoseconds → microseconds), where a linear scale would
 * render the small values invisible.
 */
export default function LogScaleBars({ label, rows, format = (v) => `${v}` }: Props) {
  const lo = Math.min(...rows.map((r) => r.value));
  const hi = Math.max(...rows.map((r) => r.value));
  const pos = (v: number) => (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));

  const ticks = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3].filter((t) => t >= lo && t <= hi);

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

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6em" }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(9rem, 11rem) 1fr minmax(3.5rem, 4.5rem)",
              alignItems: "center",
              gap: "0.75em",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
                textAlign: "right",
              }}
            >
              {r.label}
            </span>
            <div style={{ position: "relative", height: "1rem" }}>
              {/* log-scale gridline track */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "3px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
              {ticks.map((t) => (
                <span
                  key={t}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${pos(t) * 100}%`,
                    width: "1px",
                    background: "var(--border)",
                  }}
                />
              ))}
              <div
                style={{
                  position: "absolute",
                  top: "2px",
                  bottom: "2px",
                  left: 0,
                  width: `${Math.max(pos(r.value) * 100, 1.5)}%`,
                  borderRadius: "2px",
                  background: "var(--accent)",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                color: "var(--text-primary)",
                textAlign: "left",
              }}
            >
              {format(r.value)}
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.68rem",
          color: "var(--text-faint)",
          marginTop: "0.6em",
        }}
      >
        log scale — the first three are nanoseconds, the last two microseconds
      </p>
    </div>
  );
}
