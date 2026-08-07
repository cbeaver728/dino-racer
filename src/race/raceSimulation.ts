import type { RaceDinosaurProfile, Terrain, TerrainResult } from './raceTypes'

const clamp = (value: number) => Math.max(0.55, Math.min(1.55, value))

export function evaluateTerrain(profile: RaceDinosaurProfile, terrain: Terrain): TerrainResult {
  let pace = 1
  const strengths: string[] = []
  const challenges: string[] = []
  const add = (amount: number, message: string) => { pace += amount; strengths.push(message) }
  const subtract = (amount: number, message: string) => { pace -= amount; challenges.push(message) }

  if (terrain === 'Marsh') {
    if (profile.footType === 'Webbed Feet') add(.28, 'Webbed feet paddle through water')
    else if (profile.footType === 'Clawed Feet') add(.08, 'Claws grip slippery mud')
    if (profile.size === 'Big') subtract(.18, 'A big body sinks into mud')
    if (profile.stance === 'Quadruped') add(.08, 'Four feet spread the weight')
  }
  if (terrain === 'Mountains') {
    if (profile.tailType === 'Long Tail' || profile.tailType === 'Giant Tail') add(.18, 'Long tail improves balance')
    if (profile.footType === 'Clawed Feet') add(.16, 'Claws grip the rocks')
    if (profile.legLength === 'Long') subtract(.1, 'Long legs wobble on ledges')
    if (profile.size === 'Big') subtract(.08, 'Large body slows climbing')
  }
  if (terrain === 'Forest') {
    if (profile.size === 'Small') add(.2, 'Small body slips between trees')
    if (profile.stance === 'Biped') add(.08, 'Two legs pivot quickly')
    if (profile.size === 'Big') subtract(.16, 'Big body bumps branches')
    if (profile.tailType === 'Giant Tail') subtract(.1, 'Giant tail catches on roots')
  }
  if (terrain === 'Plains') {
    if (profile.legLength === 'Long') add(.25, 'Long legs open up a sprint')
    if (profile.stance === 'Biped') add(.1, 'Biped stride is fast in open space')
    if (profile.hasWings) add(.07, 'Wings help catch the breeze')
    if (profile.size === 'Big') subtract(.08, 'Large body takes more effort to sprint')
    if (profile.legLength === 'Short') subtract(.15, 'Short legs lose ground on the straightaway')
  }

  return {
    terrain,
    pace: clamp(pace),
    note: strengths[0] || challenges[0] || 'A steady all-round terrain.',
    strengths,
    challenges,
  }
}

export function estimateRaceTime(profile: RaceDinosaurProfile) {
  const sections: Terrain[] = ['Marsh', 'Mountains', 'Forest', 'Plains']
  return sections.reduce((time, terrain) => time + 25 / evaluateTerrain(profile, terrain).pace, 0)
}
