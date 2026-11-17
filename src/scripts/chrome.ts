/**
 * The "window chrome" around the page: the footer clock, the hide-UI toggle,
 * keyboard scrolling for the content pane, and the phone chrome (top controls
 * and tab bar) that steps aside while you read.
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

// ── Phone chrome: steps aside while you read ──────────────────────────────────
// The floating brand/toggle and the tab bar share one number, --hide (0 shown,
// 1 hidden), on the header. While you scroll it tracks your finger, so the bars
// leave as gradually as you scroll; when scrolling stops it springs the rest of
// the way in the direction you were going. Near the top or the end of the page
// the chrome eases back in. One passive, rAF-batched listener; CSS does the rest.
const phone = matchMedia("(max-width: 940px)");
const RANGE = 120; // px of scrolling that takes the chrome fully out (or in)
const END_ZONE = 120; // px before the end of the page where it comes back
const SETTLE_MS = 140; // quiet time that counts as "scrolling stopped"
let header: HTMLElement | null = null;
let hide = 0;
let lastY = 0;
let heading = 0; // last scroll direction: 1 down, -1 up
let ticking = false;
let settleTimer = 0;

function paintChrome(settle: boolean) {
  if (!header) return;
  header.style.setProperty("--hide", hide.toFixed(3));
  header.toggleAttribute("data-settle", settle);
  header.toggleAttribute("data-chrome-hidden", hide > 0.5);
}

function scrollBounds() {
  const end = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(Math.max(window.scrollY, 0), end); // ignore rubber-band overscroll
  return { y, end };
}

function settleChrome() {
  settleTimer = 0;
  const { y, end } = scrollBounds();
  if (y < RANGE || end - y < END_ZONE) hide = 0;
  else if (hide > 0 && hide < 1) hide = heading > 0 ? (hide > 0.2 ? 1 : 0) : hide < 0.8 ? 0 : 1;
  paintChrome(true);
}

function trackChrome() {
  ticking = false;
  if (!header) return;
  if (!phone.matches) {
    if (hide) showChrome();
    return;
  }
  const { y, end } = scrollBounds();
  const dy = y - lastY;
  lastY = y;
  if (!dy) return;
  heading = Math.sign(dy);
  hide = Math.min(1, Math.max(0, hide + dy / RANGE));
  // Ease back in, in proportion, as the top or the end of the page comes near.
  hide = Math.min(hide, y / RANGE, (end - y) / END_ZONE);
  paintChrome(false);
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settleChrome, SETTLE_MS);
}

function showChrome() {
  clearTimeout(settleTimer);
  hide = 0;
  paintChrome(true);
}

export function initChrome() {
  tickClock();

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(trackChrome);
    },
    { passive: true },
  );
  phone.addEventListener("change", showChrome);
  // Keyboard users tabbing into the chrome should always see it.
  document.addEventListener("focusin", (event) => {
    if ((event.target as Element | null)?.closest(".site-header")) showChrome();
  });

  document.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("[data-ui-toggle]")) {
      setUiHidden(root.dataset.uiHidden !== "true");
    }
  });

  document.addEventListener("astro:page-load", () => {
    header = document.querySelector<HTMLElement>(".site-header");
    clearTimeout(settleTimer);
    hide = 0;
    lastY = scrollBounds().y;
    paintChrome(false);
    renderClock();
    syncUiToggle();
    focusContent();
  });
}
