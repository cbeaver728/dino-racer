import { COLORS, DEFAULT_DINO, PATTERN_COLORS, type DinosaurConfig, type SavedDinosaur } from './dinosaurTypes'

const KEY = 'dino-lab:saved-dinosaurs'

/** Enough for a full starting grid several times over, without filling storage. */
export const MAX_ROSTER = 12

type Loose = Record<string, unknown>

function migrate(entry: Loose | null): SavedDinosaur | null {
  if (!entry || typeof entry !== 'object') return null
  const config = entry.config as Record<string, string> | undefined
  if (!config) return null

  if (entry.version === 3) return entry as unknown as SavedDinosaur

  // v2 only lacked the pattern colour, so keep the rest of the build intact.
  if (entry.version === 2) {
    return {
      ...(entry as unknown as SavedDinosaur),
      version: 3,
      config: { ...DEFAULT_DINO, ...(config as unknown as DinosaurConfig), patternColor: DEFAULT_DINO.patternColor },
    }
  }

  return {
    version: 3,
    id: (entry.id as string) || crypto.randomUUID(),
    createdAt: (entry.createdAt as string) || new Date().toISOString(),
    config: {
      ...DEFAULT_DINO,
      name: config.name || DEFAULT_DINO.name,
      head: config.head === 'Long Snout' ? 'Parasaurolophus' : config.head === 'Little Head' ? 'Raptor' : 'T-Rex',
      body: config.body === 'Small' || config.body === 'Big' ? config.body : 'Medium',
      frontLimbs: 'Normal Front Legs',
      hindLegs: config.legs === 'Short' || config.legs === 'Long' ? config.legs : 'Normal',
      tail: config.tail === 'Short' ? 'Stubby Tail' : config.tail === 'Giant' ? 'Giant Tail' : 'Long Tail',
      feature: config.feature === 'Spikes' ? 'Back Spikes' : config.feature === 'Horns' || config.feature === 'Plates' ? config.feature : 'None',
      color: COLORS.includes(config.color as typeof COLORS[number]) ? config.color as typeof COLORS[number] : DEFAULT_DINO.color,
      skin: config.pattern === 'Spots' ? 'Spotted' : config.pattern === 'Stripes' ? 'Striped' : 'Plain',
      patternColor: PATTERN_COLORS[0],
    },
  }
}

/** Every saved dinosaur, newest first. */
export function loadRoster(): SavedDinosaur[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => migrate(entry as Loose))
      .filter((entry): entry is SavedDinosaur => entry !== null)
      .slice(0, MAX_ROSTER)
  } catch {
    return []
  }
}

function writeRoster(roster: SavedDinosaur[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(roster.slice(0, MAX_ROSTER)))
  } catch {
    // A full or unavailable store should never take down the builder.
  }
}

/** Adds to the roster rather than replacing it, so a stable can be raced. */
export function saveDinosaur(config: DinosaurConfig): SavedDinosaur {
  const saved: SavedDinosaur = {
    version: 3,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    config,
  }
  writeRoster([saved, ...loadRoster()])
  return saved
}

export function deleteDinosaur(id: string) {
  writeRoster(loadRoster().filter((entry) => entry.id !== id))
}

/** The most recently saved dinosaur, used for the builder's welcome-back card. */
export function loadDinosaur(): SavedDinosaur | null {
  return loadRoster()[0] ?? null
}
