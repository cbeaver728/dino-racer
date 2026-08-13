import { DEFAULT_DINO, type DinosaurConfig, type SavedDinosaur } from './dinosaurTypes'

/**
 * Opponents that ship with the game.
 *
 * Without these, a child who has saved one dinosaur presses START and watches a
 * parade of one that they cannot lose — which is the first race most players
 * ever see. The grid is filled from this list instead.
 *
 * They are built to be beatable. Each one leans on a different terrain so there
 * is always someone to chase and someone to catch, but none of them stacks the
 * best part in every slot; a thoughtful build from the lab should win.
 */

const rival = (id: string, config: Partial<DinosaurConfig> & { name: string }): SavedDinosaur => ({
  version: 3,
  // Prefixed so it can never collide with a saved dinosaur's uuid, and so the
  // roster can always tell its own entries from these.
  id: `rival:${id}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  config: { ...DEFAULT_DINO, ...config },
})

export const RIVALS: SavedDinosaur[] = [
  rival('bramble', {
    name: 'Bramble',
    head: 'Raptor', body: 'Small', frontLimbs: 'Tiny Arms', hindLegs: 'Normal',
    feet: 'Clawed Feet', tail: 'Long Tail', feature: 'None',
    color: '#66c95a', skin: 'Striped', patternColor: '#1f9d6b',
  }),
  rival('boulder', {
    name: 'Boulder',
    head: 'Triceratops', body: 'Big', frontLimbs: 'Normal Front Legs', hindLegs: 'Short',
    feet: 'Clawed Feet', tail: 'Stubby Tail', feature: 'Horns',
    color: '#a9754a', skin: 'Plain', patternColor: '#2f4858',
  }),
  rival('puddle', {
    name: 'Puddle',
    head: 'Parasaurolophus', body: 'Medium', frontLimbs: 'Short Front Legs', hindLegs: 'Normal',
    feet: 'Webbed Feet', tail: 'Long Tail', feature: 'Plates',
    color: '#4da6ff', skin: 'Spotted', patternColor: '#fff3c4',
  }),
  rival('sunny', {
    name: 'Sunny',
    head: 'Brachiosaurus', body: 'Medium', frontLimbs: 'Long Front Legs', hindLegs: 'Long',
    feet: 'Round Feet', tail: 'Giant Tail', feature: 'None',
    color: '#f2c94c', skin: 'Spotted', patternColor: '#f2994a',
  }),
  rival('zip', {
    name: 'Zip',
    head: 'T-Rex', body: 'Small', frontLimbs: 'Tiny Arms', hindLegs: 'Long',
    feet: 'Clawed Feet', tail: 'Stubby Tail', feature: 'Wings',
    color: '#f27db0', skin: 'Plain', patternColor: '#e0518f',
  }),
]

export const isRival = (id: string) => id.startsWith('rival:')

/**
 * Tops a field up to `size` with rivals, skipping any already in it. Called with
 * the player's own picks first so their dinosaurs always make the grid.
 */
export function fillWithRivals(entries: SavedDinosaur[], size: number): SavedDinosaur[] {
  const taken = new Set(entries.map((entry) => entry.id))
  const field = [...entries]
  for (const contender of RIVALS) {
    if (field.length >= size) break
    if (!taken.has(contender.id)) field.push(contender)
  }
  return field
}
