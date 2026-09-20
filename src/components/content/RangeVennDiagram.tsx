import ChartFrame, { mono } from '@/components/content/chartChrome'

interface Props {
  /** Caption shown above the diagram */
  label?: string;
  /** One-line takeaway rendered under the diagram */
  caption?: string;
  /** Caveat rendered under the caption — here, the not-to-scale warning */
  note?: string;
}

const W = 720;
const H = 430;

/**
 * Three sets, plus the one region that decides the call:
 *   - THEORY (big)        → the range theory gives this player at the node
 *   - THEORY_BLUFF (small, nested inside THEORY) → where theory says their bluffs live
 *   - REAL (blue)         → the range you actually face: this player's real range,
 *                           which is *not* the theoretical one
 *   - THEORY_BLUFF ∩ REAL → the bluffs you actually face. This — not the solver's
 *                           frequency for the spot — is the number you get to use.
 */
const THEORY = { cx: 265, cy: 205, r: 180 };
const REAL = { cx: 460, cy: 235, r: 175 };
const THEORY_BLUFF = { cx: 275, cy: 250, r: 90 };

const LEGEND = [
  { color: "var(--text-faint)", label: "theoretical range" },
  { color: "#4fa3e0", label: "range you actually face" },
  { color: "var(--accent)", label: "theoretical bluff range" },
];

export default function RangeVennDiagram({ label, caption, note }: Props) {
  return (
    <ChartFrame label={label} caption={caption} note={note}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Venn diagram: the range theory gives the player, the theoretical bluff range nested inside it, and the real range you face. The bluffs you actually face sit where the theoretical bluff range crosses the real range."
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <clipPath id="bom-venn-lens">
            <circle cx={THEORY_BLUFF.cx} cy={THEORY_BLUFF.cy} r={THEORY_BLUFF.r} />
          </clipPath>
        </defs>

        {/* the range theory gives them */}
        <circle
          cx={THEORY.cx}
          cy={THEORY.cy}
          r={THEORY.r}
          fill="var(--text-faint)"
          fillOpacity={0.06}
          stroke="var(--border)"
          strokeWidth={1.5}
        />
        {/* the range you actually face — this player's real range */}
        <circle
          cx={REAL.cx}
          cy={REAL.cy}
          r={REAL.r}
          fill="#4fa3e0"
          fillOpacity={0.13}
          stroke="#4fa3e0"
          strokeWidth={1.5}
        />
        {/* where theory says their bluffs live */}
        <circle
          cx={THEORY_BLUFF.cx}
          cy={THEORY_BLUFF.cy}
          r={THEORY_BLUFF.r}
          fill="var(--accent)"
          fillOpacity={0.12}
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        {/* the bluffs you actually face: theoretical bluff set ∩ real range */}
        <g clipPath="url(#bom-venn-lens)">
          <circle cx={REAL.cx} cy={REAL.cy} r={REAL.r} fill="var(--accent)" fillOpacity={0.34} />
        </g>

        {/* the range theory gives them */}
        <text x={250} y={74} textAnchor="middle" {...mono} fontSize={12} fontWeight={600} letterSpacing="0.06em" fill="var(--text-secondary)">
          THEORETICAL RANGE
        </text>
        <text x={250} y={92} textAnchor="middle" {...mono} fontSize={9.5} fill="var(--text-faint)">
          the range theory gives them
        </text>

        {/* the range you actually face — this player's real range */}
        <text x={502} y={112} textAnchor="middle" {...mono} fontSize={12} fontWeight={600} letterSpacing="0.06em" fill="#4fa3e0">
          RANGE YOU FACE
        </text>
        <text x={510} y={130} textAnchor="middle" {...mono} fontSize={9.5} fill="var(--text-faint)">
          this player&rsquo;s real range
        </text>

        {/* where theory says their bluffs live */}
        <text x={235} y={245} textAnchor="middle" {...mono} fontSize={9.5} fontWeight={600} fill="var(--accent)">
          THEORETICAL
        </text>
        <text x={235} y={259} textAnchor="middle" {...mono} fontSize={9.5} fontWeight={600} fill="var(--accent)">
          BLUFF RANGE
        </text>

        {/* the key region: the bluffs you actually face */}
        <text x={325} y={245} textAnchor="middle" {...mono} fontSize={9.5} fontWeight={700} fill="var(--accent-strong)">
          bluffs
        </text>
        <text x={325} y={259} textAnchor="middle" {...mono} fontSize={9.5} fontWeight={700} fill="var(--accent-strong)">
          you face
        </text>
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.1em", marginTop: "0.7em" }}>
        {LEGEND.map((item) => (
          <span
            key={item.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--text-faint)",
            }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: item.color,
                opacity: 0.75,
                display: "inline-block",
              }}
            />
            {item.label}
          </span>
        ))}
      </div>

    </ChartFrame>
  );
}
