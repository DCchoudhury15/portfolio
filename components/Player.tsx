"use client";

import { useEffect, useState } from "react";
import { music, TRACKS } from "@/lib/music";
import { rememberSound, soundWasTurnedOff, useMusic } from "./useMusic";

/** The docked player. Browsers only allow sound after a click, so the band starts on the
 *  visitor's first click anywhere on the page, unless they switched it off last time. */
export default function Player() {
  const { playing, index, status } = useMusic();
  const [volume, setVolume] = useState(0.8);
  const track = TRACKS[index];

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 800));
    idle(() => music.warm(0));
    if (soundWasTurnedOff()) return;
    const first = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest("[data-play], .vol, .skip")) return;
      if (!music.state.playing) music.play();
    };
    document.addEventListener("pointerdown", first, { once: true, capture: true });
    return () => document.removeEventListener("pointerdown", first, { capture: true });
  }, []);

  return (
    <div className={`player${playing ? " is-playing" : ""}`} role="region" aria-label="Music player">
      <div className="disc" aria-hidden="true" />
      <div className="ptxt">
        <b>{track.title}</b>
        <span>{status ?? `In the spirit of ${track.style} · ${index + 1} of ${TRACKS.length}`}</span>
      </div>
      <input
        className="vol"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        aria-label="Volume"
        onChange={(e) => { const v = +e.target.value; setVolume(v); music.setVolume(v); }}
      />
      <div className="pctl">
        <button className="skip" type="button" aria-label="Previous track" onClick={(e) => { e.stopPropagation(); music.go(-1); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" /></svg>
        </button>
        <button
          className="pbtn"
          type="button"
          data-play
          aria-label={playing ? "Pause music" : "Play music"}
          onClick={(e) => { e.stopPropagation(); rememberSound(!playing); music.toggle(); }}
        >
          {playing ? <span className="pause" aria-hidden="true" /> : <span className="tri" aria-hidden="true" />}
        </button>
        <button className="skip" type="button" aria-label="Next track" onClick={(e) => { e.stopPropagation(); music.go(1); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor" /></svg>
        </button>
      </div>
    </div>
  );
}
