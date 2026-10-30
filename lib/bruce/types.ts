/** One prize on a Cuddly Toy! belt. */
export interface BeltItem {
  id: string
  name: string
  emoji: string
  /** One line of host patter shown under the belt while the item rides past. */
  patter: string
  /** Exactly one item per belt is the cuddly toy. */
  isCuddlyToy?: boolean
}

/** A decoy shown in the recall grid. Never on the belt. */
export interface Decoy {
  id: string
  name: string
  emoji: string
}

export interface Belt {
  slug: string
  title: string
  description: string
  items: BeltItem[]
  decoys: Decoy[]
}
