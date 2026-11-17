import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { entryHref } from "@/utilities/content";

/**
 * A tiny static index of every page, built at build time. The command palette
 * (press "/") downloads it the first time it opens, so it costs nothing on
 * pages where nobody uses the palette.
 */
export interface SearchItem {
  kind: "page" | "thought" | "project" | "movie" | "album";
  title: string;
  url: string;
  hint?: string;
}

export const GET: APIRoute = async () => {
  const [thoughts, projects, movies, music] = await Promise.all([
    getCollection("thoughts", ({ data }) => !data.draft),
    getCollection("projects"),
    getCollection("movies"),
    getCollection("music"),
  ]);

  const items: SearchItem[] = [
    { kind: "page", title: "overview", url: "/", hint: "home" },
    { kind: "page", title: "gallery", url: "/projects", hint: "projects" },
    { kind: "page", title: "thoughts", url: "/thoughts", hint: "writing" },
    { kind: "page", title: "movies", url: "/movies" },
    { kind: "page", title: "music", url: "/music" },
    { kind: "page", title: "contact", url: "/contact" },
    ...thoughts
      .sort((a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf())
      .map((e) => ({ kind: "thought" as const, title: e.data.title, url: entryHref("thoughts", e.id), hint: e.data.tags?.join(" ") })),
    ...projects.map((e) => ({ kind: "project" as const, title: e.data.title, url: entryHref("projects", e.id), hint: e.data.stack.join(" ") })),
    ...movies.map((e) => ({ kind: "movie" as const, title: e.data.title, url: entryHref("movies", e.id), hint: e.data.director })),
    ...music.map((e) => ({ kind: "album" as const, title: e.data.title, url: entryHref("music", e.id), hint: e.data.artist })),
  ];

  return new Response(JSON.stringify(items), { headers: { "Content-Type": "application/json" } });
};
