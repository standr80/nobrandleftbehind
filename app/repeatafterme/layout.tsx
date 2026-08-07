import type { Metadata, Viewport } from "next";
import "./repeatafterme.css";
import RegisterSW from "@/components/repeatafterme/RegisterSW";

export const viewport: Viewport = {
  themeColor: "#16213E",
};

export const metadata: Metadata = {
  title: "Répétez — Speak-Along Language Drill",
  description: "A Michel Thomas / Paul Noble-style speak-along drill across English, French and Spanish. Free, no account, bring your own AI key.",
  manifest: "/repeatafterme/manifest.webmanifest",
  icons: {
    // Explicit sizes/type so this clearly outranks the platform's own site-wide
    // app/favicon.ico (a 16x16 .ico, auto-injected on every route by Next.js's
    // root-level special-file convention — it can't be suppressed from here, only
    // out-prioritised with a more specific declaration).
    icon: [
      // Safari 17+ specifically prefers an SVG favicon when one's declared — listed
      // first since browsers generally take the first icon link that matches what
      // they support.
      { url: "/repeatafterme/icon-source.svg", type: "image/svg+xml" },
      { url: "/repeatafterme/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/repeatafterme/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/repeatafterme/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Répétez",
    statusBarStyle: "default",
  },
};

export default function RepeatAfterMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <RegisterSW />
      {children}
    </>
  );
}
