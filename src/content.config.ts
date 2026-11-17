import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).optional(),
    year: z.number(),
    stack: z.array(z.string()),
    order: z.number().default(0),
    liveUrl: z.url().optional(),
    repoUrl: z.url().optional(),
    featured: z.boolean().default(false),
  }),
});

// A `tech` collection used to be defined here, but no page used it and its folder
// only holds a template, so every build printed a warning. Re-add it (and a page
// for it) together with the first tech post.

const movies = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/movies" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      watchedDate: z.date(),
      description: z.string().optional(),
      releasedYear: z.number().optional(),
      director: z.string().optional(),
      poster: z.string().optional(),
      capture: image().optional(),
      genre: z.array(z.string()).optional(),
      rating: z.number().min(0).max(5).optional(),
      tags: z.array(z.string()).optional(),
    }),
});

const thoughts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/thoughts" }),
  schema: z.object({
    title: z.string(),
    publishedDate: z.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

const music = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/music" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    entryDate: z.date(),
    description: z.string().optional(),
    artist: z.string().optional(),
    releaseYear: z.number().optional(),
    genre: z.array(z.string()).optional(),
    coverArt: image().optional(),
    keyTracks: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = {
  projects,
  movies,
  thoughts,
  music,
};