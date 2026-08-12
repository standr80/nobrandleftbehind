import type { LibraryDeckMeta } from "./libraryData";

// Groups a flat list of library decks into a taxonomy tree for browsing, by splitting
// each deck's " > "-separated label into path segments. A node can be both a group
// (has children) and a deck in its own right — some merged decks sit at a level that
// other, more finely-split decks also nest under (e.g. "Topic 3: Education and work"
// is itself a 22-word deck, and also the parent of "... > Higher tier > Verbs" etc.).
export interface LibraryTreeNode {
  name: string;
  path: string;
  total: number;
  children: LibraryTreeNode[];
  deck?: LibraryDeckMeta;
}

export function buildLibraryTree(decks: LibraryDeckMeta[]): LibraryTreeNode[] {
  const root: LibraryTreeNode[] = [];

  for (const deck of decks) {
    const segments = deck.label.split(">").map((s) => s.trim());
    let level = root;
    let pathSoFar = "";
    segments.forEach((seg, i) => {
      pathSoFar = pathSoFar ? `${pathSoFar} > ${seg}` : seg;
      let node = level.find((n) => n.name === seg);
      if (!node) {
        node = { name: seg, path: pathSoFar, total: 0, children: [] };
        level.push(node);
      }
      if (i === segments.length - 1) node.deck = deck;
      level = node.children;
    });
  }

  addTotals(root);
  return root;
}

function addTotals(nodes: LibraryTreeNode[]): number {
  let sum = 0;
  for (const node of nodes) {
    let total = node.deck ? node.deck.pairs.length : 0;
    total += addTotals(node.children);
    node.total = total;
    sum += total;
  }
  return sum;
}
