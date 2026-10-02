// GET /api/top-tracks
// Top 5 Spotify tracks over roughly the last 4 weeks. Spotify recalculates this about once a day,
// so the list is kept for an hour in memory and at the CDN.

import { NextResponse } from "next/server";
import { spotifyAccessToken } from "@/lib/spotify";
import type { Track } from "@/lib/content";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
let memo: { tracks: Track[]; at: number } | null = null;

export async function GET() {
  if (memo && Date.now() - memo.at < HOUR) return respond(memo.tracks);
  try {
    const token = await spotifyAccessToken();
    const res = await fetch("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Spotify top tracks failed: ${res.status}`);
    const data = (await res.json()) as {
      items: { name: string; artists: { name: string }[]; external_urls: { spotify: string } }[];
    };
    const tracks: Track[] = data.items.map((t) => ({
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      url: t.external_urls.spotify,
    }));
    memo = { tracks, at: Date.now() };
    return respond(tracks);
  } catch (err) {
    console.error(err);
    // Serve the last good list if there is one; otherwise the page keeps its built-in songs.
    if (memo) return respond(memo.tracks);
    return NextResponse.json([], { status: 503 });
  }
}

function respond(tracks: Track[]) {
  return NextResponse.json(tracks, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
