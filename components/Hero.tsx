import { PAINTINGS } from "@/lib/paintings";

/** Van Gogh's Starry Night Over the Rhône, drifting slowly behind the hero and fading into the sky. */
export default function HeroPainting() {
  const p = PAINTINGS.hero;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="hero-painting" src={p.src} alt="" aria-hidden="true" fetchPriority="high" style={{ objectPosition: p.focus }} />;
}
