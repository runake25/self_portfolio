/**
 * Ball physics for the background maze, compiled into Web Animations.
 *
 * The ball moves in straight "legs". Each leg is simple 1D physics:
 *
 *   rest ──accelerate──▶ (cruise) ──▶ hits the wall ──▶ rebounds, slowed by
 *   friction, back to the cell centre ──▶ waits a moment ──▶ next leg
 *
 * or, when the corridor is open ahead (a junction), it brakes to a stop instead.
 *
 * The trick that keeps this free at runtime: every phase has CONSTANT acceleration,
 * and constant acceleration traces a quadratic curve, which a CSS cubic-bezier can
 * represent EXACTLY. With x(t) linear, a quadratic y(t) has control points
 *
 *     cubic-bezier(1/3, v0·T / 3S, 2/3, 1 − v1·T / 3S)
 *
 * (v0/v1 = speed at start/end, T = duration, S = distance). So a whole run becomes a
 * handful of keyframes, each with its own easing, and the browser's compositor plays
 * it: no requestAnimationFrame loop and no JavaScript per frame.
 *
 * Three animations run in lockstep on the ball's three layers:
 *   position (outer element) · squash-and-stretch + fade (core) · impact ripple (ring)
 */

export interface Vec {
  x: number;
  y: number;
}

export type LegEnd = "wall" | "stop" | "exit";

export interface BallParts {
  ball: HTMLElement;
  core: HTMLElement;
  ring: HTMLElement;
}

export interface Feel {
  cell: number; // cell size in px; all speeds scale with it
  radius: number; // ball radius in px
  random: () => number;
}

interface PosKey {
  t: number;
  x: number;
  y: number;
  easing: string;
}
interface BodyKey {
  t: number;
  sx: number;
  sy: number;
  o: number;
  easing: string;
}
interface RingKey {
  t: number;
  dx: number;
  dy: number;
  s: number;
  o: number;
  easing: string;
}

const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.3, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.55, 1)";
const f = (n: number) => +n.toFixed(4);

/** Exact easing for a constant-acceleration move from speed v0 to v1 over distance s in time t. */
function quadEasing(v0: number, v1: number, t: number, s: number) {
  return `cubic-bezier(0.3333, ${f((v0 * t) / (3 * s))}, 0.6667, ${f(1 - (v1 * t) / (3 * s))})`;
}

export class Timeline {
  private t = 0;
  private x: number;
  private y: number;
  private opacity: number;
  private pos: PosKey[];
  private body: BodyKey[];
  private ring: RingKey[];

  constructor(
    start: Vec,
    private feel: Feel,
    visible = true,
  ) {
    this.x = start.x;
    this.y = start.y;
    this.opacity = visible ? 1 : 0;
    this.pos = [{ t: 0, x: start.x, y: start.y, easing: "linear" }];
    this.body = [{ t: 0, sx: 1, sy: 1, o: this.opacity, easing: "linear" }];
    this.ring = [{ t: 0, dx: 0, dy: 0, s: 0.4, o: 0, easing: "linear" }];
  }

  get duration() {
    return this.t;
  }

  get position(): Vec {
    return { x: this.x, y: this.y };
  }

  /** One constant-acceleration phase: speed v0 → v1 over `dist` px along `dir`. */
  private phase(dir: Vec, dist: number, v0: number, v1: number) {
    if (dist < 0.01 || v0 + v1 <= 0) return;
    const duration = (2 * dist) / (v0 + v1);
    this.pos[this.pos.length - 1].easing = quadEasing(v0, v1, duration, dist);
    this.t += duration;
    this.x += dir.x * dist;
    this.y += dir.y * dist;
    this.pos.push({ t: this.t, x: this.x, y: this.y, easing: "linear" });
  }

  pause(seconds: number) {
    this.t += seconds;
    this.pos.push({ t: this.t, x: this.x, y: this.y, easing: "linear" });
    return this;
  }

  fade(to: 0 | 1, seconds: number) {
    this.holdBody(this.t);
    this.t += seconds;
    this.opacity = to;
    this.body.push({ t: this.t, sx: 1, sy: 1, o: to, easing: "linear" });
    this.pos.push({ t: this.t, x: this.x, y: this.y, easing: "linear" });
    return this;
  }

  /** Make sure the squash track sits at rest right up to time `t`. */
  private holdBody(t: number) {
    const last = this.body[this.body.length - 1];
    if (t > last.t) this.body.push({ t, sx: 1, sy: 1, o: this.opacity, easing: "linear" });
  }

  /** Squash against the wall and send out a ripple from the contact point. */
  private impact(dir: Vec, strength: number) {
    const { radius } = this.feel;
    const k = 0.1 + 0.24 * strength;
    const across = 1 + k * 0.6;
    const along = 1 - k;
    const [sx, sy] = dir.x !== 0 ? [along, across] : [across, along];
    const [ox, oy] = dir.x !== 0 ? [1 + k * 0.35, 1 - k * 0.2] : [1 - k * 0.2, 1 + k * 0.35];

    const t = this.t;
    const lead = Math.min(0.035, Math.max(0, t - this.body[this.body.length - 1].t));
    this.holdBody(t - lead);
    this.body[this.body.length - 1].easing = "cubic-bezier(0.5, 0, 1, 1)";
    this.body.push({ t, sx, sy, o: this.opacity, easing: EASE_OUT });
    this.body.push({ t: t + 0.09, sx: ox, sy: oy, o: this.opacity, easing: EASE_IN_OUT });
    this.body.push({ t: t + 0.22, sx: 1, sy: 1, o: this.opacity, easing: "linear" });

    const dx = dir.x * radius;
    const dy = dir.y * radius;
    const lastRing = this.ring[this.ring.length - 1];
    if (t > lastRing.t) this.ring.push({ t, dx, dy, s: 0.35, o: 0, easing: "linear" });
    this.ring.push({ t: t + 0.001, dx, dy, s: 0.45, o: 0.25 + 0.5 * strength, easing: EASE_OUT });
    this.ring.push({ t: t + 0.42, dx, dy, s: 2.6, o: 0, easing: "linear" });
  }

  /**
   * Roll `length` px along `dir` (a unit vector on one axis), starting from rest.
   * `end` decides what happens at the far end: bounce off a wall, brake to a stop
   * at a junction, or roll out of the exit and fade away.
   */
  leg(dir: Vec, length: number, end: LegEnd) {
    const { cell, radius, random } = this.feel;
    const vmax = cell * (3 + random() * 1.4); // px/s; a little different every leg
    const accel = cell * (3.2 + random() * 1.6);

    if (end === "wall") {
      // Roll until the ball's edge touches the wall line, half a cell past the centre.
      const gap = Math.max(1.5, cell / 2 - radius - 1);
      const toWall = length + gap;
      const accelDist = (vmax * vmax) / (2 * accel);
      let hitSpeed: number;
      if (accelDist >= toWall) {
        hitSpeed = Math.sqrt(2 * accel * toWall);
        this.phase(dir, toWall, 0, hitSpeed);
      } else {
        hitSpeed = vmax;
        this.phase(dir, accelDist, 0, vmax);
        this.phase(dir, toWall - accelDist, vmax, vmax);
      }
      this.impact(dir, Math.min(1, hitSpeed / (cell * 4)));

      // Rebound: lose energy (restitution 0.4–0.6), then roll back to the centre,
      // where friction brings it to rest.
      const restitution = 0.4 + random() * 0.2;
      const back = { x: -dir.x, y: -dir.y };
      const reboundSpeed = Math.max(hitSpeed * restitution, gap * 5);
      this.phase(back, gap, reboundSpeed, 0);
      this.pause(0.25 + random() * 0.5);
      return this;
    }

    // Trapezoid profile: accelerate, maybe cruise, then brake to a stop at `length`.
    const brake = cell * (5 + random() * 2);
    const accelDist = (vmax * vmax) / (2 * accel);
    const brakeDist = (vmax * vmax) / (2 * brake);
    if (accelDist + brakeDist <= length) {
      this.phase(dir, accelDist, 0, vmax);
      this.phase(dir, length - accelDist - brakeDist, vmax, vmax);
      this.phase(dir, brakeDist, vmax, 0);
    } else {
      const peak = Math.sqrt((2 * accel * brake * length) / (accel + brake));
      this.phase(dir, (peak * peak) / (2 * accel), 0, peak);
      this.phase(dir, (peak * peak) / (2 * brake), peak, 0);
    }
    if (end === "exit") this.fade(0, 0.5);
    else this.pause(0.08 + random() * 0.22);
    return this;
  }

  /** Start the three synchronized animations. Index 0 is the position track. */
  animate({ ball, core, ring }: BallParts): Animation[] {
    const total = Math.max(this.t, 0.001);
    const close = <K extends { t: number }>(keys: K[]) => {
      const last = keys[keys.length - 1];
      if (last.t < total) keys.push({ ...last, t: total, easing: "linear" });
      let prev = 0;
      return keys.map((k) => {
        prev = Math.min(1, Math.max(prev, k.t / total));
        return { offset: prev, k };
      });
    };
    const timing: KeyframeAnimationOptions = { duration: total * 1000, fill: "forwards" };

    return [
      ball.animate(
        close(this.pos).map(({ offset, k }) => ({
          offset,
          easing: k.easing,
          transform: `translate3d(${f(k.x)}px, ${f(k.y)}px, 0)`,
        })),
        timing,
      ),
      core.animate(
        close(this.body).map(({ offset, k }) => ({
          offset,
          easing: k.easing,
          transform: `scale(${f(k.sx)}, ${f(k.sy)})`,
          opacity: k.o,
        })),
        timing,
      ),
      ring.animate(
        close(this.ring).map(({ offset, k }) => ({
          offset,
          easing: k.easing,
          transform: `translate(${f(k.dx)}px, ${f(k.dy)}px) scale(${f(k.s)})`,
          opacity: k.o,
        })),
        timing,
      ),
    ];
  }
}
