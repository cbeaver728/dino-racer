import type { HeadType } from '../game/dinosaurTypes'

export const TERRAIN_ORDER = ['Marsh', 'Mountains', 'Forest', 'Plains'] as const
export type Terrain = typeof TERRAIN_ORDER[number]

/** Laps in a race. Two gives a comeback somewhere to happen. */
export const LAP_COUNT = 2
/** Local units per second at neutral pace; a lap lands around twenty seconds. */
export const BASE_SPEED = 5

export type RaceDinosaurProfile = {
  head: HeadType
  size: 'Small' | 'Medium' | 'Big'
  legLength: 'Short' | 'Normal' | 'Long'
  footType: 'Round Feet' | 'Clawed Feet' | 'Webbed Feet'
  tailType: 'Stubby Tail' | 'Long Tail' | 'Giant Tail' | 'Spiked Tail'
  stance: 'Biped' | 'Quadruped'
  hasWings: boolean
  /** 1–5, straight off the builder's stats panel. Shrugs off tornadoes. */
  strength: number
  /** 1–5, straight off the builder's stats panel. Holds pace to the finish. */
  stamina: number
}

export type TerrainResult = {
  terrain: Terrain
  pace: number
  note: string
  strengths: string[]
  challenges: string[]
}

export type CourseSection = {
  terrain: Terrain
  distance: number
  color: string
  accent: string
  icon: string
  description: string
}

export const COURSE: CourseSection[] = [
  { terrain: 'Marsh', distance: 25, color: '#467d79', accent: '#9bd27d', icon: '🪷', description: 'Splash through reeds, mud, and shallow water.' },
  { terrain: 'Mountains', distance: 24, color: '#786d8e', accent: '#d6cce2', icon: '⛰️', description: 'Climb rocky switchbacks and balance on ledges.' },
  { terrain: 'Forest', distance: 27, color: '#245d4c', accent: '#8fcf72', icon: '🌲', description: 'Weave between ancient trees and roots.' },
  { terrain: 'Plains', distance: 24, color: '#cda84d', accent: '#fff0a6', icon: '🌾', description: 'Sprint across open grass toward the finish.' },
]

export const DEMO_DINO: RaceDinosaurProfile = {
  head: 'Raptor',
  size: 'Medium',
  legLength: 'Normal',
  footType: 'Clawed Feet',
  tailType: 'Long Tail',
  stance: 'Biped',
  hasWings: false,
  strength: 3,
  stamina: 3,
}
