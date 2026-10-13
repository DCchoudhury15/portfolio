import LivingPainting from "@/components/LivingPainting";
import { PAINTINGS } from "@/lib/paintings";

/** A night painting for a project, flowing slowly and fading into the sky behind the page. */
export default function Sleeve({ id, title }: { id: string; cat?: string; year?: string; title: string }) {
  const p = PAINTINGS[id];
  if (!p) return null;
  return (
    <div className="sleeve">
      <LivingPainting p={p} alt={`${p.title} by ${p.artist} (${p.year}), shown with ${title}`} />
    </div>
  );
}
