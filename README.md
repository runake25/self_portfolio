# Personal Content Site (Astro)

Content-first personal site using Astro with MDX collections, dynamic routes, and static deployment for Cloudflare Pages.

## Sections

- Overview
- Contact
- Projects
- Tech Blog
- Movie Blog

## Stack

- Astro
- MDX content collections
- Tailwind CSS v4
- React integration (optional client components)
- Sitemap generation
- Static output

## Local Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable (optional): `SITE_URL=https://your-domain.com`

If `SITE_URL` is not set, the app falls back to `https://example.pages.dev` for sitemap generation.
