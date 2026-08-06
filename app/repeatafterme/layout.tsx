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
    icon: "/repeatafterme/icon-192.png",
    apple: "/repeatafterme/apple-touch-icon.png",
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
