# divyanshu choudhury · portfolio

My personal site, built as a late-night record label: projects are LP sleeves, open-source work is the
tour, and a four-piece band plays in the background.

- **Light show.** The hero and every album sleeve are painted live by a WebGL shader in the style of
  1960s oil-projector light shows. The hero pulses with the music.
- **Soundtrack.** Four original tracks in the spirit of Cream, The Doors, Pink Floyd and Led Zeppelin,
  synthesised in a Web Worker (plucked-string guitars, fuzz, wah, organ, electric piano, drums, tape
  echo and reverb). No samples or recordings, so nothing to license.
- **On repeat.** The About section lists my top 5 Spotify tracks of the last ~4 weeks, refreshed hourly.

Built with Next.js, React and TypeScript. No UI framework, no tracking.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Live Spotify list (optional)

Without these variables the site shows a built-in list. To make it follow your real listening:

1. Create an app at <https://developer.spotify.com/dashboard>, tick **Web API**, and set the redirect URI
   to `http://127.0.0.1:8888/callback` (Spotify no longer accepts `localhost`).
2. Get a refresh token once:
   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-refresh-token.mjs
   ```
3. Put the three values in `.env.local` (see `.env.example`) and in your host's environment variables.

Spotify recalculates top tracks about once a day over a rolling ~4 weeks; `/api/top-tracks` caches for an
hour. Secrets stay on the server.

To just print your current top 5 in the terminal: `node scripts/top-tracks.mjs` with the same two
variables (add `medium_term` or `long_term` for longer ranges).

## Layout

```
app/page.tsx              the page
app/globals.css           all styles
app/api/top-tracks/       Spotify top tracks endpoint
lib/content.ts            every piece of text on the site
lib/lightshow.ts          WebGL light-show shader
lib/music.ts              audio engine and setlist
public/synth-worker.js    the synthesiser that renders the tracks
components/               nav, hero, sleeves, player, on-repeat list
```

To update the site's text, edit `lib/content.ts`.
