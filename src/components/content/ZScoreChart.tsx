interface Props {
  /** Caption shown above the chart, in the same style as figure labels */
  label?: string;
  /** z-score samples, one per lookback window bucket (left = oldest) */
  data: number[];
  /** Labels for the x-axis ticks (sparse: first / mid / last) */
  xLabels?: [string, string, string];
}

/**
 * A theme-aware line chart of a z-score series over the 7-day lookback window,
 * with the interpretation bands and the ±2σ reference lines used by the app.
 */
export default function ZScoreChart({ label, data, xLabels = ["-7d", "-3d", "now"] }: Props) {
  const W = 720;
  const H = 260;
  const PAD_L = 44;
  const PAD_R = 14;
  const PAD_T = 16;
  const PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const min = -3;
  const max = 3;
  const y = (v: number) => PAD_T + ((max - v) / (max - min)) * plotH;
  const x = (i: number) => PAD_L + (i / (data.length - 1)) * plotW;

  const points = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const band = (lo: number, hi: number, color: string, opacity: number) => (
    <rect
      x={PAD_L}
      y={y(hi)}
      width={plotW}
      height={y(lo) - y(hi)}
      fill={color}
      opacity={opacity}
    />
  );

  const line = (v: number, color: string, dash: string, labelText: string) => (
    <g>
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={y(v)}
        y2={y(v)}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={dash}
      />
      <text
        x={W - PAD_R}
        y={y(v) - 4}
        textAnchor="end"
        fontSize={10}
        fill={color}
        fontFamily="var(--font-mono)"
      >
        {labelText}
      </text>
    </g>
  );

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
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Z-score over the 7-day lookback window"
      >
        {/* interpretation bands (bottom → top) */}
        {band(min, 0.5, "#9ca3af", 0.06)}
        {band(0.5, 1, "#fbbf24", 0.08)}
        {band(1, 2, "#f59e0b", 0.1)}
        {band(2, max, "var(--tone-bad)", 0.12)}
        {band(-0.5, min, "#9ca3af", 0.06)}
        {band(-1, -0.5, "#fbbf24", 0.08)}
        {band(-2, -1, "#f59e0b", 0.1)}
        {band(-3, -2, "var(--tone-bad)", 0.12)}

        {line(0, "var(--text-faint)", "", "mean")}
        {line(2, "var(--tone-bad)", "4 4", "+2σ")}
        {line(-2, "var(--tone-bad)", "4 4", "-2σ")}

        {/* y-axis ticks */}
        {[3, 1.5, 0, -1.5, -3].map((t) => (
          <text
            key={t}
            x={PAD_L - 8}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--text-faint)"
            fontFamily="var(--font-mono)"
          >
            {t === 0 ? "0σ" : `${t > 0 ? "+" : ""}${t}σ`}
          </text>
        ))}

        {/* x-axis ticks */}
        {xLabels.map((label, i) => {
          const xi = i === 0 ? PAD_L : i === 1 ? PAD_L + plotW / 2 : PAD_L + plotW;
          return (
            <text
              key={label}
              x={xi}
              y={H - 12}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fontSize={10}
              fill="var(--text-faint)"
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
          );
        })}

        <polyline
          points={points}
          fill="none"
          stroke="var(--accent-strong)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
