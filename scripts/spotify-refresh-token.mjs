// One-time helper: connects your Spotify account and prints a refresh token.
//
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-refresh-token.mjs
//
// Then open the printed link, approve, and copy SPOTIFY_REFRESH_TOKEN into .env.local
// (and into your hosting provider's environment variables).

import http from "node:http";

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.");
  process.exit(1);
}

const PORT = 8888;
// Spotify no longer accepts "localhost" redirect URIs; use the loopback IP literal.
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = "user-top-read";

const authorize = new URL("https://accounts.spotify.com/authorize");
authorize.search = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: REDIRECT, scope: SCOPES }).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const code = url.searchParams.get("code");
  if (!code) { res.writeHead(400).end(`Spotify said: ${url.searchParams.get("error") ?? "no code"}`); return; }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok || !data.refresh_token) {
    res.writeHead(500).end("Token exchange failed, see the terminal.");
    console.error(data);
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Done. You can close this tab and go back to the terminal.");
    console.log("\nAdd this to .env.local and to your host's environment variables:\n");
    console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
  }
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this link, log in to Spotify and click Agree:\n");
  console.log(authorize.toString() + "\n");
});
