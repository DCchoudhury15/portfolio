"use client";

import { useEffect, useState } from "react";
import { topArtistsFallback, type Artist } from "@/lib/content";

/** My top 5 Spotify artists of the last few weeks.
 *  Shows the last known list at once, then swaps in the live one from /api/top-artists. */
export default function TopArtists() {
  const [artists, setArtists] = useState<Artist[]>(topArtistsFallback);

  useEffect(() => {
    fetch("/api/top-artists")
      .then((r) => (r.ok ? r.json() : []))
      .then((a: Artist[]) => { if (Array.isArray(a) && a.length) setArtists(a); })
      .catch(() => {});
  }, []);

  return (
    <ol className="repeat artists">
      {artists.map((a, i) => (
        <li key={a.url}>
          <a href={a.url} target="_blank" rel="noopener" aria-label={`${a.name} on Spotify`}>
            <span className="cover">
              {a.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.art} alt="" loading="lazy" width={300} height={300} />
              ) : null}
            </span>
            <span className="t"><span className="n">{i + 1}</span>{a.name}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
