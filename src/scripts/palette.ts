/**
 * Command palette: press "/" (or Ctrl/⌘+K, or the footer button) anywhere.
 *
 * Type to jump to any page or entry ("cd music", "bayesian", "manchester"),
 * or run a command ("theme", "play", "random"). It's a native <dialog>, so focus
 * trapping, Escape and the backdrop come for free. This module and the search
 * index (/search.json) are only downloaded the first time the palette opens.
 */
import { navigate } from "astro:transitions/client";
import type { SearchItem } from "../pages/search.json";

interface Entry {
  kind: string;
  label: string;
  detail?: string;
  haystack: string;
  run: () => void;
}

let dialog: HTMLDialogElement | null = null;
let input: HTMLInputElement;
let list: HTMLUListElement;
let entries: Entry[] = [];
let shown: Entry[] = [];
let selected = 0;
let index: Promise<SearchItem[]> | null = null;

const root = document.documentElement;
const go = (url: string) => void navigate(url);
const click = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();

function commands(pages: SearchItem[]): Entry[] {
  const wide = matchMedia("(min-width: 941px)").matches;
  const entriesOnly = pages.filter((p) => p.kind !== "page");
  const make = (label: string, detail: string, run: () => void): Entry => ({
    kind: "cmd",
    label,
    detail,
    haystack: `${label} ${detail}`.toLowerCase(),
    run,
  });
  return [
    make("theme", "toggle day / night", () => click("[data-theme-toggle]")),
    ...(wide
      ? [
          make("play", "steer the maze ball yourself", () => document.dispatchEvent(new CustomEvent("maze:play"))),
          make(root.dataset.uiHidden === "true" ? "show ui" : "hide ui", "peek at the maze", () => click("[data-ui-toggle]")),
        ]
      : []),
    ...(entriesOnly.length
      ? [make("random", "open a random entry", () => go(entriesOnly[Math.floor(Math.random() * entriesOnly.length)].url))]
      : []),
    make("rss", "subscribe to new writing", () => (location.href = "/rss.xml")),
  ];
}

function toEntries(pages: SearchItem[]): Entry[] {
  return [
    ...pages.map((p) => ({
      kind: p.kind,
      label: p.title,
      detail: p.url,
      haystack: `${p.kind} ${p.title} ${p.hint ?? ""} ${p.url}`.toLowerCase(),
      run: () => go(p.url),
    })),
    ...commands(pages),
  ];
}

function filter(query: string) {
  // Accept shell-ish prefixes: "cd music", "open bayesian".
  const q = query.trim().toLowerCase().replace(/^(cd|open|ls)\s+/, "").replace(/^~?\//, "");
  if (!q) return entries.filter((e) => e.kind === "page" || e.kind === "cmd");
  const terms = q.split(/\s+/);
  return entries
    .filter((e) => terms.every((t) => e.haystack.includes(t)))
    .sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)))
    .slice(0, 8);
}

function render() {
  shown = filter(input.value);
  selected = Math.min(selected, Math.max(0, shown.length - 1));
  list.replaceChildren(
    ...shown.map((entry, i) => {
      const li = document.createElement("li");
      li.id = `palette-opt-${i}`;
      li.className = "palette-item";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === selected));
      const kind = document.createElement("span");
      kind.className = "palette-kind";
      kind.textContent = entry.kind;
      const label = document.createElement("span");
      label.className = "palette-label";
      label.textContent = entry.label;
      const detail = document.createElement("span");
      detail.className = "palette-detail";
      detail.textContent = entry.detail ?? "";
      li.append(kind, label, detail);
      li.addEventListener("pointermove", () => select(i));
      li.addEventListener("click", () => runSelected());
      return li;
    }),
  );
  if (shown.length === 0) {
    const li = document.createElement("li");
    li.className = "palette-empty";
    li.textContent = `command not found: ${input.value.trim()}`;
    list.append(li);
  }
  input.setAttribute("aria-activedescendant", shown.length ? `palette-opt-${selected}` : "");
}

function select(i: number) {
  if (i === selected) return;
  list.children[selected]?.setAttribute("aria-selected", "false");
  selected = i;
  list.children[selected]?.setAttribute("aria-selected", "true");
  list.children[selected]?.scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", `palette-opt-${selected}`);
}

function runSelected() {
  const entry = shown[selected];
  if (!entry) return;
  dialog?.close();
  entry.run();
}

function build() {
  dialog = document.createElement("dialog");
  dialog.className = "palette";
  dialog.setAttribute("aria-label", "Command palette");
  dialog.innerHTML = `
    <div class="palette-input-row">
      <span class="palette-prompt" aria-hidden="true">~$</span>
      <input class="palette-input" type="text" placeholder="cd music · bayesian · theme · play" autocomplete="off"
        spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" aria-label="Command" />
    </div>
    <ul id="palette-list" class="palette-list" role="listbox" aria-label="Results"></ul>
    <p class="palette-foot" aria-hidden="true">↑↓ select · enter run · esc close</p>`;
  input = dialog.querySelector("input")!;
  list = dialog.querySelector("ul")!;

  input.addEventListener("input", () => {
    selected = 0;
    render();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (shown.length) select((selected + (event.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runSelected();
    }
  });
  // A click on the dimmed backdrop lands on the <dialog> itself.
  dialog.addEventListener("click", (event) => event.target === dialog && dialog?.close());
}

export async function openPalette() {
  // The ClientRouter replaces <body> on navigation, so rebuild if we were swapped out.
  if (!dialog?.isConnected) {
    if (!dialog) build();
    document.body.append(dialog!);
  }
  if (dialog!.open) return;
  // If the index fails to load (offline?), still offer the commands, and retry next time.
  index ??= fetch("/search.json")
    .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => {
      index = null;
      return [];
    });
  input.value = "";
  selected = 0;
  entries = toEntries(await index);
  render();
  dialog!.showModal();
  input.focus();
}
