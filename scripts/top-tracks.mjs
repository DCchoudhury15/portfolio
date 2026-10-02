// Prints your top 5 Spotify tracks from the last ~4 weeks, with links.
//
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/top-tracks.mjs
//
// Opens a login link, you approve once, and the songs print in the terminal.
// Also saves them to top-tracks.json next to where you ran it.

import http from "node:http";
import { writeFileSync } from "node:fs";

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first (see README.md).");
  process.exit(1);
}

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`; // must match the Redirect URI in your Spotify app
const RANGE = process.argv[2] || "short_term"; // short_term ≈ 4 weeks, medium_term ≈ 6 months, long_term ≈ 1 year

const authorize = new URL("https://accounts.spotify.com/authorize");
authorize.search = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: REDIRECT, scope: "user-top-read" }).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const code = url.searchParams.get("code");
  if (!code) { res.writeHead(400).end(`Spotify said: ${url.searchParams.get("error") ?? "no code"}`); server.close(); return; }

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tok)}`);

    const topRes = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${RANGE}&limit=5`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const top = await topRes.json();
    if (!topRes.ok) throw new Error(`Top tracks failed: ${JSON.stringify(top)}`);

    const tracks = top.items.map((t, i) => ({
      rank: i + 1,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      url: t.external_urls.spotify,
    }));
    writeFileSync("top-tracks.json", JSON.stringify(tracks, null, 2));
    console.log(`\nYour top ${tracks.length} tracks (${RANGE}):\n`);
    tracks.forEach((t) => console.log(`${t.rank}. ${t.title} · ${t.artist}\n   ${t.url}`));
    console.log("\nSaved to top-tracks.json");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("Done. Go back to the terminal.");
  } catch (err) {
    console.error(err.message);
    res.writeHead(500).end("Something went wrong, see the terminal.");
  }
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this link, log in to Spotify and click Agree:\n");
  console.log(authorize.toString() + "\n");
});
