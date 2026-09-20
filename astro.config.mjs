// @ts-check
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

// https://astro.build/config
export default defineConfig({
    site: process.env.SITE_URL ?? "https://example.pages.dev",
    output: "static",

    image: {
        domains: ["image.tmdb.org", "coverartarchive.org"],
    },

    // Astro 7 uses the `satteri` processor by default, which cannot run
    // remark/rehype plugins (no KaTeX support). Opt back into the unified
    // pipeline so remark-math + rehype-katex keep rendering math, and MDX
    // inherits these plugins automatically.
    markdown: {
        processor: unified({
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
        }),
    },

    integrations: [
        react(),
        mdx(),
        sitemap(),
    ],

    vite: {
        plugins: [tailwindcss()],
    },
});