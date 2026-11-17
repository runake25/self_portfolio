/**
 * Background maze: a random maze is generated (Kruskal) and solved (A*). A ball
 * then WANDERS towards the exit: it follows the solution but sometimes takes a
 * wrong turn into a side branch, rolls to the dead end, bounces off the wall,
 * waits, and heads back. When it rolls out of the exit, the next maze is built.
 * With the interface hidden you can click the maze to steer the ball yourself
 * (see mazeGame.ts, which is only downloaded when you do).
 *
 * How it stays cheap:
 * - Walls are static, so they are drawn to the canvas ONCE per maze (and again
 *   on theme change / resize). Previously every wall was re-stroked every frame.
 * - The ball's physics (mazeMotion.ts) is computed up front and handed to the
 *   browser as Web Animations, which the compositor plays with no JavaScript
 *   running per frame.
 * - Playback pauses when the maze is covered (phone layout, where the UI shell
 *   fills the viewport), with reduced motion, or in a background tab.
 * - Window resizes are debounced instead of rebuilding the maze on every event.
 */
import { getTheme, onThemeChange } from "./theme";
import { Timeline, type BallParts, type Feel, type LegEnd, type Vec } from "./mazeMotion";

export interface Maze {
  columns: number;
  rows: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
  walls: Uint8Array; // 4 bits per cell: top, right, bottom, left
  path: number[]; // solution, as cell indices from the entrance to the exit
  ballRadius: number;
}

const TOP = 1;
const RIGHT = 2;
const BOTTOM = 4;
const LEFT = 8;

// The phone layout's UI shell is opaque and full-screen, so the maze is invisible there.
const shellCoversViewport = window.matchMedia("(max-width: 940px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ── Seeded randomness ─────────────────────────────────────────────────────────
// Seeded so each visitor gets their own stable sequence of mazes.

function hashString(input: string) {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function createPrng(seed: number) {
  let state = seed >>> 0; // mulberry32
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

const nextSeed = (seed: number) => ((seed + 0x9e3779b9) >>> 0) || 1;

// ── Generation: randomized Kruskal with union-find ────────────────────────────

function carveMaze(columns: number, rows: number, random: () => number) {
  const total = columns * rows;
  const walls = new Uint8Array(total).fill(TOP | RIGHT | BOTTOM | LEFT);
  const parent = new Int32Array(total).map((_, i) => i);

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path halving
      i = parent[i];
    }
    return i;
  };

  // Edges between neighbouring cells: [a, b, wall on a, wall on b]
  const edges: [number, number, number, number][] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const i = row * columns + col;
      if (col < columns - 1) edges.push([i, i + 1, RIGHT, LEFT]);
      if (row < rows - 1) edges.push([i, i + columns, BOTTOM, TOP]);
    }
  }

  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  for (const [a, b, wallA, wallB] of edges) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) continue;
    parent[rootA] = rootB;
    walls[a] &= ~wallA;
    walls[b] &= ~wallB;
  }

  return walls;
}

// ── Solving: A* with a Manhattan heuristic and a binary heap ──────────────────

function solveMaze(walls: Uint8Array, columns: number, rows: number) {
  const total = columns * rows;
  const target = total - 1;
  const targetRow = rows - 1;
  const targetCol = columns - 1;
  const h = (i: number) => Math.abs((i % columns) - targetCol) + Math.abs(Math.floor(i / columns) - targetRow);

  const g = new Float64Array(total).fill(Infinity);
  const f = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const inOpen = new Uint8Array(total);
  const heap: number[] = [0];
  g[0] = 0;
  f[0] = h(0);
  inOpen[0] = 1;

  const push = (node: number) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (f[heap[p]] <= f[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };

  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < heap.length && f[heap[l]] < f[heap[s]]) s = l;
        if (r < heap.length && f[heap[r]] < f[heap[s]]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };

  while (heap.length) {
    const current = pop();
    inOpen[current] = 0;
    if (current === target) {
      const path: number[] = [];
      for (let node = target; node !== -1; node = cameFrom[node]) path.push(node);
      return path.reverse();
    }

    const row = Math.floor(current / columns);
    const col = current % columns;
    const w = walls[current];
    const neighbors: number[] = [];
    if (!(w & TOP) && row > 0) neighbors.push(current - columns);
    if (!(w & RIGHT) && col < columns - 1) neighbors.push(current + 1);
    if (!(w & BOTTOM) && row < rows - 1) neighbors.push(current + columns);
    if (!(w & LEFT) && col > 0) neighbors.push(current - 1);

    for (const next of neighbors) {
      const tentative = g[current] + 1;
      if (tentative < g[next]) {
        cameFrom[next] = current;
        g[next] = tentative;
        f[next] = tentative + h(next);
        if (!inOpen[next]) {
          inOpen[next] = 1;
          push(next);
        }
      }
    }
  }
  return [0];
}
function buildMaze(seed: number, width: number, height: number): Maze {
  const random = createPrng(seed);
  const baseCell = clamp(Math.round(Math.min(width, height) / 12), 24, 56);
  const columns = clamp(Math.floor((width - 80) / baseCell), 8, 26);
  const rows = clamp(Math.floor((height - 80) / baseCell), 6, 18);
  const cellSize = Math.max(18, Math.min((width - 80) / columns, (height - 80) / rows));
  const offsetX = (width - columns * cellSize) / 2;
  const offsetY = (height - rows * cellSize) / 2;

  const walls = carveMaze(columns, rows, random);
  walls[0] &= ~LEFT; // entrance
  walls[columns * rows - 1] &= ~RIGHT; // exit

  return {
    columns,
    rows,
    cellSize,
    offsetX,
    offsetY,
    walls,
    path: solveMaze(walls, columns, rows),
    ballRadius: clamp(cellSize * 0.17, 4.5, 9),
  };
}

// ── Geometry helpers (shared with mazeGame.ts) ────────────────────────────────

export interface Dir {
  bit: number;
  dx: number;
  dy: number;
}

export const DIRS: Record<"up" | "right" | "down" | "left", Dir> = {
  up: { bit: TOP, dx: 0, dy: -1 },
  right: { bit: RIGHT, dx: 1, dy: 0 },
  down: { bit: BOTTOM, dx: 0, dy: 1 },
  left: { bit: LEFT, dx: -1, dy: 0 },
};

export const cellCenter = (m: Maze, cell: number): Vec => ({
  x: m.offsetX + ((cell % m.columns) + 0.5) * m.cellSize,
  y: m.offsetY + (Math.floor(cell / m.columns) + 0.5) * m.cellSize,
});

/** Just outside the entrance (left of the top-left cell). */
export const entryPoint = (m: Maze): Vec => ({ x: m.offsetX - m.cellSize * 0.75, y: m.offsetY + m.cellSize / 2 });

/** Just outside the exit (right of the bottom-right cell). */
export const exitPoint = (m: Maze): Vec => ({
  x: m.offsetX + (m.columns + 0.9) * m.cellSize,
  y: m.offsetY + (m.rows - 0.5) * m.cellSize,
});

const dirBit = (d: Vec) => (d.x > 0 ? RIGHT : d.x < 0 ? LEFT : d.y > 0 ? BOTTOM : TOP);
export const wallAhead = (m: Maze, cell: number, d: Vec) => (m.walls[cell] & dirBit(d)) !== 0;

function openNeighbors(m: Maze, cell: number) {
  const col = cell % m.columns;
  const row = Math.floor(cell / m.columns);
  const out: number[] = [];
  for (const d of Object.values(DIRS)) {
    const c = col + d.dx;
    const r = row + d.dy;
    if (!(m.walls[cell] & d.bit) && c >= 0 && r >= 0 && c < m.columns && r < m.rows) out.push(r * m.columns + c);
  }
  return out;
}

export const feelFor = (m: Maze, random: () => number = Math.random): Feel => ({
  cell: m.cellSize,
  radius: m.ballRadius,
  random,
});

// ── Autopilot: wander towards the exit ────────────────────────────────────────

/**
 * The solution path plus random detours: at some cells the ball turns into a
 * side branch, follows it to a dead end (at most 6 cells deep) and comes back.
 */
function wanderRoute(m: Maze, random: () => number) {
  const { path } = m;
  const route = [path[0]];
  const maxDetours = 2 + Math.floor(path.length / 8);
  let detours = 0;

  const deadEndWalk = (start: number, from: number) => {
    const walk = [start];
    let prev = from;
    for (;;) {
      const here = walk[walk.length - 1];
      const options = openNeighbors(m, here).filter((n) => n !== prev);
      if (options.length === 0) return walk;
      if (walk.length >= 6) return null;
      prev = here;
      walk.push(options[Math.floor(random() * options.length)]);
    }
  };

  for (let k = 0; k < path.length; k++) {
    const cell = path[k];
    if (k > 0) route.push(cell);
    if (detours >= maxDetours || random() > 0.5) continue;
    for (const side of openNeighbors(m, cell)) {
      if (side === path[k - 1] || side === path[k + 1]) continue;
      const walk = deadEndWalk(side, cell);
      if (!walk) continue;
      route.push(...walk, ...walk.slice(0, -1).reverse(), cell);
      detours++;
      break;
    }
  }
  return route;
}

/** Turn the route into straight legs, each ending in a bounce, a stop, or the exit. */
function planAutopilot(m: Maze, random: () => number) {
  const cells = wanderRoute(m, random);
  const points = [entryPoint(m), ...cells.map((c) => cellCenter(m, c)), exitPoint(m)];
  const unit = (a: Vec, b: Vec) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  };

  const timeline = new Timeline(points[0], feelFor(m, random), false).fade(1, 0.6);
  let i = 0;
  while (i < points.length - 1) {
    const dir = unit(points[i], points[i + 1]);
    let j = i + 1;
    while (j < points.length - 1) {
      const next = unit(points[j], points[j + 1]);
      if (next.x * dir.x + next.y * dir.y < 0.99) break;
      j++;
    }
    const length = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
    // points[j] is cells[j - 1], because points[0] is the entry point outside the maze.
    const end: LegEnd = j === points.length - 1 ? "exit" : wallAhead(m, cells[j - 1], dir) ? "wall" : "stop";
    timeline.leg(dir, length, end);
    i = j;
  }
  return timeline;
}

// ── Runtime ───────────────────────────────────────────────────────────────────

const root = document.documentElement;
let canvas: HTMLCanvasElement | null = null;
let parts: BallParts | null = null;
let maze: Maze | null = null;
let anims: Animation[] = [];
let seed = 1;
let playing = false;
let stopGame: (() => void) | null = null;

const isVisible = () => !shellCoversViewport.matches || root.dataset.uiHidden === "true";
const shouldRun = () => isVisible() && (playing || !reducedMotion.matches);

function drawWalls() {
  if (!canvas || !maze) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = getTheme() === "day" ? "rgba(10, 10, 10, 0.16)" : "rgba(255, 255, 255, 0.14)";
  context.lineWidth = 1.45;
  context.lineCap = "round";

  const { columns, rows, cellSize: size, offsetX, offsetY, walls } = maze;
  context.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const w = walls[row * columns + col];
      const x = offsetX + col * size;
      const y = offsetY + row * size;
      // Each shared wall is stored on both cells; draw top/left always and
      // right/bottom only on the outer edge so no line is stroked twice.
      if (w & TOP) {
        context.moveTo(x, y);
        context.lineTo(x + size, y);
      }
      if (w & LEFT) {
        context.moveTo(x, y);
        context.lineTo(x, y + size);
      }
      if (w & RIGHT && col === columns - 1) {
        context.moveTo(x + size, y);
        context.lineTo(x + size, y + size);
      }
      if (w & BOTTOM && row === rows - 1) {
        context.moveTo(x, y + size);
        context.lineTo(x + size, y + size);
      }
    }
  }
  context.stroke();
}

function rebuild() {
  maze = buildMaze(seed, window.innerWidth, window.innerHeight);
  drawWalls();
  parts?.ball.style.setProperty("--ball-size", `${maze.ballRadius * 2}px`);
  return maze;
}

function stopAnims() {
  for (const a of anims) a.cancel();
  anims = [];
}

/** Play a timeline. Resolves true if it ran to the end, false if something replaced it. */
function run(timeline: Timeline): Promise<boolean> {
  stopAnims();
  if (!parts) return Promise.resolve(false);
  const started = timeline.animate(parts);
  anims = started;
  syncPlayback();
  return started[0].finished.then(
    () => anims === started,
    () => false,
  );
}

// Pause (not cancel) while hidden, so the ball resumes where it left off.
function syncPlayback() {
  const go = shouldRun();
  for (const a of anims) {
    if (go && a.playState === "paused") a.play();
    else if (!go && a.playState === "running") a.pause();
  }
}

async function autopilot() {
  if (!maze || !parts || playing) return;
  if (reducedMotion.matches) {
    // Static maze; the ball rests at the entrance.
    stopAnims();
    const start = cellCenter(maze, 0);
    parts.ball.style.transform = `translate3d(${start.x}px, ${start.y}px, 0)`;
    return;
  }
  const finished = await run(planAutopilot(maze, createPrng(seed ^ 0x5bd1e995)));
  if (finished && !playing) {
    seed = nextSeed(seed);
    rebuild();
    void autopilot();
  }
}

// ── Play mode (the easter egg) ────────────────────────────────────────────────

export interface MazeHost {
  maze: () => Maze;
  run: (timeline: Timeline) => Promise<boolean>;
  nextMaze: () => Maze;
  end: () => void;
}

const host: MazeHost = {
  maze: () => maze!,
  run,
  nextMaze: () => {
    seed = nextSeed(seed);
    return rebuild();
  },
  end: () => {
    playing = false;
    stopGame = null;
    delete root.dataset.mazePlaying;
    void autopilot();
  },
};

export async function startPlay() {
  // Needs the wide layout (on phones the maze is covered) and a built maze.
  if (playing || !maze || !parts || shellCoversViewport.matches) return;
  playing = true;
  root.dataset.mazePlaying = "true";
  const { startGame } = await import("./mazeGame");
  stopGame = startGame(host);
}

export function initMaze() {
  canvas = document.querySelector<HTMLCanvasElement>("[data-maze-canvas]");
  const ball = document.querySelector<HTMLElement>("[data-maze-ball]");
  const core = ball?.querySelector<HTMLElement>(".maze-ball-core");
  const ring = ball?.querySelector<HTMLElement>(".maze-ball-ring");
  if (!canvas || !ball || !core || !ring) return;
  parts = { ball, core, ring };

  seed = hashString(
    [navigator.userAgent, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|"),
  );

  onThemeChange(drawWalls);
  shellCoversViewport.addEventListener("change", () => {
    if (shellCoversViewport.matches) stopGame?.();
    syncPlayback();
  });
  reducedMotion.addEventListener("change", () => {
    if (!playing) void autopilot();
  });
  document.addEventListener("ui-visibility-change", syncPlayback);
  document.addEventListener("maze:play", () => void startPlay());

  // With the interface hidden, the whole screen is maze: a click starts the game.
  document.addEventListener("click", (event) => {
    if (playing || root.dataset.uiHidden !== "true") return;
    if ((event.target as Element).closest("a, button, input, textarea, select, dialog, .site-shell")) return;
    void startPlay();
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      stopGame?.();
      rebuild();
      void autopilot();
    }, 150);
  });

  rebuild();
  void autopilot();
}
