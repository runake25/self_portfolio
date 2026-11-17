/**
 * The "window chrome" around the page: the footer clock, the hide-UI toggle,
 * keyboard scrolling for the content pane, and the phone tab bar that gets out
 * of the way while you read.
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

// ── Phone tab bar: hide while reading ─────────────────────────────────────────
// Scrolling down means reading, so the floating tab bar slides away; any scroll
// up, the top or bottom of the page, or a new page brings it back. One rAF-batched
// passive listener; the slide itself is a CSS transition.
const phone = matchMedia("(max-width: 940px)");
const NAV_SLACK = 8; // px of scrolling in one direction before the bar reacts
let lastY = 0;
let navTicking = false;

function setNavHidden(hidden: boolean) {
  if (hidden) root.dataset.navHidden = "";
  else delete root.dataset.navHidden;
}

function updateNav() {
  navTicking = false;
  const y = window.scrollY;
  const end = document.documentElement.scrollHeight - window.innerHeight;
  if (!phone.matches || y < 80 || y > end - 40) {
    setNavHidden(false);
    lastY = y;
    return;
  }
  const delta = y - lastY;
  if (Math.abs(delta) < NAV_SLACK) return;
  setNavHidden(delta > 0);
  lastY = y;
}

export function initChrome() {
  tickClock();

  window.addEventListener(
    "scroll",
    () => {
      if (navTicking) return;
      navTicking = true;
      requestAnimationFrame(updateNav);
    },
    { passive: true },
  );
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
    setNavHidden(false);
    lastY = window.scrollY;
    renderClock();
    syncUiToggle();
    focusContent();
  });
}
