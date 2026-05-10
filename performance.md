Here's a comprehensive breakdown of advanced performance optimization techniques for your portfolio site — structured from quick wins to high-engineering-signal tricks that will genuinely impress technical recruiters.

***

## Core Web Vitals Targets First

Before optimizing, establish baselines. Google's Core Web Vitals are the gold standard: **LCP < 1.5s** (for informational/portfolio sites), **INP < 200ms**, and **CLS < 0.1**. Run Google PageSpeed Insights and GTmetrix before and after each change to measure real impact. [dev](https://dev.to/adamgolan/performance-optimization-techniques-for-modern-web-apps-in-2025-3b3n)

***

## Asset & Network Layer

- **Serve AVIF/WebP images** with `<picture>` fallback tags. AVIF is 50%+ smaller than JPEG with same quality [treize](https://treize.pro/en/development/best-practices-to-optimize-web-performance-in-2025-a-guide-for-wordpress/)
- **Add `width`/`height` attributes on every `<img>`** to prevent Cumulative Layout Shift (CLS), which is the most common invisible penalty [straightnorth](https://www.straightnorth.com/blog/core-web-vitals-real-world-optimization-tips/)
- **Lazy load off-screen images** with `loading="lazy" decoding="async"` on every `<img>` below the fold [straightnorth](https://www.straightnorth.com/blog/core-web-vitals-real-world-optimization-tips/)
- **Deploy on a CDN** (Cloudflare Pages, Vercel, or Netlify — all free). A CDN serves from the edge node nearest to your recruiter, cutting TTFB from ~300ms to ~20ms [web](https://web.dev/articles/top-cwv)
- **Enable Brotli compression** (better than Gzip by ~15-20%). Most CDN hosts auto-configure this [darkroomagency](https://www.darkroomagency.com/observatory/website-optimization-critical-techniques-for-performance-gains)

***

## HTML/CSS/JS Delivery

- **Inline critical CSS** for above-the-fold styles in a `<style>` block in `<head>` and load the full stylesheet with `media="print" onload="this.media='all'"` — this eliminates render-blocking CSS entirely [louispretorius](https://louispretorius.com/web-design/portfolio-websites/portfolio-website-speed-optimization/)
- **Minify all assets** at build time using tools like `esbuild`, `CSSNano`, or simply Vite/Parcel. This is table stakes for a software portfolio [louispretorius](https://louispretorius.com/web-design/portfolio-websites/portfolio-website-speed-optimization/)
- **Defer all JS** with `<script defer>` or `type="module"`. Non-critical analytics should load with `<script async>` [louispretorius](https://louispretorius.com/web-design/portfolio-websites/portfolio-website-speed-optimization/)
- **Use `content-visibility: auto`** on off-screen article cards. This is a genuinely advanced CSS trick that tells the browser to skip rendering offscreen content, cutting render time by 30-50% on long list pages [dev](https://dev.to/adamgolan/performance-optimization-techniques-for-modern-web-apps-in-2025-3b3n)

```css
/* Apply to article cards/grids only visible on scroll */
.article-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px; /* estimated height to prevent CLS */
}
```

***

## Font Performance

- **Preconnect to your font CDN** in `<head>` before the stylesheet link: [straightnorth](https://www.straightnorth.com/blog/core-web-vitals-real-world-optimization-tips/)
  ```html
  <link rel="preconnect" href="https://api.fontshare.com">
  ```
- **Use variable fonts** with a single `wght` axis (`wght@300..700`) instead of loading 3 separate font weight files — cuts font requests from 3 to 1 [straightnorth](https://www.straightnorth.com/blog/core-web-vitals-real-world-optimization-tips/)
- Always use `font-display: swap` to prevent invisible text during font load [straightnorth](https://www.straightnorth.com/blog/core-web-vitals-real-world-optimization-tips/)

***

## Static Site Generation (The High-Signal Engineering Trick)

Since your site has ~3-24 pages with articles at fixed routes (`/portfolio/article`), **pre-rendering every page as static HTML** is the highest-ROI architectural decision you can make. Use a static site generator (SSG):

- **Astro** — best for portfolio/content sites in 2025-2026, ships zero JS by default, and supports MDX for your article posts [dev](https://dev.to/adamgolan/performance-optimization-techniques-for-modern-web-apps-in-2025-3b3n)
- **Next.js with `output: 'export'`** — if you want a React stack that recruiters recognize

Pre-rendered HTML means the server sends a fully-formed document on the first byte, achieving LCP < 1s on a CDN edge. This is worth including in your portfolio's README as an architecture decision. [web](https://web.dev/articles/top-cwv)

***

## Route-Level Prefetching

For your article index pages, add **`<link rel="prefetch">`** or use the Speculation Rules API to preload article pages before the user clicks:

```html
<!-- Modern: fires when link enters viewport -->
<script type="speculationrules">
{
  "prefetch": [{ "source": "document", "eagerness": "moderate" }]
}
</script>
```

This makes page transitions feel instant, which visibly demonstrates engineering craftsmanship to anyone auditing your site's network tab. [dev](https://dev.to/adamgolan/performance-optimization-techniques-for-modern-web-apps-in-2025-3b3n)

***

## Recruiter-Signal Extras

These won't move PageSpeed scores much but demonstrate engineering depth:

- **Add a `performance.mark()` / `PerformanceObserver`** in JS that logs LCP and CLS to the console — any recruiter opening DevTools will see you're measuring your own metrics
- **Set `Cache-Control: public, max-age=31536000, immutable`** on all hashed static assets (images, CSS, JS bundles) via your CDN/hosting config — shows you understand HTTP caching semantics [darkroomagency](https://www.darkroomagency.com/observatory/website-optimization-critical-techniques-for-performance-gains)
- **Include a `/lighthouse-report.html`** or a badge in your README showing a 100 performance score — many recruiters at quant firms specifically check this
- **Use HTTP/3 (QUIC)** — automatically enabled on Cloudflare Pages and Vercel. Worth mentioning in your architecture notes as it eliminates head-of-line blocking vs HTTP/1.1 [dev](https://dev.to/adamgolan/performance-optimization-techniques-for-modern-web-apps-in-2025-3b3n)