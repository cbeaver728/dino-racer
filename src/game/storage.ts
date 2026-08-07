import { COLORS, DEFAULT_DINO, type DinosaurConfig, type SavedDinosaur } from './dinosaurTypes'

const KEY = 'dino-lab:saved-dinosaurs'

export function saveDinosaur(config: DinosaurConfig) {
  const saved: SavedDinosaur = {
    version: 2,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    config,
  }
  localStorage.setItem(KEY, JSON.stringify([saved]))
  return saved
}

export function loadDinosaur(): SavedDinosaur | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]')[0]
    if (!saved?.config) return null
    if (saved.version === 2) return saved as SavedDinosaur

    const old = saved.config as Record<string, string>
    return {
      version: 2,
      id: saved.id || crypto.randomUUID(),
      createdAt: saved.createdAt || new Date().toISOString(),
      config: {
        ...DEFAULT_DINO,
        name: old.name || DEFAULT_DINO.name,
        head: old.head === 'Long Snout' ? 'Parasaurolophus' : old.head === 'Little Head' ? 'Raptor' : 'T-Rex',
        body: old.body === 'Small' || old.body === 'Big' ? old.body : 'Medium',
        frontLimbs: 'Normal Front Legs',
        hindLegs: old.legs === 'Short' || old.legs === 'Long' ? old.legs : 'Normal',
        tail: old.tail === 'Short' ? 'Stubby Tail' : old.tail === 'Giant' ? 'Giant Tail' : 'Long Tail',
        feature: old.feature === 'Spikes' ? 'Back Spikes' : old.feature === 'Horns' || old.feature === 'Plates' ? old.feature : 'None',
        color: COLORS.includes(old.color as typeof COLORS[number]) ? old.color as typeof COLORS[number] : DEFAULT_DINO.color,
        skin: old.pattern === 'Spots' ? 'Spotted' : old.pattern === 'Stripes' ? 'Striped' : 'Plain',
      },
    }
  } catch {
    return null
  }
}
