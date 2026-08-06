"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/repeatafterme/sw.js", { scope: "/repeatafterme/" }).catch(() => {
        // best-effort — a failed SW registration shouldn't block the app
      });
    }
  }, []);
  return null;
}
