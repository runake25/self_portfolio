/**
 * Cloudflare Pages Function: POST /api/notify
 *
 * Forwards a contact-form message to ntfy.sh as a push notification.
 *
 * Why this exists: ntfy topics are like passwords. Anyone who knows the topic
 * name can SUBSCRIBE to it and read every message. The topic used to be a
 * PUBLIC_ env var, which Astro bakes into the page's HTML. Now it lives only
 * here, on the server, as a secret:
 *
 *   Cloudflare dashboard → your Pages project → Settings → Variables and Secrets
 *   → add NTFY_TOPIC (type: Secret). Pick a NEW long random topic name; the old
 *   one has been public.
 *
 * Local testing: `npm run build && npx wrangler pages dev dist`, with
 * NTFY_TOPIC=... in a `.dev.vars` file (git-ignored).
 */

interface Env {
  NTFY_TOPIC?: string;
}

interface Context {
  request: Request;
  env: Env;
}

const LIMITS = { from: 200, subject: 200, message: 5000 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null;

export const onRequestPost = async ({ request, env }: Context) => {
  if (!env.NTFY_TOPIC) return json({ error: "not_configured" }, 503);

  // Only accept posts from our own pages.
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: "forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Honeypot: a hidden field humans never see. Bots fill in every field.
  if (body.website) return json({ ok: true });

  const from = text(body.from, LIMITS.from);
  const subject = text(body.subject, LIMITS.subject);
  const message = text(body.message, LIMITS.message);
  if (!from || !subject || !message) return json({ error: "invalid" }, 400);

  // ntfy's JSON API (instead of headers) so titles may contain any Unicode.
  const upstream = await fetch("https://ntfy.sh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: env.NTFY_TOPIC, title: subject, message: `from: ${from}\n\n${message}`, tags: ["envelope"] }),
  });
  return upstream.ok ? json({ ok: true }) : json({ error: "upstream" }, 502);
};
