/**
 * Cloudflare Pages Function: GET /api/now-playing
 *
 * Returns the track you're listening to right now (or played last), from Last.fm.
 * Last.fm "scrobbles" (logs) what you play on Spotify, Apple Music, etc., once you
 * connect it in Last.fm's settings. The /music page shows the result.
 *
 * Setup (until then the widget simply stays hidden):
 *   1. Create a free account at last.fm and connect Spotify (Settings → Applications).
 *   2. Get an API key at https://www.last.fm/api/account/create
 *   3. Cloudflare dashboard → Pages project → Settings → Variables and Secrets:
 *        LASTFM_USER    = your Last.fm username
 *        LASTFM_API_KEY = the key (type: Secret)
 */

interface Env {
  LASTFM_API_KEY?: string;
  LASTFM_USER?: string;
}

interface LastFmTrack {
  name: string;
  url: string;
  artist: { "#text": string };
  album: { "#text": string };
  image?: { size: string; "#text": string }[];
  date?: { uts: string };
  "@attr"?: { nowplaying?: string };
}

const json = (body: unknown, maxAge: number) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${maxAge}` },
  });

export const onRequestGet = async ({ env }: { env: Env }) => {
  if (!env.LASTFM_API_KEY || !env.LASTFM_USER) return json({ configured: false }, 300);

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.search = new URLSearchParams({
    method: "user.getrecenttracks",
    user: env.LASTFM_USER,
    api_key: env.LASTFM_API_KEY,
    format: "json",
    limit: "1",
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) return json({ configured: true, track: null }, 30);
    const data = (await response.json()) as { recenttracks?: { track?: LastFmTrack[] } };
    const track = data.recenttracks?.track?.[0];
    if (!track) return json({ configured: true, track: null }, 60);
    return json(
      {
        configured: true,
        track: {
          title: track.name,
          artist: track.artist["#text"],
          album: track.album["#text"],
          url: track.url,
          image: track.image?.find((i) => i.size === "medium")?.["#text"] || null,
          playingNow: track["@attr"]?.nowplaying === "true",
          playedAt: track.date ? Number(track.date.uts) * 1000 : null,
        },
      },
      30,
    );
  } catch {
    return json({ configured: true, track: null }, 30);
  }
};
