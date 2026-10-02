"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#work", label: "Work" },
  { href: "#experience", label: "Experience" },
  { href: "#rig", label: "Skills" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav${solid ? " solid" : ""}`} aria-label="Main">
      <div className="wrap">
        <a className="mono" href="#top">D<span>·</span>C</a>
        <ul>
          {LINKS.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
        </ul>
      </div>
    </nav>
  );
}
