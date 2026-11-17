/**
 * The "window chrome" around the page: the footer clock, the hide-UI toggle,
 * and keyboard scrolling for the content pane.
 */
const root = document.documentElement;
const UI_KEY = "portfolio-ui-hidden";

// ── Footer clock ──────────────────────────────────────────────────────────────
// Only touches one text node per second, and is scheduled on the second boundary
// so it never visibly skips a second.
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hourCycle: "h23", // "hour12: false" can print "24:00:00" at midnight
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function renderClock() {
  const node = document.querySelector("[data-local-time]");
  if (node) node.textContent = timeFormat.format(new Date());
}

function tickClock() {
  renderClock();
  setTimeout(tickClock, 1000 - (Date.now() % 1000));
}

// ── Hide-UI toggle (shows off the maze) ───────────────────────────────────────
function syncUiToggle() {
  const hidden = root.dataset.uiHidden === "true";
  const button = document.querySelector<HTMLButtonElement>("[data-ui-toggle]");
  if (!button) return;
  button.setAttribute("aria-pressed", String(hidden));
  button.setAttribute("aria-label", hidden ? "Show interface" : "Hide interface");
}

export function setUiHidden(hidden: boolean) {
  root.dataset.uiHidden = String(hidden);
  try {
    localStorage.setItem(UI_KEY, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
  syncUiToggle();
  document.dispatchEvent(new CustomEvent("ui-visibility-change"));
}

// ── Keyboard scrolling ────────────────────────────────────────────────────────
// On desktop the page content scrolls inside the window frame, not the document.
// Focusing that pane (without scrolling it) makes Space / PageDown / arrow keys
// work right away, and tells screen readers that new content has loaded.
function focusContent() {
  const main = document.querySelector<HTMLElement>("#main-content");
  if (main && document.activeElement === document.body) main.focus({ preventScroll: true });
}

export function initChrome() {
  tickClock();

  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("[data-ui-toggle]")) {
      setUiHidden(root.dataset.uiHidden !== "true");
    }
  });

  document.addEventListener("astro:page-load", () => {
    renderClock();
    syncUiToggle();
    focusContent();
  });
}
