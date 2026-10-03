# divyanshu choudhury · portfolio

My personal site, built as a late-night record label: projects are LP sleeves and open-source work
is the tour.

- **Light show.** The hero and every album sleeve are painted live by a WebGL shader in the style of
  1960s oil-projector light shows.
- **Listening.** A small closing section shows my top 5 Spotify artists of the last ~4 weeks, refreshed hourly.
- **Night sky.** The page background is the real sky over Jabalpur at 9 pm on the night I was born,
  looking south-east where the Milky Way was rising: every naked-eye star in its true position and
  colour, thousands of fainter ones, the Milky Way with its dust lanes, and Jupiter. Scrolling tilts the
  view down to the horizon, and the pointer or a tilted phone moves it a little.
  `scripts/build-sky.mjs` computes the positions once into `lib/sky.json`.

Built with Next.js, React and TypeScript. No UI framework, no tracking.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Live Spotify list (optional)

Without these variables the site shows a built-in list of artists. To make it follow your real listening:

1. Create an app at <https://developer.spotify.com/dashboard>, tick **Web API**, and set the redirect URI
   to `http://127.0.0.1:8888/callback` (Spotify no longer accepts `localhost`).
2. Get a refresh token once:
   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node scripts/spotify-refresh-token.mjs
   ```
3. Put the three values in `.env.local` (see `.env.example`) and in your host's environment variables.

Spotify recalculates top artists about once a day over a rolling ~4 weeks; `/api/top-artists` caches for an
hour. Secrets stay on the server.

To just print your current top 5 artists in the terminal: `node scripts/top-artists.mjs` with the same
two variables (add `medium_term` or `long_term` for longer ranges).

## Layout

```
app/page.tsx              the page
app/globals.css           all styles
app/api/top-artists/      Spotify top artists endpoint
lib/content.ts            every piece of text on the site
lib/lightshow.ts          WebGL light-show shader
lib/sky.json              precomputed birth-night sky (scripts/build-sky.mjs)
components/               nav, hero, sleeves, night sky, top artists
```

To update the site's text, edit `lib/content.ts`.

## Credits

Star positions, colours and constellation lines: [d3-celestial](https://github.com/ofrohn/d3-celestial)
data, Copyright (c) 2015 Olaf Frohn, BSD 3-Clause licence. Moon and planet positions:
[astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT).
