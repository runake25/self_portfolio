// @ts-check
import mdx from "@astrojs/mdx";
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
    integrations: [
        react(),
        mdx({
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
        }),
        sitemap(),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});
