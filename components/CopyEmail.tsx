"use client";

import { useRef, useState } from "react";

export default function CopyEmail({ email }: { email: string }) {
  const [label, setLabel] = useState("Copy email");
  const ref = useRef<HTMLElement>(null);

  const flash = (text: string) => { setLabel(text); setTimeout(() => setLabel("Copy email"), 1800); };
  const select = () => {
    if (!ref.current) return;
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    flash("Selected, press Ctrl+C");
  };

  return (
    <div className="mail">
      <code ref={ref}>{email}</code>
      <button
        className="btn primary"
        type="button"
        onClick={() => {
          try { navigator.clipboard.writeText(email).then(() => flash("Copied"), select); } catch { select(); }
        }}
      >
        {label}
      </button>
    </div>
  );
}
