/**
 * "Pick one" roulette shared by the movie and music grids: a highlight sweeps
 * across the cards, slowing down until it lands on a random winner.
 */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

interface PickOneOptions {
  buttonId: string;
  cardSelector: string;
  /** Full sweeps across the grid before landing */
  laps: number;
  /** Delay between steps at the start (ms) */
  baseDelay: number;
  /** Extra delay added by the final step (ms) */
  slowdown: number;
  /** Easing exponent: higher = stays fast longer, then brakes harder */
  curve: number;
}

const LABEL = "◎ pick one";

function run(button: HTMLButtonElement, cards: HTMLElement[], options: PickOneOptions) {
  const total = cards.length;
  const winner = Math.floor(Math.random() * total);
  for (const card of cards) card.classList.remove("pick-scanning", "pick-highlight");

  const land = () => {
    cards[winner].classList.add("pick-highlight");
    cards[winner].scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest" });
    button.textContent = LABEL;
    button.disabled = false;
  };

  if (reducedMotion.matches) {
    land();
    return;
  }

  button.disabled = true;
  button.textContent = "scanning...";
  const totalSteps = options.laps * total + winner + 1;
  let step = 0;

  const tick = () => {
    cards[(step - 1 + total) % total].classList.remove("pick-scanning");
    if (step === totalSteps) {
      land();
      return;
    }
    cards[step % total].classList.add("pick-scanning");
    step++;
    const progress = step / totalSteps;
    setTimeout(tick, options.baseDelay + Math.pow(progress, options.curve) * options.slowdown);
  };
  tick();
}

export function bindPickOne(options: PickOneOptions) {
  // Runs on the first load and after every client-side navigation. The DOM is
  // fresh each time, so binding to the new button never stacks listeners.
  document.addEventListener("astro:page-load", () => {
    const button = document.getElementById(options.buttonId) as HTMLButtonElement | null;
    if (!button) return;
    const cards = Array.from(document.querySelectorAll<HTMLElement>(options.cardSelector));
    if (cards.length < 2) return;

    button.addEventListener("click", () => run(button, cards, options));

    // Clicking anywhere else dismisses the winner highlight.
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as Node;
        if (button.contains(target)) return;
        for (const card of cards) if (!card.contains(target)) card.classList.remove("pick-highlight");
      },
      { signal: pageSignal() },
    );
  });
}

// An AbortSignal that fires on the next navigation, for document-level listeners
// that belong to a single page.
function pageSignal() {
  const controller = new AbortController();
  document.addEventListener("astro:before-swap", () => controller.abort(), { once: true });
  return controller.signal;
}
