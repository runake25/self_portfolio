import ChartFrame, { mono } from '@/components/content/chartChrome'

interface Branch {
  /** Pool name shown on the leaf */
  name: string;
  /** How often you actually meet this pool (edge weight) */
  weight: number;
  /** Posterior bluff rate you believe for this pool */
  bluff: number;
  /** EV of the hero action against this pool, in pot units */
  ev: number;
}

interface Props {
  label?: string;
  caption?: string;
  /** Root action being priced */
  root?: string;
  branches?: Branch[];
}

const DEFAULT_BRANCHES: Branch[] = [
  { name: "GTO pool", weight: 0.2, bluff: 0.33, ev: 0 },
  { name: "Tight pool", weight: 0.6, bluff: 0.1, ev: -0.7 },
  { name: "Bluffy pool", weight: 0.2, bluff: 0.55, ev: 0.65 },
];

const W = 720;
const H = 390;

const LEAF_Y = 252;
const LEAF_H = 104;
const LEAF_W = 210;
const LEAF_X = [18, 255, 492];
const LEAF_CX = LEAF_X.map((x) => x + LEAF_W / 2);

const ROOT = { x: 240, y: 16, w: 240, h: 54 };

function toneFor(ev: number): string {
  if (ev > 0.01) return "var(--tone-good)";
  if (ev < -0.01) return "var(--tone-bad)";
  return "var(--text-faint)";
}

function actionFor(ev: number): string {
  if (ev > 0.01) return "→ call more";
  if (ev < -0.01) return "→ fold more";
  return "indifferent";
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
}

export default function EvDistributionTree({
  label,
  caption,
  root = "Hero calls the river bet",
  branches = DEFAULT_BRANCHES,
}: Props) {
  const rootCx = ROOT.x + ROOT.w / 2;
  const rootBottom = ROOT.y + ROOT.h;

  const edges = [
    `M ${rootCx} ${rootBottom} Q ${LEAF_CX[0]} 165 ${LEAF_CX[0]} ${LEAF_Y}`,
    `M ${rootCx} ${rootBottom} L ${LEAF_CX[1]} ${LEAF_Y}`,
    `M ${rootCx} ${rootBottom} Q ${LEAF_CX[2]} 165 ${LEAF_CX[2]} ${LEAF_Y}`,
  ];

  // Each label sits just outside its own branch, with enough clearance for the
  // full "weight = NN%" wording so the three never collide.
  const edgeLabelX = [189, 368, 531];
  const edgeLabelAnchor = ["end", "start", "start"] as const;
  const edgeLabelY = [150, 150, 150];

  const total = branches.reduce((sum, b) => sum + b.weight * b.ev, 0);
  const ref = Math.max(...branches.map((b) => Math.abs(b.weight * b.ev)), 0.01);

  return (
    <ChartFrame label={label} caption={caption}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Decision tree: one hero action priced against three opponent pools, weighted by how often each is met"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {edges.map((d, i) => (
          <path key={`edge-${i}`} d={d} fill="none" stroke={toneFor(branches[i].ev)} strokeWidth={1.5} opacity={0.55} />
        ))}

        {branches.map((b, i) => (
          <text
            key={`edge-label-${b.name}`}
            x={edgeLabelX[i]}
            y={edgeLabelY[i]}
            textAnchor={edgeLabelAnchor[i]}
            {...mono}
            fontSize={10}
            fill="var(--text-secondary)"
          >
            {`weight = ${Math.round(b.weight * 100)}%`}
          </text>
        ))}

        <rect x={ROOT.x} y={ROOT.y} width={ROOT.w} height={ROOT.h} rx={9} fill="var(--surface)" stroke="var(--border)" strokeWidth={1.5} />
        <text x={rootCx} y={ROOT.y + 24} textAnchor="middle" {...mono} fontSize={12} fontWeight={600} fill="var(--text-primary)">
          {root}
        </text>
        <text x={rootCx} y={ROOT.y + 41} textAnchor="middle" {...mono} fontSize={9.5} fill="var(--text-faint)">
          GTO baseline: 50% of the time
        </text>

        {branches.map((b, i) => {
          const tone = toneFor(b.ev);
          return (
            <g key={b.name}>
              <rect
                x={LEAF_X[i]}
                y={LEAF_Y}
                width={LEAF_W}
                height={LEAF_H}
                rx={9}
                fill="var(--surface)"
                stroke={tone}
                strokeWidth={1.5}
                opacity={0.95}
              />
              <text x={LEAF_CX[i]} y={LEAF_Y + 30} textAnchor="middle" {...mono} fontSize={11.5} fontWeight={600} fill="var(--text-primary)">
                {b.name}
              </text>
              <text x={LEAF_CX[i]} y={LEAF_Y + 52} textAnchor="middle" {...mono} fontSize={9.5} fill="var(--text-faint)">
                {`bluffs ${Math.round(b.bluff * 100)}%`}
              </text>
              <text x={LEAF_CX[i]} y={LEAF_Y + 76} textAnchor="middle" {...mono} fontSize={14} fontWeight={700} fill={tone}>
                {`EV ${signed(b.ev)} pot`}
              </text>
              <text x={LEAF_CX[i]} y={LEAF_Y + 94} textAnchor="middle" {...mono} fontSize={9.5} fill={tone}>
                {actionFor(b.ev)}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: "0.9em", display: "flex", flexDirection: "column", gap: "0.45em" }}>
        {branches.map((b) => {
          const contribution = b.weight * b.ev;
          const tone = toneFor(contribution);
          const widthPct = (Math.abs(contribution) / ref) * 46;
          return (
            <div
              key={`sum-${b.name}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(6.5rem, 8rem) 1fr minmax(4.5rem, 5.5rem)",
                alignItems: "center",
                gap: "0.75em",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.68rem",
                  color: "var(--text-secondary)",
                  textAlign: "right",
                }}
              >
                {b.name}
              </span>
              <div
                style={{
                  position: "relative",
                  height: "0.85rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "3px",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "50%",
                    width: "1px",
                    background: "var(--border)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    bottom: "2px",
                    left: contribution >= 0 ? "50%" : "auto",
                    right: contribution < 0 ? "50%" : "auto",
                    width: `${Math.max(widthPct, 1.5)}%`,
                    background: tone,
                    borderRadius: "2px",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                  color: tone,
                  textAlign: "left",
                }}
              >
                {signed(contribution)}
              </span>
            </div>
          );
        })}

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            color: "var(--text-faint)",
            marginTop: "0.25em",
          }}
        >
          weight × EV → pool-weighted EV ={" "}
          <span style={{ color: total < 0 ? "var(--tone-bad)" : "var(--tone-good)", fontWeight: 700 }}>
            {signed(total)} pot
          </span>
        </div>
      </div>

    </ChartFrame>
  );
}
