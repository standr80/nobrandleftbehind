"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getStrings } from "@/lib/repeatafterme/i18n";
import type { LangCode } from "@/lib/repeatafterme/langs";
import { loadIntroDismissed, saveIntroDismissed, type IntroId } from "@/lib/repeatafterme/introSettings";

/** The "what this page is for" note that sits above each area's controls. Dismissible,
 *  because on the drill page in particular it's read once and then pushes the card
 *  you actually came for down the screen on every subsequent visit. Dismissing leaves
 *  a small ⓘ in its place so the note is always recoverable. */
export default function IntroCard({ id, native, children }: { id: IntroId; native: LangCode; children: ReactNode }) {
  const t = getStrings(native);

  // undefined until the stored preference has been read (it can only be read after
  // mount, since the page is prerendered) — rendering nothing until then is what
  // stops a dismissed note flashing in on every load.
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);

  useEffect(() => setDismissed(loadIntroDismissed(id)), [id]);

  function set(next: boolean) {
    setDismissed(next);
    saveIntroDismissed(id, next);
  }

  if (dismissed === undefined) return null;

  if (dismissed) {
    return (
      <div className="intro-restore">
        <button type="button" className="intro-btn" onClick={() => set(false)} aria-label={t.introShow} title={t.introShow}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 11.2v5" />
            <path d="M12 7.9v.1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="card info-card intro-card">
      <button type="button" className="intro-btn intro-dismiss" onClick={() => set(true)} aria-label={t.introHide} title={t.introHide}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
      {children}
    </div>
  );
}
