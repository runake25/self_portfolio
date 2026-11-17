/**
 * Liquid glass: real refraction for a few floating controls.
 *
 * Elements marked [data-lens] bend whatever sits behind their rim, the way a
 * thick piece of curved glass does: near the edge you see the background
 * stretched in from further inside. Each element gets an SVG displacement filter
 * shaped like its own rounded rectangle (the map is drawn once per size on a
 * canvas), chained in front of its frosted blur. The GPU applies it as part of
 * the element's backdrop-filter, so it costs nothing per frame in JavaScript.
 *
 * Only Chromium can use an SVG filter as a backdrop-filter. Every other browser,
 * and anyone who asked for less transparency, keeps the plain frosted glass.
 * `data-lens="14"` sets how deep (px) the bent rim reaches; default 12.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

let svg: SVGSVGElement | null = null;
let observer: ResizeObserver | null = null;
const filters = new Map<HTMLElement, SVGFilterElement>();
const maps = new Map<string, string>();
let nextId = 0;

const supported = () =>
  "userAgentData" in navigator && !matchMedia("(prefers-reduced-transparency: reduce)").matches;

/**
 * Displacement map for a rounded rectangle: R/G encode how far (x/y) to look for
 * the background. Neutral (128) in the middle; within `bezel` px of the edge it
 * points inward, strongest right at the rim and easing to nothing.
 */
function displacementMap(w: number, h: number, r: number, bezel: number) {
  const key = `${w}x${h}r${r}b${bezel}`;
  const cached = maps.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(w, h);
  const { data } = image;
  const hx = w / 2 - r;
  const hy = h / 2 - r;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      // Depth inside the shape, and the outward normal of the nearest edge.
      let depth: number;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        depth = r - len;
        nx = qx / len;
        ny = qy / len;
      } else if (qx > qy) {
        depth = r - qx;
        nx = 1;
      } else {
        depth = r - qy;
        ny = 1;
      }
      let dx = 0;
      let dy = 0;
      if (depth > 0 && depth < bezel) {
        const k = 1 - depth / bezel;
        const m = k * k;
        dx = -Math.sign(px) * nx * m;
        dy = -Math.sign(py) * ny * m;
      }
      const i = (y * w + x) * 4;
      data[i] = 128 + dx * 127;
      data[i + 1] = 128 + dy * 127;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  maps.set(key, url);
  return url;
}

function ensureSvg() {
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  }
  if (!svg.isConnected) document.body.append(svg);
  return svg;
}

function apply(el: HTMLElement) {
  el.classList.add("lens-on");
  el.style.removeProperty("backdrop-filter");
  const style = getComputedStyle(el);
  const base = style.backdropFilter;
  const w = Math.round(el.offsetWidth);
  const h = Math.round(el.offsetHeight);
  // Only where this element is actually glass right now (e.g. the tab bar on phones).
  if (!base || base === "none" || !w || !h) {
    el.classList.remove("lens-on");
    return;
  }

  const r = Math.min(parseFloat(style.borderTopLeftRadius) || 0, w / 2, h / 2);
  const bezel = Math.min(Number(el.dataset.lens) || 12, h / 2);
  const map = displacementMap(w, h, Math.round(r), Math.round(bezel));
  if (!map) return;

  let filter = filters.get(el);
  if (!filter) {
    filter = document.createElementNS(SVG_NS, "filter");
    filter.id = `lens-${++nextId}`;
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filters.set(el, filter);
  }
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", String(w));
  filter.setAttribute("height", String(h));
  filter.innerHTML =
    `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(bezel * 1.4).toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>`;
  ensureSvg().append(filter);
  el.style.backdropFilter = `url(#${filter.id}) ${base}`;
}

/** Start refracting an element added after page load (e.g. the maze HUD). */
export function watchLens(el: HTMLElement) {
  observer?.observe(el);
}

export function initLiquidGlass() {
  if (!supported()) return;
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) apply(entry.target as HTMLElement);
  });

  const scan = () => {
    // Drop filters whose element left with the previous page.
    for (const [el, filter] of filters) {
      if (!el.isConnected) {
        filter.remove();
        filters.delete(el);
        observer?.unobserve(el);
      }
    }
    for (const el of document.querySelectorAll<HTMLElement>("[data-lens]")) observer?.observe(el);
  };

  // The page swap replaces <body>; put the filters back before the new page paints.
  document.addEventListener("astro:after-swap", () => {
    if (filters.size) ensureSvg();
  });
  document.addEventListener("astro:page-load", scan);
  scan();
}
