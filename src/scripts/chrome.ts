/**
 * The "window chrome" around the page: the footer clock, the hide-UI toggle,
 * keyboard scrolling for the content pane, and the phone tab bar that steps
 * aside while you read.
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

// ── Phone tab bar: steps aside while you read ─────────────────────────────────
// Scrolling down hides the floating tab bar, scrolling up brings it back, and it
// returns near the top or end of the page. The script only flips an attribute
// when the direction changes (a few times per gesture, never per frame); the
// glide itself is a CSS transition on the compositor, so it can't lag behind
// iOS momentum scrolling the way scroll-tracking JavaScript does.
const phone = matchMedia("(max-width: 940px)");
const SLACK = 24; // px of travel in one direction before the bar reacts
const EDGE = 120; // px from the top or end of the page where it always shows
let nav: HTMLElement | null = null;
let anchorY = 0; // where the current scroll direction started
let lastY = 0;
let ticking = false;

function setNavHidden(hidden: boolean) {
  if (nav && nav.hasAttribute("data-hidden") !== hidden) nav.toggleAttribute("data-hidden", hidden);
}

function trackNav() {
  ticking = false;
  if (!nav) return;
  const end = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(Math.max(window.scrollY, 0), end); // ignore rubber-band overscroll
  if (!phone.matches || y < EDGE || end - y < EDGE) {
    setNavHidden(false);
    anchorY = lastY = y;
    return;
  }
  if (Math.sign(y - lastY) !== Math.sign(lastY - anchorY)) anchorY = lastY; // direction changed
  lastY = y;
  if (Math.abs(y - anchorY) >= SLACK) setNavHidden(y > anchorY);
}

export function initChrome() {
  tickClock();

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(trackNav);
    },
    { passive: true },
  );
  phone.addEventListener("change", () => setNavHidden(false));
  // Keyboard users tabbing into the bar should always see it.
  document.addEventListener("focusin", (event) => {
    if ((event.target as Element | null)?.closest(".site-nav")) setNavHidden(false);
  });

  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("[data-ui-toggle]")) {
      setUiHidden(root.dataset.uiHidden !== "true");
    }
  });

  document.addEventListener("astro:page-load", () => {
    nav = document.querySelector<HTMLElement>(".site-nav");
    anchorY = lastY = Math.max(window.scrollY, 0);
    renderClock();
    syncUiToggle();
    focusContent();
  });
}
