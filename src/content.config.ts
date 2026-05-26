import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    year: z.number(),
    stack: z.array(z.string()),
    complexityTime: z.string().default("O(log n)"),
    complexitySpace: z.string().default("O(1)"),
    protocol: z.string().default("Iterator Protocol"),
    order: z.number().default(0),
    liveUrl: z.url().optional(),
    repoUrl: z.url().optional(),
    featured: z.boolean().default(false),
  }),
});

const tech = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/tech" }),
  schema: z.object({
    title: z.string(),
    publishedDate: z.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

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

const places = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/places" }),
  schema: z.object({
    title: z.string(),
    visitedDate: z.date(),
    description: z.string().optional(),
    location: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = {
  projects,
  tech,
  movies,
  thoughts,
  music,
  places,
};