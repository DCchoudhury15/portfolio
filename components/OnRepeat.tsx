"use client";

import { useEffect, useState } from "react";
import { onRepeatFallback, type Track } from "@/lib/content";

/** The quiet "On repeat this month" list. Shows the last known songs at once,
 *  then swaps in the live top 5 from Spotify via /api/top-tracks. */
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
      {tracks.map((t) => (
        <li key={t.url}>
          <a href={t.url} target="_blank" rel="noopener">{t.title}</a> <span>{t.artist}</span>
        </li>
      ))}
    </ol>
  );
}
