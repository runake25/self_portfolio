/**
 * Day/night theme.
 *
 * The theme lives on <html data-theme>. An inline script in <head> sets it before
 * first paint (see BaseLayout), so this module only handles changes: the toggle
 * button, OS-level preference changes, and carrying the theme across client-side
 * navigations.
 */
export type Theme = "day" | "night";

const STORAGE_KEY = "portfolio-theme";
const root = document.documentElement;
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const listeners = new Set<(theme: Theme) => void>();

export const getTheme = (): Theme => (root.dataset.theme === "day" ? "day" : "night");

export function onThemeChange(listener: (theme: Theme) => void) {
  listeners.add(listener);
}

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "day" || value === "night" ? value : null;
  } catch {
    return null;
  }
}

function syncToggle() {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!button) return;
  const night = getTheme() === "night";
  button.setAttribute("aria-pressed", String(night));
  button.setAttribute("aria-label", night ? "Switch to day theme" : "Switch to night theme");
}

// Matches the browser's own chrome (status bar, address bar) to the page.
const THEME_COLOR: Record<Theme, string> = { night: "#0b0b14", day: "#ede0cc" };

function syncThemeColor(doc: Document, theme: Theme) {
  doc.querySelector("meta[data-theme-color]")?.setAttribute("content", THEME_COLOR[theme]);
}

function applyTheme(theme: Theme) {
  root.dataset.theme = theme;
  syncThemeColor(document, theme);
  syncToggle();
  for (const listener of listeners) listener(theme);
}

/**
 * Switch theme with a circular reveal that grows out of the toggle button.
 * Uses the View Transitions API: the browser snapshots the old page, we swap the
 * theme, then animate a clip-path on the new snapshot. All compositor work.
 */
function toggleTheme(origin: HTMLElement) {
  const next: Theme = getTheme() === "day" ? "night" : "day";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode: the choice just won't persist */
  }

  if (!document.startViewTransition || reducedMotion.matches) {
    applyTheme(next);
    return;
  }

  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  // Marks the transition so CSS can suspend per-element color transitions;
  // otherwise they would animate a second time inside the revealed area.
  root.dataset.vt = "theme";
  const transition = document.startViewTransition(() => applyTheme(next));
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    )
    .catch(() => {});
  transition.finished.finally(() => delete root.dataset.vt);
}

export function initTheme() {
  // One delegated listener on document survives every page swap, so there is
  // nothing to re-bind per page.
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>("[data-theme-toggle]");
    if (button) toggleTheme(button);
  });

  systemDark.addEventListener("change", () => {
    if (!storedTheme()) applyTheme(systemDark.matches ? "night" : "day");
  });

  // The incoming page's <html> is server-rendered without our runtime
  // attributes; copy them over before the swap so there's never a wrong-theme frame.
  document.addEventListener("astro:before-swap", (event) => {
    const incoming = event.newDocument.documentElement;
    incoming.dataset.theme = getTheme();
    syncThemeColor(event.newDocument, getTheme());
    if (root.dataset.uiHidden) incoming.dataset.uiHidden = root.dataset.uiHidden;
  });

  document.addEventListener("astro:page-load", syncToggle);
}
