"use client";

import { useState } from "react";

/** Discord has no public profile link by username, so this copies the username instead. */
export default function CopyDiscord({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      title="Copy Discord username"
      onClick={() => {
        navigator.clipboard?.writeText(username).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }, () => {});
      }}
    >
      Discord · {copied ? "copied" : username}
    </button>
  );
}
