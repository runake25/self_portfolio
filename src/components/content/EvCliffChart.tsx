import ChartFrame, { mono } from '@/components/content/chartChrome'

interface Props {
  /** Caption shown above the chart */
  label?: string;
  /** Explainer rendered under the chart */
  caption?: string;
}

const W = 720;
const H = 300;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 22;
const PAD_B = 54;
const SAMPLES = 140;

const EV_CAP = 7; // best case, when the read is sharp (pot units)
const EV_FLOOR = -22; // worst case, when the read is wrong (pot units)
const Y_MIN = -24;
const Y_MAX = 9;

// Where the ledge bites, and how fast it falls once it does.
const MID = 0.7;
const STEEP = 0.04;

/** EV as a function of how accurate your posterior read is (0 → 1). */
function evAt(accuracy: number): number {
  return EV_FLOOR + (EV_CAP - EV_FLOOR) / (1 + Math.exp(-(accuracy - MID) / STEEP));
}

const Y_TICKS = [-20, -15, -10, -5, 0, 5];
const X_TICKS = [0, 0.25, 0.5, 0.75, 1];

export default function EvCliffChart({ label, caption }: Props) {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xScale = (a: number) => PAD_L + a * plotW;
  const yScale = (ev: number) => PAD_T + ((Y_MAX - ev) / (Y_MAX - Y_MIN)) * plotH;

  const points = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const a = i / SAMPLES;
    return { a, ev: evAt(a) };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.a).toFixed(1)},${yScale(p.ev).toFixed(1)}`)
    .join(" ");

  // accuracy at which the line crosses break-even
  const breakEven = MID - STEEP * Math.log((EV_CAP - EV_FLOOR) / -EV_FLOOR - 1);

  return (
    <ChartFrame label={label} caption={caption}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Line chart: EV falls off a cliff as the accuracy of your posterior read drops"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* negative-EV region */}
        <rect
          x={PAD_L}
          y={yScale(0)}
          width={plotW}
          height={PAD_T + plotH - yScale(0)}
          fill="var(--tone-bad)"
          opacity={0.06}
        />

        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={PAD_L + plotW} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--border)" strokeWidth={tick === 0 ? 0 : 1} opacity={0.5} />
            <text x={PAD_L - 8} y={yScale(tick) + 3} textAnchor="end" {...mono} fontSize={10} fill="var(--text-faint)">
              {tick > 0 ? `+${tick}` : `${tick}`}
            </text>
          </g>
        ))}

        {X_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={xScale(tick)} x2={xScale(tick)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--border)" strokeWidth={1} opacity={0.35} />
            <text x={xScale(tick)} y={PAD_T + plotH + 18} textAnchor={tick === 0 ? "start" : tick === 1 ? "end" : "middle"} {...mono} fontSize={10} fill="var(--text-faint)">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}

        {/* break-even line */}
        <line
          x1={PAD_L}
          x2={PAD_L + plotW}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke="var(--accent-strong)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* the curve */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* break-even crossing */}
        <circle cx={xScale(breakEven)} cy={yScale(0)} r={4} fill="var(--accent-strong)" />
        <line
          x1={xScale(breakEven)}
          x2={xScale(breakEven)}
          y1={yScale(0)}
          y2={PAD_T}
          stroke="var(--accent-strong)"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.6}
        />
        <text x={xScale(breakEven) + 8} y={PAD_T + 14} {...mono} fontSize={10} fill="var(--accent-strong)">
          break-even ≈ {Math.round(breakEven * 100)}%
        </text>

        {/* the cliff annotation */}
        <text x={xScale(0.66)} y={72} textAnchor="middle" {...mono} fontSize={10} fontWeight={700} fill="var(--tone-bad)">
          the cliff
        </text>
        <line x1={xScale(0.66)} x2={xScale(0.66)} y1={80} y2={yScale(-13)} stroke="var(--tone-bad)" strokeWidth={1} strokeDasharray="3 3" />

        <text x={PAD_L + 6} y={PAD_T + plotH - 8} {...mono} fontSize={9.5} fill="var(--text-faint)">
          sloppy read
        </text>
        <text x={PAD_L + plotW - 6} y={PAD_T + plotH - 8} textAnchor="end" {...mono} fontSize={9.5} fill="var(--text-faint)">
          sharp read
        </text>

        <text x={PAD_L + plotW / 2} y={H - 8} textAnchor="middle" {...mono} fontSize={10} fill="var(--text-faint)">
          accuracy of your posterior read →
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
          EV of the call (pot)
        </text>
      </svg>
    </ChartFrame>
  );
}
