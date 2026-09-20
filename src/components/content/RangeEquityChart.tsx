import ChartFrame, { mono } from '@/components/content/chartChrome'

type Variant = "gto" | "tight" | "bluffy";

interface Props {
  /** Caption shown above the chart */
  label?: string;
  /** Explainer rendered under the chart */
  caption?: string;
  /** Caveat rendered under the caption — reading instructions and the like */
  note?: string;
  /** Which opponent the equity curve describes */
  variant?: Variant;
  /** Equity of your bluff-catcher — a call only beats hands below this line */
  heroEquity?: number;
}

const W = 720;
const H = 340;
const PAD_L = 60;
const PAD_R = 24;
const PAD_T = 22;
const PAD_B = 64;
const SAMPLES = 160;

const Y_TICKS = [0, 25, 50, 75, 100];
const X_TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Hand equity — the share of the pot a hand wins at showdown — at a point in
 * the opponent's range, ordered weakest (0) → strongest (1). All three curves
 * are smooth and monotonic; they differ only in where they start and how fast
 * they climb.
 *
 *  - "gto":    starts at 0 and climbs evenly, so a real low-equity layer exists.
 *  - "tight":  starts at 15 — they only continue with stronger hands — jumps
 *              away from it, then crawls through the middle: the shape a real
 *              tight range traces, and it leaves no low-equity tail.
 *  - "bluffy": starts at 0 but crawls throughout, so weak hands make up far more
 *              of the range and the low-equity tail is fat.
 */
function equityAt(u: number, variant: Variant): number {
  if (variant === "tight") return 15 + 85 * (0.45 * Math.pow(u, 0.4) + 0.55 * Math.pow(u, 1.8));
  if (variant === "bluffy") return 100 * Math.pow(u, 1.7);
  return 100 * u * u * (3 - 2 * u);
}

/** Red for the call you do not want, green for the one you do, calm accent for neutral. */
const TONE: Record<Variant, { verdict: string; label: string; zone: string }> = {
  gto: { verdict: "var(--accent-strong)", label: "var(--text-faint)", zone: "var(--accent)" },
  tight: { verdict: "var(--tone-bad)", label: "var(--tone-bad)", zone: "var(--tone-bad)" },
  bluffy: { verdict: "var(--tone-good)", label: "var(--tone-good)", zone: "var(--tone-good)" },
};

/** Where the curve drops under the hero's equity — i.e. how much of the range is beatable. */
function crossing(heroEquity: number, variant: Variant): number {
  const N = 2000;
  for (let i = 1; i <= N; i += 1) {
    const u = i / N;
    const prev = (i - 1) / N;
    const a = equityAt(prev, variant);
    const b = equityAt(u, variant);
    if (b >= heroEquity) return prev + (u - prev) * ((heroEquity - a) / (b - a || 1));
  }
  return 1;
}

export default function RangeEquityChart({ label, caption, note, variant = "gto", heroEquity = 33 }: Props) {
  const tone = TONE[variant];
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xScale = (p: number) => PAD_L + p * plotW;
  const yScale = (e: number) => PAD_T + (1 - e / 100) * plotH;

  const toPath = (pts: { u: number; e: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.u).toFixed(1)},${yScale(p.e).toFixed(1)}`).join(" ");

  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const u = i / SAMPLES;
    return { u, e: equityAt(u, variant) };
  });
  const line = toPath(points);
  const area = `${line} L ${xScale(1).toFixed(1)},${yScale(0).toFixed(1)} L ${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} Z`;

  // Everything under the hero's equity line, up to where the curve crosses it.
  const crossU = crossing(heroEquity, variant);
  const crossX = xScale(crossU);
  const lineY = yScale(heroEquity);
  const zonePoints = points.filter((p) => p.u <= crossU).concat([{ u: crossU, e: heroEquity }]);
  const zoneArea = `${toPath(zonePoints)} L ${crossX.toFixed(1)},${yScale(0).toFixed(1)} L ${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} Z`;

  return (
    <ChartFrame label={label} caption={caption} note={note} labelColor={tone.label}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Hand equity across a ${variant} opponent's range, ordered weakest to strongest`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {Y_TICKS.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--border)" strokeWidth={1} opacity={tick === 0 ? 0.6 : 0.35} />
            <text x={PAD_L - 8} y={yScale(tick) + 3} textAnchor="end" {...mono} fontSize={10} fill="var(--text-faint)">
              {tick}
            </text>
          </g>
        ))}

        {X_TICKS.map((tick) => (
          <text
            key={`x-${tick}`}
            x={xScale(tick)}
            y={PAD_T + plotH + 17}
            textAnchor={tick === 0 ? "start" : tick === 1 ? "end" : "middle"}
            {...mono}
            fontSize={10}
            fill="var(--text-faint)"
          >
            {Math.round(tick * 100)}%
          </text>
        ))}

        {/* the whole distribution stays in the theme accent; the beatable slice carries the verdict tone */}
        <path d={area} fill="var(--accent)" opacity={0.08} />
        <path d={zoneArea} fill={tone.zone} opacity={0.28} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* your own equity — the shared reference, identical on every chart */}
        <line x1={PAD_L} x2={PAD_L + plotW} y1={lineY} y2={lineY} stroke="var(--accent-strong)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={PAD_L + 6} y={lineY - 9} {...mono} fontSize={10} fill="var(--accent-strong)">
          your equity · {heroEquity}%
        </text>

        {/* the verdict: how much of the range actually stays under yours */}
        <line x1={crossX} x2={crossX} y1={PAD_T} y2={yScale(0)} stroke={tone.verdict} strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={crossX + 8} y={PAD_T + 14} {...mono} fontSize={10} fill={tone.verdict}>
          {Math.round(crossU * 100)}% of his range
        </text>

        <text x={xScale(crossU / 2)} y={PAD_T + 16} textAnchor="middle" {...mono} fontSize={9.5} fill={tone.verdict}>
          target zone
        </text>

        <text x={PAD_L} y={PAD_T + plotH + 33} {...mono} fontSize={9.5} fill="var(--text-faint)">
          weakest
        </text>
        <text x={PAD_L + plotW} y={PAD_T + plotH + 33} textAnchor="end" {...mono} fontSize={9.5} fill="var(--text-faint)">
          strongest
        </text>

        <text x={PAD_L + plotW / 2} y={H - 9} textAnchor="middle" {...mono} fontSize={10} fill="var(--text-faint)">
          share of villain&rsquo;s range →
        </text>
        <text
          x={16}
          y={PAD_T + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${PAD_T + plotH / 2})`}
          {...mono}
          fontSize={10}
          fill="var(--text-faint)"
        >
          villain&rsquo;s hand equity (% of pot)
        </text>
      </svg>
    </ChartFrame>
  );
}
