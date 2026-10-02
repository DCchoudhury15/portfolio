"use client";

import { useSyncExternalStore } from "react";
import { music, type MusicState } from "@/lib/music";

const SERVER_STATE: MusicState = { playing: false, index: 0, status: null };

export function useMusic() {
  return useSyncExternalStore(music.subscribe, music.getState, () => SERVER_STATE);
}

export function rememberSound(on: boolean) {
  try { localStorage.setItem("dc-sound", on ? "on" : "off"); } catch {}
}

export function soundWasTurnedOff() {
  try { return localStorage.getItem("dc-sound") === "off"; } catch { return false; }
}
