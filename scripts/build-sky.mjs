// Computes the night sky over Jabalpur at 9:00 pm IST on 15 May 2005 and writes lib/sky.json.
// Stars come from d3-celestial (BSD licence, Olaf Frohn); positions of the Moon and planets, and the
// sidereal time used to place the Milky Way, come from astronomy-engine.
// Run once with: node scripts/build-sky.mjs

import * as Astronomy from "astronomy-engine";
import { writeFileSync } from "node:fs";

const PLACE = { name: "Jabalpur", lat: 23.1815, lon: 79.9864, elevation: 411 };
const WHEN = new Date("2005-05-15T21:00:00+05:30");
const MAX_MAG = 6.5; // the naked-eye limit under a dark sky
const DATA = "https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data";

const observer = new Astronomy.Observer(PLACE.lat, PLACE.lon, PLACE.elevation);
const time = Astronomy.MakeTime(WHEN);
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// d3-celestial stores RA as longitude in degrees from -180 to 180.
const horizon = (lonDeg, decDeg) => {
  const raHours = ((lonDeg + 360) % 360) / 15;
  const h = Astronomy.Horizon(time, observer, raHours, decDeg, "normal");
  return [round(h.azimuth), round(h.altitude)];
};

const get = async (f) => (await fetch(`${DATA}/${f}`)).json();
const stars = await get("stars.6.json");

// [azimuth, altitude, magnitude, B-V colour index] at that moment. Stars below the horizon are kept
// too, because the sky turns on the page and they rise later; only those that never rise are left out.
const starList = [];
for (const f of stars.features) {
  const mag = f.properties.mag;
  if (mag > MAX_MAG) continue;
  if (f.geometry.coordinates[1] < PLACE.lat - 92) continue;
  const [az, alt] = horizon(...f.geometry.coordinates);
  starList.push([az, alt, round(mag, 1), round(parseFloat(f.properties.bv) || 0.6, 2)]);
}

// Moon and naked-eye planets.
const bodies = [];
for (const body of ["Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
  const eq = Astronomy.Equator(body, time, observer, true, true);
  const h = Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal");
  const mag = Astronomy.Illumination(body, time).mag;
  bodies.push({ name: body, az: round(h.azimuth), alt: round(h.altitude), mag: round(mag, 1) });
}
// The Sun is below the horizon, but its direction tells us which side of the Moon is lit.
const sunEq = Astronomy.Equator("Sun", time, observer, true, true);
const sunHor = Astronomy.Horizon(time, observer, sunEq.ra, sunEq.dec, "normal");
const sun = { name: "Sun", az: round(sunHor.azimuth), alt: round(sunHor.altitude), mag: -26.7 };
const moonPhase = round(Astronomy.MoonPhase(time), 1); // 0 new, 90 first quarter, 180 full, 270 last quarter
const moonLit = round(Astronomy.Illumination("Moon", time).phase_fraction, 3);

const out = {
  place: PLACE.name,
  when: WHEN.toISOString(),
  lat: PLACE.lat,
  // Local sidereal time in degrees: with the latitude, enough to place the Milky Way.
  lst: round(((Astronomy.SiderealTime(time) + PLACE.lon / 15) % 24) * 15, 3),
  stars: starList,
  bodies: [...bodies, sun],
  moon: { phase: moonPhase, lit: moonLit },
};
writeFileSync(new URL("../lib/sky.json", import.meta.url), JSON.stringify(out));
console.log(`${starList.length} stars that rise over Jabalpur, LST ${out.lst} deg`);
console.log("Moon and planets:", bodies.map((b) => `${b.name} alt ${b.alt}° az ${b.az}° mag ${b.mag}`).join("; "));
console.log(`Sun alt ${sun.alt}° az ${sun.az}°`);
console.log(`Moon phase angle ${moonPhase}°, ${Math.round(moonLit * 100)}% lit`);
