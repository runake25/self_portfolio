import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { entryHref } from "@/utilities/content";

// RSS feed of the writing in /thoughts, generated at build time.
// Readers (Feedly, NetNewsWire, Inoreader…) subscribe to /rss.xml.
//
// Written by hand rather than with @astrojs/rss: RSS 2.0 is a tiny format, and that
// package's 4.x line still targets Zod 3, which crashes under Astro 7 (Zod 4).

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://example.pages.dev");
  const abs = (path: string) => new URL(path, base).href;
  const posts = (await getCollection("thoughts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf(),
  );

  const items = posts
    .map((post) => {
      const link = abs(entryHref("thoughts", post.id));
      return [
        "<item>",
        `<title>${escape(post.data.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<pubDate>${post.data.publishedDate.toUTCString()}</pubDate>`,
        post.data.description ? `<description>${escape(post.data.description)}</description>` : "",
        ...(post.data.tags ?? []).map((tag) => `<category>${escape(tag)}</category>`),
        "</item>",
      ].join("");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Brian::sharespace — thoughts</title>
<link>${abs("/thoughts")}</link>
<atom:link href="${abs("/rss.xml")}" rel="self" type="application/rss+xml"/>
<description>Writing by Brian: poker, probability, data engineering, and whatever else is on my mind.</description>
<language>en</language>
${posts[0] ? `<lastBuildDate>${posts[0].data.publishedDate.toUTCString()}</lastBuildDate>` : ""}
${items}
</channel>
</rss>
`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
