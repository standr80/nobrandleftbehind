/**
 * Repair Windows-1252 UTF-8 mojibake using targeted pattern replacement.
 *
 * Happens when UTF-8 multi-byte sequences are stored/decoded as Windows-1252
 * characters, e.g. the em dash — (bytes E2 80 94) becomes â€" because:
 *   byte E2 → â  (U+00E2, Latin-1)
 *   byte 80 → €  (U+20AC, W1252 special)
 *   byte 94 → "  (U+201D, W1252 special — right double quote)
 *
 * Each pattern is the exact Unicode sequence produced by that misreading,
 * replaced with the correct character. Unaffected text is left untouched.
 *
 * Safe to import in both server and client components — no Node.js dependencies.
 */
export function repairMojibake(str: string): string {
  return str
    // ── Typographic dashes ──────────────────────────────────────────────────
    // em dash — [E2 80 94]:  â + € + " (U+201D right double quote)
    .replace(/\u00E2\u20AC\u201D/g, '\u2014')
    // en dash – [E2 80 93]:  â + € + " (U+201C left double quote)
    .replace(/\u00E2\u20AC\u201C/g, '\u2013')
    // ── Smart quotes ────────────────────────────────────────────────────────
    // left single quote ' [E2 80 98]:  â + € + ˜ (U+02DC small tilde)
    .replace(/\u00E2\u20AC\u02DC/g, '\u2018')
    // right single quote / apostrophe ' [E2 80 99]:  â + € + ™ (U+2122 trademark)
    .replace(/\u00E2\u20AC\u2122/g, '\u2019')
    // left double quote " [E2 80 9C]:  â + € + œ (U+0153)
    .replace(/\u00E2\u20AC\u0153/g, '\u201C')
    // right double quote " [E2 80 9D]:  â + € + (U+009D control char)
    .replace(/\u00E2\u20AC\u009D/g, '\u201D')
    // ── Other common typographic chars ──────────────────────────────────────
    // ellipsis … [E2 80 A6]:  â + € + ¦ (U+00A6 broken bar)
    .replace(/\u00E2\u20AC\u00A6/g, '\u2026')
    // bullet • [E2 80 A2]:  â + € + ¢ (U+00A2 cent sign)
    .replace(/\u00E2\u20AC\u00A2/g, '\u2022')
    // ── Accented Latin letters (C3 xx sequences) ────────────────────────────
    // é [C3 A9]:  Ã + © (U+00A9)
    .replace(/\u00C3\u00A9/g, '\u00E9')
    // è [C3 A8]:  Ã + ¨ (U+00A8)
    .replace(/\u00C3\u00A8/g, '\u00E8')
    // ê [C3 AA]:  Ã + ª (U+00AA)
    .replace(/\u00C3\u00AA/g, '\u00EA')
    // ë [C3 AB]:  Ã + « (U+00AB)
    .replace(/\u00C3\u00AB/g, '\u00EB')
    // à [C3 A0]:  Ã + (U+00A0 non-breaking space)
    .replace(/\u00C3\u00A0/g, '\u00E0')
    // á [C3 A1]:  Ã + ¡ (U+00A1)
    .replace(/\u00C3\u00A1/g, '\u00E1')
    // â [C3 A2]:  Ã + ¢ (U+00A2)
    .replace(/\u00C3\u00A2/g, '\u00E2')
    // ä [C3 A4]:  Ã + ¤ (U+00A4)
    .replace(/\u00C3\u00A4/g, '\u00E4')
    // ç [C3 A7]:  Ã + § (U+00A7)
    .replace(/\u00C3\u00A7/g, '\u00E7')
    // í [C3 AD]:  Ã + ­ (U+00AD soft hyphen)
    .replace(/\u00C3\u00AD/g, '\u00ED')
    // î [C3 AE]:  Ã + ® (U+00AE)
    .replace(/\u00C3\u00AE/g, '\u00EE')
    // ñ [C3 B1]:  Ã + ± (U+00B1)
    .replace(/\u00C3\u00B1/g, '\u00F1')
    // ó [C3 B3]:  Ã + ³ (U+00B3)
    .replace(/\u00C3\u00B3/g, '\u00F3')
    // ô [C3 B4]:  Ã + ´ (U+00B4)
    .replace(/\u00C3\u00B4/g, '\u00F4')
    // ö [C3 B6]:  Ã + ¶ (U+00B6)
    .replace(/\u00C3\u00B6/g, '\u00F6')
    // ú [C3 BA]:  Ã + º (U+00BA)
    .replace(/\u00C3\u00BA/g, '\u00FA')
    // ü [C3 BC]:  Ã + ¼ (U+00BC)
    .replace(/\u00C3\u00BC/g, '\u00FC')
    // ── C2 xx sequences ─────────────────────────────────────────────────────
    .replace(/\u00C2\u00A3/g, '\u00A3')  // £
    .replace(/\u00C2\u00A9/g, '\u00A9')  // ©
    .replace(/\u00C2\u00AE/g, '\u00AE')  // ®
    .replace(/\u00C2\u00B0/g, '\u00B0')  // °
    .replace(/\u00C2\u00B1/g, '\u00B1')  // ±
    .replace(/\u00C2\u00B2/g, '\u00B2')  // ²
    .replace(/\u00C2\u00B3/g, '\u00B3')  // ³
    .replace(/\u00C2\u00BD/g, '\u00BD')  // ½
    .replace(/\u00C2\u00A0/g, '\u00A0')  // non-breaking space
}
