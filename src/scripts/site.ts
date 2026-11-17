/**
 * Site-wide runtime. Imported once from BaseLayout via a regular <script> tag,
 * so Astro bundles, minifies and caches it as a single file. With the ClientRouter,
 * a bundled module runs exactly once per visit (not once per page), which is why
 * everything here binds global listeners once and reacts to `astro:page-load`.
 */
import { initChrome } from "./chrome";
import { initLiquidGlass } from "./liquidGlass";
import { initMaze } from "./maze";
import { initTheme } from "./theme";

initTheme();
initChrome();
initMaze();
initLiquidGlass();

// ── Command palette ───────────────────────────────────────────────────────────
// Only this tiny listener ships with every page; the palette itself is a separate
// file fetched with import() the first time someone opens it.
const openPalette = () => import("./palette").then((m) => m.openPalette());

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey) return;
  const typing = (event.target as Element).closest("input, textarea, select, [contenteditable]");
  const modK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
  const slash = event.key === "/" && !typing && !event.metaKey && !event.ctrlKey;
  if (!modK && !slash) return;
  event.preventDefault();
  void openPalette();
});

document.addEventListener("click", (event) => {
  if ((event.target as Element).closest("[data-palette-open]")) void openPalette();
});
