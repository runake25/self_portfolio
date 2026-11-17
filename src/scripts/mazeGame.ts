/**
 * Play mode: steer the maze ball yourself.
 *
 * Loaded with a dynamic import() only when someone starts a game, so visitors
 * who never play never download it. Each key press rolls the ball until the next
 * junction (where it brakes) or wall (where it bounces), using the same physics
 * as the autopilot. Arrow keys / WASD, or click the side of the ball you want it
 * to roll to. Esc (or showing the interface again) quits.
 */
import { setUiHidden } from "./chrome";
import { DIRS, cellCenter, entryPoint, exitPoint, feelFor, wallAhead, type Dir, type Maze, type MazeHost } from "./maze";
import { watchLens } from "./liquidGlass";
import { Timeline, type LegEnd } from "./mazeMotion";

const KEYS: Record<string, Dir> = {
  ArrowUp: DIRS.up,
  ArrowRight: DIRS.right,
  ArrowDown: DIRS.down,
  ArrowLeft: DIRS.left,
  w: DIRS.up,
  d: DIRS.right,
  s: DIRS.down,
  a: DIRS.left,
};

interface Move {
  endCell: number;
  cells: number;
  end: LegEnd;
}

/** Roll from `cell` in direction `dir` until a wall, a junction, or the exit. */
function planMove(m: Maze, cell: number, dir: Dir): Move {
  const last = m.columns * m.rows - 1;
  const v = { x: dir.dx, y: dir.dy };
  const sideOpen = (c: number) =>
    Object.values(DIRS).some((d) => d.dx !== dir.dx && d.dy !== dir.dy && !(m.walls[c] & d.bit));

  let current = cell;
  let cells = 0;
  for (;;) {
    if (current === last && dir === DIRS.right) return { endCell: current, cells, end: "exit" };
    // The entrance has no wall drawn, but the ball may not leave that way.
    if (wallAhead(m, current, v) || (current === 0 && dir === DIRS.left)) return { endCell: current, cells, end: "wall" };
    current += dir.dx + dir.dy * m.columns;
    cells++;
    if (sideOpen(current) && !wallAhead(m, current, v)) return { endCell: current, cells, end: "stop" };
  }
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function startGame(host: MazeHost): () => void {
  const root = document.documentElement;
  const hadUiHidden = root.dataset.uiHidden === "true";
  if (!hadUiHidden) setUiHidden(true);

  let maze = host.maze();
  let cell = 0;
  let moving = true;
  let queued: Dir | null = null;
  let moves = 0;
  let solved = 0;
  let startedAt = performance.now();
  let banner = "";
  let ended = false;

  // ── HUD ──
  const hud = document.createElement("div");
  hud.className = "maze-hud";
  hud.setAttribute("role", "status");
  const stats = document.createElement("span");
  const help = document.createElement("span");
  help.className = "maze-hud-help";
  help.textContent = "arrows / wasd / click · esc to quit";
  hud.append(stats, help);
  hud.dataset.lens = "10";
  document.body.append(hud);
  watchLens(hud);
  const render = () => {
    stats.textContent = banner || `maze ${solved + 1} · moves ${moves} · ${clock(performance.now() - startedAt)}`;
  };
  render();
  const timer = window.setInterval(render, 1000);

  // ── Movement ──
  const enter = async () => {
    moving = true;
    cell = 0;
    const start = entryPoint(maze);
    const first = cellCenter(maze, 0);
    const timeline = new Timeline(start, feelFor(maze), false)
      .fade(1, 0.35)
      .leg({ x: 1, y: 0 }, first.x - start.x, wallAhead(maze, 0, { x: 1, y: 0 }) ? "wall" : "stop");
    if (!(await host.run(timeline))) return;
    moving = false;
    flush();
  };

  const move = async (dir: Dir) => {
    if (ended) return;
    if (moving) {
      queued = dir; // remember the latest press; it runs as soon as the ball settles
      return;
    }
    moving = true;
    const plan = planMove(maze, cell, dir);
    const from = cellCenter(maze, cell);
    const v = { x: dir.dx, y: dir.dy };
    const length = plan.end === "exit" ? exitPoint(maze).x - from.x : plan.cells * maze.cellSize;
    if (plan.cells > 0 || plan.end === "exit") moves++;
    render();

    if (!(await host.run(new Timeline(from, feelFor(maze)).leg(v, length, plan.end)))) return;
    cell = plan.endCell;

    if (plan.end === "exit") {
      solved++;
      banner = `solved in ${moves} moves · ${clock(performance.now() - startedAt)}`;
      render();
      window.setTimeout(() => {
        banner = "";
        moves = 0;
        startedAt = performance.now();
        render();
      }, 2600);
      maze = host.nextMaze();
      await enter();
      return;
    }
    moving = false;
    flush();
  };

  const flush = () => {
    if (!queued) return;
    const next = queued;
    queued = null;
    void move(next);
  };

  // ── Input ──
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as Element).closest("input, textarea, select, dialog")) return;
    if (event.key === "Escape") {
      quit();
      return;
    }
    const dir = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!dir) return;
    event.preventDefault(); // keep arrow keys from scrolling the page
    void move(dir);
  };

  const onClick = (event: MouseEvent) => {
    if ((event.target as Element).closest("a, button, input, textarea, select, dialog, .site-shell, .maze-hud")) return;
    const at = cellCenter(maze, cell);
    const dx = event.clientX - at.x;
    const dy = event.clientY - at.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < maze.cellSize * 0.3) return;
    void move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : dy > 0 ? DIRS.down : DIRS.up);
  };

  // The ClientRouter swaps <body> when you navigate; put the HUD back afterwards.
  const keepHud = () => document.body.append(hud);

  const onUiChange = () => {
    if (root.dataset.uiHidden !== "true") quit();
  };

  function quit() {
    if (ended) return;
    ended = true;
    window.clearInterval(timer);
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("click", onClick);
    document.removeEventListener("ui-visibility-change", onUiChange);
    document.removeEventListener("astro:after-swap", keepHud);
    hud.remove();
    if (!hadUiHidden && root.dataset.uiHidden === "true") setUiHidden(false);
    host.end();
  }

  window.addEventListener("keydown", onKey, true);
  // Bind clicks on the next tick, so the click that started the game doesn't count as a move.
  window.setTimeout(() => !ended && document.addEventListener("click", onClick), 0);
  document.addEventListener("ui-visibility-change", onUiChange);
  document.addEventListener("astro:after-swap", keepHud);

  void enter();
  return quit;
}
