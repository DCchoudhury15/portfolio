// GET /api/top-artists
// Top 5 Spotify artists over roughly the last 4 weeks. Spotify recalculates this about once a day,
// so the list is kept for an hour in memory and at the CDN.

import { NextResponse } from "next/server";
import { spotifyAccessToken } from "@/lib/spotify";
import type { Artist } from "@/lib/content";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
let memo: { artists: Artist[]; at: number } | null = null;

export async function GET() {
  if (memo && Date.now() - memo.at < HOUR) return respond(memo.artists);
  try {
    const token = await spotifyAccessToken();
    const res = await fetch("https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Spotify top artists failed: ${res.status}`);
    const data = (await res.json()) as {
      items: { name: string; images: { url: string; width: number }[]; external_urls: { spotify: string } }[];
    };
    const artists: Artist[] = data.items.map((a) => {
      const images = [...a.images].sort((x, y) => x.width - y.width);
      return {
        name: a.name,
        url: a.external_urls.spotify,
        art: (images.find((i) => i.width >= 300) ?? images[images.length - 1])?.url ?? null,
      };
    });
    memo = { artists, at: Date.now() };
    return respond(artists);
  } catch (err) {
    console.error(err);
    // Serve the last good list if there is one; otherwise the page keeps its built-in artists.
    if (memo) return respond(memo.artists);
    return NextResponse.json([], { status: 503 });
  }
}

function respond(artists: Artist[]) {
  return NextResponse.json(artists, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
