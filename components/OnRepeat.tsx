"use client";

import { useEffect, useState } from "react";
import { onRepeatFallback, type Track } from "@/lib/content";

/** My top 5 Spotify tracks of the last few weeks, with album covers.
 *  Shows the last known list at once, then swaps in the live one from /api/top-tracks. */
export default function OnRepeat() {
  const [tracks, setTracks] = useState<Track[]>(onRepeatFallback);

  useEffect(() => {
    fetch("/api/top-tracks")
      .then((r) => (r.ok ? r.json() : []))
      .then((t: Track[]) => { if (Array.isArray(t) && t.length) setTracks(t); })
      .catch(() => {});
  }, []);

  return (
    <ol className="repeat">
      {tracks.map((t, i) => (
        <li key={t.url}>
          <a href={t.url} target="_blank" rel="noopener" aria-label={`${t.title} by ${t.artist} on Spotify`}>
            <span className="cover">
              {t.art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.art} alt="" loading="lazy" width={300} height={300} />
              ) : null}
              <span className="rank">{i + 1}</span>
            </span>
            <span className="t">{t.title}</span>
            <span className="a">{t.artist}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
