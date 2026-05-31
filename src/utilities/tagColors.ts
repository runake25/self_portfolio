/**
 * Maps tag names (lowercase) to a highlight accent color used for card top borders.
 * Add new entries here as you create content in new categories.
 */
const TAG_COLORS: Record<string, string> = {
  // ── Games / Strategy ──────────────────────────────────────────
  poker: "#e85d7b",

  // ── Tech / Code ───────────────────────────────────────────────
  code: "#4fa3e0",
  programming: "#4fa3e0",
  javascript: "#f0db4f",
  typescript: "#3178c6",
  python: "#3572a5",

  // ── Design ────────────────────────────────────────────────────
  design: "#a78bfa",
  ui: "#a78bfa",

  // ── Film / Music ──────────────────────────────────────────────
  drama: "#f59e0b",
  music: "#34d399",
};

/**
 * Returns the first matching accent color for a list of tags, or undefined if none match.
 */
export function tagAccentColor(tags: string[] | undefined): string | undefined {
  if (!tags) return undefined;
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) return color;
  }
  return undefined;
}

/**
 * Returns the first matching { tag, color } pair, preserving the original tag casing.
 * Use this when you need both the display label and the color.
 */
export function tagAccentEntry(
  tags: string[] | undefined,
): { tag: string; color: string } | undefined {
  if (!tags) return undefined;
  for (const tag of tags) {
    const color = TAG_COLORS[tag.toLowerCase()];
    if (color) return { tag, color };
  }
  return undefined;
}
