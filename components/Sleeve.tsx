import { PAINTINGS } from "@/lib/paintings";

/** A night painting for a project, slowly drifting and fading into the sky behind the page. */
export default function Sleeve({ id, title }: { id: string; cat?: string; year?: string; title: string }) {
  const p = PAINTINGS[id];
  if (!p) return null;
  return (
    <div className="sleeve">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src} alt={`${p.title} by ${p.artist} (${p.year}), shown with ${title}`} title={`${p.title}, ${p.artist}, ${p.year}`}
        loading="lazy" decoding="async" style={{ objectPosition: p.focus }} />
    </div>
  );
}
