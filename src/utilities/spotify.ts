/**
 * Spotify Web API – Client Credentials flow utility.
 * Used at build-time only; never runs in the browser.
 *
 * Required env vars (in .env, no PUBLIC_ prefix):
 *   SPOTIFY_CLIENT_ID=<your app client id>
 *   SPOTIFY_CLIENT_SECRET=<your app client secret>
 */

interface SpotifyToken {
  access_token: string;
  expires_at: number;
}

interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: string[];
  releaseYear: number;
  images: SpotifyImage[];
}

let _cachedToken: SpotifyToken | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && now < _cachedToken.expires_at - 30_000) {
    return _cachedToken.access_token;
  }

  const clientId = import.meta.env.SPOTIFY_CLIENT_ID as string | undefined;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET as string | undefined;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Spotify credentials missing. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env",
    );
  }

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = {
    access_token: json.access_token,
    expires_at: now + json.expires_in * 1_000,
  };

  return _cachedToken.access_token;
}

/** Search Spotify for an album and return structured metadata, or null on failure. */
export async function searchAlbum(
  artist: string,
  album: string,
): Promise<SpotifyAlbum | null> {
  try {
    const token = await getAccessToken();
    const q = encodeURIComponent(`album:${album} artist:${artist}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) return null;

    const json = (await res.json()) as {
      albums: { items: Array<{
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        release_date: string;
        images: SpotifyImage[];
      }> };
    };

    const item = json.albums?.items?.[0];
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      artists: item.artists.map((a) => a.name),
      releaseYear: new Date(item.release_date).getFullYear(),
      images: item.images,
    };
  } catch {
    return null;
  }
}

/**
 * Convenience: return the largest available album cover URL, or null.
 * Spotify's largest image is typically 640×640.
 */
export async function getAlbumArt(artist: string, album: string): Promise<string | null> {
  const result = await searchAlbum(artist, album);
  if (!result?.images.length) return null;
  // Sort descending by width to get the largest
  const sorted = [...result.images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}
