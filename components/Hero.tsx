import LivingPainting from "@/components/LivingPainting";
import { PAINTINGS } from "@/lib/paintings";

/** Van Gogh's Starry Night Over the Rhône, flowing slowly behind the hero and fading into the sky. */
export default function HeroPainting() {
  return <LivingPainting p={PAINTINGS.hero} className="hero-painting" alt="" amp={0.015} eager />;
}
