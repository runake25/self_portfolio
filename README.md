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
- The `functions/` folder is deployed automatically as **Pages Functions** (small server-side endpoints).

### Environment variables (Settings → Variables and Secrets)

| Name | Type | Used for |
|---|---|---|
| `SITE_URL` | plain | **Set this.** Your real domain, e.g. `https://brian.dev`. Used for canonical links, the sitemap, `robots.txt`, RSS and link previews. Falls back to `https://example.pages.dev`. |
| `NTFY_TOPIC` | **secret** | Contact form → push notification (`functions/api/notify.ts`). Use a long random topic name; anyone who knows it can read your messages. |
| `LASTFM_USER`, `LASTFM_API_KEY` | key is **secret** | "Now playing" on /music (`functions/api/now-playing.ts`). Hidden until set. |
| `PUBLIC_WEB3FORMS_KEY` | plain | Contact form → email. Web3Forms keys are designed to be public. Without it, the form opens the visitor's mail app. |
| `PUBLIC_CONTACT_EMAIL` | plain | The address for that mail-app fallback. |
| `PUBLIC_GITHUB_URL`, `PUBLIC_LINKEDIN_URL` | plain | Header links. LinkedIn is hidden until set. |

Anything starting with `PUBLIC_` is baked into the HTML and visible to everyone. Never put a secret in a `PUBLIC_` variable.

### Testing the functions locally

`astro dev` doesn't run Pages Functions. To try them:

```bash
npm run build
# put NTFY_TOPIC=... (and LASTFM_* if you like) in a .dev.vars file (git-ignored)
npx wrangler pages dev dist
```

## Fun stuff

- Press `/` (or Ctrl/⌘+K) anywhere for the command palette: `cd music`, `bayesian`, `theme`, `play`, `random`.
- Hide the interface (top-right toggle) and click the maze to steer the ball with the arrow keys / WASD.
- `/rss.xml` is an RSS feed of the thoughts collection.
