import type { Metadata } from "next";
import "./repeatafterme.css";

export const metadata: Metadata = {
  title: "Répétez — French & Spanish Speaking Drill",
  description: "A Michel Thomas / Paul Noble-style speak-along drill for French and Spanish. Free, no account, bring your own AI key.",
};

export default function RepeatAfterMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
