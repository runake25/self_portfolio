/**
 * Cover Art Archive + MusicBrainz utility — no authentication required.
 *
 * Flow:
 *   1. Search MusicBrainz for a release-group MBID by artist + album name
 *   2. Fetch cover art from Cover Art Archive using that MBID
 *
 * MusicBrainz rate limit: max 1 req/sec — enforced below.
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *       https://coverartarchive.org/doc/
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface MBReleaseGroup {
  id: string;
  title: string;
}

interface CAAImage {
  image: string;
  thumbnails: {
    "250"?: string;
    "500"?: string;
    "1200"?: string;
    large?: string;
    small?: string;
  };
  front: boolean;
  back: boolean;
}

// ─── Rate-limiter for MusicBrainz (1 req/sec) ────────────────────────────────

const MB_USER_AGENT =
  "self-portfolio/1.0 (https://github.com/runake25)";

let _lastMBRequest = 0;

async function mbFetch(url: string): Promise<Response> {
  const wait = 1_100 - (Date.now() - _lastMBRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastMBRequest = Date.now();
  return fetch(url, {
    headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
  });
}

// ─── MusicBrainz search ───────────────────────────────────────────────────────

async function findReleaseGroupMBID(
  artist: string,
  album: string,
): Promise<string | null> {
  const q = encodeURIComponent(`releasegroup:"${album}" AND artist:"${artist}"`);
  const res = await mbFetch(
    `https://musicbrainz.org/ws/2/release-group/?query=${q}&fmt=json&limit=3&type=album`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { "release-groups"?: MBReleaseGroup[] };
  return json["release-groups"]?.[0]?.id ?? null;
}

// ─── Cover Art Archive ───────────────────────────────────────────────────────

async function fetchCAAImages(mbid: string): Promise<CAAImage[]> {
  const res = await fetch(`https://coverartarchive.org/release-group/${mbid}`, {
    headers: { Accept: "application/json" },
    redirect: "follow",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { images?: CAAImage[] };
  return json.images ?? [];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the best front-cover URL for an album, or null on failure.
 * Prefers the 500px thumbnail (always square, ~30–80 KB).
 */
export async function getAlbumArt(
  artist: string,
  album: string,
): Promise<string | null> {
  try {
    const mbid = await findReleaseGroupMBID(artist, album);
    if (!mbid) return null;

    const images = await fetchCAAImages(mbid);
    if (!images.length) return null;

    const front = images.find((img) => img.front) ?? images[0];
    return (
      front.thumbnails["500"] ??
      front.thumbnails["1200"] ??
      front.thumbnails["large"] ??
      front.image
    );
  } catch {
    return null;
  }
}
