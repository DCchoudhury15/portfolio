"use client";

import { music } from "@/lib/music";
import { rememberSound, useMusic } from "./useMusic";

/** The hero's "Play the record" button. */
export default function PlayButton() {
  const { playing } = useMusic();
  return (
    <button
      className="btn primary"
      type="button"
      data-play
      onClick={(e) => { e.stopPropagation(); rememberSound(!playing); music.toggle(); }}
    >
      {playing ? (
        <span className="bars" aria-hidden="true"><i /><i /><i /></span>
      ) : (
        <span className="tri" aria-hidden="true" />
      )}
      {playing ? "Pause the record" : "Play the record"}
    </button>
  );
}
