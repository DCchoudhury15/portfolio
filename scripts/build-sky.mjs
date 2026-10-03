// Computes the night sky over Jabalpur at 9:00 pm IST on 15 May 2005 and writes lib/sky.json.
// Stars and constellation lines come from d3-celestial (BSD licence, Olaf Frohn); positions of the
// Moon and planets come from astronomy-engine. Run once with: node scripts/build-sky.mjs

import * as Astronomy from "astronomy-engine";
import { writeFileSync } from "node:fs";

const PLACE = { name: "Jabalpur", lat: 23.1815, lon: 79.9864, elevation: 411 };
const WHEN = new Date("2005-05-15T21:00:00+05:30");
const MAX_MAG = 5.8; // a little brighter than the naked-eye limit, so the background stays calm
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
const [stars, lines, names] = await Promise.all([get("stars.6.json"), get("constellations.lines.json"), get("constellations.json")]);

// [azimuth, altitude, magnitude, B-V colour index], only stars above the horizon.
const starList = [];
for (const f of stars.features) {
  const mag = f.properties.mag;
  if (mag > MAX_MAG) continue;
  const [az, alt] = horizon(...f.geometry.coordinates);
  if (alt < -2) continue;
  starList.push([az, alt, round(mag, 1), round(parseFloat(f.properties.bv) || 0.6, 2)]);
}

// Constellation stick figures as [az, alt] polylines; drop any line fully below the horizon.
const lineList = [];
for (const f of lines.features) {
  for (const path of f.geometry.coordinates) {
    const pts = path.map(([lon, dec]) => horizon(lon, dec));
    if (pts.some(([, alt]) => alt > 0)) lineList.push(pts);
  }
}

// Constellation names at their label positions, if above the horizon.
const labelList = [];
for (const f of names.features) {
  const [az, alt] = horizon(...f.geometry.coordinates);
  if (alt > 8 && f.properties.rank === "1") labelList.push([az, alt, f.properties.en || f.properties.name]);
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
  stars: starList,
  lines: lineList,
  labels: labelList,
  bodies: [...bodies.filter((b) => b.alt > -2), sun],
  moon: { phase: moonPhase, lit: moonLit },
};
writeFileSync(new URL("../lib/sky.json", import.meta.url), JSON.stringify(out));
console.log(`${starList.length} stars, ${lineList.length} constellation lines, ${labelList.length} labels above the horizon`);
console.log("Moon and planets:", bodies.map((b) => `${b.name} alt ${b.alt}° az ${b.az}° mag ${b.mag}`).join("; "));
console.log(`Sun alt ${sun.alt}° az ${sun.az}°`);
console.log(`Moon phase angle ${moonPhase}°, ${Math.round(moonLit * 100)}% lit`);
