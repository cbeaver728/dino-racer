import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * Lane units per second the player slides while holding a steer control. Tuned
 * against the width of a star: crossing the road takes a bit over a second, so
 * a star spotted ahead is reachable but never free.
 */
export const STEER_SPEED = 1.75

/**
 * How far off the centre line the player may drive. Inside `ROAD_HALF_WIDTH`
 * so a dinosaur at full lock still has all four feet on the track, and wide
 * enough to reach a pickup at its own outermost spawn of 0.92.
 */
export const STEER_LIMIT = 1.08

export type SteerDirection = -1 | 1

export interface Steering {
  /** -1, 0 or 1. Read by the frame loop; never triggers a render. */
  input: RefObject<number>
  press: (direction: SteerDirection) => void
  release: (direction: SteerDirection) => void
}

/**
 * Hold-to-steer input for the driven dinosaur.
 *
 * Held rather than tapped, because a lane you commit to is a lane you can hold
 * against a tornado. Keys and touch feed the same ref, and every held source is
 * counted, so releasing the left key while the right pad is still down keeps
 * steering right instead of stopping dead.
 */
export function usePlayerSteering(active: boolean): Steering {
  const input = useRef(0)
  const held = useRef(new Set<string>())

  const apply = useCallback(() => {
    let direction = 0
    for (const source of held.current) direction += source.endsWith('right') ? 1 : -1
    input.current = Math.sign(direction)
  }, [])

  const press = useCallback((direction: SteerDirection) => {
    held.current.add(direction > 0 ? 'pad:right' : 'pad:left')
    apply()
  }, [apply])

  const release = useCallback((direction: SteerDirection) => {
    held.current.delete(direction > 0 ? 'pad:right' : 'pad:left')
    apply()
  }, [apply])

  useEffect(() => {
    if (!active) {
      held.current.clear()
      input.current = 0
      return
    }

    const sourceOf = (key: string) => {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'key:left'
      if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'key:right'
      return null
    }

    const down = (event: KeyboardEvent) => {
      const source = sourceOf(event.key)
      if (!source) return
      event.preventDefault()
      held.current.add(source)
      apply()
    }
    const up = (event: KeyboardEvent) => {
      const source = sourceOf(event.key)
      if (!source) return
      held.current.delete(source)
      apply()
    }
    // A tab switch swallows the keyup, which would otherwise leave the dinosaur
    // steering into the weeds until the key is pressed and released again.
    const blur = () => { held.current.clear(); apply() }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      held.current.clear()
      input.current = 0
    }
  }, [active, apply])

  return { input, press, release }
}
