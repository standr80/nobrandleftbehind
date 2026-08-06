import type { Pair } from "./langs";

// Ported verbatim from repetez.html's parseLines/download logic.
export function parseLines(text: string): Pair[] {
  const rows: Pair[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let parts: string[];
    if (line.includes("\t")) parts = line.split("\t");
    else if (line.includes(";")) parts = line.split(";");
    else {
      const i = line.indexOf(",");
      if (i < 0) continue;
      parts = [line.slice(0, i), line.slice(i + 1)];
    }
    const en = parts[0].trim().replace(/^"|"$/g, "");
    const fr = (parts[1] || "").trim().replace(/^"|"$/g, "");
    if (en.toLowerCase() === "english" || en.toLowerCase() === "en") continue; // header row
    if (en && fr) rows.push([en, fr]);
  }
  return rows;
}

export function deckToCsv(deck: Pair[]): string {
  return deck.map(([e, f]) => '"' + e.replace(/"/g, '""') + '","' + f.replace(/"/g, '""') + '"').join("\n");
}
