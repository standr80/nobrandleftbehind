"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStrings } from "@/lib/repeatafterme/i18n";
import type { LangCode } from "@/lib/repeatafterme/langs";

/** The app's three core areas, as one prominent tab bar sitting directly under the
 *  header on every /repeatafterme page. Replaces the old arrangement — two small
 *  header links out of the drill page and a "← Back to drills" link back — which
 *  gave no sense of the three areas being peers. Labels stay fixed across pages so
 *  the bar reads as navigation, not as page content. */

const ICONS: Record<string, ReactNode> = {
  repetez: (
    <path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 15H9l-4.5 4.5z" />
  ),
  ecoutez: (
    <>
      <path d="M4 14.5v-2.5a8 8 0 0 1 16 0v2.5" />
      <path d="M4.5 13.5h3v6h-2a1 1 0 0 1-1-1z" />
      <path d="M19.5 13.5h-3v6h2a1 1 0 0 0 1-1z" />
    </>
  ),
  library: (
    <>
      <rect x="3.5" y="8.5" width="12" height="11" rx="2" />
      <path d="M7.5 8.5v-2a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </>
  ),
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function AppNav({ native }: { native: LangCode }) {
  const t = getStrings(native);
  const pathname = usePathname();

  const tabs = [
    { href: "/repeatafterme", icon: "repetez", label: t.repetezNavLink, hint: t.repetezNavHint },
    { href: "/repeatafterme/ecoutez", icon: "ecoutez", label: t.ecoutezNavLink, hint: t.ecoutezNavHint },
    { href: "/repeatafterme/library", icon: "library", label: t.libraryNavLink, hint: t.libraryNavHint },
  ];

  return (
    <nav className="app-nav" aria-label={t.navLabel}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={"app-tab" + (active ? " on" : "")}
            aria-current={active ? "page" : undefined}
          >
            <TabIcon name={tab.icon} />
            <span className="app-tab-label">{tab.label}</span>
            <span className="app-tab-hint">{tab.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
